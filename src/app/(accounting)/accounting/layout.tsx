import Link from "next/link";
import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { EntitySwitch } from "@/components/shared/EntitySwitch";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ModuleBrandScope, ModuleLogo } from "@/components/shared/ModuleBrandScope";
import { UndoControl } from "@/components/shared/UndoControl";
import { AcctModuleNav } from "@/components/accounting/AcctModuleNav";
import { logout } from "@/lib/auth/actions";
import { requireAccountingPage } from "@/lib/auth/page-guards";
import { moduleCompaniesFor } from "@/lib/module-companies";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { nav, roles } from "@/lib/i18n/dict/crm";
import { acct } from "@/lib/i18n/dict/accounting";

/* ADR-054 — the accounting module's app shell: same chrome contract as the two
   CRM shells (header, module nav, switcher, language toggle, user cluster,
   logout), composed from the same components. Admin-only: the proxy gates the
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
      <ImpersonationBar />
      <header className="app-header">
        {/* the active COMPANY's real mark + the module wordmark (directive D);
            clicking it goes to THIS module's dashboard */}
        <Link href="/accounting" className="shrink-0 flex items-center gap-3" aria-label={t(acct.navItem)}>
          <ModuleLogo
            module="accounting"
            fallback={fallbackCompany}
            allowed={companies}
            wordmark={t(acct.navItem)}
          />
        </Link>
        <AcctModuleNav
          companies={companies}
          extras={
            <>
              <LanguageToggle />
              <EntitySwitch user={user} current="accounting" />
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
          <EntitySwitch user={user} current="accounting" />
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
      {/* ADR-060 — the phone's module bar (≤820px), directly under the header */}
      <EntitySwitch variant="bar" user={user} current="accounting" />
      {/* ADR-056: the full-width query container the board measures itself
          against. `50cqw` is the content width EXCLUDING the scrollbar —
          the quantity `50vw` cannot express — so the full-bleed board is
          pixel-exact at every browser zoom. Drop this wrapper and the
          board silently falls back to the old vw arithmetic. */}
      <div className="shell-body">
        <main className="page max-w-7xl mx-auto w-full">{children}</main>
      </div>
      <UndoControl userId={user.id} />
    </ModuleBrandScope>
  );
}
