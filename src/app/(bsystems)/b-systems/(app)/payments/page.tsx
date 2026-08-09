import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { paymentsFor } from "@/lib/services/statements";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";

export const metadata = { title: "Payments — B-Systems CRM" };

/* V2 §7 — the closer's Payments section (agents/partners): created statements
   arrive as pending; paid ones carry the admin's proof image. */

export default async function PaymentsPage() {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  const role = bsRoleOf(user);
  if (role !== "bsystems_agent" && role !== "bsystems_partner") redirect("/b-systems");

  const payments = await paymentsFor(user.id);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · PAYMENTS</p>
          <h1 className="u-h1">Payments</h1>
        </div>
      </div>
      {payments.length === 0 ? (
        <p className="empty">
          No payments yet — when the admin creates a statement for one of your milestones it
          appears here as pending.
        </p>
      ) : (
        <div className="card card--flush0">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Client</th>
                  <th>Milestone</th>
                  <th>Amount</th>
                  <th>Expected</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((s) => (
                  <tr key={s.id}>
                    <td className="td-mono">{s.code}</td>
                    <td className="td-title">{s.clientName}</td>
                    <td>{s.milestoneLabel}</td>
                    <td>{formatEGP(s.amount + s.adjustments)}</td>
                    <td>{s.expectedDate ? formatCairoDate(s.expectedDate) : "—"}</td>
                    <td>
                      {s.status === "paid" ? (
                        <span className="text-brand-success">
                          Paid{s.paidAt ? ` ${formatCairoDate(s.paidAt)}` : ""}
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
                        <span className="text-brand-muted">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
