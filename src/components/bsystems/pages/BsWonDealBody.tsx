import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { CrmSurface } from "@/lib/crm/surface";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";
import { MilestoneCheckbox, WonDocumentUpload } from "@/components/bsystems/wonLeads";
import { Meter } from "@/components/shared/Meter";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, wonLeads } from "@/lib/i18n/dict/admin";

/* V2 §5 — the admin won-lead detail: full client details, contract date,
   milestone checklist (sequential), proposal/contract PDF uploads.

   ADR-074 — extracted as a shared body. The brand check below
   is the wall that stops one company opening another company's deal by id. */

export async function BsWonDealBody({ ctx, wonId }: { ctx: CrmSurface; wonId: string }) {
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
  /* ADR-073/074 — the deal must belong to the surface on screen. Pinned to a
     literal, every Mindoo won deal 404'd on the page its own staff reached it
     from — and, read the other way, this is also the wall that stops one
     company opening another's deal by id. */
  if (!w || w.lead.brand !== ctx.brand) notFound();

  const locale = await getLocale();
  const t = tFor(locale);
  const closer = w.lead.owner?.name ?? w.lead.salesRep?.name ?? t(wonLeads.closerFallbackAdmin);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          {/* no "Back to Won Leads": Won Leads is in the CRM menu, the one way
              to it (one way to each page) */}
          <p className="u-eyebrow">{t(wonLeads.eyebrowDetail)}</p>
          <h1 className="u-h1">{w.lead.name}</h1>
        </div>
      </div>

      {/* grid-cols-1 = minmax(0, 1fr): one column on a phone that may shrink to
          the screen (an implicit auto track grew to its widest child, and the
          upload row pushed the page 32px sideways at 390px) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
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
                  {w.contractDate ? formatCairoDate(w.contractDate, locale) : "—"}
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
                /* ADR-074 — the lead detail of THIS surface. */
                href={`${ctx.basePath}/crm/lead/${w.leadId}${ctx.query}`}
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
            <WonDocumentUpload wonDealId={w.id} apiBase={ctx.apiBase} />
          </div>
        </section>

        <section className="card card--flush0">
          <div className="card-head">
            <h2 className="u-h3">{t(wonLeads.milestonesHeading)}</h2>
            {/* the deal's progress through its milestones, drawn (the rows
                below carry each tick in words) */}
            {w.milestones.length > 0 ? (
              <span className="crm-meter-row ms-progress">
                <Meter value={w.milestones.filter((m) => m.completed).length} total={w.milestones.length} />
                <span className="crm-meter-label">
                  {w.milestones.filter((m) => m.completed).length}/{w.milestones.length}
                </span>
              </span>
            ) : null}
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
                    apiBase={ctx.apiBase}
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
                    {m.expectedStart ? ` · ${formatCairoDate(m.expectedStart, locale)}` : ""}
                    {m.expectedEnd ? (
                      <>
                        {/* the range's arrow turns with the reading direction */}
                        {/* the spaces sit OUTSIDE the inline-block, where they
                            do not collapse */}
                        {" "}
                        <span className="inline-block rtl:-scale-x-100" aria-hidden>
                          →
                        </span>{" "}
                        {formatCairoDate(m.expectedEnd, locale)}
                      </>
                    ) : null}
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
