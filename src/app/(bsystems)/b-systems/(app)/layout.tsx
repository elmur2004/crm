import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { NotificationsBell } from "@/components/bsystems/NotificationsBell";
import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { EntitySwitch } from "@/components/shared/EntitySwitch";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ShellNav } from "@/components/shared/ShellNav";
import { UndoControl } from "@/components/shared/UndoControl";
import { logout } from "@/lib/auth/actions";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { nav, roles } from "@/lib/i18n/dict/crm";
import { todoPage } from "@/lib/i18n/dict/todo";
import { acct } from "@/lib/i18n/dict/accounting";
import { vault } from "@/lib/i18n/dict/vault";

/* V2 §2 — ONE role-aware B-Systems app. Chrome per the approved prototype
   (spec §2.1): dark indigo header for admin + internal sales; agents/partners
   keep the deep-navy external identity (data-shell="external", spec R8).
   Guards stay server-side — the nav only mirrors them. */

const NAV: Record<string, Array<{ href: string; label: Msg }>> = {
  bsystems_admin: [
    { href: "/b-systems", label: nav.home },
    { href: "/b-systems/todo", label: todoPage.navItem },
    { href: "/b-systems/leads", label: nav.leads },
    { href: "/b-systems/crm", label: nav.crm },
    { href: "/b-systems/won-leads", label: nav.wonLeads },
    { href: "/b-systems/partners-pipeline", label: nav.partnersAndAgents },
    { href: "/b-systems/partners", label: nav.partners },
    { href: "/b-systems/agents", label: nav.agents },
    { href: "/b-systems/registrations", label: nav.registrations },
    { href: "/b-systems/statements", label: nav.statements },
    { href: "/b-systems/accounting", label: acct.navItem }, // ADR-052 — admin only
    { href: "/b-systems/vault", label: vault.navItem }, // ADR-053 — admin only
    { href: "/b-systems/users", label: nav.users },
  ],
  bsystems_sales: [
    { href: "/b-systems/crm", label: nav.crm },
    { href: "/b-systems/todo", label: todoPage.navItem },
    { href: "/b-systems/won-leads", label: nav.wonLeads },
  ],
  bsystems_agent: [
    { href: "/b-systems/crm", label: nav.crm },
    { href: "/b-systems/todo", label: todoPage.navItem },
    { href: "/b-systems/won-leads", label: nav.wonLeads },
    { href: "/b-systems/payments", label: nav.payments },
    { href: "/b-systems/profile", label: nav.profile },
  ],
  bsystems_partner: [
    { href: "/b-systems/crm", label: nav.crm },
    { href: "/b-systems/todo", label: todoPage.navItem },
    { href: "/b-systems/won-leads", label: nav.wonLeads },
    { href: "/b-systems/payments", label: nav.payments },
    { href: "/b-systems/profile", label: nav.profile },
  ],
  /* ADR-051 — the data-entry role adds and nothing else, so it has exactly ONE
     destination. A one-item nav is the honest picture of the permission set. */
  bsystems_data_entry: [{ href: "/b-systems/entry", label: nav.dataEntry }],
};

const ROLE_LABELS: Record<string, Msg> = roles;

export default async function BSystemsAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
    "bsystems_data_entry",
  );
  const locale = await getLocale();
  const t = tFor(locale);
  const role = bsRoleOf(user);
  const external = role === "bsystems_agent" || role === "bsystems_partner";
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <ImpersonationBar />
      <header className="app-header" data-shell={external ? "external" : undefined}>
        {/* founder: the REAL B-Systems mark; clicking it goes to THIS app's
            landing for the current role — never the platform root */}
        <Link
          href={NAV[role]![0]!.href}
          className="shrink-0 flex items-center gap-3"
          aria-label={t(nav.bsystemsHome)}
        >
          <BrandLogo brand="bsystems" variant="mark" height={40} />
          <span className="wordmark">B-Systems</span>
        </Link>
        <ShellNav
          items={NAV[role]!.map((item) => ({ href: item.href, label: t(item.label) }))}
          extras={
            <>
              <LanguageToggle />
              <EntitySwitch roles={user.roles} current="bsystems" />
              <form action={logout.bind(null, "/login")}>
                <button type="submit" className="nav-item">
                  {t(nav.logOut)}
                </button>
              </form>
            </>
          }
        />
        <div className="user">
          <LanguageToggle />
          {/* ADR-051: a data-entry account receives no notifications and is not
              granted the notifications endpoint — a bell that can only ever
              poll a 403 is worse than no bell. */}
          {role === "bsystems_data_entry" ? null : <NotificationsBell />}
          <EntitySwitch roles={user.roles} current="bsystems" />
          <span className="user-avatar" aria-hidden>
            {initials}
          </span>
          <span className="user-meta">
            <span className="user-name block">{user.name}</span>
            <span className="user-role block">{ROLE_LABELS[role] ? t(ROLE_LABELS[role]!) : null}</span>
          </span>
          <form action={logout.bind(null, "/login")}>
            <button type="submit" className="nav-item" title={user.name}>
              {t(nav.logOut)}
            </button>
          </form>
        </div>
      </header>
      <main className="page max-w-7xl mx-auto w-full">{children}</main>
      <UndoControl userId={user.id} />
    </>
  );
}
