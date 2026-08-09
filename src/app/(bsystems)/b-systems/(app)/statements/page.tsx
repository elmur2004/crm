import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listStatements, waitingToBePaidOut } from "@/lib/services/statements";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";
import { MarkPaidForm, StatementGenerator } from "@/components/bsystems/statements";

export const metadata = { title: "Statements — B-Systems CRM" };

/* V2 §2.9/§7 — checked milestones wait here; Generate opens the editable tab;
   Create files the coded statement; Mark paid uploads the proof image. */

export default async function StatementsPage() {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  const [waiting, statements] = await Promise.all([waitingToBePaidOut(), listStatements()]);

  return (
    <div className="space-y-8">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Statements</h1>

      <section className="space-y-3">
        <h2 className="text-brand-meta text-brand-muted">Waiting to be paid out</h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-brand-muted">
            Nothing waiting — checked milestones without a statement appear here.
          </p>
        ) : (
          <div className="overflow-x-auto border border-brand-border rounded-brand-card bg-brand-surface-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-start p-3 font-bold">Milestone</th>
                  <th className="text-start p-3 font-bold">Company</th>
                  <th className="text-start p-3 font-bold">Closer</th>
                  <th className="text-start p-3 font-bold">Commission</th>
                  <th className="text-start p-3 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {waiting.map((row) => (
                  <tr key={row.milestoneId} className="border-b border-brand-border last:border-0">
                    <td className="p-3 font-medium">{row.label}</td>
                    <td className="p-3">{row.companyName ?? row.clientName}</td>
                    <td className="p-3">{row.closerLabel}</td>
                    <td className="p-3">{formatEGP(row.commissionValue)}</td>
                    <td className="p-3">
                      <StatementGenerator row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-brand-meta text-brand-muted">Statement</h2>
        {statements.length === 0 ? (
          <p className="text-sm text-brand-muted">No statements created yet.</p>
        ) : (
          <div className="overflow-x-auto border border-brand-border rounded-brand-card bg-brand-surface-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-start p-3 font-bold">Code</th>
                  <th className="text-start p-3 font-bold">Client</th>
                  <th className="text-start p-3 font-bold">Milestone</th>
                  <th className="text-start p-3 font-bold">Amount</th>
                  <th className="text-start p-3 font-bold">Adjustments</th>
                  <th className="text-start p-3 font-bold">Closer</th>
                  <th className="text-start p-3 font-bold">Expected</th>
                  <th className="text-start p-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id} className="border-b border-brand-border last:border-0">
                    <td className="p-3 font-medium">{s.code}</td>
                    <td className="p-3">{s.clientName}</td>
                    <td className="p-3">
                      {s.milestoneLabel}
                      <span className="text-xs text-brand-muted">
                        {" "}
                        ({formatEGP(s.milestoneValue)} · {(s.percentBp / 100).toFixed(2).replace(/\.00$/, "")}%)
                      </span>
                    </td>
                    <td className="p-3">{formatEGP(s.amount)}</td>
                    <td className="p-3">{s.adjustments ? formatEGP(s.adjustments) : "—"}</td>
                    <td className="p-3">{s.closerLabel}</td>
                    <td className="p-3">{s.expectedDate ? formatCairoDate(s.expectedDate) : "—"}</td>
                    <td className="p-3">
                      {s.status === "paid" ? (
                        <span className="text-brand-success">
                          Paid
                          {s.proofs[0] ? (
                            <>
                              {" · "}
                              <a
                                href={`/api/files/${s.proofs[0].id}`}
                                className="text-brand-link underline underline-offset-2"
                              >
                                proof
                              </a>
                            </>
                          ) : null}
                        </span>
                      ) : (
                        <MarkPaidForm statementId={s.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
