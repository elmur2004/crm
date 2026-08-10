import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { statementDocument } from "@/lib/services/statements";
import { ApiError } from "@/lib/api-error";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";
import { PrintButton } from "@/components/shared/PrintButton";

export const metadata = { title: "Statement — B-Systems CRM" };

/* Founder ⑧ — the printable commission statement: branded (token-driven, so it
   prints in the working brand), the closer, the client and their details, the
   full money breakdown, dates and the payment status. Admin + the statement's
   own closer can open and print it. */

export default async function StatementDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  const { id } = await params;

  let doc;
  try {
    doc = await statementDocument(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { statement: s, lead, closerUser } = doc;
  const isAdmin = bsRoleOf(user) === "bsystems_admin";
  if (!isAdmin && s.closerUserId !== user.id) redirect("/b-systems");

  const total = s.amount + s.adjustments;
  const backHref = isAdmin ? "/b-systems/statements" : "/b-systems/payments";

  return (
    <div className="space-y-5">
      <div className="page-head no-print">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · STATEMENT {s.code}</p>
          <Link href={backHref} className="text-sm text-brand-muted underline underline-offset-2">
            Back
          </Link>
        </div>
        <div className="page-actions">
          <PrintButton label="Print statement" />
        </div>
      </div>

      <article className="print-sheet">
        <div className="print-band" aria-hidden />
        <header className="print-head">
          <div>
            <div className="print-brand">
              <span className="logo-b" aria-hidden>
                S
              </span>
              <span className="wordmark text-brand-heading">B-Systems</span>
            </div>
            <p className="print-eyebrow mt-4">Commission statement</p>
            <h1 className="print-title">{s.milestoneLabel}</h1>
          </div>
          <div className="text-end">
            <p className="print-code">{s.code}</p>
            <p className="print-date">Issued {formatCairoDate(s.createdAt)}</p>
            {s.expectedDate ? (
              <p className="print-date">Expected payment {formatCairoDate(s.expectedDate)}</p>
            ) : null}
          </div>
        </header>

        <section className="print-section">
          <div className="print-parties">
            <div>
              <p className="print-party-label">Paid by</p>
              <p className="print-party-name">B-Systems</p>
              <p className="print-party-line">Systems Before Software</p>
            </div>
            <div>
              <p className="print-party-label">Paid to</p>
              <p className="print-party-name">{closerUser?.name ?? s.closerLabel}</p>
              {closerUser?.email ? <p className="print-party-line">{closerUser.email}</p> : null}
              {closerUser?.phone ? <p className="print-party-line">{closerUser.phone}</p> : null}
            </div>
            <div>
              <p className="print-party-label">Client</p>
              <p className="print-party-name">{s.clientName}</p>
              {lead.companyName ? <p className="print-party-line">{lead.companyName}</p> : null}
              <p className="print-party-line">{lead.number}</p>
              {lead.email ? <p className="print-party-line">{lead.email}</p> : null}
            </div>
          </div>
        </section>

        <section className="print-section">
          <div className="table-scroll">
            <table className="table table--embedded">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Milestone value</th>
                  <th>Share</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="td-title">
                    {s.milestoneLabel} — {s.clientName}
                  </td>
                  <td>{formatEGP(s.milestoneValue)}</td>
                  <td>{(s.percentBp / 100).toFixed(2).replace(/\.00$/, "")}%</td>
                  <td>{formatEGP(s.amount)}</td>
                </tr>
                {s.adjustments !== 0 ? (
                  <tr>
                    <td className="td-title">Adjustments</td>
                    <td>—</td>
                    <td>—</td>
                    <td>{formatEGP(s.adjustments)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="print-total-row mt-4">
            <span className="print-total-label">Total payable</span>
            <span className="print-total">{formatEGP(total)}</span>
          </div>
        </section>

        <section className="print-section flex items-center justify-between gap-4 flex-wrap">
          {s.status === "paid" ? (
            <span className="print-stamp">Paid</span>
          ) : (
            <span className="print-stamp print-stamp--pending">Pending</span>
          )}
          <div className="text-end">
            {s.status === "paid" && s.paidAt ? (
              <p className="print-party-line">Paid on {formatCairoDate(s.paidAt)}</p>
            ) : null}
            {s.proofs[0] ? (
              <p className="print-party-line">Payment proof on file ({s.proofs[0].filename})</p>
            ) : null}
          </div>
        </section>

        <footer className="print-foot">
          <span>B-Systems Sales Platform</span>
          <span>{s.code}</span>
        </footer>
      </article>
    </div>
  );
}
