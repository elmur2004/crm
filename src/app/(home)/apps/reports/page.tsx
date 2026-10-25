import Link from "next/link";
import { redirect } from "next/navigation";
import "@/themes/launcher.css";
import { AppIcon, type Glyph } from "@/components/launcher/AppIcon";
import { LauncherChrome } from "@/components/launcher/LauncherChrome";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { launcher, launcherReports as r } from "@/lib/i18n/dict/launcher";
import { LAUNCHER_PATH, reportsFor, type ReportId } from "@/lib/launcher/apps";
import { requireLauncherUser } from "@/lib/launcher/guard";

export async function generateMetadata() {
  const t = tFor(await getLocale());
  return { title: `${t(r.title)} — ${t(launcher.platform)}` };
}

/* ============================================================================
   REPORTS & DASHBOARDS — the launcher's one second-level screen.

   Founder: "reports + dashboards" as ONE icon. The product has six of them,
   spread over THREE apps' chromes — the two company dashboards and the daily
   report live in the merged CRM, the dashboard, the monthly P&L and the
   department profitability live in Accounting — and no single header nav
   holds them all. So the tile cannot lead "straight to the main dashboard"
   without hiding the other five, and for a sales rep the B-Systems dashboard
   is not even a screen he can open (the page bounces every non-admin to his
   board). A small index is the honest destination: it lists exactly the ones
   THIS account can open (lib/launcher/apps.ts, reportsFor), grouped by app.

   When an account can open only ONE of them (a rep's daily report), the tile
   skips this screen and opens it directly — a list of one is a click that asks
   nothing. Somebody who arrives here by URL anyway is shown that one entry;
   somebody with none is sent back to the grid, which will not show him the
   tile either.

   Same wall as the grid: outside the proxy matcher, guarded first.
   ========================================================================== */

const GLYPH: Record<ReportId, { glyph: Glyph; tone?: Glyph }> = {
  "bs-dashboard": { glyph: "reports" },
  "bf-dashboard": { glyph: "reports" },
  "daily-report": { glyph: "todo", tone: "reports" },
  "acct-dashboard": { glyph: "accounting" },
  "acct-pnl": { glyph: "reports", tone: "accounting" },
  "acct-departments": { glyph: "pie", tone: "accounting" },
};

export default async function ReportsPage() {
  const user = await requireLauncherUser();
  const entries = reportsFor(user);
  if (entries.length === 0) redirect(LAUNCHER_PATH);

  const locale = await getLocale();
  const t = tFor(locale);
  const groups = [
    { id: "crm" as const, title: t(r.groupCrm) },
    { id: "accounting" as const, title: t(r.groupAccounting) },
  ]
    .map((g) => ({ ...g, items: entries.filter((e) => e.group === g.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="lx-shell">
      <LauncherChrome locale={locale} userName={user.name} />
      <main className="lx-main lx-main--wide">
        <p className="lx-back-row">
          <Link href={LAUNCHER_PATH} prefetch={false} className="lx-back">
            <span className="lx-back-arrow" aria-hidden="true" />
            {t(launcher.allApps)}
          </Link>
        </p>
        <div className="lx-page-head">
          <AppIcon glyph="reports" palette="neutral" />
          <div>
            <h1 className="lx-page-title">{t(r.title)}</h1>
            <p className="lx-page-sub">{t(r.sub)}</p>
          </div>
        </div>
        {groups.map((group) => (
          <section key={group.id} className="lx-group" aria-labelledby={`lx-group-${group.id}`}>
            <h2 id={`lx-group-${group.id}`} className="lx-group-title">
              {group.title}
            </h2>
            <ul className="lx-list" role="list">
              {group.items.map((entry) => (
                <li key={entry.id}>
                  <Link href={entry.href} prefetch={false} className="lx-entry" data-report={entry.id}>
                    <AppIcon
                      glyph={GLYPH[entry.id].glyph}
                      tone={GLYPH[entry.id].tone}
                      palette={entry.palette}
                      size="small"
                    />
                    <span className="lx-entry-text">
                      <span className="lx-entry-title">{t(entry.label)}</span>
                      <span className="lx-entry-desc">{t(entry.description)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
