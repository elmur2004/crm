import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { LauncherHomeLink } from "@/components/launcher/LauncherHomeLink";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ModuleBrandScope, ModuleLogo } from "@/components/shared/ModuleBrandScope";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { AppGround } from "@/components/shared/AppGround";
import { RoutePending } from "@/components/shared/RoutePending";
import { UndoControl } from "@/components/shared/UndoControl";
import { VaultModuleNav } from "@/components/vault/VaultModuleNav";
import { logout } from "@/lib/auth/actions";
import { requireVaultPage } from "@/lib/auth/page-guards";
import { seesUntagged, vaultCompaniesOf } from "@/lib/services/vault/tenancy";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { nav, roles } from "@/lib/i18n/dict/crm";
import { vault } from "@/lib/i18n/dict/vault";

/* ADR-054 — the Data Vault module's app shell: same chrome contract as the
   CRM shell (header, module nav, language toggle, user cluster, logout),
   composed from the same components. One way to each page: the launcher is
   the way between apps (its grid icon heads every header), so the module
   switcher and its phone bar are gone. Admin-only: the proxy gates the
   route group coarsely and this guard is the real wall. No notifications bell —
   the bell belongs to the CRM pipelines, not the registry. */

export default async function VaultShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireVaultPage();
  const locale = await getLocale();
  const t = tFor(locale);
  /* ADR-074 — the vault's unfiltered view shows every company this account
     holds, so it wears the NEUTRAL scope… unless the account holds exactly one,
     in which case the unfiltered view IS that company and neutral would be a
     lie about whose registry is on screen. */
  const visible = vaultCompaniesOf(user);
  const fallbackCompany = visible.length === 1 ? visible[0]! : "neutral";
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ModuleBrandScope module="vault" fallback={fallbackCompany} allowed={visible}>
      {/* the ambient ground — INSIDE the brand scope, so it glows in the
          filtered company's own colours (glass.css) */}
      <AppGround />
      <ImpersonationBar />
      <header className="app-header">
        <LauncherHomeLink locale={locale} />
        {/* founder: "add the bsystems logo for the vault" — the module's header
            identity is PINNED to the real B-Systems mark whatever the company
            FILTER shows, because the vault is B-Systems' registry and the
            filter is a filter.

            ADR-074 — pinned per ACCOUNT rather than globally: the companies it
            holds decide, so an account that does not hold the untagged rows
            wears its own company's mark instead. `ModuleLogo` resolves that
            from the same fallback the brand scope uses. */}
        {/* a plain mark, not a link: the menu's Overview is the one way to the
            overview, and the grid icon the one way back to the launcher */}
        <div className="app-mark shrink-0 flex items-center gap-3">
          {seesUntagged(visible) ? (
            <>
              <BrandLogo brand="bsystems" variant="mark" height={36} />
              <span className="wordmark">{t(vault.navItem)}</span>
            </>
          ) : (
            <ModuleLogo
              module="vault"
              fallback={fallbackCompany}
              allowed={visible}
              wordmark={t(vault.navItem)}
            />
          )}
        </div>
        <VaultModuleNav
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
            <span className="user-role block">
              {t(roles.bsystems_admin)}
            </span>
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
