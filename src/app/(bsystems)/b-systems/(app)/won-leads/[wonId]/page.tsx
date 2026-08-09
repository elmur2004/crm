import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";
import { MilestoneCheckbox, WonDocumentUpload } from "@/components/bsystems/wonLeads";

export const metadata = { title: "Won Lead — B-Systems CRM" };

/* V2 §5 — the admin won-lead detail: full client details, contract date,
   milestone checklist (sequential), proposal/contract PDF uploads. */

export default async function WonLeadDetailPage({
  params,
}: {
  params: Promise<{ wonId: string }>;
}) {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/won-leads");

  const { wonId } = await params;
  const w = await db.wonDeal.findUnique({
    where: { id: wonId },
    include: {
      lead: {
        include: {
          owner: { select: { name: true } },
          salesRep: { select: { name: true } },
          partner: { select: { companyName: true } },
        },
      },
      milestones: { orderBy: { index: "asc" } },
      attachments: true,
    },
  });
  if (!w || w.lead.brand !== "bsystems") notFound();

  const closer = w.lead.owner?.name ?? w.lead.salesRep?.name ?? "Admin";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/b-systems/won-leads" className="text-sm text-brand-muted underline underline-offset-2">
          Back to Won Leads
        </Link>
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading">{w.lead.name}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <section className="space-y-4">
          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 text-sm space-y-1">
            <p>
              <span className="text-brand-muted">Number:</span> {w.lead.number}
            </p>
            <p>
              <span className="text-brand-muted">Email:</span> {w.lead.email ?? "—"}
            </p>
            {w.lead.companyName ? (
              <p>
                <span className="text-brand-muted">Company:</span> {w.lead.companyName}
              </p>
            ) : null}
            {w.lead.industry ? (
              <p>
                <span className="text-brand-muted">Industry:</span> {w.lead.industry}
              </p>
            ) : null}
            <p>
              <span className="text-brand-muted">Closer:</span> {closer}
            </p>
            <p>
              <span className="text-brand-muted">Estimated value:</span> {formatEGP(w.estimatedValue)}
            </p>
            <p>
              <span className="text-brand-muted">Total commission:</span>{" "}
              {w.totalCommissionPercent != null
                ? `${(w.totalCommissionPercent / 100).toFixed(2).replace(/\.00$/, "")}%`
                : "—"}
            </p>
            <p>
              <span className="text-brand-muted">Contract date:</span>{" "}
              {w.contractDate ? formatCairoDate(w.contractDate) : "—"}
            </p>
            <p>
              <Link
                href={`/b-systems/crm/lead/${w.leadId}`}
                className="text-brand-link underline underline-offset-2"
              >
                Open the lead record
              </Link>
            </p>
          </div>

          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 space-y-3">
            <h2 className="text-brand-meta text-brand-muted">Documents</h2>
            {w.attachments.length === 0 ? (
              <p className="text-sm text-brand-muted">No documents uploaded yet.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {w.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={`/api/files/${a.id}`}
                      className="text-brand-link underline underline-offset-2"
                    >
                      {a.kind === "proposal" ? "Proposal" : "Contract"}: {a.filename}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <WonDocumentUpload wonDealId={w.id} />
          </div>
        </section>

        <section className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
          <h2 className="text-brand-meta text-brand-muted mb-3">Milestones</h2>
          <div className="space-y-2 text-sm">
            {w.milestones.map((m, i) => {
              const previous = w.milestones[i - 1];
              const next = w.milestones[i + 1];
              const unlocked = m.index === 1 || Boolean(previous?.completed);
              /* sequential both ways: check the next unlocked one, uncheck only the last checked */
              const canToggle = m.completed ? !next?.completed : unlocked;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 border border-brand-border rounded-brand-control px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <MilestoneCheckbox
                      milestoneId={m.id}
                      completed={m.completed}
                      disabled={!canToggle}
                      label={m.label ?? `Milestone ${m.index}`}
                    />
                    <span className={m.completed ? "" : unlocked ? "" : "text-brand-muted"}>
                      {m.label ?? `Milestone ${m.index}`}
                    </span>
                  </div>
                  <span className="text-xs text-brand-muted text-end">
                    {formatEGP(m.value)}
                    {m.commissionValue != null ? ` · commission ${formatEGP(m.commissionValue)}` : ""}
                    {m.expectedStart ? ` · ${formatCairoDate(m.expectedStart)}` : ""}
                    {m.expectedEnd ? ` → ${formatCairoDate(m.expectedEnd)}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-brand-muted mt-3">
            Checked milestones appear under Statements → Waiting to be paid out.
          </p>
        </section>
      </div>
    </div>
  );
}
