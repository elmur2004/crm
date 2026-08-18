import Link from "next/link";
import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { EntitySwitch } from "@/components/shared/EntitySwitch";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ModuleBrandScope, ModuleLogo } from "@/components/shared/ModuleBrandScope";
import { UndoControl } from "@/components/shared/UndoControl";
import { VaultModuleNav } from "@/components/vault/VaultModuleNav";
import { logout } from "@/lib/auth/actions";
import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { nav, roles } from "@/lib/i18n/dict/crm";
import { vault } from "@/lib/i18n/dict/vault";

/* ADR-054 — the Data Vault module's app shell: same chrome contract as the two
   CRM shells (header, module nav, switcher, language toggle, user cluster,
   logout), composed from the same components. Admin-only: the proxy gates the
   route group coarsely and this guard is the real wall. No notifications bell —
   the bell belongs to the CRM pipelines, not the registry. */

export default async function VaultShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ModuleBrandScope module="vault">
      <ImpersonationBar />
      <header className="app-header">
        {/* the active COMPANY mark when filtered, the neutral home lockup on "all"
            (directive D); clicking it goes to THIS module's overview */}
        <Link href="/vault" className="shrink-0 flex items-center gap-3" aria-label={t(vault.navItem)}>
          <ModuleLogo module="vault" wordmark={t(vault.navItem)} />
        </Link>
        <VaultModuleNav
          extras={
            <>
              <LanguageToggle />
              <EntitySwitch roles={user.roles} current="vault" />
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
          <EntitySwitch roles={user.roles} current="vault" />
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
      <main className="page max-w-7xl mx-auto w-full">{children}</main>
      <UndoControl userId={user.id} />
    </ModuleBrandScope>
  );
}
