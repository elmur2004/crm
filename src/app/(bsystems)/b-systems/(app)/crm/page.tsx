import Link from "next/link";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listBsLeads, listOwnLeads } from "@/lib/services/bsystems-admin";
import { listReps } from "@/lib/services/sales-reps";
import { formatCairo } from "@/lib/datetime";
import { formatEGP } from "@/lib/money";
import { tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { ownerTypeLabel } from "@/lib/i18n/dict/labels";
import { common, crmPage as m, ownerFilters } from "@/lib/i18n/dict/crm";
import { BsBoard, type BsBoardLead } from "@/components/bsystems/BsBoard";
import { BsAddLeadForm } from "@/components/bsystems/leadActions";
import type { BsFormRole } from "@/components/bsystems/roleForms";

export const metadata = { title: "CRM — B-Systems CRM" };

/* V2 §2.3 — THE board: colored columns, drag & drop with the stage's role-aware
   form on drop. Admin filters by owner bucket (incl. Admins); sales sees the
   internal bucket; agents/partners see only their own leads. */

const FILTERS: Array<{ key: string; label: Msg }> = [
  { key: "any", label: ownerFilters.any },
  { key: "internal", label: ownerFilters.internal },
  { key: "agent", label: ownerFilters.agent },
  { key: "partner", label: ownerFilters.partner },
  { key: "admin", label: ownerFilters.admin },
];

type LeadRow = Awaited<ReturnType<typeof listBsLeads>>[number];

function ownerLabel(locale: Locale, lead: LeadRow): string {
  const bucket = ownerTypeLabel(locale, lead.ownerType);
  const who =
    lead.owner?.name ?? lead.salesRep?.name ?? lead.partner?.companyName ?? null;
  return who ? `${bucket} · ${who}` : bucket;
}

function keyDatum(locale: Locale, lead: LeadRow): string {
  const t = tFor(locale);
  switch (lead.stage) {
    case "following_up":
      return lead.followUps[0]
        ? `${t(m.nextPrefix)}${formatCairo(lead.followUps[0].dueAt)}`
        : t(m.noFollowUp);
    case "meeting_setting":
      return lead.meetings[0]?.datetime
        ? `${t(m.meetingPrefix)}${formatCairo(lead.meetings[0].datetime)}`
        : t(m.meetingNotArranged);
    case "sending_proposal":
      return lead.proposals[0]?.estimatedValue != null
        ? `${t(m.estPrefix)}${formatEGP(lead.proposals[0].estimatedValue)}`
        : t(m.noValue);
    case "lost":
      return lead.lostInfo[0]?.reason ?? "";
    default:
      return "";
  }
}

export default async function BsCrmPage({
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
  const engineRole = bsRoleOf(user);
  const role: BsFormRole =
    engineRole === "bsystems_admin"
      ? "admin"
      : engineRole === "bsystems_sales"
        ? "sales"
        : engineRole === "bsystems_agent"
          ? "agent"
          : "partner";

  const locale = await getLocale();
  const t = tFor(locale);
  const { owner } = await searchParams;
  const filter = FILTERS.some((f) => f.key === owner) ? owner : "any";

  const rows =
    role === "admin"
      ? await listBsLeads(filter)
      : role === "sales"
        ? await listBsLeads("internal")
        : await listOwnLeads(user.id);

  const leads: BsBoardLead[] = rows.map((l) => ({
    id: l.id,
    name: l.name,
    companyName: l.companyName,
    stage: l.stage,
    ownerType: l.ownerType,
    ownerLabel: ownerLabel(locale, l),
    readyToClose: l.readyToClose,
    keyDatum: keyDatum(locale, l),
  }));

  const reps =
    role === "admin" || role === "sales"
      ? (await listReps("bsystems")).map((r) => ({ id: r.id, name: r.name }))
      : [];

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(m.eyebrow)}</p>
          <h1 className="u-h1">{t(m.title)}</h1>
        </div>
        <div className="page-actions">
          <BsAddLeadForm />
          {role === "admin" ? (
            <nav className="flex gap-1 flex-wrap" aria-label={t(common.ownerFilter)}>
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={f.key === "any" ? "/b-systems/crm" : `/b-systems/crm?owner=${f.key}`}
                  className="nav-item"
                  aria-current={filter === f.key ? "page" : undefined}
                >
                  {t(f.label)}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
      <BsBoard leads={leads} role={role} reps={reps} />
    </div>
  );
}
