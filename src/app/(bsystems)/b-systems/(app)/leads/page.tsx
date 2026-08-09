import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listBsLeads } from "@/lib/services/bsystems-admin";
import {
  LEAD_TYPE_LABELS,
  OWNER_TYPE_LABELS,
  type LeadType,
  type OwnerType,
} from "@/lib/pipeline-engine/constants";
import { formatCairoDate } from "@/lib/datetime";
import { StageBadge } from "@/components/shared/StageBadge";
import { BsAddLeadForm } from "@/components/bsystems/leadActions";

export const metadata = { title: "Leads — B-Systems CRM" };

/* V2 §2.2 — the admin Leads section: every lead with the owner-bucket filter
   (Internal / Agents / Partners / Admins / Any). Admin-added leads land in the
   admin bucket (the API buckets by role). Edit/copy/delete live on the detail. */

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "any", label: "Any" },
  { key: "internal", label: "Internal" },
  { key: "agent", label: "Agents" },
  { key: "partner", label: "Partners" },
  { key: "admin", label: "Admins" },
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

  const { owner } = await searchParams;
  const filter = FILTERS.some((f) => f.key === owner) ? owner : "any";
  const leads = await listBsLeads(filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Leads</h1>
        <BsAddLeadForm />
      </div>
      <nav className="flex gap-1 flex-wrap" aria-label="Owner filter">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "any" ? "/b-systems/leads" : `/b-systems/leads?owner=${f.key}`}
            className={`px-3 py-1.5 rounded-brand-control text-sm font-medium ${
              filter === f.key
                ? "bg-brand-primary text-brand-on-primary"
                : "text-brand-link hover:bg-brand-surface-tint"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {leads.length === 0 ? (
        <p className="text-sm text-brand-muted">No leads in this bucket yet.</p>
      ) : (
        <div className="overflow-x-auto border border-brand-border rounded-brand-card bg-brand-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-start p-3 font-bold">Name</th>
                <th className="text-start p-3 font-bold">Number</th>
                <th className="text-start p-3 font-bold">Company</th>
                <th className="text-start p-3 font-bold">Owner</th>
                <th className="text-start p-3 font-bold">Type</th>
                <th className="text-start p-3 font-bold">Stage</th>
                <th className="text-start p-3 font-bold">Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-brand-border last:border-0 hover:bg-brand-surface-tint"
                >
                  <td className="p-3">
                    <Link href={`/b-systems/crm/lead/${lead.id}`} className="font-medium text-brand-link">
                      {lead.name}
                    </Link>
                  </td>
                  <td className="p-3">{lead.number}</td>
                  <td className="p-3">{lead.companyName ?? "—"}</td>
                  <td className="p-3">
                    {OWNER_TYPE_LABELS[lead.ownerType as OwnerType] ?? lead.ownerType}
                    {lead.owner ? ` · ${lead.owner.name}` : ""}
                    {lead.partner ? ` · ${lead.partner.companyName}` : ""}
                  </td>
                  <td className="p-3">{LEAD_TYPE_LABELS[lead.type as LeadType] ?? lead.type}</td>
                  <td className="p-3">
                    <StageBadge stage={lead.stage} />
                  </td>
                  <td className="p-3">{formatCairoDate(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
