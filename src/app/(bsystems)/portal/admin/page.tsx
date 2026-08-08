import { adminDashboard } from "@/lib/services/portal-admin";
import { StatCard } from "@/components/shared/StatCard";
import { formatEGP } from "@/lib/money";

export const metadata = { title: "Dashboard — Portal Admin" };

/* §8.5.1 — every number a tested formula. */

export default async function AdminDashboard() {
  const d = await adminDashboard();
  return (
    <div className="space-y-6">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total leads" value={String(d.totalLeads)} hint="All reps, all stages" />
        <StatCard label="Total estimated value" value={formatEGP(d.totalEstimatedValue)} />
        <StatCard label="Won deals" value={String(d.wonDealsCount)} />
        <StatCard label="Total commissions" value={formatEGP(d.totalCommissions)} />
      </div>
    </div>
  );
}
