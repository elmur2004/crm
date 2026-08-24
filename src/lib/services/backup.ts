import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { storage } from "@/lib/storage";
import type { Actor } from "./activity";

/* Full-system backup & restore (founder directive): Export produces ONE JSON
   file holding every table (ids preserved) plus every uploaded file (base64).
   Import REPLACES the entire database with the backup's contents atomically —
   restoring an export onto a wiped system reproduces the system exactly.
   Admin-only at the route layer. The file contains password hashes — treat it
   as a secret. */

export const BACKUP_VERSION = 1;
const BACKUP_APP = "byteforce-bsystems-sales-platform";

/* FK-safe INSERT order (parents before children). Deletes run in reverse.
   Keep in sync with prisma/schema.prisma and src/tests/db-reset.ts. */
const MODELS = [
  "user",
  "userRole",
  "salesRep",
  "portalRep",
  "partnerProspect",
  "partner",
  "lead",
  "followUp",
  "meeting",
  "proposal",
  "lostInfo",
  "wonInfo",
  "client",
  "wonDeal",
  "milestone",
  "statement",
  /* ADR-062 — AFTER all five parents (user, lead→followUp/meeting, milestone,
     statement): the manual To-Do completion marks; deletes run reversed so it
     clears first */
  "todoDone",
  "negotiationNote",
  "notification",
  "leadComment",
  /* data vault (ADR-053) — BEFORE attachment: Attachment rows now reference
     VaultSheet/VaultDocument/VaultTask (vault employee before its tasks) */
  "vaultEmployee",
  "vaultForm",
  "vaultSheet",
  "vaultDocument",
  "vaultTask",
  "attachment",
  "activityLog",
  /* ADR-053 hardening: undoEntry had silently fallen OUT of the backup (the
     exact failure mode INTEGRATION-PLAN §3 warns about — it was already in
     resetDb). No relations, so order is free; restoring it keeps stale undo
     offers from surviving a restore they no longer match. */
  "undoEntry",
  /* accounting (ADR-052) — parents before children */
  "acctSettings",
  "acctRosterMember",
  "acctRosterSegment",
  "acctPayrollPayment",
  "acctMediaEntry",
  "acctIncome", // references AcctMediaEntry
  "acctExpense", // references AcctRosterMember
  "acctTreasuryMove",
  "acctLoan",
  "acctLoanPayment",
  "acctTarget",
] as const;
type ModelName = (typeof MODELS)[number];

type AnyDelegate = {
  findMany: (args?: unknown) => Promise<Record<string, unknown>[]>;
  deleteMany: () => Promise<unknown>;
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
};
function delegate(client: unknown, model: ModelName): AnyDelegate {
  return (client as Record<ModelName, AnyDelegate>)[model];
}

export interface BackupFilePayload {
  version: number;
  app: string;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  files: Array<{ key: string; data: string }>; // base64
}

export async function exportBackup(): Promise<BackupFilePayload> {
  const tables: BackupFilePayload["tables"] = {};
  for (const model of MODELS) {
    tables[model] = await delegate(db, model).findMany();
  }

  /* every stored upload, keyed exactly as the Attachment rows reference it —
     a missing file on disk is skipped (the row still restores) */
  const files: BackupFilePayload["files"] = [];
  const attachments = tables["attachment"] as Array<{ storageKey: string }>;
  for (const a of attachments) {
    try {
      const buf = await storage.read(a.storageKey);
      files.push({ key: a.storageKey, data: buf.toString("base64") });
    } catch {
      // file lost on disk — the restore recreates the row without the blob
    }
  }

  return {
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    exportedAt: new Date().toISOString(),
    tables,
    files,
  };
}

/** REPLACES all data with the backup's contents. Ids are preserved, so every
    relation (and the signed-in admin's session) survives the round-trip. */
export async function importBackup(
  raw: unknown,
  actor: Actor,
): Promise<Record<string, number>> {
  const payload = raw as Partial<BackupFilePayload> | null;
  if (
    !payload ||
    payload.app !== BACKUP_APP ||
    typeof payload.version !== "number" ||
    !payload.tables ||
    typeof payload.tables !== "object"
  ) {
    throw new ApiError(400, "Not a valid backup file for this system");
  }
  if (payload.version > BACKUP_VERSION) {
    throw new ApiError(400, "This backup was made by a newer version of the system");
  }

  const counts: Record<string, number> = {};
  await db.$transaction(async (tx) => {
    for (const model of [...MODELS].reverse()) {
      await delegate(tx, model).deleteMany();
    }
    for (const model of MODELS) {
      const rows = payload.tables![model] ?? [];
      counts[model] = rows.length;
      if (rows.length > 0) {
        // Prisma coerces ISO-8601 strings back into DateTime columns
        await delegate(tx, model).createMany({ data: rows });
      }
    }
    /* ADR-057, widened by ADR-059 — a backup exported BEFORE the renames holds
       prospect rows at `following_up` / `won`; createMany restores them verbatim
       and they would render in no column of the board. The restore runs the SAME
       normalisation the two migrations run, so it can never re-strand a card nor
       leave a restored card's History speaking a retired vocabulary. */
    await normaliseProspectStages(tx);
    /* ADR-063 — a backup exported BEFORE the marker existed holds FollowUp rows
       with no `dueTimeSet` at all; createMany restores them at the column
       default (false), which would silently turn every legacy CHOSEN time into
       a date-only row. Same reasoning as the stage normalisation above: the
       restore runs the SAME backfill the migration runs — but ONLY for that
       pre-marker payload, which is the difference between this twin and the
       stage one. A retired stage key cannot be a legitimate value; `dueTimeSet
       = false` very much can, and a POST-marker export states it explicitly on
       every date-only row. Running the backfill over those would hand a
       follow-up a clock NOBODY CHOSE — precisely the failure ADR-063 exists to
       prevent — so the payload is asked which era it comes from first. */
    if (predatesFollowUpDueTimeSet(payload.tables!["followUp"] ?? [])) {
      await backfillFollowUpDueTimeSet(tx);
    }
    await tx.activityLog.create({
      data: {
        entityType: "user",
        entityId: actor.id ?? "system",
        actorId: actor.id,
        actorLabel: actor.label,
        action: "update",
        trigger: "backup_import",
      },
    });
  });

  /* uploaded files after the rows commit — a failed blob never aborts the data */
  for (const f of payload.files ?? []) {
    try {
      await storage.put(f.key, Buffer.from(f.data, "base64"));
    } catch {
      // bad key/blob — the attachment row exists; the file 404s until re-uploaded
    }
  }

  return counts;
}

/* ------------------------------------------------------- ADR-063 backfill */

/** Does this export predate the ADR-063 marker? `exportBackup` calls
    `findMany()` with no `select`, so a POST-marker export carries `dueTimeSet`
    on EVERY FollowUp row — `false` included — while a PRE-marker export has no
    such key at all. That absence is the only honest signal of the era, and it
    is the exact precondition the backfill's rule assumes. No rows ⇒ nothing to
    backfill either way, so the answer is `false`. */
export function predatesFollowUpDueTimeSet(rows: Record<string, unknown>[]): boolean {
  return rows.some((row) => !("dueTimeSet" in row));
}

/** The TypeScript twin of the backfill in
    `prisma/migrations/20260825093000_follow_up_due_time_set/migration.sql`,
    statement for statement, for the one path the migration cannot reach:
    `importBackup` re-inserts a PRE-marker export verbatim onto an
    already-migrated database.

    The rule, stated honestly: an instant that is NOT 09:00 on the CAIRO wall
    clock can only have come from a form that required a time, so the user
    really chose it. Rows at exactly 09:00 Cairo stay date-only — that is every
    row written during the ADR-061 date-only window, plus the one accepted false
    negative (someone who deliberately typed 09:00 before ADR-061). Rows already
    marked TRUE are never touched, so this is re-runnable — but that is NOT the
    same as safe on any database: a row deliberately marked FALSE at some other
    clock is indistinguishable here from a legacy row, so only a caller that has
    established the pre-marker era may run it (`predatesFollowUpDueTimeSet`, or
    the migration, which by definition runs the moment the column is born). */
export async function backfillFollowUpDueTimeSet(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "FollowUp"
    SET "dueTimeSet" = true
    WHERE "dueTimeSet" = false
      AND ("dueAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')::time <> TIME '09:00'`;
}

/* ------------------------------------------ ADR-057 / ADR-059 normalisation */

/** The retired prospect stage keys, and the slot each one became. Named once so
    the SQL migrations and this restore path cannot drift into different answers.

    ADR-059 made the pair KIND-AGNOSTIC: `following_up` and `won` are dead keys
    for partner cards as well as agent cards now, so applying both renames to
    every PartnerProspect row is the exact TypeScript twin of the two shipped
    migrations run in sequence. */
const PROSPECT_STAGE_RENAMES = [
  ["following_up", "contacted"], // the stage a card used to follow up in
  ["won", "qualified"], // the terminal-success slot / directory gate
] as const;

/** Walk prospect rows off the retired stage vocabulary — the TypeScript twin of
    `prisma/migrations/20260819180000_agent_stages/migration.sql` and
    `.../20260821180000_unified_prospect_stages/migration.sql`, statement for
    statement, for the one path the migrations cannot reach: `importBackup`
    re-inserts a PRE-rename export verbatim onto an already-migrated database.
    A parity test runs both against identical fixtures and diffs the result. */
export async function normaliseProspectStages(tx: Prisma.TransactionClient): Promise<void> {
  const prospectIds = (await tx.partnerProspect.findMany({ select: { id: true } })).map(
    (p) => p.id,
  );
  if (prospectIds.length === 0) return;

  for (const [from, to] of PROSPECT_STAGE_RENAMES) {
    /* 1. the cards themselves — RAW, and that is the whole point. Prisma applies
       `@updatedAt` CLIENT-side, so `updateMany` would stamp `updatedAt = now()`
       on every renamed card while the SQL migrations leave it untouched. Two
       things ride on that column and both would break the "statement for
       statement" promise: undo's integrity FINGERPRINT (a surviving pending
       entry would 409 for ever on the restore path and succeed on the SQL path)
       and the board's `orderBy: { updatedAt: "desc" }` (a restore would silently
       re-sort every renamed card to the top of its column). The values are the
       literals of PROSPECT_STAGE_RENAMES, and are bound as parameters anyway. */
    await tx.$executeRaw`UPDATE "PartnerProspect" SET "stage" = ${to} WHERE "stage" = ${from}`;
    /* 2. their History, so a card's own panel stops printing "Following Up" and
       "Won" — columns the board does not have. ActivityLog is append-only by
       policy; this rewrite is the deliberate exception ADR-057/ADR-059 record.
       The entityType filter is load-bearing: internal LEAD history still uses
       `following_up` and `won` as LIVE stage names and must never be rewritten. */
    await tx.activityLog.updateMany({
      where: { entityType: "partner_prospect", entityId: { in: prospectIds }, fromStage: from },
      data: { fromStage: to },
    });
    await tx.activityLog.updateMany({
      where: { entityType: "partner_prospect", entityId: { in: prospectIds }, toStage: from },
      data: { toStage: to },
    });
  }

  /* 3. THE STRANDING GUARD. A restored UndoEntry can still be pending and can
     still carry a dead stage in its snapshot. `undoProspectEvent` refuses to
     write a stage the card's board lacks, so it cannot strand anything — but
     the button would keep OFFERING a revert that always fails. Retire the
     owner's whole pending set, exactly as the migrations do, so ADR-045's
     honesty invariant survives a restore too. */
  const stale = await tx.undoEntry.findMany({
    where: { consumedAt: null, entityType: "partner_prospect", entityId: { in: prospectIds } },
    select: { userId: true, payload: true },
  });
  const oldStages = new Set<string>(PROSPECT_STAGE_RENAMES.map(([from]) => from));
  const owners = [
    ...new Set(
      stale
        .filter((e) => {
          const stage = (e.payload as { stage?: unknown } | null)?.stage;
          return typeof stage === "string" && oldStages.has(stage);
        })
        .map((e) => e.userId),
    ),
  ];
  if (owners.length > 0) {
    await tx.undoEntry.updateMany({
      where: { userId: { in: owners }, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
}
