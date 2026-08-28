import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listStatements, waitingToBePaidOut } from "@/lib/services/statements";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";
import { MarkPaidForm, ReplaceProofForm, StatementGenerator } from "@/components/bsystems/statements";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, statements as d } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(d.metaList) };
}

/* V2 §2.9/§7 — checked milestones wait here; Generate opens the editable tab;
   Create files the coded statement; Mark paid uploads the proof image. */

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  /* ADR-067 — a B-Systems-ONLY section: refused under company=byteforce, and
     refused BEFORE the role narrowing below, so a ByteForce-only teammate is
     redirected rather than falling into bsRoleOf and turning into a 500.
     Past this line bsRoleOf is TOTAL: holding "bsystems" is exactly holding one
     of the five B-Systems roles, so it can no longer throw. */
  const { user } = await requireCompanySection(
    "bsystems",
    (await searchParams).company,
    BS_PIPELINE_ROLES,
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  const [waiting, statements] = await Promise.all([waitingToBePaidOut(), listStatements()]);
  const locale = await getLocale();
  const t = tFor(locale);

  return (
    <div className="space-y-8">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(d.eyebrowList)}</p>
          <h1 className="u-h1">{t(d.title)}</h1>
        </div>
      </div>

      <section className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(d.waitingHeading)}</h2>
        </div>
        {waiting.length === 0 ? (
          <p className="empty m-4">{t(d.waitingEmpty)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(common.thMilestone)}</th>
                  <th>{t(d.thCompany)}</th>
                  <th>{t(common.thCloser)}</th>
                  <th>{t(d.thCommission)}</th>
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
          <h2 className="u-h3">{t(d.statementHeading)}</h2>
        </div>
        {statements.length === 0 ? (
          <p className="empty m-4">{t(d.statementsEmpty)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(common.thCode)}</th>
                  <th>{t(common.thClient)}</th>
                  <th>{t(common.thMilestone)}</th>
                  <th>{t(common.thAmount)}</th>
                  <th>{t(d.thAdjustments)}</th>
                  <th>{t(common.thCloser)}</th>
                  <th>{t(common.thExpected)}</th>
                  <th>{t(common.thStatus)}</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/b-systems/statements/${s.id}/document`}
                        className="td-mono text-brand-link underline underline-offset-2"
                        title={t(common.openPrintableStatement)}
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
                    <td>{s.expectedDate ? formatCairoDate(s.expectedDate, locale) : "—"}</td>
                    <td>
                      {s.status === "paid" ? (
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          <span className="text-brand-success">
                            {t(common.paid)}
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
                            /* the record survived but the file is gone (lost
                               in a redeploy without persistent storage) */
                            <span className="text-brand-danger text-xs">{t(d.proofFileMissing)}</span>
                          ) : null}
                          <ReplaceProofForm
                            statementId={s.id}
                            label={s.proofs[0]?.fileOk ? t(d.replaceProof) : t(d.reuploadProof)}
                          />
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
