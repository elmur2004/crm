/* Numeric-first dashboard stat (SPEC §2: dashboards are numeric-first). */
export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4">
      <p className="text-xs uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="font-brand-display text-2xl font-bold mt-1">{value}</p>
      {hint ? <p className="text-xs text-brand-muted mt-1">{hint}</p> : null}
    </div>
  );
}
