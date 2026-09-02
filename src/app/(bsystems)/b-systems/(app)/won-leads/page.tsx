import Link from "next/link";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES, MINDOO_ROLES, crmQuery } from "@/lib/crm/company";
import { crmEngineRole } from "@/lib/api/bsystems";
import { adminWonLeads, closerWonLeads, salesWonLeads } from "@/lib/services/won-leads";
import { DeleteLeadButton } from "@/components/bsystems/leadActions";
import { formatEGP } from "@/lib/money";
import { formatCairoDate } from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { common, wonLeads } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(wonLeads.metaList) };
}

/* V2 §2.4/§4 — Won Leads. Admin: every won lead as a card (name, value, closer,
   milestone checks) linking into the detail. Closers see their own with client
   data + milestone progress; commission shows for agents/partners, NEVER for
   internal sales. */

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

export default async function WonLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  /* ADR-067 — a B-Systems-ONLY section: refused under company=byteforce, and
     refused BEFORE the role narrowing below, so a ByteForce-only teammate is
     redirected rather than falling into a role lookup and turning into a 500.
     ADR-073 — past this line the company is known to be B-Systems or Mindoo,
     and `crmEngineRole` is TOTAL for both: holding either company is exactly
     holding one of its roles, so it cannot return null here. */
  const { user, company } = await requireCompanySection(
    /* ADR-073 — B-Systems AND Mindoo: Mindoo runs the same pipeline, so it wins
       the same way and needs the same screen. ByteForce is still refused, and
       rightly — its win writes a Client, not a Won Deal, so this page would
       have nothing to show it. The role list is the union of both companies'
       staff, which is safe because the COMPANY is resolved and refused first. */
    ["bsystems", "mindoo"],
    (await searchParams).company,
    [...BS_PIPELINE_ROLES, ...MINDOO_ROLES],
  );
  /* ADR-073 — `bsRoleOf` THROWS for an account with no B-Systems role, which is
     every Mindoo account, so it can no longer be called unconditionally here.
     `crmEngineRole` answers for the company on screen instead; Mindoo's staff
     reads the admin view, because it is the whole of its company's staff and
     there is no narrower audience to show it. */
  const role = crmEngineRole(company, user);
  const locale = await getLocale();
  const t = tFor(locale);

  if (role === "bsystems_admin" || role === "mindoo_staff") {
    const deals = await adminWonLeads(company);
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
                <Link href={`/b-systems/won-leads/${w.id}`} className="block">
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
                    /* ADR-073 — Won Leads is shared with Mindoo, so the link
                       into the lead detail must name the company or it resolves
                       the reader's default and 404s. */
                    href={`/b-systems/crm/lead/${w.lead.id}${crmQuery(company)}`}
                    className="btn-ghost btn--sm"
                  >
                    {t(wonLeads.editLead)}
                  </Link>
                  <DeleteLeadButton leadId={w.lead.id} redirectTo="/b-systems/won-leads" />
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
      ? await salesWonLeads(company)
      : await closerWonLeads(company, user.id, { showCommission: true });

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
