/* KPI tile (spec §2.3) — numeric-first dashboard stat. */
export function StatCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className={warn ? "tile tile--warn" : "tile"}>
      <span className="tile-dot" aria-hidden />
      <p className="tile-label">{label}</p>
      <p className="tile-value">{value}</p>
      {hint ? <p className="tile-delta">{hint}</p> : null}
    </div>
  );
}
