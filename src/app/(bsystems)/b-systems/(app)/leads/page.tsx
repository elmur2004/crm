import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listBsLeads } from "@/lib/services/bsystems-admin";
import { LEAD_SORTS, sortLeads, type LeadSort } from "@/lib/services/lead-sort";
import { BSYSTEMS_STAGES, LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import { formatCairoDate } from "@/lib/datetime";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadTypeLabel, ownerTypeLabel, stageLabel } from "@/lib/i18n/dict/labels";
import {
  archiveMsgs,
  common,
  leadsFilters as lf,
  leadsPage as m,
  ownerFilters,
} from "@/lib/i18n/dict/crm";
import { StageBadge } from "@/components/shared/StageBadge";
import { BsAddLeadForm } from "@/components/bsystems/leadActions";
import { FilterPanel } from "@/components/shared/FilterPanel";

export const metadata = { title: "Leads — B-Systems CRM" };

/* V2 §2.2 — the admin Leads section: every lead with the owner-bucket filter
   (Internal / Agents / Partners / Admins / Any). Admin-added leads land in the
   admin bucket (the API buckets by role). Edit/copy/delete live on the detail.
   Founder (filters round): stage/type/owner selects + ordering — newest added,
   recently updated, or pipeline priority — via a plain GET form.
   Founder (filters round 2): the controls moved OUT of the cramped top strip
   into a start-side sidebar (collapsing behind a "Filters" disclosure with a
   count chip under 900px), led by one universal search box matched server-side
   against the lead name, the company, or the number. Query-param names are
   unchanged — old links keep working; `q` is the new one. */

const OWNER_KEYS: Array<{ key: string; label: Msg }> = [
  { key: "any", label: ownerFilters.any },
  { key: "internal", label: ownerFilters.internal },
  { key: "agent", label: ownerFilters.agent },
  { key: "partner", label: ownerFilters.partner },
  { key: "admin", label: ownerFilters.admin },
  /* ADR-051 — the queue the data-entry role fills: internal, no rep, no
     owner. Without it a lead that belongs to nobody is unfindable. */
  { key: "unassigned", label: ownerFilters.unassigned },
];

const SORT_LABEL: Record<LeadSort, Msg> = {
  added: lf.sortAdded,
  updated: lf.sortUpdated,
  priority: lf.sortPriority,
};

export default async function BsLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    owner?: string;
    stage?: string;
    type?: string;
    sort?: string;
    view?: string;
  }>;
}) {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  const locale = await getLocale();
  const t = tFor(locale);
  const params = await searchParams;
  const owner = OWNER_KEYS.some((f) => f.key === params.owner) ? params.owner! : "any";
  const stage = (BSYSTEMS_STAGES as readonly string[]).includes(params.stage ?? "")
    ? params.stage!
    : "any";
  const type = (LEAD_TYPES as readonly string[]).includes(params.type ?? "")
    ? params.type!
    : "any";
  const sort: LeadSort = (LEAD_SORTS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as LeadSort)
    : "added";
  const archived = params.view === "archived"; // ADR-043: this IS the archive
  const search = (params.q ?? "").trim();

  /* search + owner + type are SQL; only the stage narrowing stays in JS (the
     admin list is page-sized and the board shares the same service). */
  const fetched = await listBsLeads(owner, { archived, search, type });
  const leads = sortLeads(
    fetched.filter((l) => stage === "any" || l.stage === stage),
    sort,
  );

  /* the disclosure chip counts every control that is off its default */
  const activeCount = [
    search !== "",
    owner !== "any",
    stage !== "any",
    type !== "any",
    sort !== "added",
    archived,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(m.eyebrow)}</p>
          <h1 className="u-h1">{t(m.title)}</h1>
        </div>
        <div className="page-actions">
          <BsAddLeadForm />
        </div>
      </div>
      <div className="filter-layout">
        <FilterPanel activeCount={activeCount} defaultOpen={activeCount > 0}>
          <form method="get" className="card filter-card" aria-label={t(lf.filters)}>
            <label className="filter-section">
              <span className="filter-section-label">{t(lf.search)}</span>
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder={t(lf.searchPlaceholder)}
                className="field-input"
              />
            </label>
            <label className="filter-section">
              <span className="filter-section-label">{t(common.owner)}</span>
              <select name="owner" defaultValue={owner} className="field-input">
                {OWNER_KEYS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {t(f.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-section">
              <span className="filter-section-label">{t(common.stage)}</span>
              <select name="stage" defaultValue={stage} className="field-input">
                <option value="any">{t(ownerFilters.any)}</option>
                {BSYSTEMS_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {stageLabel(locale, s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-section">
              <span className="filter-section-label">{t(common.type)}</span>
              <select name="type" defaultValue={type} className="field-input">
                <option value="any">{t(ownerFilters.any)}</option>
                {LEAD_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {leadTypeLabel(locale, ty)}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-section">
              <span className="filter-section-label">{t(lf.sort)}</span>
              <select name="sort" defaultValue={sort} className="field-input">
                {LEAD_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(SORT_LABEL[s])}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-section">
              <span className="filter-section-label">{t(lf.view)}</span>
              <select
                name="view"
                defaultValue={archived ? "archived" : "active"}
                className="field-input"
              >
                <option value="active">{t(archiveMsgs.active)}</option>
                <option value="archived">{t(archiveMsgs.archived)}</option>
              </select>
            </label>
            <div className="filter-actions">
              <button type="submit" className="btn-primary btn--sm">
                {t(lf.apply)}
              </button>
              {activeCount > 0 ? (
                <Link href="/b-systems/leads" className="filter-reset">
                  {t(lf.clear)}
                </Link>
              ) : null}
            </div>
          </form>
        </FilterPanel>
        <div className="filter-main">
          {leads.length === 0 ? (
            <p className="empty">{activeCount > 0 ? t(m.noMatches) : t(m.empty)}</p>
          ) : (
            <div className="card card--flush0">
              <div className="table-scroll">
                <table className="table table--wrap">
                  <thead>
                    <tr>
                      <th>{t(common.name)}</th>
                      <th>{t(common.number)}</th>
                      <th>{t(common.company)}</th>
                      <th>{t(common.owner)}</th>
                      <th>{t(common.type)}</th>
                      <th>{t(common.stage)}</th>
                      <th>{t(common.created)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <Link href={`/b-systems/crm/lead/${lead.id}`} className="td-title">
                            {lead.name}
                          </Link>
                        </td>
                        <td className="td-mono">{lead.number}</td>
                        <td>{lead.companyName ?? "—"}</td>
                        <td>
                          <span className="owner-chip" data-owner-key={lead.ownerType}>
                            {ownerTypeLabel(locale, lead.ownerType)}
                            {lead.owner ? ` · ${lead.owner.name}` : ""}
                            {lead.partner ? ` · ${lead.partner.companyName}` : ""}
                          </span>
                        </td>
                        <td>
                          <span className="chip-outline">
                            {leadTypeLabel(locale, lead.type)}
                          </span>
                        </td>
                        <td>
                          <StageBadge stage={lead.stage} />
                        </td>
                        <td className="td-nowrap">{formatCairoDate(lead.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
