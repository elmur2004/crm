import Link from "next/link";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listBsLeads, listOwnLeads } from "@/lib/services/bsystems-admin";
import { listReps } from "@/lib/services/sales-reps";
import { OWNER_TYPE_LABELS, type OwnerType } from "@/lib/pipeline-engine/constants";
import { formatCairo } from "@/lib/datetime";
import { formatEGP } from "@/lib/money";
import { BsBoard, type BsBoardLead } from "@/components/bsystems/BsBoard";
import { BsAddLeadForm } from "@/components/bsystems/leadActions";
import type { BsFormRole } from "@/components/bsystems/roleForms";

export const metadata = { title: "CRM — B-Systems CRM" };

/* V2 §2.3 — THE board: colored columns, drag & drop with the stage's role-aware
   form on drop. Admin filters by owner bucket (incl. Admins); sales sees the
   internal bucket; agents/partners see only their own leads. */

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "any", label: "Any" },
  { key: "internal", label: "Internal" },
  { key: "agent", label: "Agents" },
  { key: "partner", label: "Partners" },
  { key: "admin", label: "Admins" },
];

type LeadRow = Awaited<ReturnType<typeof listBsLeads>>[number];

function ownerLabel(lead: LeadRow): string {
  const bucket = OWNER_TYPE_LABELS[lead.ownerType as OwnerType] ?? lead.ownerType;
  const who =
    lead.owner?.name ?? lead.salesRep?.name ?? lead.partner?.companyName ?? null;
  return who ? `${bucket} · ${who}` : bucket;
}

function keyDatum(lead: LeadRow): string {
  switch (lead.stage) {
    case "following_up":
      return lead.followUps[0] ? `Next: ${formatCairo(lead.followUps[0].dueAt)}` : "No follow-up set";
    case "meeting_setting":
      return lead.meetings[0]?.datetime
        ? `Meeting: ${formatCairo(lead.meetings[0].datetime)}`
        : "Meeting not arranged";
    case "sending_proposal":
      return lead.proposals[0]?.estimatedValue != null
        ? `Est: ${formatEGP(lead.proposals[0].estimatedValue)}`
        : "No value set";
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
    ownerLabel: ownerLabel(l),
    readyToClose: l.readyToClose,
    keyDatum: keyDatum(l),
  }));

  const reps =
    role === "admin" || role === "sales"
      ? (await listReps("bsystems")).map((r) => ({ id: r.id, name: r.name }))
      : [];

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · CRM</p>
          <h1 className="u-h1">CRM</h1>
        </div>
        <div className="page-actions">
          <BsAddLeadForm />
          {role === "admin" ? (
            <nav className="flex gap-1 flex-wrap" aria-label="Owner filter">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={f.key === "any" ? "/b-systems/crm" : `/b-systems/crm?owner=${f.key}`}
                  className="nav-item"
                  aria-current={filter === f.key ? "page" : undefined}
                >
                  {f.label}
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
