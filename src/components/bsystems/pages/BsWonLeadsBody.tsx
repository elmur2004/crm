import Link from "next/link";
import type { CrmSurface } from "@/lib/crm/surface";
import type { Role } from "@/lib/pipeline-engine/constants";
import { adminWonLeads, closerWonLeads, salesWonLeads } from "@/lib/services/won-leads";
import { DeleteLeadButton } from "@/components/bsystems/leadActions";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, wonLeads } from "@/lib/i18n/dict/admin";

/* V2 §2.4/§4 — Won Leads. Admin: every won lead as a card (name, value, closer,
   milestone checks) linking into the detail. Closers see their own with client
   data + milestone progress; commission shows for agents/partners, NEVER for
   internal sales.

   ADR-074 — extracted so Mindoo renders the SAME screen. Mindoo's staff reads
   the admin view, because it is the whole of its company's staff and there is
   no narrower audience to show it. ByteForce still has no Won Leads at all —
   its win writes a Client, not a Won Deal — so no surface exists for it. */

function markInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function MilestoneDots({
  milestones,
  progressLabel,
}: {
  milestones: Array<{ completed: boolean }>;
  progressLabel: string;
}) {
  return (
    <span className="inline-flex gap-1 align-middle" aria-label={progressLabel}>
      {milestones.map((m, i) => (
        <span
          key={i}
          className={`inline-block w-3 h-3 rounded-full border border-brand-border ${
            m.completed ? "bg-brand-success" : "bg-brand-surface-tint"
          }`}
        />
      ))}
    </span>
  );
}

export async function BsWonLeadsBody({
  ctx,
  role,
  userId,
}: {
  ctx: CrmSurface;
  /* the ENGINE role for this surface — `bsystems_admin` and `mindoo_staff`
     both read the administrator's view; the other three read their own deals */
  role: Role | null;
  userId: string;
}) {
  const locale = await getLocale();
  const t = tFor(locale);

  if (role === "bsystems_admin" || role === "mindoo_staff") {
    const deals = await adminWonLeads(ctx.brand);
    return (
      <div className="space-y-6">
        <div className="page-head">
          <div>
            <p className="u-eyebrow">{t(wonLeads.eyebrowList)}</p>
            <h1 className="u-h1">{t(wonLeads.title)}</h1>
          </div>
        </div>
        {deals.length === 0 ? (
          <p className="empty">{t(wonLeads.empty)}</p>
        ) : (
          <div className="ecard-grid">
            {deals.map((w) => (
              <div key={w.id} className="ecard cursor-default">
                <Link href={`${ctx.basePath}/won-leads/${w.id}${ctx.query}`} className="block">
                  <div className="ecard-top">
                    <span className="ecard-mark">{markInitials(w.lead.name)}</span>
                  </div>
                  <p className="ecard-title">{w.lead.name}</p>
                  <p className="ecard-sub">
                    <span>{t(common.labelValue)}</span> {formatEGP(w.estimatedValue)}
                  </p>
                  <p className="ecard-sub">
                    <span>{t(wonLeads.labelCloser)}</span> {w.closer}
                  </p>
                  <p className="ecard-sub flex items-center gap-2">
                    <span>{t(wonLeads.labelMilestones)}</span>
                    <MilestoneDots
                      milestones={w.milestones}
                      progressLabel={t(wonLeads.milestoneProgressAria)}
                    />
                    <span className="text-xs text-brand-muted">
                      {w.milestones.filter((m) => m.completed).length}/{w.milestones.length}
                    </span>
                  </p>
                </Link>
                {/* founder V4: edit + delete straight from this interface */}
                <div className="ecard-footer flex items-center gap-2 flex-wrap">
                  <Link
                    /* ADR-074 — the lead detail of THIS surface. */
                    href={`${ctx.basePath}/crm/lead/${w.lead.id}${ctx.query}`}
                    className="btn-ghost btn--sm"
                  >
                    {t(wonLeads.editLead)}
                  </Link>
                  <DeleteLeadButton
                    leadId={w.lead.id}
                    apiBase={ctx.apiBase}
                    redirectTo={`${ctx.basePath}/won-leads${ctx.query}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const deals =
    role === "bsystems_sales"
      ? await salesWonLeads(ctx.brand)
      : await closerWonLeads(ctx.brand, userId, { showCommission: true });

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(wonLeads.eyebrowList)}</p>
          <h1 className="u-h1">{t(wonLeads.title)}</h1>
        </div>
      </div>
      {deals.length === 0 ? (
        <p className="empty">{t(wonLeads.empty)}</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-3 items-start">
          {deals.map((w) => (
            <div key={w.id} className="card card-pad text-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="u-h3">{w.lead.name}</p>
                <MilestoneDots
                  milestones={w.milestones}
                  progressLabel={t(wonLeads.milestoneProgressAria)}
                />
              </div>
              <p>
                <span className="text-brand-muted">{t(common.labelNumber)}</span> {w.lead.number}
              </p>
              {w.lead.companyName ? (
                <p>
                  <span className="text-brand-muted">{t(common.labelCompany)}</span>{" "}
                  {w.lead.companyName}
                </p>
              ) : null}
              <div className="flex gap-2 flex-wrap">
                <div className="money-tile">
                  <p className="money-label">{t(common.labelValue)}</p>
                  <p className="money-value">{formatEGP(w.estimatedValue)}</p>
                </div>
                {w.totalCommissionPercent != null ? (
                  <div className="money-tile">
                    <p className="money-label">{t(common.labelTotalCommission)}</p>
                    <p className="money-value money-value--commission">
                      {(w.totalCommissionPercent / 100).toFixed(2).replace(/\.00$/, "")}%
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="border-t border-brand-hairline pt-3 space-y-2">
                {w.milestones.map((m) => (
                  <div
                    key={m.id}
                    className={`ms-row ${
                      m.completed ? "ms-row--done" : m.locked ? "ms-row--locked" : ""
                    }`}
                  >
                    <span className={`ms-label ${m.completed ? "" : "text-brand-muted"}`}>
                      {m.completed ? "✓ " : ""}
                      {m.label}
                      {m.locked ? t(wonLeads.lockedSuffix) : ""}
                    </span>
                    <span className="ms-note ms-auto text-end">
                      {formatEGP(m.value)}
                      {m.commissionValue != null
                        ? `${t(common.commissionSep)}${formatEGP(m.commissionValue)}`
                        : ""}
                      {m.expectedEnd
                        ? ` · ${t(wonLeads.dueWord)} ${formatCairoDate(m.expectedEnd, locale)}`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
