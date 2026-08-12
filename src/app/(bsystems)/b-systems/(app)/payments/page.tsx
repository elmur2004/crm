import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { paymentsFor } from "@/lib/services/statements";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, payments as d } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(d.meta) };
}

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
  const locale = await getLocale();
  const t = tFor(locale);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(d.eyebrow)}</p>
          <h1 className="u-h1">{t(d.title)}</h1>
        </div>
      </div>
      {payments.length === 0 ? (
        <p className="empty">{t(d.empty)}</p>
      ) : (
        <div className="card card--flush0">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(common.thCode)}</th>
                  <th>{t(common.thClient)}</th>
                  <th>{t(common.thMilestone)}</th>
                  <th>{t(common.thAmount)}</th>
                  <th>{t(common.thExpected)}</th>
                  <th>{t(common.thStatus)}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((s) => (
                  <tr key={s.id}>
                    <td>
                    <Link href={`/b-systems/statements/${s.id}/document`} className="td-mono text-brand-link underline underline-offset-2" title={t(common.openPrintableStatement)}>
                      {s.code}
                    </Link>
                  </td>
                    <td className="td-title">{s.clientName}</td>
                    <td>{s.milestoneLabel}</td>
                    <td>{formatEGP(s.amount + s.adjustments)}</td>
                    <td>{s.expectedDate ? formatCairoDate(s.expectedDate) : "—"}</td>
                    <td>
                      {s.status === "paid" ? (
                        <>
                          <span className="text-brand-success">
                            {t(common.paid)}
                            {s.paidAt ? ` ${formatCairoDate(s.paidAt)}` : ""}
                            {s.proofs[0]?.fileOk ? (
                              <>
                                {" · "}
                                <a
                                  href={`/api/files/${s.proofs[0].id}`}
                                  className="text-brand-link underline underline-offset-2"
                                >
                                  {t(common.proofLink)}
                                </a>
                              </>
                            ) : null}
                          </span>
                          {s.proofs[0] && !s.proofs[0].fileOk ? (
                            <span className="text-brand-danger text-xs">
                              {" "}
                              {t(d.proofMissingAsk)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-brand-muted">{t(common.pending)}</span>
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
