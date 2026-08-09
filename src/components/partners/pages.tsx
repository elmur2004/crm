import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PARTNER_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { getPartnerDetail, getProspectDetail, listPartners, parseNumbers } from "@/lib/services/partners";
import { listReps } from "@/lib/services/sales-reps";
import { formatCairo, formatCairoDate } from "@/lib/datetime";
import { StageBadge } from "@/components/shared/StageBadge";
import { GroupHistory } from "@/components/internal/GroupHistory";
import { HistoryPanel } from "@/components/internal/HistoryPanel";
import { AddProspectForm, AlternativeNumbersForm, RecordingUpload } from "./forms";
import { PartnerAddLeadClient } from "./PartnerAddLead";
import { ProspectEventPanel } from "./ProspectEventPanel";
import { ApiError } from "@/lib/api-error";

/* App B Partners: acquisition board (§7.2), prospect detail, directory (§7.3),
   partner detail with attributed leads (§7.4). */

export async function PartnersPipelineBody() {
  const prospects = await db.partnerProspect.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  function keyDatum(p: (typeof prospects)[number]): string {
    switch (p.stage) {
      case "didnt_answer":
        return "Awaiting a new number";
      case "following_up":
        return p.followUps[0] ? `Next: ${formatCairo(p.followUps[0].dueAt)}` : "No follow-up set";
      case "meeting_setting":
        return p.meetings[0]?.datetime ? `Meeting: ${formatCairo(p.meetings[0].datetime)}` : "Not arranged";
      case "lost":
        return p.lostInfo[0]?.reason ?? "";
      default:
        return p.businessActivity;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Partners Pipeline</h1>
        <AddProspectForm />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-start">
        {PARTNER_STAGES.map((stage) => {
          const cards = prospects.filter((p) => p.stage === stage);
          return (
            <div key={stage} className="bg-brand-surface-tint rounded-brand-card p-2 min-h-24">
              <p className="text-brand-meta text-brand-muted px-1 pb-2">
                {STAGE_LABELS[stage]} ({cards.length})
              </p>
              <div className="space-y-2">
                {cards.map((p) => (
                  <Link
                    key={p.id}
                    href={`/b-systems/partners-pipeline/${p.id}`}
                    className="block bg-brand-surface-card border border-brand-border rounded-brand-card p-3 shadow-brand-card hover:border-brand-primary"
                  >
                    <p className="font-medium text-sm">{p.companyName}</p>
                    <p className="text-xs text-brand-muted mt-0.5">{p.name}</p>
                    {p.converted ? (
                      <p className="text-xs mt-1">
                        <span className="bg-brand-success text-brand-on-success rounded-brand-control px-1.5 py-0.5">
                          Converted
                        </span>
                      </p>
                    ) : null}
                    <p className="text-xs text-brand-ink mt-1">{keyDatum(p)}</p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export async function ProspectDetailBody({ prospectId }: { prospectId: string }) {
  let data;
  try {
    data = await getProspectDetail(prospectId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { prospect, history } = data;
  const reps = await listReps("bsystems");
  const latestMeeting = prospect.meetings.at(-1);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/b-systems/partners-pipeline"
          className="text-sm text-brand-muted underline underline-offset-2"
        >
          Back to the pipeline
        </Link>
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading flex items-center gap-3 flex-wrap">
          {prospect.companyName}
          <StageBadge stage={prospect.stage} />
          {prospect.converted ? (
            <span className="text-xs bg-brand-success text-brand-on-success rounded-brand-control px-2 py-1">
              Converted
            </span>
          ) : null}
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 text-sm space-y-1">
            <p>
              <span className="text-brand-muted">Contact:</span> {prospect.name}
              {prospect.role ? ` · ${prospect.role}` : ""}
            </p>
            <p>
              <span className="text-brand-muted">Number:</span> {prospect.number}
            </p>
            {parseNumbers(prospect.nonAnsweringNumbers).length > 0 ? (
              <p>
                <span className="text-brand-muted">Non-answering number(s):</span>{" "}
                {parseNumbers(prospect.nonAnsweringNumbers).join(" · ")}
              </p>
            ) : null}
            {parseNumbers(prospect.alternativeNumbers).length > 0 ? (
              <p>
                <span className="text-brand-muted">Alternative numbers:</span>{" "}
                {parseNumbers(prospect.alternativeNumbers).join(" · ")}
              </p>
            ) : null}
            <p>
              <span className="text-brand-muted">Email:</span> {prospect.email ?? "—"}
            </p>
            <p>
              <span className="text-brand-muted">Business activity:</span>{" "}
              {prospect.businessActivity}
            </p>
            {prospect.description ? (
              <p className="pt-1 whitespace-pre-wrap">{prospect.description}</p>
            ) : null}
            {prospect.partner ? (
              <p className="pt-1">
                <Link
                  href={`/b-systems/partners/${prospect.partner.id}`}
                  className="text-brand-primary underline underline-offset-2"
                >
                  View in Partners directory
                </Link>
              </p>
            ) : null}
          </div>

          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
            <AlternativeNumbersForm
              prospectId={prospect.id}
              inDidntAnswer={prospect.stage === "didnt_answer"}
            />
          </div>

          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 space-y-3">
            <h2 className="text-brand-meta text-brand-muted">Cold-call recordings</h2>
            {prospect.recordings.length === 0 ? (
              <p className="text-sm text-brand-muted">No recordings yet.</p>
            ) : (
              <ul className="space-y-3">
                {prospect.recordings.map((r) => (
                  <li key={r.id} className="text-sm">
                    <p className="mb-1">{r.filename}</p>
                    {r.mime.startsWith("video/") ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video controls preload="metadata" className="w-full rounded-brand-control" src={`/api/files/${r.id}`} />
                    ) : (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio controls preload="metadata" className="w-full" src={`/api/files/${r.id}`} />
                    )}
                  </li>
                ))}
              </ul>
            )}
            <RecordingUpload prospectId={prospect.id} />
          </div>

          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
            <h2 className="text-brand-meta text-brand-muted mb-3">Next action</h2>
            <ProspectEventPanel
              prospectId={prospect.id}
              stage={prospect.stage}
              reps={reps.map((r) => ({ id: r.id, name: r.name }))}
              pendingMeeting={Boolean(
                latestMeeting && latestMeeting.outcome === null && latestMeeting.arranged,
              )}
              defaults={{
                companyName: prospect.companyName,
                name: prospect.name,
                role: prospect.role,
                number: prospect.number,
                email: prospect.email,
                businessActivity: prospect.businessActivity,
              }}
              cardNumbers={[prospect.number, ...parseNumbers(prospect.alternativeNumbers)]}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-brand-meta text-brand-muted mb-2">Stage records</h2>
            <GroupHistory
              followUps={prospect.followUps}
              meetings={prospect.meetings}
              lostInfo={prospect.lostInfo}
            />
          </div>
          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
            <h2 className="text-brand-meta text-brand-muted mb-2">History</h2>
            <HistoryPanel entries={history} />
          </div>
        </section>
      </div>
    </div>
  );
}

export async function PartnersDirectoryBody() {
  const partners = await listPartners();
  return (
    <div className="space-y-6">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Partners</h1>
      {partners.length === 0 ? (
        <p className="text-sm text-brand-muted">
          No partners yet — they appear automatically when a pipeline card is Won.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {partners.map((p) => (
            <Link
              key={p.id}
              href={`/b-systems/partners/${p.id}`}
              className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4 hover:border-brand-primary"
            >
              <p className="font-bold">{p.companyName}</p>
              <p className="text-brand-meta text-brand-muted mt-1">{p.importance}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export async function PartnerDetailBody({ partnerId }: { partnerId: string }) {
  let partner;
  try {
    partner = await getPartnerDetail(partnerId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const reps = await listReps("bsystems");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/b-systems/partners"
          className="text-sm text-brand-muted underline underline-offset-2"
        >
          Back to all partners
        </Link>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h1 className="font-brand-display text-2xl font-bold text-brand-heading">{partner.companyName}</h1>
          <p className="text-brand-meta text-brand-muted">
            Date joined: {formatCairoDate(partner.dateJoined)}
          </p>
        </div>
      </div>

      <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 text-sm grid sm:grid-cols-2 gap-x-6 gap-y-1">
        <p>
          <span className="text-brand-muted">Key person:</span> {partner.keyPersonName} ·{" "}
          {partner.keyPersonRole}
        </p>
        <p>
          <span className="text-brand-muted">Importance:</span> {partner.importance}
        </p>
        <p>
          <span className="text-brand-muted">Address:</span> {partner.address}
        </p>
        <p>
          <span className="text-brand-muted">Number:</span> {partner.number}
        </p>
        <p>
          <span className="text-brand-muted">Email:</span> {partner.email ?? "—"}
        </p>
        <p>
          <span className="text-brand-muted">Business activity:</span> {partner.businessActivity}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-brand-display text-lg font-bold text-brand-heading">Leads from this partner</h2>
          <PartnerAddLead partnerId={partner.id} reps={reps.map((r) => ({ id: r.id, name: r.name }))} />
        </div>
        {partner.leads.length === 0 ? (
          <p className="text-sm text-brand-muted">No leads yet.</p>
        ) : (
          <div className="overflow-x-auto border border-brand-border rounded-brand-card bg-brand-surface-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-start p-3 font-bold">Name</th>
                  <th className="text-start p-3 font-bold">Number</th>
                  <th className="text-start p-3 font-bold">Rep</th>
                  <th className="text-start p-3 font-bold">Created</th>
                  <th className="text-start p-3 font-bold">Stage</th>
                </tr>
              </thead>
              <tbody>
                {partner.leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-brand-border last:border-0">
                    <td className="p-3">
                      <Link
                        href={`/b-systems/crm/lead/${lead.id}`}
                        className="font-medium text-brand-primary"
                      >
                        {lead.name}
                      </Link>
                    </td>
                    <td className="p-3">{lead.number}</td>
                    <td className="p-3">{lead.salesRep?.name ?? "Unassigned"}</td>
                    <td className="p-3">{formatCairoDate(lead.createdAt)}</td>
                    <td className="p-3">
                      <StageBadge stage={lead.stage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* §7.4: same fields as §6.1's lead detail + optional assign-to-rep (A-6). */
function PartnerAddLead({
  partnerId,
  reps,
}: {
  partnerId: string;
  reps: Array<{ id: string; name: string }>;
}) {
  return <PartnerAddLeadClient partnerId={partnerId} reps={reps} />;
}
