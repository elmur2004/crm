import Link from "next/link";
import { leadHref } from "@/lib/crm/surface";
import { formatCairoRelative, formatCairoShort } from "@/lib/datetime";
import { interactionPhrase } from "@/lib/i18n/dict/daily-report";
import { dash as m } from "@/lib/i18n/dict/dashboard";
import type { ActivityRow } from "@/lib/services/dashboard";
import { Panel } from "./Panel";
import type { DashCtx } from "./ctx";

/* W13 — the latest lead activity this reader may see (restores the approved
   "Recent activity" feed, dashboard spec A14). Each row is phrased by the
   daily report's OWN resolver (`interactionPhrase`), so the two screens can
   never describe one history row two ways; an impersonated action prints its
   "(via …)" label exactly as stored. Archived leads stay, badged (ADR-081).
   This is team activity — nothing a client does is recorded (spec §10.2). */

export function ActivityFeed({ rows, now, ctx }: { rows: ActivityRow[]; now: Date; ctx: DashCtx }) {
  const { t } = ctx;
  return (
    <Panel
      id="db-activity"
      className="db-w-activity"
      title={t(m.activity)}
      eyebrow={t(m.latest)}
      data={{ "data-metric": "activity", "data-value": rows.length }}
    >
      {rows.length === 0 ? (
        <p className="db-empty">{t(m.noActivity)}</p>
      ) : (
        <ol className="db-feed">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={leadHref(ctx.brand, row.lead.id)} prefetch={false} className="db-feed-row">
                <span className="db-feed-dot" aria-hidden />
                <span className="db-feed-body">
                  <span className="db-feed-line">
                    <span className="db-feed-actor">{row.actorLabel}</span>
                    <span aria-hidden> · </span>
                    <span>{interactionPhrase(ctx.locale, row)}</span>
                  </span>
                  <span className="db-feed-meta">
                    <span className="db-feed-lead">{row.lead.name}</span>
                    {row.lead.archived ? <span className="db-pill db-pill--muted">{t(m.archived)}</span> : null}
                    <time
                      className="db-feed-time"
                      dateTime={row.at.toISOString()}
                      title={formatCairoShort(row.at, ctx.locale)}
                    >
                      {formatCairoRelative(row.at, now, ctx.locale)}
                    </time>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
