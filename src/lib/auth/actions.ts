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
  ["byteforce_staff", "/byteforce"],
  ["bsystems_staff", "/b-systems"],
  ["platform_admin", "/byteforce"], // ADR-029 (entity switcher round)
  ["portal_admin", "/portal/admin"],
  ["portal_rep", "/portal/crm"],
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
