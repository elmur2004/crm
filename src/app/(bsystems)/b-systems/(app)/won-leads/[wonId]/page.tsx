import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { bsRoleOf } from "@/lib/api/bsystems";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";
import { MilestoneCheckbox, WonDocumentUpload } from "@/components/bsystems/wonLeads";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, wonLeads } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(wonLeads.metaDetail) };
}

/* V2 §5 — the admin won-lead detail: full client details, contract date,
   milestone checklist (sequential), proposal/contract PDF uploads. */

export default async function WonLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ wonId: string }>;
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

  const locale = await getLocale();
  const t = tFor(locale);
  const closer = w.lead.owner?.name ?? w.lead.salesRep?.name ?? t(wonLeads.closerFallbackAdmin);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <Link href="/b-systems/won-leads" className="text-sm text-brand-muted underline underline-offset-2">
            {t(wonLeads.backToWonLeads)}
          </Link>
          <p className="u-eyebrow mt-3">{t(wonLeads.eyebrowDetail)}</p>
          <h1 className="u-h1">{w.lead.name}</h1>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <section className="space-y-4">
          <div className="card card--flush0">
            <div className="card-pad flex gap-2 flex-wrap">
              <div className="money-tile">
                <p className="money-label">{t(wonLeads.labelEstimatedValue)}</p>
                <p className="money-value">{formatEGP(w.estimatedValue)}</p>
              </div>
              <div className="money-tile">
                <p className="money-label">{t(common.labelTotalCommission)}</p>
                <p className="money-value money-value--commission">
                  {w.totalCommissionPercent != null
                    ? `${(w.totalCommissionPercent / 100).toFixed(2).replace(/\.00$/, "")}%`
                    : "—"}
                </p>
              </div>
              <div className="money-tile">
                <p className="money-label">{t(wonLeads.labelContractDate)}</p>
                <p className="money-value">
                  {w.contractDate ? formatCairoDate(w.contractDate) : "—"}
                </p>
              </div>
            </div>
            <div className="fields-grid border-t border-brand-hairline">
              <div className="fields-cell">
                <p className="fields-label">{t(common.labelNumber)}</p>
                <p className="fields-value">{w.lead.number}</p>
              </div>
              <div className="fields-cell">
                <p className="fields-label">{t(common.labelEmail)}</p>
                <p className="fields-value">{w.lead.email ?? "—"}</p>
              </div>
              {w.lead.companyName ? (
                <div className="fields-cell">
                  <p className="fields-label">{t(common.labelCompany)}</p>
                  <p className="fields-value">{w.lead.companyName}</p>
                </div>
              ) : null}
              {w.lead.industry ? (
                <div className="fields-cell">
                  <p className="fields-label">{t(wonLeads.labelIndustry)}</p>
                  <p className="fields-value">{w.lead.industry}</p>
                </div>
              ) : null}
              <div className="fields-cell">
                <p className="fields-label">{t(wonLeads.labelCloser)}</p>
                <p className="fields-value">{closer}</p>
              </div>
            </div>
            <p className="panel-hint">
              <Link
                href={`/b-systems/crm/lead/${w.leadId}`}
                className="text-brand-link underline underline-offset-2"
              >
                {t(wonLeads.openLeadRecord)}
              </Link>
            </p>
          </div>

          <div className="card card-pad space-y-3">
            <h2 className="u-mono">{t(wonLeads.documents)}</h2>
            {w.attachments.length === 0 ? (
              <p className="empty">{t(wonLeads.noDocuments)}</p>
            ) : (
              <ul className="text-sm space-y-1">
                {w.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={`/api/files/${a.id}`}
                      className="text-brand-link underline underline-offset-2"
                    >
                      {a.kind === "proposal"
                        ? t(wonLeads.attachmentProposal)
                        : t(wonLeads.attachmentContract)}
                      : {a.filename}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <WonDocumentUpload wonDealId={w.id} />
          </div>
        </section>

        <section className="card card--flush0">
          <div className="card-head">
            <h2 className="u-h3">{t(wonLeads.milestonesHeading)}</h2>
          </div>
          <div className="card-pad space-y-2 text-sm">
            {w.milestones.map((m, i) => {
              const previous = w.milestones[i - 1];
              const next = w.milestones[i + 1];
              const unlocked = m.index === 1 || Boolean(previous?.completed);
              /* sequential both ways: check the next unlocked one, uncheck only the last checked */
              const canToggle = m.completed ? !next?.completed : unlocked;
              return (
                <div
                  key={m.id}
                  className={`ms-row ${
                    m.completed ? "ms-row--done" : unlocked ? "ms-row--next" : "ms-row--locked"
                  }`}
                >
                  <MilestoneCheckbox
                    milestoneId={m.id}
                    completed={m.completed}
                    disabled={!canToggle}
                    label={m.label ?? t(wonLeads.milestoneFallback).replace("{n}", String(m.index))}
                  />
                  <span className={`ms-label ${m.completed ? "" : unlocked ? "" : "text-brand-muted"}`}>
                    {m.label ?? t(wonLeads.milestoneFallback).replace("{n}", String(m.index))}
                  </span>
                  <span className="ms-note ms-auto text-end">
                    {formatEGP(m.value)}
                    {m.commissionValue != null
                      ? `${t(common.commissionSep)}${formatEGP(m.commissionValue)}`
                      : ""}
                    {m.expectedStart ? ` · ${formatCairoDate(m.expectedStart)}` : ""}
                    {m.expectedEnd ? ` → ${formatCairoDate(m.expectedEnd)}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="panel-hint">{t(wonLeads.checkedHint)}</p>
        </section>
      </div>
    </div>
  );
}
