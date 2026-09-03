import Link from "next/link";
import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { EntitySwitch } from "@/components/shared/EntitySwitch";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ModuleBrandScope, ModuleLogo } from "@/components/shared/ModuleBrandScope";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { UndoControl } from "@/components/shared/UndoControl";
import { VaultModuleNav } from "@/components/vault/VaultModuleNav";
import { logout } from "@/lib/auth/actions";
import { requireVaultPage } from "@/lib/auth/page-guards";
import { seesUntagged, vaultCompaniesOf } from "@/lib/services/vault/tenancy";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { nav, roles } from "@/lib/i18n/dict/crm";
import { vault } from "@/lib/i18n/dict/vault";
import { mindooShell } from "@/lib/i18n/dict/mindoo";

/* ADR-054 — the Data Vault module's app shell: same chrome contract as the two
   CRM shells (header, module nav, switcher, language toggle, user cluster,
   logout), composed from the same components. Admin-only: the proxy gates the
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
      <ImpersonationBar />
      <header className="app-header">
        {/* founder: "add the bsystems logo for the vault" — the module's header
            identity is PINNED to the real B-Systems mark whatever the company
            FILTER shows, because the vault is B-Systems' registry and the
            filter is a filter.

            ADR-074 — that reasoning holds for the account it was written about
            and not for Mindoo's, which does not have a B-Systems registry to
            put a B-Systems mark on. So the mark is pinned per ACCOUNT: the
            companies it holds decide, and for an account holding only Mindoo
            the header wears Mindoo's. `ModuleLogo` already resolves exactly
            this from the same fallback the brand scope uses. */}
        <Link href="/vault" className="shrink-0 flex items-center gap-3" aria-label={t(vault.navItem)}>
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
        </Link>
        <VaultModuleNav
          extras={
            <>
              <LanguageToggle />
              <EntitySwitch user={user} current="vault" />
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
          <EntitySwitch user={user} current="vault" />
          <span className="user-avatar" aria-hidden>
            {initials}
          </span>
          <span className="user-meta">
            <span className="user-name block">{user.name}</span>
            {/* ADR-074 — the module admits both companies' administrators now,
                so a hardcoded "Admin (B-Systems)" badge was telling Mindoo's
                staff it held a role it does not have. */}
            <span className="user-role block">
              {user.roles.includes("bsystems_admin") ? t(roles.bsystems_admin) : t(mindooShell.roleLabel)}
            </span>
          </span>
          <form action={logout.bind(null, "/login")}>
            <button type="submit" className="nav-item" title={user.name}>
              {t(nav.logOut)}
            </button>
          </form>
        </div>
      </header>
      {/* ADR-060 — the phone's module bar (≤820px), directly under the header */}
      <EntitySwitch variant="bar" user={user} current="vault" />
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
