import Link from "next/link";
import { redirect } from "next/navigation";
import "@/themes/launcher.css";
import { AppIcon } from "@/components/launcher/AppIcon";
import { LauncherChrome } from "@/components/launcher/LauncherChrome";
import { AppGround } from "@/components/shared/AppGround";
import { AllUsersBody } from "@/components/users/AllUsersBody";
import { MyAccountBody } from "@/components/users/MyAccountBody";
import { MassAssignBody } from "@/components/users/MassAssignBody";
import { UndoControl } from "@/components/shared/UndoControl";
import { impersonate } from "@/lib/auth/actions";
import { landingFor } from "@/lib/auth/landing";
import { BOOTSTRAP_ADMIN_EMAILS } from "@/lib/services/bootstrap";
import { ASSIGNABLE_ROLES } from "@/lib/services/users";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { launcher } from "@/lib/i18n/dict/launcher";
import { usersAdmin } from "@/lib/i18n/dict/admin";
import { usersApp as m } from "@/lib/i18n/dict/users-app";
import { LAUNCHER_PATH, USERS_PATH } from "@/lib/launcher/apps";
import { requireLauncherUser } from "@/lib/launcher/guard";

export async function generateMetadata() {
  const t = tFor(await getLocale());
  return { title: `${t(usersAdmin.meta)} — ${t(launcher.platform)}` };
}

/* ============================================================================
   THE USERS APP — /users (ADR-103).

   Founder, 2026-11-14: "make sure that in the main page the welcome page there
   is a dedicated icon for the users. The users currently for the entire
   systems are sitting inside the bsystems CRM. Separate it, just put the
   users, every single type of users, put it in a different app … for the
   admin he of course can change all the users and all of that. If it's for a
   normal user, he can click on it to change his information too, so he can
   change his name, he can change his password and all of that."

   So ONE app, beside the launcher, in the launcher's own clothes (its bar, its
   glass ground, the "All apps" link back) and in NO company's: it lives in the
   brand-neutral (home) group, not in the B-Systems shell it used to be a page
   of. Two views, chosen by who you are, never by the address alone:

     the B-Systems admin   "All users" — every account of every type, to add,
                           edit, remove, delete or open — and "My account"
     everybody else        "My account" — his own details and password

   `?tab=me` is a same-page control (one-way.test.ts: tabs are not
   navigation); for anybody but the admin there is no other view to ask for,
   so the parameter is simply moot — the admin check below is the wall, read
   from the LIVE roles on this request (requireUser, ADR-017), never from the
   address. Every write the "All users" view makes is `requireBsAdmin` again
   on the server; My account writes only the session's own row (/api/me).

   Same wall as the grid: outside the proxy matcher, so `requireLauncherUser`
   is the only gate, and it runs FIRST. An account with no role at all has no
   app to manage itself from either, and goes where the launcher sends it.
   ========================================================================== */

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    error?: string;
    /* ADR-105 — the mass-assign view of All users, and its filters */
    assign?: string;
    company?: string;
    owner?: string;
    stage?: string;
    q?: string;
  }>;
}) {
  const user = await requireLauncherUser();
  if (user.roles.length === 0) redirect(landingFor(user.roles));

  const params = await searchParams;
  const admin = user.roles.includes("bsystems_admin");
  const view: "all" | "me" = admin && params.tab !== "me" ? "all" : "me";
  /* ADR-105 — "Assign leads" from a row: a view of All users, so the admin's
     alone, and only while the All users tab is the one open. Everybody else's
     page ignores the parameter exactly as it ignores `?tab=all`. */
  const assignTo =
    view === "all" && typeof params.assign === "string" && /^[\w-]{1,64}$/.test(params.assign)
      ? params.assign
      : null;
  const locale = await getLocale();
  const t = tFor(locale);

  return (
    <div className="lx-shell">
      {/* the sign-in's ground, behind the glass frame (glass.css) */}
      <AppGround variant="rich" />
      <LauncherChrome locale={locale} userName={user.name} />
      <main className="lx-main lx-main--app">
        <p className="lx-back-row">
          <Link href={LAUNCHER_PATH} prefetch={false} className="lx-back">
            <span className="lx-back-arrow" aria-hidden="true" />
            {t(launcher.allApps)}
          </Link>
        </p>
        <div className="lx-page-head">
          <AppIcon glyph="users" palette="neutral" />
          <div>
            <h1 className="lx-page-title">{admin ? t(usersAdmin.title) : t(m.titleMe)}</h1>
            <p className="lx-page-sub">{view === "all" ? t(m.subAll) : t(m.subMe)}</p>
          </div>
        </div>
        {admin ? (
          <nav className="lx-tabs" aria-label={t(m.tabsAria)}>
            <Link
              href={USERS_PATH}
              prefetch={false}
              className="nav-item"
              aria-current={view === "all" ? "page" : undefined}
            >
              {t(m.tabAll)}
            </Link>
            <Link
              href={`${USERS_PATH}?tab=me`}
              prefetch={false}
              className="nav-item"
              aria-current={view === "me" ? "page" : undefined}
            >
              {t(m.tabMe)}
            </Link>
          </nav>
        ) : null}
        {params.error === "impersonation" && admin ? (
          <p role="alert" className="alert-error lx-alert">
            {t(m.impersonationFailed)}
          </p>
        ) : null}
        <div className="lx-app-body">
          {assignTo ? (
            <MassAssignBody
              viewer={{ id: user.id, roles: user.roles }}
              targetId={assignTo}
              params={{ company: params.company, owner: params.owner, stage: params.stage, q: params.q }}
            />
          ) : view === "all" ? (
            <AllUsersBody
              ctx={{
                apiBase: "/api/b-systems",
                assignableRoles: ASSIGNABLE_ROLES,
                bootstrapAdminEmails: BOOTSTRAP_ADMIN_EMAILS,
                impersonate,
              }}
              viewerId={user.id}
              viewerRoles={user.roles}
            />
          ) : (
            <MyAccountBody userId={user.id} />
          )}
        </div>
      </main>
      {/* ADR-105 — a mass assign is ONE undo step; the shells' own floating
          pill offers it right here, where it happened */}
      {assignTo ? <UndoControl userId={user.id} /> : null}
    </div>
  );
}
