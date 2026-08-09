import Link from "next/link";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { adminWonLeads, closerWonLeads, salesWonLeads } from "@/lib/services/won-leads";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";

export const metadata = { title: "Won Leads — B-Systems CRM" };

/* V2 §2.4/§4 — Won Leads. Admin: every won lead as a card (name, value, closer,
   milestone checks) linking into the detail. Closers see their own with client
   data + milestone progress; commission shows for agents/partners, NEVER for
   internal sales. */

function MilestoneDots({ milestones }: { milestones: Array<{ completed: boolean }> }) {
  return (
    <span className="inline-flex gap-1 align-middle" aria-label="Milestone progress">
      {milestones.map((m, i) => (
        <span
          key={i}
          className={`inline-block w-3 h-3 rounded-full border border-brand-border ${
            m.completed ? "bg-brand-success" : "bg-brand-surface-tint"
          }`}
        />
      ))}
    </span>
  );
}

export default async function WonLeadsPage() {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  const role = bsRoleOf(user);

  if (role === "bsystems_admin") {
    const deals = await adminWonLeads();
    return (
      <div className="space-y-6">
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Won Leads</h1>
        {deals.length === 0 ? (
          <p className="text-sm text-brand-muted">No won leads yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {deals.map((w) => (
              <Link
                key={w.id}
                href={`/b-systems/won-leads/${w.id}`}
                className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4 text-sm space-y-1.5 hover:border-brand-primary"
              >
                <p className="font-bold">{w.lead.name}</p>
                <p>
                  <span className="text-brand-muted">Value:</span> {formatEGP(w.estimatedValue)}
                </p>
                <p>
                  <span className="text-brand-muted">Closer:</span> {w.closer}
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-brand-muted">Milestones:</span>
                  <MilestoneDots milestones={w.milestones} />
                  <span className="text-xs text-brand-muted">
                    {w.milestones.filter((m) => m.completed).length}/{w.milestones.length}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const deals =
    role === "bsystems_sales"
      ? await salesWonLeads()
      : await closerWonLeads(user.id, { showCommission: true });

  return (
    <div className="space-y-6">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Won Leads</h1>
      {deals.length === 0 ? (
        <p className="text-sm text-brand-muted">No won leads yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {deals.map((w) => (
            <div
              key={w.id}
              className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4 text-sm space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{w.lead.name}</p>
                <MilestoneDots milestones={w.milestones} />
              </div>
              <p>
                <span className="text-brand-muted">Number:</span> {w.lead.number}
              </p>
              {w.lead.companyName ? (
                <p>
                  <span className="text-brand-muted">Company:</span> {w.lead.companyName}
                </p>
              ) : null}
              <p>
                <span className="text-brand-muted">Value:</span> {formatEGP(w.estimatedValue)}
              </p>
              {w.totalCommissionPercent != null ? (
                <p>
                  <span className="text-brand-muted">Total commission:</span>{" "}
                  {(w.totalCommissionPercent / 100).toFixed(2).replace(/\.00$/, "")}%
                </p>
              ) : null}
              <div className="border-t border-brand-border pt-2 space-y-1">
                {w.milestones.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <span className={m.completed ? "" : "text-brand-muted"}>
                      {m.completed ? "✓ " : ""}
                      {m.label}
                      {m.locked ? " (locked)" : ""}
                    </span>
                    <span className="text-xs text-brand-muted">
                      {formatEGP(m.value)}
                      {m.commissionValue != null ? ` · commission ${formatEGP(m.commissionValue)}` : ""}
                      {m.expectedEnd ? ` · due ${formatCairoDate(m.expectedEnd)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
