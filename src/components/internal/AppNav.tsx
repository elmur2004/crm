import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { NotificationsBell } from "@/components/bsystems/NotificationsBell";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { EntitySwitch } from "@/components/shared/EntitySwitch";
import { ShellNav } from "@/components/shared/ShellNav";
import { logout } from "@/lib/auth/actions";
import type { ModuleAccessBearer } from "@/lib/auth/roles";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { nav } from "@/lib/i18n/dict/internal";
import { todoPage } from "@/lib/i18n/dict/todo";

/* ByteForce app chrome — the prototype's light header (spec §2.1): white bar,
   notched-square mark, orange-tint active nav. Logical properties only (A-12). */

export async function AppNav({
  basePath,
  userName,
  user,
  extraItems = [],
}: {
  basePath: string;
  userName: string;
  /* ADR-066 — the switcher needs the two module flags as well as the roles, so
     the whole bearer is threaded through (required: see EntitySwitch). */
  user: ModuleAccessBearer;
  extraItems?: Array<{ href: string; label: string }>;
}) {
  const locale = await getLocale();
  const t = tFor(locale);
  const items = [
    { href: basePath, label: t(nav.home) },
    { href: `${basePath}/todo`, label: t(todoPage.navItem) },
    { href: `${basePath}/leads`, label: t(nav.leads) },
    { href: `${basePath}/crm`, label: t(nav.crm) },
    { href: `${basePath}/clients`, label: t(nav.clients) },
    ...extraItems,
  ];
  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <>
    <header className="app-header">
      {/* founder: the REAL ByteForce logo; clicking it goes to THIS app's
          dashboard — never the platform root */}
      <Link href={basePath} className="shrink-0" aria-label={t(nav.byteforceDashboard)}>
        <BrandLogo brand="byteforce" height={30} />
      </Link>
      <ShellNav
        items={items}
        extras={
          <>
            <LanguageToggle />
            <EntitySwitch user={user} current="byteforce" />
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
        <EntitySwitch user={user} current="byteforce" />
        {/* founder V5: lead-chat mentions land here too */}
        <NotificationsBell apiBase="/api/byteforce" leadPathBase={`${basePath}/leads/lead`} />
        <span className="user-avatar" aria-hidden>
          {initials}
        </span>
        <span className="user-meta">
          <span className="user-name block">{userName}</span>
          <span className="user-role block">{t(nav.staff)}</span>
        </span>
        <form action={logout.bind(null, "/login")}>
          <button type="submit" className="nav-item" title={userName}>
            {t(nav.logOut)}
          </button>
        </form>
      </div>
    </header>
    {/* ADR-060 — the phone's module bar (≤820px), directly under the header */}
    <EntitySwitch variant="bar" user={user} current="byteforce" />
    </>
  );
}
