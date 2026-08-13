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

export const metadata = { title: "Leads — B-Systems CRM" };

/* V2 §2.2 — the admin Leads section: every lead with the owner-bucket filter
   (Internal / Agents / Partners / Admins / Any). Admin-added leads land in the
   admin bucket (the API buckets by role). Edit/copy/delete live on the detail.
   Founder (filters round): stage/type/owner selects + ordering — newest added,
   recently updated, or pipeline priority — via a plain GET form. */

const OWNER_KEYS: Array<{ key: string; label: Msg }> = [
  { key: "any", label: ownerFilters.any },
  { key: "internal", label: ownerFilters.internal },
  { key: "agent", label: ownerFilters.agent },
  { key: "partner", label: ownerFilters.partner },
  { key: "admin", label: ownerFilters.admin },
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

  const fetched = await listBsLeads(owner, { archived });
  const leads = sortLeads(
    fetched.filter(
      (l) => (stage === "any" || l.stage === stage) && (type === "any" || l.type === type),
    ),
    sort,
  );

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
      <form method="get" className="flex gap-2 flex-wrap items-center" aria-label={t(lf.filters)}>
        <select name="owner" defaultValue={owner} aria-label={t(common.owner)} className="field-input w-auto">
          {OWNER_KEYS.map((f) => (
            <option key={f.key} value={f.key}>
              {t(f.label)}
            </option>
          ))}
        </select>
        <select name="stage" defaultValue={stage} aria-label={t(common.stage)} className="field-input w-auto">
          <option value="any">{t(ownerFilters.any)}</option>
          {BSYSTEMS_STAGES.map((s) => (
            <option key={s} value={s}>
              {stageLabel(locale, s)}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type} aria-label={t(common.type)} className="field-input w-auto">
          <option value="any">{t(ownerFilters.any)}</option>
          {LEAD_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {leadTypeLabel(locale, ty)}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} aria-label={t(lf.sort)} className="field-input w-auto">
          {LEAD_SORTS.map((s) => (
            <option key={s} value={s}>
              {t(SORT_LABEL[s])}
            </option>
          ))}
        </select>
        <select
          name="view"
          defaultValue={archived ? "archived" : "active"}
          aria-label={t(archiveMsgs.archived)}
          className="field-input w-auto"
        >
          <option value="active">{t(archiveMsgs.active)}</option>
          <option value="archived">{t(archiveMsgs.archived)}</option>
        </select>
        <button type="submit" className="btn-ghost btn--sm">
          {t(lf.apply)}
        </button>
      </form>
      {leads.length === 0 ? (
        <p className="empty">{t(m.empty)}</p>
      ) : (
        <div className="card card--flush0">
          <div className="table-scroll">
            <table className="table">
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
                    <td>{formatCairoDate(lead.createdAt)}</td>
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
