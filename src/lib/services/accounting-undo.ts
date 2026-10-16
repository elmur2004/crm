import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { refuse } from "@/lib/accounting/undo-reasons";
import type { Prisma } from "../../../generated/prisma/client";
import { writeLog, type Actor } from "./activity";
import { ACCT_KIND_PREFIX, UNDO_WINDOW_MS } from "./undo";
import {
  ACCT_EXPENSE_TYPE_LABELS,
  ACCT_INCOME_TYPE_LABELS,
  type AcctCompany,
  type AcctExpenseType,
  type AcctIncomeType,
} from "@/lib/accounting/constants";
import type { LogEntityType } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ACCOUNTING UNDO / REDO (ADR-086) — founder: "add an undo and redo button for
   the accounting system", then, asked to choose: ONE STEP (Undo reverses your
   last accounting action, Redo puts it back — not a full history stack) and
   PERSONAL (you can only undo what you yourself did).

   This is ADR-045's snapshot-inverse, extended — NOT a second undo system. It
   reuses the UndoEntry table (no new model, no migration): accounting entries
   are told apart by a `kind` prefixed "acct_", and the redo flag plus the
   company live inside the existing `payload` Json column. undo.ts excludes
   acct_ kinds from the CRM's two queries and its retire-the-rest sweep, so the
   two stacks cannot reach into each other.

   WHAT AN ENTRY IS. Not a diff and not a replay log: a list of WHOLE ROWS, each
   named by the key that makes it unique, each carrying the state it must be put
   back to (`null` = "this row must not exist"). Applying an entry is therefore
   provably a restore — "the database is byte-equal to before" is literally the
   operation, timestamps and ids included (Prisma 7 honours an explicit `id`,
   `createdAt` and `updatedAt` on create AND update, which is what makes an
   exact restore possible at all).

   REDO IS THE INVERSE OF THE UNDO. Applying an accounting undo writes, inside
   the same transaction, a fresh entry whose snapshot is the state it just read
   and verified — so the redo payload is captured LIVE and is exact. Applying
   that redo writes a fresh undo in turn, so Undo/Redo can be pressed back and
   forth on one action for ever without the data drifting. Undo never offers a
   redo entry and Redo never offers an undo entry (`payload.redo`).

   THE SIX GUARDS, all server-side, all ADR-045's:
     · OWNERSHIP — only the author's own entries; admins are not special.
     · COMPANY   — ADR-086's addition. An entry made in ByteForce's books is
                   invisible and inapplicable from B-Systems' view, and the
                   company travels in the payload, not in the caller's hands.
     · RECENCY   — the newest unconsumed entry only, inside UNDO_WINDOW_MS; past
                   it the stack is retired rather than applied.
     · INTEGRITY — the FINGERPRINT (see below). Changed since = refuse, never
                   overwrite somebody's later edit.
     · ONCE      — the row is claimed with a conditional updateMany FIRST, so a
                   racing double-click finds count 0 and gets a clean 409.
     · HONESTY   — every accounting mutation retires this user's pending
                   accounting entries before recording its own fresh inverse
                   (via logAndSeal → invalidateUndo), so the buttons can never
                   offer something older than the last thing that happened, and
                   a stale Redo can never re-create a row out of nowhere.

   THE FINGERPRINT, and the models with no `updatedAt`. ADR-045 fingerprints the
   entity's `updatedAt`. Four of the eleven accounting tables have no such
   column (AcctTarget, AcctMediaEntry, AcctPayrollPayment, AcctSettings — and
   AcctRosterSegment / AcctLoanPayment have neither timestamp), so `updatedAt`
   cannot be the fingerprint here and pretending otherwise would be a guard that
   cannot fail. Instead the fingerprint is a SHA-256 over the canonical JSON of
   the live state of every row in the entry's scope — all columns, including
   `updatedAt` where it exists. For a table that has `updatedAt` this is
   strictly stronger than ADR-045's check; for one that does not it is the
   honest equivalent, and in one respect better: it compares the STATE rather
   than a touch counter, so it refuses exactly when the state the inverse
   assumed is no longer there. Its one blind spot is a net-zero edit (A → B → A
   between the action and the undo), which by definition leaves the state the
   inverse expected, so the restore is still correct.

   WHAT THE FINGERPRINT CANNOT SEE is a row OUTSIDE the scope. Three such holes
   exist and each is closed explicitly rather than left to a constraint error:
   a unique-key collision on restore (P2002 → 409), a dangling foreign key
   (P2003 → 409), and the two ADR-058 / cascade invariants below.
   ========================================================================== */

/* ------------------------------------------------------------------ messages

   Every refusal below is thrown through `refuse(status, message, reason)`, so
   it carries a MACHINE-READABLE code (lib/accounting/undo-reasons.ts) beside
   the human sentence. The UI switches on the code and never on this prose —
   rewording any string here is a copy change, not a behaviour change. Note
   especially that the double-payroll message contains the word "already" while
   having applied nothing at all: that near miss is why the code exists. */

const CHANGED_SINCE = "This changed since — undo is no longer safe";
const CHANGED_SINCE_REDO = "This changed since — redo is no longer safe";
const CHILDREN_SINCE =
  "Records were added to this since — undo would delete them, so it was refused";
const DOUBLE_PAYROLL =
  "That person already has another payroll row for this month — undo would pay them twice";

/* ------------------------------------------------------------------- tables */

type Tx = Prisma.TransactionClient;

/** A column value as it is stored in a snapshot. Dates travel as ISO strings;
    everything else in the eleven accounting tables is already a String, an Int
    (piasters / basis points — never a float, ADR-018), a Boolean or null. */
type Scalar = string | number | boolean | null;
type RowData = Record<string, Scalar>;

/** The minimum surface a snapshot restore needs. The eleven Prisma delegates
    below are cast to it ONCE each: their real argument types are per-model
    unions that cannot express "any accounting row", and the alternative — an
    eleven-way switch repeated in six places — is where a typo turns into a
    money bug. Every value that reaches these calls came out of `plain()`, so
    the looseness is contained to the table that declares it. */
type RowDelegate = {
  findFirst(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
  }): Promise<Record<string, unknown> | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
  }): Promise<Record<string, unknown>[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: { id: string } }): Promise<unknown>;
};

/** `rank` is DEPENDENCY depth: 0 = nothing points at it, 1 = it points at a 0.
    Deletes run high→low and writes low→high, so a restore puts a loan back
    before its payments and takes payments away before the loan. */
const MODELS = {
  income: { rank: 1, d: (tx: Tx) => tx.acctIncome as unknown as RowDelegate },
  expense: { rank: 1, d: (tx: Tx) => tx.acctExpense as unknown as RowDelegate },
  member: { rank: 0, d: (tx: Tx) => tx.acctRosterMember as unknown as RowDelegate },
  segment: { rank: 1, d: (tx: Tx) => tx.acctRosterSegment as unknown as RowDelegate },
  mark: { rank: 1, d: (tx: Tx) => tx.acctPayrollPayment as unknown as RowDelegate },
  move: { rank: 0, d: (tx: Tx) => tx.acctTreasuryMove as unknown as RowDelegate },
  loan: { rank: 0, d: (tx: Tx) => tx.acctLoan as unknown as RowDelegate },
  loanPayment: { rank: 1, d: (tx: Tx) => tx.acctLoanPayment as unknown as RowDelegate },
  media: { rank: 0, d: (tx: Tx) => tx.acctMediaEntry as unknown as RowDelegate },
  target: { rank: 0, d: (tx: Tx) => tx.acctTarget as unknown as RowDelegate },
  settings: { rank: 0, d: (tx: Tx) => tx.acctSettings as unknown as RowDelegate },
} as const;

export type AcctModelKey = keyof typeof MODELS;

/** The only DateTime columns in the accounting schema. `month`, `period`,
    `date`, `paidDate`, `collectedDate`, `since` and `from` are calendar STRINGS
    by ADR-052 and must stay strings. */
const DATETIME_COLUMNS = new Set(["createdAt", "updatedAt"]);

/* --------------------------------------------------------------- references */

/** One row, named by the key that makes it unique.

    The three tables the module addresses by a NATURAL key are named that way on
    purpose: a payroll mark is "(member, month)", a target is "(company,
    period)", settings is "(company)". Naming them by id instead would make
    "somebody created a DIFFERENT row at this key since" invisible to the
    fingerprint and leave it to blow up as a constraint violation; naming them
    by their key makes it an ordinary changed-since refusal. */
export type AcctRowRef =
  | { m: Exclude<AcctModelKey, "mark" | "target" | "settings">; id: string }
  | { m: "mark"; memberId: string; month: string }
  | { m: "target"; company: string; period: string }
  | { m: "settings"; company: string };

/** A whole child collection, named by its parent. The honest unit for a write
    that REPLACES a set (updateMember re-creates every roster segment with a new
    id, so no id survives to name) and for a cascade that takes one away
    (deleteLoan drops every AcctLoanPayment). */
export type AcctSetRef =
  | { s: "segmentsOf"; memberId: string }
  | { s: "marksOf"; memberId: string }
  | { s: "paymentsOf"; loanId: string };

/** One element of the inverse: the state this row / this collection must be
    put back to. `data: null` means "this row must not exist". */
export type AcctScopeItem =
  | { t: "row"; ref: AcctRowRef; data: RowData | null }
  | { t: "set"; ref: AcctSetRef; rows: RowData[] };

interface AcctUndoPayload {
  v: 1;
  company: AcctCompany;
  /** true = applying this entry RE-APPLIES the original action */
  redo: boolean;
  scope: AcctScopeItem[];
}

function whereOf(ref: AcctRowRef): Record<string, unknown> {
  if (ref.m === "mark") return { memberId: ref.memberId, month: ref.month };
  if (ref.m === "target") return { company: ref.company, period: ref.period };
  if (ref.m === "settings") return { company: ref.company };
  return { id: ref.id };
}

function refKey(ref: AcctRowRef): string {
  return `${ref.m}:${JSON.stringify(Object.entries(whereOf(ref)).sort())}`;
}

const SET_MODEL: Record<AcctSetRef["s"], AcctModelKey> = {
  segmentsOf: "segment",
  marksOf: "mark",
  paymentsOf: "loanPayment",
};

function setWhereOf(ref: AcctSetRef): Record<string, unknown> {
  return ref.s === "paymentsOf" ? { loanId: ref.loanId } : { memberId: ref.memberId };
}

function setKey(ref: AcctSetRef): string {
  return `${ref.s}:${JSON.stringify(Object.entries(setWhereOf(ref)).sort())}`;
}

function modelOf(item: AcctScopeItem): AcctModelKey {
  return item.t === "row" ? item.ref.m : SET_MODEL[item.ref.s];
}

/* ----------------------------------------------------- snapshots & digests */

/** A Prisma row → a canonical, JSON-safe, KEY-SORTED snapshot. The sort is what
    makes the fingerprint deterministic. The throw is a real guard: if a future
    migration adds a Json, Decimal, BigInt or Bytes column to an accounting
    table, this engine stops dead instead of silently dropping it from the
    inverse (a dropped column is a money bug that no test would see). */
function plain(row: Record<string, unknown>): RowData {
  const out: RowData = {};
  for (const key of Object.keys(row).sort()) {
    const v = row[key];
    if (v === null || v === undefined) out[key] = null;
    else if (v instanceof Date) out[key] = v.toISOString();
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[key] = v;
    } else {
      throw new Error(
        `accounting-undo: column "${key}" has a type this engine cannot snapshot`,
      );
    }
  }
  return out;
}

/** A snapshot → the shape Prisma writes. Only the two DateTime columns are
    revived; every other calendar fact is a string by design (ADR-052). */
function revive(data: RowData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = DATETIME_COLUMNS.has(k) && typeof v === "string" ? new Date(v) : v;
  }
  return out;
}

function byId(a: RowData, b: RowData): number {
  return String(a.id).localeCompare(String(b.id));
}

/** Read the LIVE state of every row the scope names, in the scope's own order.
    Used twice per application: once to check the fingerprint, and once more
    afterwards to fingerprint the counter-entry. */
async function liveScope(tx: Tx, scope: AcctScopeItem[]): Promise<AcctScopeItem[]> {
  const out: AcctScopeItem[] = [];
  for (const item of scope) {
    if (item.t === "row") {
      const row = await MODELS[item.ref.m].d(tx).findFirst({ where: whereOf(item.ref) });
      out.push({ t: "row", ref: item.ref, data: row ? plain(row) : null });
    } else {
      const rows = await MODELS[SET_MODEL[item.ref.s]]
        .d(tx)
        .findMany({ where: setWhereOf(item.ref) });
      out.push({ t: "set", ref: item.ref, rows: rows.map(plain).sort(byId) });
    }
  }
  return out;
}

/** SHA-256 over the canonical JSON of a scope's state. See the header note on
    why this, and not `updatedAt`, is the fingerprint for all eleven tables. */
export function acctFingerprint(scope: AcctScopeItem[]): string {
  const canonical = scope.map((item) =>
    item.t === "row"
      ? ["row", refKey(item.ref), item.data]
      : ["set", setKey(item.ref), item.rows],
  );
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/* ------------------------------------------------------------------ writing */

/** Every row id this entry is allowed to touch — the union of the ids in the
    state it wants and the state it found. Anything else that points at a row
    the inverse is about to delete is somebody ELSE's record, and the inverse
    refuses rather than let a cascade take it. */
function authorisedIds(...scopes: AcctScopeItem[][]): Set<string> {
  const ids = new Set<string>();
  for (const scope of scopes) {
    for (const item of scope) {
      const model = modelOf(item);
      if (item.t === "row") {
        if (item.data?.id) ids.add(`${model}:${String(item.data.id)}`);
      } else {
        for (const row of item.rows) if (row.id) ids.add(`${model}:${String(row.id)}`);
      }
    }
  }
  return ids;
}

/** The cascades and SetNulls in the accounting schema, as the inverse must see
    them. Deleting one of these three parents takes rows with it, so a child
    this entry never recorded means the undo would destroy a record it has no
    snapshot of — ADR-045's `lead_create` rule, applied per cascade. */
const CHILD_LINKS: Partial<
  Record<AcctModelKey, Array<{ model: AcctModelKey; fk: string }>>
> = {
  /* segments + marks CASCADE on the member; linked expenses SetNull, which
     silently unlinks a payroll override and moves a whole salary between the
     stored row and the derived one */
  member: [
    { model: "segment", fk: "memberId" },
    { model: "mark", fk: "memberId" },
    { model: "expense", fk: "rosterId" },
  ],
  loan: [{ model: "loanPayment", fk: "loanId" }],
  /* fee income SetNulls on the media entry it was minted by */
  media: [{ model: "income", fk: "mediaEntryId" }],
};

async function assertNoForeignChildren(
  tx: Tx,
  model: AcctModelKey,
  id: string,
  authorised: Set<string>,
): Promise<void> {
  for (const link of CHILD_LINKS[model] ?? []) {
    const rows = await MODELS[link.model].d(tx).findMany({ where: { [link.fk]: id } });
    for (const row of rows) {
      if (!authorised.has(`${link.model}:${String(row.id)}`)) {
        throw refuse(409, CHILDREN_SINCE, "children_added");
      }
    }
  }
}

/** ADR-058's single-owner approval invariant, enforced on the way BACK.
    `refuseSecondCoveringRow` guards the forward path; nothing guarded the
    inverse. Restoring a deleted payroll override after somebody has created
    another row for the same person-month would pay that person twice out of one
    month — in the totals, the P&L, the department margins and the treasury
    alike — and the engine cannot tell the two apart after the fact. */
async function assertSingleCoveringRow(tx: Tx, data: RowData): Promise<void> {
  if (data.type !== "payroll" || !data.rosterId) return;
  const clash = await MODELS.expense.d(tx).findFirst({
    where: {
      company: data.company,
      type: "payroll",
      rosterId: data.rosterId,
      month: data.month,
      id: { not: data.id },
    },
  });
  if (clash) throw refuse(409, DOUBLE_PAYROLL, "double_payroll");
}

/** Put `want` back, given the `live` state the fingerprint has just verified.
    Deletes run parent-last, writes run parent-first (MODELS.rank). */
async function applyScope(
  tx: Tx,
  want: AcctScopeItem[],
  live: AcctScopeItem[],
): Promise<void> {
  const authorised = authorisedIds(want, live);
  const order = [...want.keys()];
  const liveAt = (i: number) => live[i]!;

  /* ---- phase 1: deletes, children before parents ---- */
  for (const i of [...order].sort((a, b) => MODELS[modelOf(want[b]!)].rank - MODELS[modelOf(want[a]!)].rank)) {
    const item = want[i]!;
    const now = liveAt(i);
    const model = modelOf(item);
    const del = async (id: string) => {
      await assertNoForeignChildren(tx, model, id, authorised);
      await MODELS[model].d(tx).delete({ where: { id } });
    };
    if (item.t === "row" && now.t === "row") {
      if (!now.data) continue;
      /* gone, or a DIFFERENT row now sits at this natural key */
      if (!item.data || item.data.id !== now.data.id) await del(String(now.data.id));
    } else if (item.t === "set" && now.t === "set") {
      const keep = new Set(item.rows.map((r) => String(r.id)));
      for (const row of now.rows) if (!keep.has(String(row.id))) await del(String(row.id));
    }
  }

  /* ---- phase 2: creates and in-place restores, parents before children ---- */
  for (const i of [...order].sort((a, b) => MODELS[modelOf(want[a]!)].rank - MODELS[modelOf(want[b]!)].rank)) {
    const item = want[i]!;
    const now = liveAt(i);
    const model = MODELS[modelOf(item)];
    const put = async (data: RowData, survived: boolean) => {
      if (modelOf(item) === "expense") await assertSingleCoveringRow(tx, data);
      if (survived) {
        const { id, ...rest } = revive(data);
        void id; // the row is already there under this id — never re-assign it
        await model.d(tx).update({ where: { id: String(data.id) }, data: rest });
      } else {
        await model.d(tx).create({ data: revive(data) });
      }
    };
    if (item.t === "row" && now.t === "row") {
      if (!item.data) continue;
      await put(item.data, Boolean(now.data) && now.data!.id === item.data.id);
    } else if (item.t === "set" && now.t === "set") {
      const alive = new Set(now.rows.map((r) => String(r.id)));
      for (const row of item.rows) await put(row, alive.has(String(row.id)));
    }
  }
}

/** A constraint the fingerprint cannot see: a unique key taken by a row created
    since (P2002), a parent deleted since (P2003), or a row that vanished
    between the read and the write (P2025). All three mean the same thing to the
    founder — this is not the world the snapshot was taken in. */
function asChangedSince(err: unknown, redo: boolean): never {
  if (err instanceof ApiError) throw err;
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "P2002" || code === "P2003" || code === "P2025") {
    throw refuse(409, redo ? CHANGED_SINCE_REDO : CHANGED_SINCE, "changed_since");
  }
  throw err;
}

/* ----------------------------------------------------------------- recording */

/** The 24 accounting mutations, named by the TRIGGER each one already writes to
    the ActivityLog — reused verbatim as the UndoEntry `kind` so an action has
    ONE name in the system, not two that can drift. Every member is
    "acct_"-prefixed, which is precisely what keeps this stack out of the CRM's
    (see undo.ts's CRM_KINDS_ONLY). */
export type AcctUndoKind =
  | "acct_income_create"
  | "acct_income_update"
  | "acct_income_collect_toggle"
  | "acct_income_delete"
  | "acct_expense_create"
  | "acct_expense_update"
  | "acct_expense_paid_toggle"
  | "acct_expense_delete"
  | "acct_payroll_toggle"
  | "acct_member_create"
  | "acct_member_update"
  | "acct_member_toggle_active"
  | "acct_member_delete"
  | "acct_media_received"
  | "acct_media_sent"
  | "acct_loan_create"
  | "acct_loan_payment"
  | "acct_loan_delete"
  | "acct_move_create"
  | "acct_move_update"
  | "acct_move_delete"
  | "acct_opening_balance"
  | "acct_target_set"
  | "acct_target_delete";

/** Everything a mutation hands the engine beyond its own log fields. */
export interface AcctUndoRecord {
  company: AcctCompany;
  label: string;
  labelAr: string;
  /** the state to put back — whole rows, captured BEFORE the mutation ran */
  scope: AcctScopeItem[];
}

/** Write the inverse of what just happened, inside the mutation's OWN
    transaction. No actor id (seeds, the importer's system writes, anything
    without a user) = nothing to undo, by design — ADR-045's rule. */
export async function recordAcctUndo(
  input: {
    tx: Tx;
    actor: Actor;
    kind: AcctUndoKind;
    entityType: LogEntityType;
    entityId: string;
  } & AcctUndoRecord,
): Promise<void> {
  if (!input.actor.id) return;
  /* The type above is the braces; this is the belt, and it CAN fail: a cast at
     a call site, a kind appended to the union without the prefix, or a hand
     -written row. An accounting entry whose kind lost its prefix would be
     offered by the CRM's pill, which has no inverse for it — so fail at write
     time, loudly, in development and in production alike. */
  if (!(input.kind as string).startsWith(ACCT_KIND_PREFIX)) {
    throw new Error(
      `accounting-undo: kind "${input.kind}" must start with "${ACCT_KIND_PREFIX}"`,
    );
  }
  const payload: AcctUndoPayload = {
    v: 1,
    company: input.company,
    redo: false,
    scope: input.scope,
  };
  await input.tx.undoEntry.create({
    data: {
      userId: input.actor.id,
      kind: input.kind,
      entityType: input.entityType,
      entityId: input.entityId,
      label: input.label,
      labelAr: input.labelAr,
      /* the state the inverse expects to FIND — read after the mutation */
      fingerprint: acctFingerprint(await liveScope(input.tx, input.scope)),
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });
}

/* ------------------------------------------------------------------- reading */

export interface AcctUndoOffer {
  id: string;
  label: string;
  labelAr: string;
  createdAt: Date;
}

function parsePayload(raw: Prisma.JsonValue): AcctUndoPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (p.v !== 1 || typeof p.company !== "string" || typeof p.redo !== "boolean") return null;
  if (!Array.isArray(p.scope)) return null;
  return p as unknown as AcctUndoPayload;
}

/** This user's newest unconsumed accounting entry in THIS company's books, of
    the asked-for direction. Deliberately filtered in TypeScript rather than
    through a Json path query: the stack is one deep by construction (every
    mutation retires the pending ones before recording), so this reads a handful
    of rows off the [userId, consumedAt, createdAt] index, and the company and
    the redo flag are then plain object fields instead of a dialect-specific
    JSON operator that a future adapter could quietly stop supporting. */
async function newestAcctEntry(
  userId: string,
  company: AcctCompany,
  redo: boolean,
  opts: { withinWindow: boolean },
) {
  const rows = await db.undoEntry.findMany({
    where: {
      userId,
      kind: { startsWith: ACCT_KIND_PREFIX },
      consumedAt: null,
      ...(opts.withinWindow
        ? { createdAt: { gt: new Date(Date.now() - UNDO_WINDOW_MS) } }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  for (const row of rows) {
    const payload = parsePayload(row.payload);
    if (payload && payload.company === company && payload.redo === redo) {
      return { row, payload };
    }
  }
  return null;
}

/** The entry the accounting Undo button may offer. */
export async function pendingAcctUndo(
  userId: string,
  company: AcctCompany,
): Promise<AcctUndoOffer | null> {
  return offerOf(await newestAcctEntry(userId, company, false, { withinWindow: true }));
}

/** The entry the accounting Redo button may offer — written by an undo, and
    never confused with one: Undo reads `redo: false`, Redo reads `redo: true`. */
export async function pendingAcctRedo(
  userId: string,
  company: AcctCompany,
): Promise<AcctUndoOffer | null> {
  return offerOf(await newestAcctEntry(userId, company, true, { withinWindow: true }));
}

function offerOf(
  found: { row: { id: string; label: string; labelAr: string; createdAt: Date } } | null,
): AcctUndoOffer | null {
  if (!found) return null;
  const { id, label, labelAr, createdAt } = found.row;
  return { id, label, labelAr, createdAt };
}

/* ------------------------------------------------------------------ applying */

/** Retire this user's pending entries for ONE company's books. acct_ kinds
    only — the CRM's lead and vault stack is a different stack and must come
    out of this untouched (which is the other half of undo.ts's exclusion). */
async function retireAcctStack(
  client: Tx | typeof db,
  userId: string,
  company: AcctCompany,
  except?: string,
): Promise<void> {
  const rows = await client.undoEntry.findMany({
    where: { userId, kind: { startsWith: ACCT_KIND_PREFIX }, consumedAt: null },
    select: { id: true, payload: true },
  });
  const ids = rows
    .filter((r) => r.id !== except && parsePayload(r.payload)?.company === company)
    .map((r) => r.id);
  if (!ids.length) return;
  await client.undoEntry.updateMany({
    where: { id: { in: ids } },
    data: { consumedAt: new Date() },
  });
}

/** The small set of ActivityLog entity types the accounting module writes. An
    entry carries one as a plain String column, so it is validated rather than
    cast: an unrecognised value logs against the whole-books subject instead of
    smuggling an unknown entityType into the log. */
const ACCT_LOG_ENTITY_TYPES = new Set<string>([
  "acct_income",
  "acct_expense",
  "acct_roster_member",
  "acct_payroll_payment",
  "acct_treasury_move",
  "acct_loan",
  "acct_loan_payment",
  "acct_media_entry",
  "acct_target",
  "acct_settings",
  "acct_books",
]);

async function applyAcctEntry(
  actor: Actor,
  company: AcctCompany,
  redo: boolean,
): Promise<{ label: string; labelAr: string }> {
  const userId = actor.id;
  const nothing = redo ? "Nothing to redo" : "Nothing to undo";
  /* no actor id = no ownership, so there is nothing of yours to apply */
  if (!userId) throw refuse(403, nothing, "no_actor");

  const found = await newestAcctEntry(userId, company, redo, { withinWindow: false });
  if (!found) throw refuse(400, nothing, "nothing");
  const { row: entry, payload } = found;

  if (entry.createdAt.getTime() < Date.now() - UNDO_WINDOW_MS) {
    /* the newest is expired ⇒ everything older is too: retire this company's
       accounting stack so the buttons stop offering what can no longer apply */
    await retireAcctStack(db, userId, company);
    throw refuse(
      400,
      redo ? "That action is too old to redo" : "That action is too old to undo",
      "too_old",
    );
  }

  await db.$transaction(async (tx) => {
    /* ONCE — claim FIRST and atomically: a racing double-click finds count 0 */
    const claimed = await tx.undoEntry.updateMany({
      where: { id: entry.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw refuse(
        409,
        redo ? "That action was already redone" : "That action was already undone",
        "already_applied",
      );
    }

    /* ONE STEP, not a history stack: applying retires this user's other
       pending accounting entries for this company — including any stale redo,
       which is what stops a third press re-creating a row out of nowhere. */
    await retireAcctStack(tx, userId, company, entry.id);

    /* INTEGRITY — the live state must be the state this entry was written
       against, or somebody has edited these rows since and the inverse would
       clobber their edit. */
    const live = await liveScope(tx, payload.scope);
    if (acctFingerprint(live) !== entry.fingerprint) {
      throw refuse(409, redo ? CHANGED_SINCE_REDO : CHANGED_SINCE, "changed_since");
    }

    try {
      await applyScope(tx, payload.scope, live);
    } catch (err) {
      asChangedSince(err, redo);
    }

    /* REDO IS THE INVERSE OF THE UNDO — the counter-entry's snapshot is the
       state we just read and VERIFIED, so it is exact, and its fingerprint is
       the state we have just written. Toggling cannot drift. */
    const counter: AcctUndoPayload = { v: 1, company, redo: !redo, scope: live };
    await tx.undoEntry.create({
      data: {
        userId,
        kind: entry.kind,
        entityType: entry.entityType,
        entityId: entry.entityId,
        /* the label describes the ACTION, so it travels unchanged in both
           directions: the UI says "Undo — Deleted expense: Office rent" and
           then "Redo — Deleted expense: Office rent" */
        label: entry.label,
        labelAr: entry.labelAr,
        fingerprint: acctFingerprint(await liveScope(tx, payload.scope)),
        payload: counter as unknown as Prisma.InputJsonValue,
      },
    });

    /* a reversal is history, not a silent rewrite (ADR-045) */
    await writeLog(tx, {
      entityType: (ACCT_LOG_ENTITY_TYPES.has(entry.entityType)
        ? entry.entityType
        : "acct_books") as LogEntityType,
      entityId: entry.entityId,
      actor,
      action: "update",
      trigger: redo ? "acct_redo" : "acct_undo",
    });
  });

  return { label: entry.label, labelAr: entry.labelAr };
}

/** Reverse this user's last accounting action in this company's books. */
export async function performAcctUndo(
  actor: Actor,
  company: AcctCompany,
): Promise<{ label: string; labelAr: string }> {
  return applyAcctEntry(actor, company, false);
}

/** Put back what the last accounting undo reversed. */
export async function performAcctRedo(
  actor: Actor,
  company: AcctCompany,
): Promise<{ label: string; labelAr: string }> {
  return applyAcctEntry(actor, company, true);
}

/* ------------------------------------------------------- snapshot helpers */

/** A row that EXISTS, as a scope item: "put these exact columns back". */
export function snapRow(ref: AcctRowRef, row: Record<string, unknown>): AcctScopeItem {
  return { t: "row", ref, data: plain(row) };
}

/** A row that DOES NOT exist, as a scope item: "this row must not exist".
    What a create records, and what a naturally-keyed upsert records when it
    found nothing there. */
export function snapAbsent(ref: AcctRowRef): AcctScopeItem {
  return { t: "row", ref, data: null };
}

/** A row that may or may not exist (read it, then pass what you found). */
export function snapMaybe(
  ref: AcctRowRef,
  row: Record<string, unknown> | null,
): AcctScopeItem {
  return row ? snapRow(ref, row) : snapAbsent(ref);
}

/** A whole child collection, as a scope item. */
export function snapSet(ref: AcctSetRef, rows: Record<string, unknown>[]): AcctScopeItem {
  return { t: "set", ref, rows: rows.map(plain).sort(byId) };
}

/* ---------------------------------------------------------------- the labels

   ADR-045's rule: the entry stores a FINISHED English AND Arabic sentence,
   composed at write time, so the button can always say what it is about to
   revert without re-deriving it from data that may since have moved. The fixed
   words live here (the dictionary is the UI agent's file and these are server
   snapshots, not render-time strings); the SUBJECT comes from the row. The
   register is the accounting dictionary's: terse formal Arabic, brand names and
   calendar strings untranslated. */

function L(
  en: string,
  ar: string,
  subject?: string | null,
  subjectAr?: string | null,
): { label: string; labelAr: string } {
  const sEn = (subject ?? "").trim();
  const sAr = (subjectAr ?? subject ?? "").trim();
  return {
    label: sEn ? `${en}: ${sEn}` : en,
    labelAr: sAr ? `${ar}: ${sAr}` : ar,
  };
}

/** Income and expenses are free text first, type label second — the founder
    reads "Deleted expense: Office rent", and only falls back to the type when
    the row has no name at all. */
function incomeSubject(row: { client: string; type: string }) {
  const typed = ACCT_INCOME_TYPE_LABELS[row.type as AcctIncomeType];
  return { en: row.client || typed?.en || "", ar: row.client || typed?.ar || "" };
}

function expenseSubject(row: { name: string; type: string }) {
  const typed = ACCT_EXPENSE_TYPE_LABELS[row.type as AcctExpenseType];
  return { en: row.name || typed?.en || "", ar: row.name || typed?.ar || "" };
}

export const acctLabel = {
  incomeCreated: (r: { client: string; type: string }) => {
    const s = incomeSubject(r);
    return L("Added income", "إضافة دخل", s.en, s.ar);
  },
  incomeEdited: (r: { client: string; type: string }) => {
    const s = incomeSubject(r);
    return L("Edited income", "تعديل دخل", s.en, s.ar);
  },
  incomeCollected: (r: { client: string; type: string }, collected: boolean) => {
    const s = incomeSubject(r);
    return collected
      ? L("Marked income collected", "تحديد الدخل كمحصّل", s.en, s.ar)
      : L("Marked income not collected", "إلغاء تحصيل الدخل", s.en, s.ar);
  },
  incomeDeleted: (r: { client: string; type: string }) => {
    const s = incomeSubject(r);
    return L("Deleted income", "حذف دخل", s.en, s.ar);
  },
  expenseCreated: (r: { name: string; type: string }) => {
    const s = expenseSubject(r);
    return L("Added expense", "إضافة مصروف", s.en, s.ar);
  },
  expenseEdited: (r: { name: string; type: string }) => {
    const s = expenseSubject(r);
    return L("Edited expense", "تعديل مصروف", s.en, s.ar);
  },
  expensePaid: (r: { name: string; type: string }, paid: boolean) => {
    const s = expenseSubject(r);
    return paid
      ? L("Approved expense", "اعتماد مصروف", s.en, s.ar)
      : L("Put expense back on hold", "إرجاع المصروف قيد الانتظار", s.en, s.ar);
  },
  expenseDeleted: (r: { name: string; type: string }) => {
    const s = expenseSubject(r);
    return L("Deleted expense", "حذف مصروف", s.en, s.ar);
  },
  salaryMark: (who: string, month: string, approved: boolean) =>
    approved
      ? L("Approved salary", "اعتماد راتب", `${who} — ${month}`)
      : L("Un-approved salary", "إلغاء اعتماد راتب", `${who} — ${month}`),
  memberCreated: (name: string) =>
    L("Added to the payroll roster", "إضافة إلى كشف الرواتب", name),
  memberEdited: (name: string) => L("Edited roster member", "تعديل عضو كشف الرواتب", name),
  memberActive: (name: string, active: boolean) =>
    active
      ? L("Reactivated roster member", "إعادة تنشيط عضو كشف الرواتب", name)
      : L("Deactivated roster member", "إيقاف تنشيط عضو كشف الرواتب", name),
  memberDeleted: (name: string) =>
    L("Removed from the payroll roster", "إزالة من كشف الرواتب", name),
  mediaReceived: (client: string) =>
    L("Recorded ad budget received", "تسجيل ميزانية إعلان مستلمة", client),
  mediaSent: (client: string) =>
    L("Recorded ad spend forwarded", "تسجيل إنفاق إعلاني مُمرَّر", client),
  loanCreated: (party: string, borrowed: boolean) =>
    borrowed
      ? L("Recorded loan received", "تسجيل قرض مستلَم", party)
      : L("Recorded loan given", "تسجيل قرض ممنوح", party),
  loanPaid: (party: string) => L("Recorded loan payment", "تسجيل دفعة قرض", party),
  loanDeleted: (party: string) => L("Deleted loan", "حذف قرض", party),
  moveCreated: (label: string, deposit: boolean) =>
    deposit
      ? L("Added treasury deposit", "إضافة إيداع للخزينة", label)
      : L("Added treasury withdrawal", "إضافة سحب من الخزينة", label),
  moveEdited: (label: string) => L("Edited treasury movement", "تعديل حركة خزينة", label),
  moveDeleted: (label: string) => L("Deleted treasury movement", "حذف حركة خزينة", label),
  openingBalance: () => L("Changed the opening balance", "تغيير الرصيد الافتتاحي"),
  targetSet: (period: string) => L("Set the target", "تحديد الهدف", period),
  targetDeleted: (period: string) => L("Deleted the target", "حذف الهدف", period),
};
