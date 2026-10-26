import type { CSSProperties } from "react";

/* A thin progress bar — the To-Do's day, a won deal's milestones (crm.css
   `.crm-meter`). Server-safe (no hooks): it is drawn at its FINAL geometry by
   the server, so with no JavaScript and no motion it is already correct; with
   motion it draws in once per visit and eases when the value changes.

   aria-hidden: it is a picture of figures the page already states in words
   (the Done heading's count, the milestone rows' own ticks) — never the only
   carrier of the number. */
export function Meter({ value, total, className }: { value: number; total: number; className?: string }) {
  if (total <= 0) return null;
  const v = Math.max(0, Math.min(1, value / total));
  return (
    <span className={className ? `crm-meter ${className}` : "crm-meter"} aria-hidden="true">
      <span className="crm-meter-fill" style={{ "--v": v } as CSSProperties} />
    </span>
  );
}
