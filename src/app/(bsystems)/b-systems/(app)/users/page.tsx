import { redirect } from "next/navigation";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { bsRoleOf } from "@/lib/api/bsystems";
import { impersonate } from "@/lib/auth/actions";
import { BOOTSTRAP_ADMIN_EMAILS } from "@/lib/services/bootstrap";
import { grantableRoles } from "@/lib/services/user-tenancy";
import { UsersBody } from "@/components/bsystems/pages/UsersBody";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { usersAdmin as d } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(d.meta) };
}

/* V2 §2.10 — every user; create with role/entity assignment; remove
   (deactivate, reversible); impersonate = open their account directly.

   ADR-067 — a B-Systems-ONLY section: refused under company=byteforce, and
   refused BEFORE the role narrowing below, so a ByteForce-only teammate is
   redirected rather than falling into bsRoleOf and turning into a 500. Past
   this line bsRoleOf is TOTAL: holding "bsystems" is exactly holding one of the
   five B-Systems roles, so it can no longer throw.

   ADR-075 — and it is B-SYSTEMS' PEOPLE only. Mindoo administers its own at
   /mindoo/users; neither list contains the other's accounts, and neither
   administrator can edit, deactivate, delete or impersonate across. */

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { user } = await requireCompanySection(
    "bsystems",
    (await searchParams).company,
    BS_PIPELINE_ROLES,
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  return (
    <UsersBody
      ctx={{
        scope: "bsystems",
        apiBase: "/api/b-systems",
        assignableRoles: grantableRoles("bsystems"),
        bootstrapAdminEmails: BOOTSTRAP_ADMIN_EMAILS,
        impersonate,
      }}
      viewerId={user.id}
    />
  );
}
