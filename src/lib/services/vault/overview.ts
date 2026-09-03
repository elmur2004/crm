import { db } from "@/lib/db";
import { isOverdue } from "./lateness";
import type { VaultCompany } from "./constants";
import { vaultCompanyWhere, vaultCompanyWhereNullable } from "./tenancy";

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


/* Every vault record id this account may see. Built once per overview render;
   the vault is a registry rather than a feed, so this is a few hundred ids at
   worst — and correctness here is worth a query the page already amortises
   over seven others. `vault_employee` is in VAULT_LOG_TYPES but employees are
   logged by their own id, so they are resolved too. */
async function visibleIdsFor(visible: readonly VaultCompany[]): Promise<string[]> {
  const mine = vaultCompanyWhere(visible, undefined);
  const mineNullable = vaultCompanyWhereNullable(visible, undefined);
  const [forms, links, sheets, documents, tasks, employees] = await Promise.all([
    db.vaultForm.findMany({ where: mine, select: { id: true } }),
    db.vaultLink.findMany({ where: mine, select: { id: true } }),
    db.vaultSheet.findMany({ where: mine, select: { id: true } }),
    db.vaultDocument.findMany({ where: mine, select: { id: true } }),
    db.vaultTask.findMany({ where: mineNullable, select: { id: true } }),
    db.vaultEmployee.findMany({ where: mineNullable, select: { id: true } }),
  ]);
  return [...forms, ...links, ...sheets, ...documents, ...tasks, ...employees].map((r) => r.id);
}

export async function vaultOverview(
  /* ADR-074 — the companies this account may see; see services/vault/tenancy.
     REQUIRED, never defaulted, because the default would be the platform. */
  visible: readonly VaultCompany[],
  now = new Date(),
): Promise<VaultOverview> {
  /* ADR-074 — every count on this landing is scoped to the account's own
     companies. An unscoped count is a disclosure in itself: "37 documents"
     tells a Mindoo account how much another company has filed. */
  const mine = vaultCompanyWhere(visible, undefined);
  const mineNullable = vaultCompanyWhereNullable(visible, undefined);
  const visibleIds = () => visibleIdsFor(visible);
  const [forms, links, sheets, documents, openTaskRows, archivedCounts, activity] =
    await Promise.all([
      db.vaultForm.count({ where: { archived: false, ...mine } }),
      db.vaultLink.count({ where: { archived: false, ...mine } }),
      db.vaultSheet.count({ where: { archived: false, ...mine } }),
      db.vaultDocument.count({ where: { archived: false, ...mine } }),
      db.vaultTask.findMany({
        where: { archived: false, status: "open", ...mineNullable },
        select: { deadline: true },
      }),
      Promise.all([
        db.vaultForm.count({ where: { archived: true, ...mine } }),
        db.vaultLink.count({ where: { archived: true, ...mine } }),
        db.vaultSheet.count({ where: { archived: true, ...mine } }),
        db.vaultDocument.count({ where: { archived: true, ...mine } }),
        db.vaultTask.count({ where: { archived: true, ...mineNullable } }),
      ]),
      /* ADR-074 — SCOPED BY ENTITY, because ActivityLog has no company column
         and cannot have one: it is the platform's log, and its rows point at
         entities of every kind. So the visible ids are resolved first (the four
         company-required tables and the two nullable ones, each through the
         same wall the lists use) and the feed is narrowed to them.

         This was the one query on this page with no wall at all, and it is the
         loudest thing on the screen: "Mona Adel archived Q4 Contract" tells a
         reader the record exists, who touched it and when. A count leaks a
         number; an activity line leaks a sentence. */
      db.activityLog.findMany({
        where: { entityType: { in: VAULT_LOG_TYPES }, entityId: { in: await visibleIds() } },
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
