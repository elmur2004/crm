import { BrandLogo } from "@/components/shared/BrandLogo";
import { ShellNav } from "@/components/shared/ShellNav";
import { NotificationsBell } from "@/components/bsystems/NotificationsBell";
import { ImpersonationBar } from "@/components/shared/ImpersonationBar";
import { EntitySwitch } from "@/components/shared/EntitySwitch";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { UndoControl } from "@/components/shared/UndoControl";
import Link from "next/link";
import { logout } from "@/lib/auth/actions";
import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import { mindooNav } from "@/lib/crm/nav";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { nav } from "@/lib/i18n/dict/crm";
import { mindooShell } from "@/lib/i18n/dict/mindoo";

/* ADR-074 — MINDOO'S SHELL.

   Read it beside (bsystems)/b-systems/(app)/layout.tsx and the difference is
   the founder's instruction, in one line: THERE IS NO CompanySwitch HERE.
   "remove the switcher from bsystems system seperate them entirly nothing
   inside bsystems goes to mindoo and vice versa." Mindoo is not a company you
   switch to; it is an application you sign in to. Nothing in this tree emits a
   `?company=` (MINDOO_SURFACE.query is the empty string), and nothing in the
   merged shell can name Mindoo — `CrmCompany` no longer contains it, so a link
   from there to here does not typecheck.

   What DOES stay is the EntitySwitch: Accounting and the Data Vault are MODULES
   (ADR-054), peers of the CRM rather than parts of B-Systems, and the founder
   asked for Mindoo to have "vault and accounting and the crm and to do and
   calender". Its CRM segment reads `landingFor`, which sends a Mindoo account
   to /mindoo — the same answer sign-in gives, so the two can never disagree.

   The wall is `requireMindooPage`, re-read from the live User row on every
   request. It is enough on its own HERE, unlike the merged shell's, because
   there is no per-company question left for the pages to answer: a layout that
   cannot read searchParams is a perfectly good wall for an app that does not
   use them. */

export default async function MindooAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireMindooPage();
  const locale = await getLocale();
  const t = tFor(locale);

  const items = mindooNav().map((item) => ({ href: item.href, label: t(item.label) }));
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <ImpersonationBar />
      <header className="app-header">
        <Link
          href={MINDOO_SURFACE.basePath}
          className="shrink-0 flex items-center gap-3"
          aria-label={t(mindooShell.home)}
        >
          <BrandLogo brand="mindoo" variant="mark" height={40} />
        </Link>
        <ShellNav
          items={items}
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
          {/* the bell polls MINDOO's namespace. The brand is derived from the
              ROUTE on the server, so pointing it anywhere else would be both a
              403 and a leak; `leadQuery` is empty because this app has no
              company parameter to carry. */}
          <NotificationsBell
            apiBase={MINDOO_SURFACE.apiBase}
            leadPathBase={`${MINDOO_SURFACE.basePath}/crm/lead`}
            leadQuery={MINDOO_SURFACE.query}
          />
          <EntitySwitch user={user} current="crm" />
          <span className="user-avatar" aria-hidden>
            {initials}
          </span>
          <span className="user-meta">
            <span className="user-name block">{user.name}</span>
            <span className="user-role block">{t(mindooShell.roleLabel)}</span>
          </span>
          <form action={logout.bind(null, "/login")}>
            <button type="submit" className="nav-item" title={user.name}>
              {t(nav.logOut)}
            </button>
          </form>
        </div>
      </header>
      {/* ADR-060 — the phone module bar (≤820px), directly under the header. */}
      <EntitySwitch variant="bar" user={user} current="crm" />
      {/* ADR-056 — the full-width query container the board measures itself
          against. Drop this wrapper and the board silently falls back to the
          old vw arithmetic and misses the scrollbar. */}
      <div className="shell-body">
        <main className="page max-w-7xl mx-auto w-full">{children}</main>
      </div>
      <UndoControl userId={user.id} />
    </>
  );
}
