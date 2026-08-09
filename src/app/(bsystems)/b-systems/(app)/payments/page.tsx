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
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Payments</h1>
      {payments.length === 0 ? (
        <p className="text-sm text-brand-muted">
          No payments yet — when the admin creates a statement for one of your milestones it
          appears here as pending.
        </p>
      ) : (
        <div className="overflow-x-auto border border-brand-border rounded-brand-card bg-brand-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-start p-3 font-bold">Code</th>
                <th className="text-start p-3 font-bold">Client</th>
                <th className="text-start p-3 font-bold">Milestone</th>
                <th className="text-start p-3 font-bold">Amount</th>
                <th className="text-start p-3 font-bold">Expected</th>
                <th className="text-start p-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((s) => (
                <tr key={s.id} className="border-b border-brand-border last:border-0">
                  <td className="p-3 font-medium">{s.code}</td>
                  <td className="p-3">{s.clientName}</td>
                  <td className="p-3">{s.milestoneLabel}</td>
                  <td className="p-3">{formatEGP(s.amount + s.adjustments)}</td>
                  <td className="p-3">{s.expectedDate ? formatCairoDate(s.expectedDate) : "—"}</td>
                  <td className="p-3">
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
      )}
    </div>
  );
}
