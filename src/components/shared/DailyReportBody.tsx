import Link from "next/link";
import { formatCairoDate, formatCairoTime, startOfCairoDay } from "@/lib/datetime";
import { formatMsg, tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { dailyReport as m, interactionPhrase } from "@/lib/i18n/dict/daily-report";
import { calendarPage } from "@/lib/i18n/dict/calendar";
import { acctCompanies } from "@/lib/i18n/dict/accounting";
import { archiveMsgs } from "@/lib/i18n/dict/crm";
import {
  isViaLabel,
  type DailyReport,
  type ReportDay,
  type ReportLeadRow,
} from "@/lib/services/daily-report";

/* ============================================================================
   ADR-081 — THE DAILY REPORT, on screen.

   Founder: "it should have a display on the number: how many leads did you
   interact with this day, and what interactions were those." So the NUMBER comes
   first, three times over — one tile per day, the count in the biggest type on
   the page — and every lead beneath it is a LINK, because "when I click on the
   lead I go to the lead".

   THREE DAYS, ALWAYS THREE SECTIONS. A day he did nothing reads as a calm
   explicit zero with its own date; an omitted section would look like the page
   failed to load, which is the one thing a report must never look like.

   ZERO NEW TOKENS, and every colour comes from a token that is already declared
   in all three scopes (byteforce, b-systems, neutral) — a token missing from one
   scope paints nothing, because design-system.css spends them through bare var()
   with no fallback. Two RULES were added (`.tl-list--head` / `.tl-list--tail`,
   review Run 097) because this is the first screen to split one timeline across a
   fold; they re-spend existing tokens and declare no colour of their own. The
   timeline is otherwise the same `.tl-*` rail the per-lead History panel uses,
   which is the right visual echo: this screen is that panel's TRANSPOSE — the
   same rows, grouped by person and day instead of by lead.

   THE CLOCK IS NEVER BUILT HERE. `formatCairoTime` only (ADR-068), which is
   why `datetime.sweep.test.ts` needs no new ALLOWED entry for this file. Day
   HEADINGS are Today / Yesterday / a bare date — deliberately no weekday, since
   the only weekday formatter in the product is allowlisted to the dashboard. */

/** How many interaction lines a row shows before the rest fold away. Three is
    the number that keeps a busy day readable at 390px without hiding the shape
    of it; the tail is a native <details>, so there is no client component and
    no JavaScript involved. */
const VISIBLE_INTERACTIONS = 3;

export async function DailyReportBody({
  report,
  viewerName,
  now,
}: {
  report: DailyReport;
  /** the reader's own name. A line names its actor only when the stored label is
      an IMPERSONATION label ("Omar Agent (via Elmur)") AND that label is not the
      reader's own — i.e. only for the LEAD CHAT, the one writer in this product
      that records an impersonator (see `isViaLabel`). A label that merely differs
      is not evidence of a second actor: it is history, so an account renamed
      yesterday would otherwise wear its old name on every row. */
  viewerName: string;
  now: Date;
}) {
  const locale = await getLocale();
  const t = tFor(locale);
  const empty = report.days.every((d) => d.leadCount === 0);

  const dayLabel = (day: ReportDay, index: number): string => {
    const date = formatCairoDate(startOfCairoDay(day.date), locale);
    if (index === 0) return `${t(m.today)} · ${date}`;
    if (index === 1) return `${t(m.yesterday)} · ${date}`;
    return date;
  };

  const leadRow = (row: ReportLeadRow) => {
    const hidden = Math.max(0, row.interactions.length - VISIBLE_INTERACTIONS);
    return (
      <li key={row.leadId} className="record-group">
        {/* flex-wrap, gap, no physical left/right property — RTL-correct by
            order, and it wraps rather than pushing the page sideways at 390px */}
        <div className="flex items-baseline gap-2 flex-wrap">
          {row.href && row.name ? (
            /* A LEAD NAME IS FREE TEXT, up to 200 characters with no space in it
               if that is what he typed. `min-w-0 wrap-anywhere` is what the rest
               of the product already does with user text in a narrow column
               (.bcard-name, .bcard-meta) — without it the flex item cannot shrink
               below its min-content width and ONE long token pushes the whole page
               sideways at 390px, which is the Global DoD property this screen's
               width sweep exists to hold. Review, Run 097. */
            <Link
              href={row.href}
              className="record-title underline underline-offset-2 min-w-0 wrap-anywhere"
            >
              {row.name}
            </Link>
          ) : (
            /* BUILT, not stripped (ADR-071's pattern): there is no name and no
               href to render, so the row says which of the two it is. It still
               COUNTS — dropping it would shrink the number he asked for. */
            <span className="record-title text-brand-muted">
              {t(row.redacted === "deleted" ? m.deletedLead : m.outOfScopeLead)}
            </span>
          )}
          {row.brand ? (
            /* on EVERY row, so two companies' leads can never be confused */
            <span className="badge badge--entity">{t(acctCompanies[row.brand]!)}</span>
          ) : null}
          {row.archived ? (
            <span className="badge badge--archived">{t(archiveMsgs.archived)}</span>
          ) : null}
          <span className="record-time">
            {t(formatMsg(m.interactionsCount, { n: String(row.interactions.length) }))}
          </span>
        </div>
        {/* THE FOLD SPLITS ONE TIMELINE ACROSS TWO LISTS, and `.tl-*`'s rail and
            live dot are POSITIONAL rules (`:last-child` drops the rail, so the
            line ends; `:first-child` paints the newest dot). Split naively, line
            three lost its rail — a gap in the middle of the day — and line four
            wore a second "this is the latest" dot. `.tl-list--head` /
            `.tl-list--tail` put both facts back where they belong: the day's line
            runs on THROUGH the fold and only the genuinely newest line is live.
            Review, Run 097. */}
        <ol className={hidden > 0 ? "mt-2 tl-list--head" : "mt-2"}>
          {row.interactions.slice(0, VISIBLE_INTERACTIONS).map((i) => interactionLine(i))}
        </ol>
        {hidden > 0 ? (
          <details className="mt-1">
            {/* `list-none` is what actually removes the triangle: Chromium draws a
                summary's marker through `::marker` on `display: list-item`, and
                Firefox never supported the WebKit pseudo-element at all — which is
                kept only as the Safari fallback. `min-h-11` is the house 44px thumb
                target (ADR-060), the one interactive control this page adds. */}
            <summary className="u-muted underline underline-offset-2 cursor-pointer py-2 min-h-11 flex items-center list-none [&::-webkit-details-marker]:hidden">
              {t(formatMsg(calendarPage.moreCount, { n: String(hidden) }))}
            </summary>
            <ol className="mt-2 tl-list--tail">
              {row.interactions.slice(VISIBLE_INTERACTIONS).map((i) => interactionLine(i))}
            </ol>
          </details>
        ) : null}
      </li>
    );
  };

  function interactionLine(i: ReportLeadRow["interactions"][number]) {
    return (
      <li key={i.id} className="tl-row">
        <span className="tl-rail" aria-hidden>
          <span className="tl-dot" />
        </span>
        <div className="tl-text flex flex-wrap items-baseline gap-x-2 pb-3">
          <span className="tl-time">{formatCairoTime(i.at, locale)}</span>
          <span className="tl-pill">{interactionPhrase(locale, i)}</span>
          {isViaLabel(i.actorLabel) && i.actorLabel !== viewerName ? (
            <span className="u-muted">{i.actorLabel}</span>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(m.eyebrow)}</p>
          <h1 className="u-h1">
            {t(m.title)} — {formatCairoDate(now, locale)}
          </h1>
          <p className="u-sub">{t(m.subtitle)}</p>
          <p className="u-muted">
            {t(m.ownOnly)} {t(m.bothCompanies)}
          </p>
        </div>
      </div>

      {/* THE NUMBER HE ASKED FOR, one tile per day, biggest type on the page */}
      <div className="tile-grid">
        {report.days.map((day, index) => (
          <div key={day.date} className="tile">
            <p className="tile-label">{dayLabel(day, index)}</p>
            <p className="tile-value">{day.leadCount}</p>
            <p className="tile-delta">
              {t(m.leadsTouched)} ·{" "}
              {t(formatMsg(m.interactionsCount, { n: String(day.interactionCount) }))}
            </p>
          </div>
        ))}
      </div>

      {empty ? (
        /* the tiles above still read a calm 0 · 0 · 0; this says why, because on
           a brand-new account — and on the seeded demo database, whose history
           carries no actor — there is genuinely nothing yet */
        <p className="empty">{t(m.emptyAll)}</p>
      ) : (
        report.days.map((day, index) => (
          <section key={day.date} className="card card--flush0">
            <div className="card-head">
              <h2 className="u-h3">{dayLabel(day, index)}</h2>
              <span className="chip-outline">
                {t(formatMsg(m.leadsCount, { n: String(day.leadCount) }))}
              </span>
            </div>
            <div className="card-pad">
              {day.leads.length === 0 ? (
                <p className="empty">{t(m.emptyDay)}</p>
              ) : (
                <ul className="space-y-2">{day.leads.map((row) => leadRow(row))}</ul>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
