import { db } from "@/lib/db";
import { isOverdue } from "./lateness";

/* ADR-053 Phase 5 — the vault landing: live counts per kind + the module's
   recent activity (append-only log, newest first). */

export type VaultOverview = {
  forms: number;
  links: number;
  sheets: number;
  documents: number;
  openTasks: number;
  overdueTasks: number;
  archived: number;
  activity: Array<{
    id: string;
    entityType: string;
    action: string;
    actorLabel: string;
    trigger: string;
    createdAt: Date;
  }>;
};

const VAULT_LOG_TYPES = [
  "vault_employee",
  "vault_form",
  "vault_link",
  "vault_sheet",
  "vault_document",
  "vault_task",
];

export async function vaultOverview(now = new Date()): Promise<VaultOverview> {
  const [forms, links, sheets, documents, openTaskRows, archivedCounts, activity] =
    await Promise.all([
      db.vaultForm.count({ where: { archived: false } }),
      db.vaultLink.count({ where: { archived: false } }),
      db.vaultSheet.count({ where: { archived: false } }),
      db.vaultDocument.count({ where: { archived: false } }),
      db.vaultTask.findMany({
        where: { archived: false, status: "open" },
        select: { deadline: true },
      }),
      Promise.all([
        db.vaultForm.count({ where: { archived: true } }),
        db.vaultLink.count({ where: { archived: true } }),
        db.vaultSheet.count({ where: { archived: true } }),
        db.vaultDocument.count({ where: { archived: true } }),
        db.vaultTask.count({ where: { archived: true } }),
      ]),
      db.activityLog.findMany({
        where: { entityType: { in: VAULT_LOG_TYPES } },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          entityType: true,
          action: true,
          actorLabel: true,
          trigger: true,
          createdAt: true,
        },
      }),
    ]);

  return {
    forms,
    links,
    sheets,
    documents,
    openTasks: openTaskRows.length,
    overdueTasks: openTaskRows.filter((t) => isOverdue(t.deadline, now)).length,
    archived: archivedCounts.reduce((s, n) => s + n, 0),
    activity,
  };
}
