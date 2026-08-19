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
    /* ADR-057 — a backup exported BEFORE the agent rename holds agent rows at
       `following_up` / `won`; createMany restores them verbatim and they would
       render in no column of the agent board. The restore runs the SAME
       normalisation the migration runs, so it can never re-strand a card nor
       leave a restored card's History speaking the partner vocabulary. */
    await normaliseAgentStages(tx);
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

/* ---------------------------------------------------- ADR-057 normalisation */

/** The old agent stage keys, and the slot each one became. Named once so the
    SQL migration and this restore path cannot drift into different answers. */
const AGENT_STAGE_RENAMES = [
  ["following_up", "contacted"], // the follow-up role slot
  ["won", "qualified"], // the terminal-success slot / account gate
] as const;

/** Walk agent rows off the partner stage vocabulary — the TypeScript twin of
    `prisma/migrations/20260819180000_agent_stages/migration.sql`, statement for
    statement, for the one path the migration cannot reach: `importBackup`
    re-inserts a PRE-rename export verbatim onto an already-migrated database.
    A parity test runs both against identical fixtures and diffs the result. */
export async function normaliseAgentStages(tx: Prisma.TransactionClient): Promise<void> {
  const agentIds = (
    await tx.partnerProspect.findMany({ where: { kind: "agent" }, select: { id: true } })
  ).map((p) => p.id);
  if (agentIds.length === 0) return;

  for (const [from, to] of AGENT_STAGE_RENAMES) {
    // 1. the cards themselves
    await tx.partnerProspect.updateMany({
      where: { kind: "agent", stage: from },
      data: { stage: to },
    });
    /* 2. their History, so an agent's own panel stops printing "Following Up"
       and "Won" — columns his board does not have. ActivityLog is append-only
       by policy; this rewrite is the deliberate exception ADR-057 records. */
    await tx.activityLog.updateMany({
      where: { entityType: "partner_prospect", entityId: { in: agentIds }, fromStage: from },
      data: { fromStage: to },
    });
    await tx.activityLog.updateMany({
      where: { entityType: "partner_prospect", entityId: { in: agentIds }, toStage: from },
      data: { toStage: to },
    });
  }

  /* 3. THE STRANDING GUARD. A restored UndoEntry can still be pending and can
     still carry a dead stage in its snapshot. `undoProspectEvent` refuses to
     write a stage the card's board lacks, so it cannot strand anything — but
     the button would keep OFFERING a revert that always fails. Retire the
     owner's whole pending set, exactly as the migration does, so ADR-045's
     honesty invariant survives a restore too. */
  const stale = await tx.undoEntry.findMany({
    where: { consumedAt: null, entityType: "partner_prospect", entityId: { in: agentIds } },
    select: { userId: true, payload: true },
  });
  const oldStages = new Set<string>(AGENT_STAGE_RENAMES.map(([from]) => from));
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
