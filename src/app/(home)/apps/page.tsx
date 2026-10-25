import { redirect } from "next/navigation";
import "@/themes/launcher.css";
import { LauncherChrome } from "@/components/launcher/LauncherChrome";
import { LauncherGrid } from "@/components/launcher/LauncherGrid";
import { landingFor } from "@/lib/auth/landing";
import { formatCairoDate } from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { launcher } from "@/lib/i18n/dict/launcher";
import { launcherTilesFor } from "@/lib/launcher/apps";
import { greetingFor } from "@/lib/launcher/greeting";
import { requireLauncherUser } from "@/lib/launcher/guard";

export async function generateMetadata() {
  const t = tFor(await getLocale());
  return { title: `${t(launcher.metaTitle)} — ${t(launcher.platform)}` };
}

/* ============================================================================
   THE APP LAUNCHER — /apps.

   Founder: "It should be something like this, with little icons opening each
   section: accounting; each CRM, byteforce and bsystems; vault; to-do; reports
   + dashboards; partners and agents group them in an icon also." He chose HOME
   AFTER SIGN-IN: this is where signing in lands, and a home icon in every app
   header comes back here.

   This does NOT contradict the recorded directive on the platform root
   ((home)/page.tsx: the root goes straight to sign-in, "no hub stop"). That
   directive is about the page BEFORE sign-in; this is the page AFTER it, and
   an anonymous visitor never sees it — the guard below sends him to /login.

   IN THE (home) GROUP ON PURPOSE: that group's root layout is the
   brand-neutral one and already stamps data-brand="neutral", the theme
   (data-theme, from the cookie) and the language — so this page needed no
   layout of its own and touched no existing file. It is OUTSIDE the proxy
   matcher, so `requireLauncherUser` is the only wall, and it runs FIRST,
   before anything reads a cookie or the database for display.

   The stylesheet is imported HERE, by the page, so it loads only where the
   launcher renders (App Router allows a global stylesheet from a page).
   ========================================================================== */

export default async function LauncherPage() {
  const user = await requireLauncherUser();
  const tiles = launcherTilesFor(user);
  /* an account with no app at all has nothing to launch: it goes where its
     roles already point (for a role-less account that is the sign-in page's
     error, the same answer sign-in itself gives it) */
  if (tiles.length === 0) redirect(landingFor(user.roles));

  const locale = await getLocale();
  const t = tFor(locale);
  const now = new Date();

  return (
    <div className="lx-shell">
      <LauncherChrome locale={locale} userName={user.name} />
      <main className="lx-main">
        <div className="lx-hello">
          <p className="lx-date">{formatCairoDate(now, locale)}</p>
          <h1 className="lx-greeting">{t(greetingFor(now, user.name))}</h1>
        </div>
        <section className="lx-apps" aria-labelledby="lx-apps-heading">
          <h2 id="lx-apps-heading" className="lx-apps-heading">
            {t(launcher.appsHeading)}
          </h2>
          <LauncherGrid
            labelledBy="lx-apps-heading"
            items={tiles.map((tile) => ({
              id: tile.id,
              href: tile.href,
              label: t(tile.label),
              palette: tile.palette,
            }))}
          />
        </section>
      </main>
    </div>
  );
}
