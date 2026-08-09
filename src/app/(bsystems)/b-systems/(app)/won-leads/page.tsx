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

function markInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

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
        <div className="page-head">
          <div>
            <p className="u-eyebrow">B-SYSTEMS · WON LEADS</p>
            <h1 className="u-h1">Won Leads</h1>
          </div>
        </div>
        {deals.length === 0 ? (
          <p className="empty">No won leads yet.</p>
        ) : (
          <div className="ecard-grid">
            {deals.map((w) => (
              <Link key={w.id} href={`/b-systems/won-leads/${w.id}`} className="ecard">
                <div className="ecard-top">
                  <span className="ecard-mark">{markInitials(w.lead.name)}</span>
                </div>
                <p className="ecard-title">{w.lead.name}</p>
                <p className="ecard-sub">
                  <span>Value:</span> {formatEGP(w.estimatedValue)}
                </p>
                <p className="ecard-sub">
                  <span>Closer:</span> {w.closer}
                </p>
                <p className="ecard-footer flex items-center gap-2">
                  <span>Milestones:</span>
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
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · WON LEADS</p>
          <h1 className="u-h1">Won Leads</h1>
        </div>
      </div>
      {deals.length === 0 ? (
        <p className="empty">No won leads yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3 items-start">
          {deals.map((w) => (
            <div key={w.id} className="card card-pad text-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="u-h3">{w.lead.name}</p>
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
              <div className="flex gap-2 flex-wrap">
                <div className="money-tile">
                  <p className="money-label">Value:</p>
                  <p className="money-value">{formatEGP(w.estimatedValue)}</p>
                </div>
                {w.totalCommissionPercent != null ? (
                  <div className="money-tile">
                    <p className="money-label">Total commission:</p>
                    <p className="money-value money-value--commission">
                      {(w.totalCommissionPercent / 100).toFixed(2).replace(/\.00$/, "")}%
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="border-t border-brand-hairline pt-3 space-y-2">
                {w.milestones.map((m) => (
                  <div
                    key={m.id}
                    className={`ms-row ${
                      m.completed ? "ms-row--done" : m.locked ? "ms-row--locked" : ""
                    }`}
                  >
                    <span className={`ms-label ${m.completed ? "" : "text-brand-muted"}`}>
                      {m.completed ? "✓ " : ""}
                      {m.label}
                      {m.locked ? " (locked)" : ""}
                    </span>
                    <span className="ms-note ms-auto text-end">
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
