import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "../../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { storage as blobStorage, validateAndStore } from "@/lib/storage";
import { writeLog, type Actor } from "../activity";
import { invalidateUndo } from "../undo";
import { assertNotArchived, setVaultArchived } from "./archive";
import { computeLateness, isOverdue } from "./lateness";
import {
  optionalText,
  parseResultLinks,
  vaultListParams,
  zResultLink,
  zVaultCompany,
  zVaultDate,
  type ResultLink,
} from "./common";
import { VAULT_TASK_STATUSES, type VaultCompany } from "./constants";
import { vaultCompanyWhereNullable, visibleCompany } from "./tenancy";

/* ADR-053 — vault tasks: the reason the reference app exists (its SPEC §9).
   The rules that must never be traded away, each enforced HERE, server-side:

   • THE RESULT GATE (BR-05/AC-08): a task cannot complete without a recorded
     result — non-empty text, ≥1 file, or ≥1 link, ANY ONE of the three (never
     text *and* an attachment: forcing "see attached" teaches everyone the gate
     is theatre). Re-checked inside the completion transaction whatever the
     client claimed; unsatisfied = 422 and nothing commits.
   • completedAt is SERVER time (BR-06), never the browser's.
   • LATENESS IS FROZEN (BR-07/AC-12): computed exactly once at completion
     against the deadline and stored. There is NO recompute path — editing the
     deadline of a completed task never touches wasLate/daysLate. What was
     true at completion stays true; it is a performance record about a person.
   • REOPENING (§9.5): clears the completion trio, keeps the result, and logs
     the previous values — erasing a performance record needs provenance.
   • completeVaultTask is the ONLY code path that sets status "completed". */

export const vaultTaskSchema = z.object({
  employeeId: z.string().min(1, "Choose who this task is for."),
  name: z.string().trim().min(1, "Give the task a name.").max(200),
  description: optionalText(10_000),
  company: zVaultCompany.nullish().default(null),
  deadline: zVaultDate, // date only, evaluated in Cairo (reference D-06)
});
export type VaultTaskInput = z.infer<typeof vaultTaskSchema>;

/** The result panel's payload. Nothing here is required — the GATE is enforced
    in completeVaultTask against what is stored plus what arrives. */
export const vaultResultSchema = z.object({
  resultText: z.string().max(20_000).nullish(),
  links: z.array(zResultLink).max(20).optional(),
});
export type VaultResultInput = z.infer<typeof vaultResultSchema>;

export const vaultTaskListParams = vaultListParams.extend({
  employeeId: z.string().optional().catch(undefined),
  status: z.enum(VAULT_TASK_STATUSES).optional().catch(undefined),
  overdue: z.coerce.boolean().optional().catch(undefined),
});
export type VaultTaskListParams = z.infer<typeof vaultTaskListParams>;

export async function listVaultTasks(
  params: VaultTaskListParams,
  /* ADR-074 — `visible` is the tenancy wall (services/vault/tenancy.ts).
     REQUIRED, never defaulted: a default would be "the whole platform", which
     is exactly the leak this argument exists to close. */
  visible: readonly VaultCompany[],
  now = new Date(),
) {
  const where: Prisma.VaultTaskWhereInput = {
    archived: params.archived,
    ...(params.employeeId ? { employeeId: params.employeeId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...vaultCompanyWhereNullable(visible, params.company),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await db.vaultTask.findMany({
    where,
    /* "open first, deadline ascending" — the next thing due sits on top
       ("open" < "completed" alphabetically, exactly as the reference §9.2) */
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
    include: {
      employee: { select: { id: true, name: true, active: true } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });

  return rows
    .map((t) => ({
      ...t,
      links: parseResultLinks(t.resultLinks),
      /* live warning, distinct from the frozen wasLate of completed tasks */
      isOverdue: t.status === "open" && isOverdue(t.deadline, now),
    }))
    .filter((t) => (params.overdue ? t.isOverdue : true));
}

export async function getVaultTask(id: string) {
  const task = await db.vaultTask.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, active: true } },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!task) throw new ApiError(404, "Task not found");
  return { ...task, links: parseResultLinks(task.resultLinks) };
}

export async function createVaultTask(
  input: VaultTaskInput,
  /* ADR-074 — the tenancy wall (services/vault/tenancy.ts). REQUIRED. */
  visible: readonly VaultCompany[],
  actor: Actor,
) {
  /* ADR-074 — the ASSIGNEE is resolved by id, which was proof of nothing once
     employee cards became company-tagged: a guessed id assigned work to another
     company's person, and the task then appeared on a card its own company
     cannot see. The card must be one this account can see. */
  const employee = await db.vaultEmployee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, name: true, active: true, company: true },
  });
  if (!employee || !visibleCompany(visible, employee.company)) {
    throw new ApiError(404, "Employee not found");
  }
  if (!employee.active) throw new ApiError(400, "This employee card is deactivated");

  return db.$transaction(async (tx) => {
    const task = await tx.vaultTask.create({
      data: {
        employeeId: input.employeeId,
        name: input.name,
        description: input.description,
        company: input.company ?? null,
        deadline: input.deadline,
      },
    });
    await writeLog(tx, {
      entityType: "vault_task",
      entityId: task.id,
      actor,
      action: "create",
      trigger: `assigned to ${employee.name}, due ${input.deadline}`,
    });
    await invalidateUndo(tx, actor);
    return task;
  });
}

/**
 * Edit / reassign. The reference AC-12 lives here: there is deliberately NO
 * recompute call — editing the deadline of a completed task must not touch its
 * stored lateness, so wasLate/daysLate/completedAt are absent from the update.
 */
export async function updateVaultTask(
  id: string,
  input: VaultTaskInput,
  /* ADR-074 — the tenancy wall (services/vault/tenancy.ts). REQUIRED. */
  visible: readonly VaultCompany[],
  actor: Actor,
) {
  /* ADR-074 — REASSIGNMENT is the same wall as creation (see createVaultTask). */
  const assignee = await db.vaultEmployee.findUnique({
    where: { id: input.employeeId },
    select: { company: true },
  });
  if (!assignee || !visibleCompany(visible, assignee.company)) {
    throw new ApiError(404, "Employee not found");
  }
  const before = await db.vaultTask.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "Task not found");
  assertNotArchived(before);

  if (before.employeeId !== input.employeeId) {
    const employee = await db.vaultEmployee.findUnique({ where: { id: input.employeeId } });
    if (!employee) throw new ApiError(404, "Employee not found");
    if (!employee.active) throw new ApiError(400, "This employee card is deactivated");
  }

  return db.$transaction(async (tx) => {
    const task = await tx.vaultTask.update({
      where: { id },
      data: {
        employeeId: input.employeeId,
        name: input.name,
        description: input.description,
        company: input.company ?? null,
        deadline: input.deadline,
        // wasLate / daysLate / completedAt absent ON PURPOSE (frozen forever).
      },
    });
    await writeLog(tx, {
      entityType: "vault_task",
      entityId: id,
      actor,
      action: "update",
      trigger: "vault_task_update",
    });
    if (before.employeeId !== input.employeeId) {
      await writeLog(tx, {
        entityType: "vault_task",
        entityId: id,
        actor,
        action: "update",
        trigger: `reassigned ${before.employeeId} -> ${input.employeeId}`,
      });
    }
    await invalidateUndo(tx, actor);
    return task;
  });
}

/* -------------------------------------------------- the result + the gate */

type StoredUpload = { key: string; filename: string; mime: string; size: number };

/** Validate + store result files BEFORE any transaction; ids attach inside it.
    On a later failure the caller deletes these keys — no orphaned blobs. */
async function storeResultFiles(files: File[]): Promise<StoredUpload[]> {
  const stored: StoredUpload[] = [];
  try {
    for (const f of files) stored.push(await validateAndStore("vault_attachment", f));
    return stored;
  } catch (err) {
    for (const s of stored) await blobStorage.delete(s.key);
    throw err;
  }
}

async function cleanupUploads(stored: StoredUpload[]) {
  for (const s of stored) await blobStorage.delete(s.key);
}

function mergedResult(
  task: { resultText: string | null; resultLinks: string },
  payload: VaultResultInput,
): { resultText: string | null; links: ResultLink[]; addedLinks: number } {
  const resultText =
    payload.resultText !== undefined
      ? payload.resultText?.trim()
        ? payload.resultText.trim()
        : null
      : task.resultText;
  const existing = parseResultLinks(task.resultLinks);
  const added = (payload.links ?? []).map((l) => ({ url: l.url, label: l.label ?? null }));
  return { resultText, links: [...existing, ...added], addedLinks: added.length };
}

/** "Save for later" — adds to the result WITHOUT completing (reference §9.3).
    Kept separate so the gate lives in exactly one place: completeVaultTask. */
export async function saveVaultTaskResult(
  id: string,
  payload: VaultResultInput,
  files: File[],
  actor: Actor,
) {
  const probe = await db.vaultTask.findUnique({ where: { id } });
  if (!probe) throw new ApiError(404, "Task not found");
  assertNotArchived(probe);
  if (probe.status !== "open") throw new ApiError(422, "That task is already completed.");
  if (payload.resultText === undefined && !payload.links?.length && files.length === 0) {
    throw new ApiError(422, "Nothing to save.");
  }

  const stored = await storeResultFiles(files);
  try {
    return await db.$transaction(async (tx) => {
      const task = await tx.vaultTask.findUniqueOrThrow({ where: { id } });
      const merged = mergedResult(task, payload);
      if (stored.length) {
        await tx.attachment.createMany({
          data: stored.map((s) => ({
            kind: "vault_attachment",
            vaultTaskId: id,
            filename: s.filename,
            storageKey: s.key,
            mime: s.mime,
            size: s.size,
          })),
        });
      }
      const updated = await tx.vaultTask.update({
        where: { id },
        data: { resultText: merged.resultText, resultLinks: JSON.stringify(merged.links) },
      });
      await writeLog(tx, {
        entityType: "vault_task",
        entityId: id,
        actor,
        action: "update",
        trigger: `result saved (${stored.length} file(s), ${merged.addedLinks} link(s))`,
      });
      await invalidateUndo(tx, actor);
      return updated;
    });
  } catch (err) {
    await cleanupUploads(stored);
    throw err;
  }
}

/**
 * THE ONLY code path that completes a vault task.
 *
 * Applies whatever the result panel sent, re-checks the gate inside the
 * transaction, stamps SERVER time, computes lateness ONCE and stores it
 * frozen. A 422 leaves the task open and commits nothing.
 */
export async function completeVaultTask(
  id: string,
  payload: VaultResultInput,
  files: File[],
  actor: Actor,
) {
  const probe = await db.vaultTask.findUnique({ where: { id } });
  if (!probe) throw new ApiError(404, "Task not found");
  assertNotArchived(probe);

  const stored = await storeResultFiles(files);
  try {
    return await db.$transaction(async (tx) => {
      const task = await tx.vaultTask.findUniqueOrThrow({
        where: { id },
        include: { attachments: { select: { id: true } } },
      });
      if (task.status !== "open") {
        throw new ApiError(422, "That task is already completed.");
      }

      const merged = mergedResult(task, payload);
      if (stored.length) {
        await tx.attachment.createMany({
          data: stored.map((s) => ({
            kind: "vault_attachment",
            vaultTaskId: id,
            filename: s.filename,
            storageKey: s.key,
            mime: s.mime,
            size: s.size,
          })),
        });
      }

      const attachmentCount = task.attachments.length + stored.length;

      /* THE GATE (reference BR-05): any ONE of text / file / link. */
      const hasResult =
        Boolean(merged.resultText?.trim()) || attachmentCount > 0 || merged.links.length > 0;
      if (!hasResult) {
        throw new ApiError(
          422,
          "Add a result before completing this task — a note, a file, or a link.",
        );
      }

      const completedAt = new Date(); // SERVER time (reference BR-06)
      const { wasLate, daysLate } = computeLateness(task.deadline, completedAt); // frozen (BR-07)

      const updated = await tx.vaultTask.update({
        where: { id },
        data: {
          status: "completed",
          completedAt,
          wasLate,
          daysLate,
          resultText: merged.resultText,
          resultLinks: JSON.stringify(merged.links),
        },
      });

      await writeLog(tx, {
        entityType: "vault_task",
        entityId: id,
        actor,
        action: "complete",
        fromStage: "open",
        toStage: "completed",
        trigger: wasLate ? `late by ${daysLate} day(s)` : "on time",
      });
      /* Completion freezes a lateness record — NOT undoable (reopen is the
         audited way back). Consuming pending entries keeps the undo button
         honest: it never offers anything older than the last action. */
      await invalidateUndo(tx, actor);
      return updated;
    });
  } catch (err) {
    await cleanupUploads(stored);
    throw err;
  }
}

/**
 * Reopening (reference §9.5): completion fields cleared, the result text and
 * attachments STAY, and the erased values are recorded — provenance for the
 * performance record this wipes. Admin-only by construction (every vault
 * caller is behind requireBsAdmin).
 */
export async function reopenVaultTask(id: string, actor: Actor) {
  return db.$transaction(async (tx) => {
    const task = await tx.vaultTask.findUnique({ where: { id } });
    if (!task) throw new ApiError(404, "Task not found");
    assertNotArchived(task);
    if (task.status !== "completed") throw new ApiError(422, "That task is not completed.");

    const updated = await tx.vaultTask.update({
      where: { id },
      data: { status: "open", completedAt: null, wasLate: null, daysLate: null },
    });
    await writeLog(tx, {
      entityType: "vault_task",
      entityId: id,
      actor,
      action: "reopen",
      fromStage: "completed",
      toStage: "open",
      trigger: `was ${task.wasLate ? `late by ${task.daysLate} day(s)` : "on time"}, completed ${task.completedAt?.toISOString() ?? "?"}`,
    });
    await invalidateUndo(tx, actor);
    return updated;
  });
}

export const archiveVaultTask = (id: string, actor: Actor) =>
  setVaultArchived("vault_task", id, true, actor);
export const restoreVaultTask = (id: string, actor: Actor) =>
  setVaultArchived("vault_task", id, false, actor);
