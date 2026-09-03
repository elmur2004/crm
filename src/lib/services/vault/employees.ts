import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { writeLog, type Actor } from "../activity";
import { invalidateUndo } from "../undo";
import { isOverdue } from "./lateness";
import { optionalText, zVaultCompany } from "./common";
import type { VaultCompany } from "./constants";
import { vaultCompanyWhereNullable } from "./tenancy";

/* ADR-053 — vault employees are assignee CARDS: name / title / company.
   No userId, no email, no invitations, no logins (founder decision §7.3 —
   every auth column of the reference Employee model is deleted, not rebuilt).
   Cards DEACTIVATE, never delete (reference BR-13): a deactivated card stops
   taking new tasks but its history — and its frozen lateness — stays. */

export const vaultEmployeeSchema = z.object({
  name: z.string().trim().min(1, "Enter the employee's name.").max(120),
  title: optionalText(120),
  company: zVaultCompany.nullish().default(null), // null = both companies
});
export type VaultEmployeeInput = z.infer<typeof vaultEmployeeSchema>;

export async function createVaultEmployee(input: VaultEmployeeInput, actor: Actor) {
  return db.$transaction(async (tx) => {
    const employee = await tx.vaultEmployee.create({
      data: { name: input.name, title: input.title, company: input.company ?? null },
    });
    await writeLog(tx, {
      entityType: "vault_employee",
      entityId: employee.id,
      actor,
      action: "create",
      trigger: "vault_employee_create",
    });
    await invalidateUndo(tx, actor); // not on the undo allowlist — be honest about it
    return employee;
  });
}

export async function updateVaultEmployee(id: string, input: VaultEmployeeInput, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.vaultEmployee.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Employee not found");
    const employee = await tx.vaultEmployee.update({
      where: { id },
      data: { name: input.name, title: input.title, company: input.company ?? null },
    });
    await writeLog(tx, {
      entityType: "vault_employee",
      entityId: id,
      actor,
      action: "update",
      trigger: "vault_employee_update",
    });
    await invalidateUndo(tx, actor);
    return employee;
  });
}

/** Deactivate / reactivate — the card equivalent of archive (reference BR-13). */
export async function setVaultEmployeeActive(id: string, active: boolean, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.vaultEmployee.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Employee not found");
    if (existing.active === active) return existing;
    const employee = await tx.vaultEmployee.update({ where: { id }, data: { active } });
    await writeLog(tx, {
      entityType: "vault_employee",
      entityId: id,
      actor,
      action: "update",
      trigger: active ? "reactivated" : "deactivated",
    });
    await invalidateUndo(tx, actor);
    return employee;
  });
}

export type VaultEmployeeCard = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  active: boolean;
  openCount: number;
  overdueCount: number;
  completedCount: number;
};

/**
 * The reference §9.1 — employee cards with open / overdue / completed counts,
 * overdue highlighted when above zero. Archived tasks are out of every count.
 * "Overdue" is the LIVE flag (today past deadline), never the frozen wasLate.
 */
export async function listVaultEmployeeCards(
  /* ADR-074 — the companies this account may see; see services/vault/tenancy.
     REQUIRED, never defaulted, because the default would be the platform. */
  visible: readonly VaultCompany[],
  opts?: {
    includeInactive?: boolean;
    now?: Date;
  },
): Promise<VaultEmployeeCard[]> {
  const employees = await db.vaultEmployee.findMany({
    where: {
      ...(opts?.includeInactive ? {} : { active: true }),
      /* ADR-074 — an employee card is company-tagged (nullable: null has always
         meant "not tagged", and those cards belong to the original pair). */
      ...vaultCompanyWhereNullable(visible, undefined),
    },
    orderBy: { name: "asc" },
  });
  if (employees.length === 0) return [];

  /* ADR-074 — the COUNTS are scoped too. The cards were narrowed and their
     open/overdue/completed figures were not, so a shared employee card read
     "7 open, 2 overdue" to a company that could see none of the seven — a
     number about work it is not entitled to know exists. */
  const tasks = await db.vaultTask.findMany({
    where: {
      archived: false,
      employeeId: { in: employees.map((e) => e.id) },
      ...vaultCompanyWhereNullable(visible, undefined),
    },
    select: { employeeId: true, status: true, deadline: true },
  });

  return employees.map((e) => {
    const mine = tasks.filter((t) => t.employeeId === e.id);
    const open = mine.filter((t) => t.status === "open");
    return {
      id: e.id,
      name: e.name,
      title: e.title,
      company: e.company,
      active: e.active,
      openCount: open.length,
      overdueCount: open.filter((t) => isOverdue(t.deadline, opts?.now)).length,
      completedCount: mine.filter((t) => t.status === "completed").length,
    };
  });
}
