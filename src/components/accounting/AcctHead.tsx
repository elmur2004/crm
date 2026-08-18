import type { ReactNode } from "react";
import { tFor, type Locale, type Msg } from "@/lib/i18n/core";
import type { AcctView } from "@/lib/accounting/params";
import { AcctControls } from "./controls";

/* ADR-052 / ADR-054 — the shared accounting page chrome: eyebrow/title/sub on
   the left, the company + month controls on the right. The section nav lives
   in the module's app-shell header now (AcctModuleNav) — the module is a
   switcher peer, so its sections sit where every app's sections sit. Month-
   scoped pages mirror the SPA (roster/targets/loans/clients/import hide the
   picker). */

export function AcctHead({
  view,
  locale,
  eyebrow,
  eyebrowExtra,
  eyebrowAccent = false,
  title,
  sub,
  showMonth = true,
}: {
  view: AcctView;
  locale: Locale;
  eyebrow: Msg;
  /** appended after the eyebrow as " · extra" — the SPA's "Overview · June 2026" */
  eyebrowExtra?: string;
  /** ADR-054 dashboard exception: the SPA's brand-colored (accent) eyebrow */
  eyebrowAccent?: boolean;
  title: Msg;
  sub?: Msg;
  showMonth?: boolean;
}) {
  const t = tFor(locale);
  return (
    <div className="page-head">
      <div>
        <p className={eyebrowAccent ? "u-eyebrow acct-eyebrow-accent" : "u-eyebrow"}>
          {t(eyebrow)}
          {eyebrowExtra ? ` · ${eyebrowExtra}` : null}
        </p>
        <h1 className="u-h1">{t(title)}</h1>
        {sub ? <p className="u-sub">{t(sub)}</p> : null}
      </div>
      <AcctControls company={view.company} month={view.month} showMonth={showMonth} />
    </div>
  );
}

/* ---- ADR-054 dashboard exception: the ORIGINAL SPA's KPI card ----
   White card, 3px inline-start accent edge, uppercase label, COLORED figure.
   Tones map the SPA's semantic coloring onto brand tokens (see the .acct-kpi
   rules); `accent` mirrors the SPA passing/omitting its accent bar. */
export type AcctKpiTone = "success" | "danger" | "warning" | "net" | "muted";

export function AcctKpi({
  label,
  value,
  sub,
  tone,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: AcctKpiTone;
  accent?: boolean;
}) {
  return (
    <div className="acct-kpi" data-tone={tone}>
      {accent ? <span className="acct-kpi-accent" aria-hidden /> : null}
      <span className="acct-kpi-label">{label}</span>
      <span className="acct-kpi-value">{value}</span>
      {sub ? <span className="acct-kpi-sub">{sub}</span> : null}
    </div>
  );
}

/** token-driven status chip: good=indigo intake tint (NOT the won/accent chip —
    Signal Pink stays the Won cue only, brand-audit ADR-046 precedent: Collected/
    Paid/Active are the MAJORITY states of mature books and would drown it) ·
    wait=following tint · off=didn't-answer tint */
export function AcctChip({ kind, children }: { kind: "good" | "wait" | "off"; children: ReactNode }) {
  const key = kind === "good" ? "intake" : kind === "wait" ? "following" : "didnt-answer";
  return (
    <span className="stage-chip" data-stage-key={key}>
      {children}
    </span>
  );
}

/** dashboard stat tile (tokens only; tone via brand utilities) */
export function AcctTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  /* no "accent" tone by design: accent is a cue, never KPI data ink */
  tone?: "success" | "danger";
}) {
  const toneCls =
    tone === "success" ? " text-brand-success" : tone === "danger" ? " text-brand-danger" : "";
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className={`tile-value${toneCls}`}>{value}</span>
      {sub ? <span className="tile-delta">{sub}</span> : null}
    </div>
  );
}
