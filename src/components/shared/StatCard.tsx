/* Numeric-first dashboard stat (SPEC §2). Label = the meta layer (JetBrains Mono
   caps under B-Systems, §4.3); value = body face bold (Inter 700 KPI style in
   B-Systems, Lama Sans Bold in ByteForce) — display faces stay on headings. */
export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4">
      <p className="text-brand-meta text-brand-muted">{label}</p>
      <p className="font-brand-body text-2xl font-bold mt-1">{value}</p>
      {hint ? <p className="text-xs text-brand-muted mt-1">{hint}</p> : null}
    </div>
  );
}
