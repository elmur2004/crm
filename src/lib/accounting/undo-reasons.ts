import { ApiError } from "@/lib/api-error";

/* ============================================================================
   ADR-086 — THE ACCOUNTING UNDO/REDO REFUSAL CODES.

   THE ADR NUMBER IN THIS FEATURE IS WRONG AND NEEDS RE-STAMPING. Every file of
   the accounting undo/redo cites "ADR-086", but docs/DECISIONS.md's ADR-086 is
   already taken — "THE EXACT LOG FOR EACH SINGLE LEAD, ADDED TO THE BACKUP"
   (2026-10-08), cited correctly by six backup files. The highest logged ADR is
   085, so this feature's number is ADR-086, and no ADR for it has been written
   yet (CLAUDE.md operating rule 2). Flagged rather than renumbered here because
   picking the number is a documentation decision, not a code one.

   WHY THIS FILE EXISTS. The first cut of this feature decided which
   explanation a bookkeeper sees by MATCHING THE SERVER'S ENGLISH MESSAGE in
   the browser (`/pay them twice/`, `/records were added/`, `/already
   (undone|redone)/`, …). It worked, and it was pinned by tests on both sides,
   but it was wrong by construction in two ways:

     · a reword in accounting-undo.ts silently changes which sentence a
       bookkeeper reads — the copy degrades without anything going red at the
       moment of the edit; and
     · the near misses are catastrophic rather than cosmetic. The engine
       refuses a double payroll with "That person ALREADY has another payroll
       row…", so the obvious one-word test for "already" answered a guard that
       had applied NOTHING with "that step was already applied" — telling
       someone his click landed twice when in truth it never landed at all. On
       a money screen a wrong explanation of a refusal is worse than a generic
       one.

   So the REASON now travels as data. Every refusal this feature can produce is
   named here, once, as a string-literal union; the engine attaches the name at
   the THROW SITE (AcctUndoError below) so nothing has to be inferred from
   prose; the two routes put it in the JSON body beside the unchanged human
   message; and the client switches on it. The English text match survives only
   as a last-resort fallback for a body with no code in it — an older cached
   bundle, or a proxy that strips the field.

   ONE DEFINITION, BOTH HALVES. The routes and the browser bundle import this
   same module, so the producer and the consumer cannot drift: the client's
   code→copy table is a `Record<AcctUndoReason, Msg>`, which stops compiling
   the moment a code is added here without a sentence to show for it.

   This module stays dependency-free apart from ApiError (itself import-free,
   which is why services and tests can use it) so that importing it into a
   client component pulls no server runtime into the browser bundle.
   ========================================================================== */

/** Every refusal the accounting undo/redo path can produce, enumerated from
    the throw sites in src/lib/services/accounting-undo.ts plus the two guards
    the routes call before it. A closed set: `nothing` and `changed_since` are
    the two that also serve as catch-alls for their own families (see below). */
export const ACCT_UNDO_REASONS = [
  /** 400 — nothing left on this side of the stack: never recorded, already
      consumed, somebody else's, another company's, or retired by a newer
      action. All one fact to the reader: the step is not on offer. */
  "nothing",
  /** 400 — the entry is older than UNDO_WINDOW_MS, so the stack was retired
      rather than applied. */
  "too_old",
  /** 409 — the fingerprint no longer matches the state the inverse was written
      against, or a constraint the fingerprint cannot see says the same thing
      (P2002 a unique key taken since, P2003 a parent deleted since, P2025 a
      row that vanished between the read and the write). Nothing was touched. */
  "changed_since",
  /** 409 — the single-use claim was already taken, so this press is the second
      one of a double-click and the first one did the work. */
  "already_applied",
  /** 409 — a cascade child exists that this entry never recorded, so undoing
      would destroy a record it has no snapshot of (ADR-045's `lead_create`
      rule, per cascade). */
  "children_added",
  /** 409 — ADR-058's single-covering-row invariant, enforced on the way back:
      restoring a deleted payroll override when another row now covers the same
      person-month would pay that person twice out of one month. */
  "double_payroll",
  /** 403 — no actor identity on the call, so there is nothing OF YOURS to
      apply. Raised by the engine, not by a guard. */
  "no_actor",
  /** 403 — the module wall refused the account: this is the code for "no
      accounting module" (ADR-066's per-admin flag) and, with it, every other
      403 `requireAccounting()` raises — below the administrator floor,
      deactivated, or awaiting approval. They are deliberately one code because
      they are one fact to the person holding the mouse ("you may not do this
      here"), they all already render one sentence, and the route must NOT
      re-derive which of them it was: a hand-written role check beside the
      guard is exactly what module-access.integration.test reads this directory
      to forbid. */
  "not_permitted",
  /** 400 or 404 — the `company` on the wire is not one of this account's
      (ADR-074's wall answers 404 so a valid name is not confirmed to exist) or
      is not a company at all (400). Unreachable from the real UI, where the
      company comes from the server-rendered page. */
  "no_company",
] as const;

export type AcctUndoReason = (typeof ACCT_UNDO_REASONS)[number];

const REASON_SET: ReadonlySet<string> = new Set(ACCT_UNDO_REASONS);

/** True for a value that really is one of the codes above — the client's guard
    against a body shaped by a future, unknown server. */
export function isAcctUndoReason(value: unknown): value is AcctUndoReason {
  return typeof value === "string" && REASON_SET.has(value);
}

/** An ApiError that also says WHY, in one word a machine can switch on.

    It extends ApiError rather than replacing it, so every `instanceof
    ApiError` in the engine and in the shared `handleRoute` keeps working and
    the status and message behave exactly as before. The extra field is
    additive: a caller that does not know about it sees the ApiError it always
    saw. */
export class AcctUndoError extends ApiError {
  constructor(
    status: number,
    message: string,
    readonly reason: AcctUndoReason,
  ) {
    super(status, message);
    this.name = "AcctUndoError";
  }
}

/** The engine's throw helper: `throw refuse(409, DOUBLE_PAYROLL, "double_payroll")`.
    Reads as a refusal at the call site and makes a bare `new ApiError` in that
    file stand out as the omission it would be. */
export function refuse(
  status: number,
  message: string,
  reason: AcctUndoReason,
): AcctUndoError {
  return new AcctUndoError(status, message, reason);
}

/* ---------------------------------------------------------------- the routes

   HOW THE FIELD GETS INTO THE BODY WITHOUT TOUCHING THE SHARED HANDLER.

   `handleRoute` (src/lib/auth/guards.ts) answers an ApiError with exactly
   `{ error: message }` and is shared by some forty CRM endpoints, so it is not
   ours to widen. Instead each accounting route catches on its way out and asks
   this function to shape the body; a refusal we can name is answered HERE,
   with the same status and the byte-identical `error` string plus `reason`, and
   anything else is re-thrown so the shared handler deals with it exactly as it
   always has (401 Not signed in, a ZodError, an unexpected 500).

   The guard layer cannot be made to carry its own codes — guards.ts and
   tenancy.ts are shared — so the two guard reasons are supplied by the CALL
   SITE instead: the route labels each guard call with the reason that guard's
   refusals mean (`attempt` below), which is structural, not another text
   match. The status still decides whether the label applies, so a 401 out of
   the module guard stays an un-coded 401 rather than being mislabelled. */

/** Run a guard and label the refusals it is allowed to produce, so a code
    comes from WHICH guard refused rather than from what it said.
    `statuses` keeps the label honest: only those statuses are labelled. */
export async function attempt<T>(
  reason: AcctUndoReason,
  statuses: readonly number[],
  fn: () => T | Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (
      err instanceof ApiError &&
      !(err instanceof AcctUndoError) &&
      statuses.includes(err.status)
    ) {
      throw new AcctUndoError(err.status, err.message, reason);
    }
    throw err;
  }
}

/** The refusal body: the human message unchanged, plus the machine code.
    Returns null for anything that is not a coded refusal, which the caller
    re-throws to the shared handler. */
export function acctRefusalResponse(err: unknown): Response | null {
  if (!(err instanceof AcctUndoError)) return null;
  return Response.json({ error: err.message, reason: err.reason }, { status: err.status });
}
