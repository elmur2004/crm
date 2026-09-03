import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
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

/* ADR-075 — MINDOO'S USERS.

   Founder: "mindoo user should appear in mindoo system not in bsystems systems
   separate their users." ADR-073 had decided the opposite — accounts are
   platform-wide, administered from B-Systems — and flagged it for confirmation;
   this is the confirmation, and it goes the other way.

   The screen is the B-Systems one, shared rather than copied (UsersBody), with
   three things different and every one of them passed in:

     · the SCOPE is Mindoo, so the list holds Mindoo's accounts and nobody
       else's, and every write is refused on an account outside it;
     · the grantable roles are Mindoo's alone, so this page cannot mint a
       B-Systems admin any more than /b-systems/users can mint a Mindoo one;
     · there is NO impersonation. B-Systems has had it since V2 §2.10 because it
       has agents and partners whose accounts an admin may need to stand in.
       Mindoo has one staff role and therefore nobody to impersonate — and
       impersonation is the sharpest tool in the product, so it is not offered
       where it has no use.

   Every one of those is a courtesy: the SERVICE enforces the scope and the
   grant on its own, which is what makes sharing this screen safe. */

export default async function MindooUsersPage() {
  const user = await requireMindooPage();
  return (
    <UsersBody
      ctx={{
        scope: "mindoo",
        apiBase: MINDOO_SURFACE.apiBase,
        assignableRoles: grantableRoles("mindoo"),
        bootstrapAdminEmails: BOOTSTRAP_ADMIN_EMAILS,
      }}
      viewerId={user.id}
    />
  );
}
