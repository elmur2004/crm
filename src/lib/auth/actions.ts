"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { identifierKind, normalizePhone } from "./phone";
import type { Role } from "@/lib/pipeline-engine/constants";

/* Consolidated sign-in (ADR-028): one action, one page. After authentication the
   user lands where their roles point. NOTE: auth() cannot see the just-set session
   cookie within the same request, so the landing roles are read from the DB. */

const LANDING_PRIORITY: Array<[Role, string]> = [
  ["bsystems_admin", "/b-systems"],
  ["byteforce_staff", "/byteforce"],
  ["bsystems_sales", "/b-systems/crm"],
  ["bsystems_agent", "/b-systems/crm"],
  ["bsystems_partner", "/b-systems/crm"],
];

function landingFor(roles: Role[]): string {
  for (const [role, target] of LANDING_PRIORITY) {
    if (roles.includes(role)) return target;
  }
  return "/login?error=1";
}

export async function login(formData: FormData): Promise<void> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("unified", { identifier, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw err;
  }
  const where =
    identifierKind(identifier) === "email"
      ? { email: identifier.trim().toLowerCase() }
      : { phone: normalizePhone(identifier) };
  const user = await db.user.findUnique({ where: where as never, include: { roles: true } });
  redirect(landingFor((user?.roles.map((r) => r.role) ?? []) as Role[]));
}

export async function logout(redirectTo: string): Promise<void> {
  await signOut({ redirectTo });
}

/* V2 §2.10 — admin opens any account directly (no re-login). */
export async function impersonate(targetUserId: string): Promise<void> {
  const { requireRole } = await import("@/lib/auth/guards");
  const { mintImpersonationToken } = await import("@/lib/services/users");
  const adminUser = await requireRole("bsystems_admin");
  const token = await mintImpersonationToken(targetUserId, {
    id: adminUser.id,
    label: adminUser.name,
  });
  try {
    await signIn("impersonation", { token, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) redirect("/b-systems/users?error=impersonation");
    throw err;
  }
  const target = await db.user.findUnique({
    where: { id: targetUserId },
    include: { roles: true },
  });
  redirect(landingFor((target?.roles.map((r) => r.role) ?? []) as Role[]));
}
