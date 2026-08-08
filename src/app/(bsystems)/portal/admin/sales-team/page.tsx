import { requirePageRole } from "@/lib/auth/page-guards";
import { salesTeamTable } from "@/lib/services/portal-admin";
import { STAGE_LABELS, PORTAL_STAGES } from "@/lib/pipeline-engine/constants";
import { formatEGP } from "@/lib/money";

export const metadata = { title: "Sales Team — Portal Admin" };

/* §8.5.4 — the team table, every column per the spec. */

export default async function SalesTeam() {
  await requirePageRole("/portal/login", "portal_admin");
  const rows = await salesTeamTable();

  return (
    <div className="space-y-6">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Sales Team</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-brand-muted">No reps yet.</p>
      ) : (
        <div className="overflow-x-auto border border-brand-border rounded-brand-card bg-brand-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-start p-3 font-bold">Rep name</th>
                <th className="text-start p-3 font-bold">Total leads</th>
                {PORTAL_STAGES.map((s) => (
                  <th key={s} className="text-start p-3 font-bold">
                    {STAGE_LABELS[s]}
                  </th>
                ))}
                <th className="text-start p-3 font-bold">Won deals</th>
                <th className="text-start p-3 font-bold">Won value</th>
                <th className="text-start p-3 font-bold">Total commission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.repId} className="border-b border-brand-border last:border-0">
                  <td className="p-3 font-medium">{row.repName}</td>
                  <td className="p-3">{row.totalLeads}</td>
                  {PORTAL_STAGES.map((s) => (
                    <td key={s} className="p-3">
                      {row.perStage[s] ?? 0}
                    </td>
                  ))}
                  <td className="p-3">{row.wonDeals}</td>
                  <td className="p-3">{formatEGP(row.wonValue)}</td>
                  <td className="p-3">{formatEGP(row.totalCommission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
