import Link from "next/link";
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
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · STATEMENTS</p>
          <h1 className="u-h1">Statements</h1>
        </div>
      </div>

      <section className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">Waiting to be paid out</h2>
        </div>
        {waiting.length === 0 ? (
          <p className="empty m-4">
            Nothing waiting — checked milestones without a statement appear here.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th>Company</th>
                  <th>Closer</th>
                  <th>Commission</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {waiting.map((row) => (
                  <tr key={row.milestoneId}>
                    <td className="td-title">{row.label}</td>
                    <td>{row.companyName ?? row.clientName}</td>
                    <td>{row.closerLabel}</td>
                    <td>{formatEGP(row.commissionValue)}</td>
                    <td>
                      <StatementGenerator row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">Statement</h2>
        </div>
        {statements.length === 0 ? (
          <p className="empty m-4">No statements created yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Client</th>
                  <th>Milestone</th>
                  <th>Amount</th>
                  <th>Adjustments</th>
                  <th>Closer</th>
                  <th>Expected</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/b-systems/statements/${s.id}/document`}
                        className="td-mono text-brand-link underline underline-offset-2"
                        title="Open the printable statement"
                      >
                        {s.code}
                      </Link>
                    </td>
                    <td className="td-title">{s.clientName}</td>
                    <td>
                      {s.milestoneLabel}
                      <span className="text-xs text-brand-muted">
                        {" "}
                        ({formatEGP(s.milestoneValue)} · {(s.percentBp / 100).toFixed(2).replace(/\.00$/, "")}%)
                      </span>
                    </td>
                    <td>{formatEGP(s.amount)}</td>
                    <td>{s.adjustments ? formatEGP(s.adjustments) : "—"}</td>
                    <td>{s.closerLabel}</td>
                    <td>{s.expectedDate ? formatCairoDate(s.expectedDate) : "—"}</td>
                    <td>
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
