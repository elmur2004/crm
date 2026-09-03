"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { identifierKind, normalizePhone } from "./phone";
import { landingFor } from "./landing";
import type { Role } from "@/lib/pipeline-engine/constants";

/* Consolidated sign-in (ADR-028): one action, one page. After authentication the
   user lands where their roles point. NOTE: auth() cannot see the just-set session
   cookie within the same request, so the landing roles are read from the DB. */

/* the map itself lives in ./landing so the page guards can share it */

export async function login(formData: FormData): Promise<void> {
  /* self-healing: the admin account is guaranteed usable (created/repaired,
     password pinned to the configured value) before any sign-in is evaluated.
     If the database/schema blocks even that, say SO — not "wrong password". */
  const { ensureAdminExists } = await import("@/lib/services/bootstrap");
  if ((await ensureAdminExists()) === "failed") redirect("/login?error=health");
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");
  /* founder: self-signups are approval REQUESTS — tell pending/declined users
     what is happening instead of the generic wrong-credentials error */
  const preWhere =
    identifierKind(identifier) === "email"
      ? { email: identifier.trim().toLowerCase() }
      : { phone: normalizePhone(identifier) };
  const preUser = await db.user
    .findUnique({ where: preWhere as never, select: { registrationStatus: true } })
    .catch(() => null);
  if (preUser?.registrationStatus === "pending") redirect("/login?error=pending");
  if (preUser?.registrationStatus === "rejected") redirect("/login?error=rejected");
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
  /* signOut({redirectTo}) absolutizes the path against the proxy-reported
     scheme — behind a proxy that misreports x-forwarded-proto it emits an
     http:// Location and downgrades the browser off https. A relative
     redirect() can never change the scheme. */
  await signOut({ redirect: false });
  redirect(redirectTo);
}

/* V2 §2.10 — admin opens any account directly (no re-login). The session
   remembers the admin (impersonatorId) so "Back to admin" snaps back any time. */
export async function impersonate(targetUserId: string): Promise<void> {
  const { requireRole } = await import("@/lib/auth/guards");
  const { mintImpersonationToken } = await import("@/lib/services/users");
  const adminUser = await requireRole("bsystems_admin");
  /* ADR-075 — a B-Systems admin impersonates B-SYSTEMS' people. The service
     404s a Mindoo account, which is the whole point: impersonation hands you a
     session as the target, so an unscoped mint is every wall opened at once. */
  const token = await mintImpersonationToken(
    targetUserId,
    "bsystems",
    { id: adminUser.id, label: adminUser.name },
    { impersonatorId: adminUser.id },
  );
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

/* Snap back to the admin who started the impersonation (founder: "back and
   forth, any time"). Only a session that legitimately carries impersonatorId
   can do this; the admin's account is re-checked (exists, active, still admin). */
export async function endImpersonation(): Promise<void> {
  const { auth } = await import("@/lib/auth");
  const { mintImpersonationToken } = await import("@/lib/services/users");
  const session = await auth();
  const impersonatorId = session?.user?.impersonatorId;
  if (!impersonatorId) redirect("/login");
  const admin = await db.user.findUnique({
    where: { id: impersonatorId },
    include: { roles: true },
  });
  if (!admin || !admin.active || !admin.roles.some((r) => r.role === "bsystems_admin")) {
    redirect("/login");
  }
  /* snapping BACK to the admin: the target is the B-Systems admin himself,
     already re-checked above, so his own scope is the right one to mint under */
  const token = await mintImpersonationToken(
    admin.id,
    "bsystems",
    { id: admin.id, label: admin.name },
    { trigger: "impersonation_return" }, // no impersonatorId — a clean admin session
  );
  try {
    await signIn("impersonation", { token, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login");
    throw err;
  }
  redirect(landingFor(admin.roles.map((r) => r.role) as Role[]));
}
