import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { LauncherHomeLink } from "@/components/launcher/LauncherHomeLink";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ModuleBrandScope, ModuleLogo } from "@/components/shared/ModuleBrandScope";
import { AppGround } from "@/components/shared/AppGround";
import { RoutePending } from "@/components/shared/RoutePending";
import { UndoControl } from "@/components/shared/UndoControl";
import { AcctModuleNav } from "@/components/accounting/AcctModuleNav";
import { logout } from "@/lib/auth/actions";
import { requireAccountingPage } from "@/lib/auth/page-guards";
import { moduleCompaniesFor } from "@/lib/module-companies";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { nav, roles } from "@/lib/i18n/dict/crm";
import { acct } from "@/lib/i18n/dict/accounting";

/* ADR-054 — the accounting module's app shell: same chrome contract as the
   CRM shell (header, module nav, language toggle, user cluster, logout),
   composed from the same components. One way to each page: the launcher is
   the way between apps (its grid icon heads every header), so the module
   switcher and its phone bar are gone. Admin-only: the proxy gates the
   route group coarsely and this guard is the real wall. No notifications bell —
   the bell belongs to the CRM pipelines, not the books. */

export default async function AccountingShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAccountingPage();
  const locale = await getLocale();
  const t = tFor(locale);
  /* ADR-074 — the company this account's books OPEN on. `acctView` resolves
     the same value on every page below; the shell needs it too, because the
     brand is stamped before any page renders. */
  const companies = moduleCompaniesFor(user.roles);
  const fallbackCompany = companies[0] ?? "byteforce";
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ModuleBrandScope module="accounting" fallback={fallbackCompany} allowed={companies}>
      {/* the ambient ground — INSIDE the brand scope, so it glows in the
          company's own colours (glass.css) */}
      <AppGround />
      <ImpersonationBar />
      <header className="app-header">
        <LauncherHomeLink locale={locale} />
        {/* the active COMPANY's real mark + the module wordmark (directive D).
            A plain mark, not a link: the menu's Dashboard is the one way to the
            dashboard, and the grid icon the one way back to the launcher. */}
        <div className="app-mark shrink-0 flex items-center gap-3">
          <ModuleLogo
            module="accounting"
            fallback={fallbackCompany}
            allowed={companies}
            wordmark={t(acct.navItem)}
          />
        </div>
        <AcctModuleNav
          companies={companies}
          extras={
            <>
              <LanguageToggle />
              <ThemeToggle />
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
          <ThemeToggle compact />
          <span className="user-avatar" aria-hidden>
            {initials}
          </span>
          <span className="user-meta">
            <span className="user-name block">{user.name}</span>
            <span className="user-role block">{t(roles.bsystems_admin)}</span>
          </span>
          <form action={logout.bind(null, "/login")}>
            <button type="submit" className="nav-item" title={user.name}>
              {t(nav.logOut)}
            </button>
          </form>
        </div>
      </header>
      {/* ADR-056: the full-width query container the board measures itself
          against. `50cqw` is the content width EXCLUDING the scrollbar —
          the quantity `50vw` cannot express — so the full-bleed board is
          pixel-exact at every browser zoom. Drop this wrapper and the
          board silently falls back to the old vw arithmetic. */}
      <div className="shell-body">
        <main className="page max-w-7xl mx-auto w-full">
          {/* the instant skeleton on a click to another screen (client
              navigations only — the server still renders the whole page) */}
          <RoutePending>{children}</RoutePending>
        </main>
      </div>
      <UndoControl userId={user.id} />
    </ModuleBrandScope>
  );
}
