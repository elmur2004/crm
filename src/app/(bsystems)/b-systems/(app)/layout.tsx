import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { CompanySwitch } from "@/components/shared/CompanySwitch";
import {
  CrmHomeLink,
  CrmShellBell,
  CrmShellNav,
  type PerCompany,
} from "@/components/shared/CrmShellNav";
import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { EntitySwitch } from "@/components/shared/EntitySwitch";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { UndoControl } from "@/components/shared/UndoControl";
import { logout } from "@/lib/auth/actions";
import { landingFor } from "@/lib/auth/landing";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOrNull } from "@/lib/api/bsystems";
import { CRM_ROLES, companiesFor, defaultCompanyFor } from "@/lib/crm/company";
import { crmHomeFor, crmNavFor } from "@/lib/crm/nav";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { nav, roles } from "@/lib/i18n/dict/crm";
import { regRoleBadges } from "@/lib/i18n/dict/admin";

/* V2 §2 — ONE role-aware B-Systems app. Chrome per the approved prototype
   (spec §2.1): dark indigo header for admin + internal sales; agents/partners
   keep the deep-navy external identity (data-shell="external", spec R8).
   Guards stay server-side — the nav only mirrors them.

   ADR-067 — and it is now the ONE shell for BOTH companies. The founder:
   "I don't need [the whole ByteForce interface]. I don't want it. I just want
   the b systems CRM. I can have a switch button between b systems and byte
   force, and the entire boards change accordingly."

   So switching company changes the DATA and never the skin: same header, same
   mark, same colours, same data-brand="bsystems" on <html>. That retires the
   ByteForce-branded app shell from the product — a real consequence of what he
   asked for, recorded in ADR-067 and flagged for his confirmation in PROGRESS,
   because SPEC section 4 still calls App A the ByteForce-branded app. The
   ByteForce TOKENS are untouched and still in use by the accounting module's
   per-company scope; it is one shell that retired, not a brand.

   This layout can enforce only "does this account hold ANY company" — a server
   layout can read neither searchParams nor the pathname. The per-company wall
   is requireCompanyPage / requireCompanySection in every page, swept by
   page-company-guards.integration.test so a page cannot quietly skip it. */

const ROLE_LABELS: Record<string, Msg> = roles;

export default async function BSystemsAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requirePageRole("/login", ...CRM_ROLES);
  const locale = await getLocale();
  const t = tFor(locale);
  /* the TOTAL helper: bsRoleOf THROWS for a ByteForce-only account, and this
     is a LAYOUT — a throw here would 500 the whole app for the teammate whose
     own CRM it is supposed to be rendering (ADR-067) */
  const role = bsRoleOrNull(user);
  const companies = companiesFor(user.roles);
  const fallback = defaultCompanyFor(user.roles);
  /* belt: requirePageRole already refused an account holding none of the six
     CRM roles. Fail closed rather than render a shell with no company. */
  if (!fallback) redirect(landingFor(user.roles));

  const external = role === "bsystems_agent" || role === "bsystems_partner";
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  /* Everything company-shaped is decided HERE, on the server, from the live
     roles — one entry per company this account actually holds. The client
     chrome only picks between what it was handed, so a company he does not
     hold has no nav, no home and no bell to render. */
  const navs: PerCompany<Array<{ href: string; label: string }>> = {};
  const homes: PerCompany<string> = {};
  const bells: PerCompany<{ apiBase: string; leadPathBase: string; leadQuery: string }> = {};
  for (const company of companies) {
    navs[company] = crmNavFor(company, role).map((item) => ({
      href: item.href,
      label: t(item.label),
    }));
    homes[company] = crmHomeFor(company, role);
  }
  if (companies.includes("bsystems") && role !== "bsystems_data_entry") {
    /* ADR-051: a data-entry account receives no notifications and is not
       granted the notifications endpoint — a bell that can only ever poll a
       403 is worse than no bell. */
    bells.bsystems = {
      apiBase: "/api/b-systems",
      leadPathBase: "/b-systems/crm/lead",
      leadQuery: "?company=bsystems",
    };
  }
  if (companies.includes("byteforce")) {
    bells.byteforce = {
      apiBase: "/api/byteforce",
      leadPathBase: "/b-systems/leads/lead",
      leadQuery: "?company=byteforce",
    };
  }
  /* ADR-074 — Mindoo's bell rings in Mindoo's own shell, not this one. */

  const roleLabel = role
    ? (ROLE_LABELS[role] ? t(ROLE_LABELS[role]!) : null)
    : /* a ByteForce-only teammate has no B-Systems role to print; reuse the
         label the Registrations screen already gives him rather than invent
         a new string */
      t(regRoleBadges.byteforce_staff!);

  return (
    <>
      <ImpersonationBar />
      <header className="app-header" data-shell={external ? "external" : undefined}>
        {/* founder: the REAL B-Systems mark; clicking it goes to THIS app's
            landing for the current role AND company — never the platform root,
            and never the other company's home */}
        <CrmHomeLink homes={homes} fallback={fallback} label={t(nav.bsystemsHome)}>
          <BrandLogo brand="bsystems" variant="mark" height={40} />
          <span className="wordmark">B-Systems</span>
        </CrmHomeLink>
        <CrmShellNav
          navs={navs}
          fallback={fallback}
          /* The sheet carries the header controls whose header twin is hidden
             at <=820px (LanguageToggle, EntitySwitch, Log out — see
             design-system.css). The company switch is deliberately NOT among
             them: it does not live in the header at all, it lives in the page
             below, where it is on screen at EVERY width. Putting it here too
             would render two live "Switch company" groups on a phone whenever
             the burger is open (review, Run 080). */
          extras={
            <>
              <LanguageToggle />
              <EntitySwitch user={user} current="crm" />
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
          <CrmShellBell bases={bells} fallback={fallback} />
          <EntitySwitch user={user} current="crm" />
          <span className="user-avatar" aria-hidden>
            {initials}
          </span>
          <span className="user-meta">
            <span className="user-name block">{user.name}</span>
            <span className="user-role block">{roleLabel}</span>
          </span>
          <form action={logout.bind(null, "/login")}>
            <button type="submit" className="nav-item" title={user.name}>
              {t(nav.logOut)}
            </button>
          </form>
        </div>
      </header>
      {/* ADR-060 — the phone module bar (<=820px), directly under the header.
          ADR-067 shortened it to three segments: the two CRMs became one. */}
      <EntitySwitch variant="bar" user={user} current="crm" />
      {/* ADR-056: the full-width query container the board measures itself
          against. 50cqw is the content width EXCLUDING the scrollbar —
          the quantity 50vw cannot express — so the full-bleed board is
          pixel-exact at every browser zoom. Drop this wrapper and the
          board silently falls back to the old vw arithmetic. */}
      <div className="shell-body">
        <main className="page max-w-7xl mx-auto w-full">
          {/* ADR-067 — the company switch, in the page and labelled, so it can
              never be mistaken for the module bar above it. In the SHELL, so
              no screen can forget to render it. */}
          <CompanySwitch companies={companies} fallback={fallback} />
          {children}
        </main>
      </div>
      <UndoControl userId={user.id} />
    </>
  );
}
