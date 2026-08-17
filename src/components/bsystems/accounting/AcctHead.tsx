import type { ReactNode } from "react";
import { tFor, type Locale, type Msg } from "@/lib/i18n/core";
import type { AcctView } from "@/lib/accounting/params";
import { AcctControls } from "./controls";
import { AcctNav, type AcctTab } from "./AcctNav";

/* ADR-052 — the shared accounting page chrome: eyebrow/title/sub on the left,
   the company + month controls on the right, the tab strip below. Month-scoped
   pages mirror the SPA (roster/targets/loans/clients/import hide the picker). */

export function AcctHead({
  view,
  tab,
  locale,
  eyebrow,
  title,
  sub,
  showMonth = true,
}: {
  view: AcctView;
  tab: AcctTab;
  locale: Locale;
  eyebrow: Msg;
  title: Msg;
  sub?: Msg;
  showMonth?: boolean;
}) {
  const t = tFor(locale);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(eyebrow)}</p>
          <h1 className="u-h1">{t(title)}</h1>
          {sub ? <p className="u-sub">{t(sub)}</p> : null}
        </div>
        <AcctControls company={view.company} month={view.month} showMonth={showMonth} />
      </div>
      <AcctNav view={view} tab={tab} locale={locale} />
    </>
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
