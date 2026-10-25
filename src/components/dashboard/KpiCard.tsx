import type { ReactNode } from "react";
import Link from "next/link";
import type { Delta } from "@/lib/dashboard/delta";
import { DeltaBadge } from "./DeltaBadge";
import { LiveNumber, type LiveFormat } from "./LiveNumber";
import type { DashCtx } from "./ctx";

/* One KPI card (dashboard spec W1–W4). A card that goes somewhere is a LINK
   and only a link card lifts on hover (A12); the win-rate card is not a link
   and does not pretend to be one.

   `data-metric` / `data-value` carry the SERVER value — never the animated
   text — so a test (or anything else) reads the figure without waiting for a
   count to settle (spec §9.5). */

export interface KpiCardProps {
  ctx: DashCtx;
  metric: string;
  /** the raw server value (piasters for money) — data-value */
  dataValue: number | null;
  extraData?: Record<`data-${string}`, string | number>;
  label: string;
  /** the mono time-scope eyebrow: the period, or NOW */
  eyebrow: string;
  value: number | null;
  format: LiveFormat;
  /** printed when value is null ("—") */
  emptyText?: string;
  delta?: Delta;
  /** the previous figure, formatted, for the badge's sentence */
  prevText?: string;
  /** "vs last month" — shown beside the badge */
  vsText?: string;
  /** a "Now" chip instead of a delta */
  chip?: string;
  sub?: ReactNode;
  visual?: ReactNode;
  href?: string;
  hero?: boolean;
}

export function KpiCard(p: KpiCardProps) {
  const className = `db-card db-kpi${p.hero ? " db-kpi--hero" : ""}${p.href ? " db-card--link" : ""}`;
  const body = (
    <>
      <div className="db-kpi-top">
        <span className="db-kpi-label">{p.label}</span>
        <span className="db-eyebrow">{p.eyebrow}</span>
      </div>
      <p className="db-kpi-value">
        {p.value === null ? (
          <span>{p.emptyText ?? "—"}</span>
        ) : (
          <bdi>
            <LiveNumber value={p.value} format={p.format} />
          </bdi>
        )}
      </p>
      {p.delta || p.chip ? (
        <div className="db-kpi-delta-row">
          {p.delta ? (
            <DeltaBadge delta={p.delta} prevText={p.prevText ?? ""} ctx={p.ctx} onDark={p.hero} />
          ) : null}
          {p.chip ? <span className="db-chip-now">{p.chip}</span> : null}
          {p.vsText ? <span className="db-kpi-vs">{p.vsText}</span> : null}
        </div>
      ) : null}
      {p.sub ? <div className="db-kpi-sub">{p.sub}</div> : null}
      {p.visual ? <div className="db-kpi-visual">{p.visual}</div> : null}
    </>
  );
  const data = {
    "data-metric": p.metric,
    "data-value": p.dataValue === null ? "" : String(p.dataValue),
    ...p.extraData,
  };
  return p.href ? (
    <Link href={p.href} prefetch={false} className={className} {...data}>
      {body}
    </Link>
  ) : (
    <div className={className} {...data}>
      {body}
    </div>
  );
}
