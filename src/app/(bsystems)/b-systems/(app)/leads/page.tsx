import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listBsLeads } from "@/lib/services/bsystems-admin";
import { formatCairoDate } from "@/lib/datetime";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadTypeLabel, ownerTypeLabel } from "@/lib/i18n/dict/labels";
import { common, leadsPage as m, ownerFilters } from "@/lib/i18n/dict/crm";
import { StageBadge } from "@/components/shared/StageBadge";
import { BsAddLeadForm } from "@/components/bsystems/leadActions";

export const metadata = { title: "Leads — B-Systems CRM" };

/* V2 §2.2 — the admin Leads section: every lead with the owner-bucket filter
   (Internal / Agents / Partners / Admins / Any). Admin-added leads land in the
   admin bucket (the API buckets by role). Edit/copy/delete live on the detail. */

const FILTERS: Array<{ key: string; label: Msg }> = [
  { key: "any", label: ownerFilters.any },
  { key: "internal", label: ownerFilters.internal },
  { key: "agent", label: ownerFilters.agent },
  { key: "partner", label: ownerFilters.partner },
  { key: "admin", label: ownerFilters.admin },
];

export default async function BsLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
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
  const { owner } = await searchParams;
  const filter = FILTERS.some((f) => f.key === owner) ? owner : "any";
  const leads = await listBsLeads(filter);

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
      <nav className="flex gap-1 flex-wrap" aria-label={t(common.ownerFilter)}>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "any" ? "/b-systems/leads" : `/b-systems/leads?owner=${f.key}`}
            className="nav-item"
            aria-current={filter === f.key ? "page" : undefined}
          >
            {t(f.label)}
          </Link>
        ))}
      </nav>
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
