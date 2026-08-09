import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PARTNER_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { getPartnerDetail, getProspectDetail, listPartners, parseNumbers } from "@/lib/services/partners";
import { listReps } from "@/lib/services/sales-reps";
import { formatCairo, formatCairoDate } from "@/lib/datetime";
import { StageBadge } from "@/components/shared/StageBadge";
import { stageKey } from "@/components/bsystems/stageColors";
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
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · PARTNERS PIPELINE</p>
          <h1 className="u-h1">Partners Pipeline</h1>
        </div>
        <div className="page-actions">
          <AddProspectForm />
        </div>
      </div>
      <div className="board" data-cols="6plus">
        {PARTNER_STAGES.map((stage) => {
          const cards = prospects.filter((p) => p.stage === stage);
          return (
            <div key={stage} className="col" data-stage-key={stageKey(stage)}>
              <div className="col-bar" />
              <div className="col-head">
                <p className="col-title">
                  {STAGE_LABELS[stage]} ({cards.length})
                </p>
              </div>
              <div className="col-cards">
                {cards.map((p) => (
                  <Link
                    key={p.id}
                    href={`/b-systems/partners-pipeline/${p.id}`}
                    className="bcard block"
                  >
                    <p className="bcard-name">{p.companyName}</p>
                    <p className="bcard-rep whitespace-normal">{p.name}</p>
                    {p.converted ? (
                      <p className="mt-1.5">
                        <span className="badge badge--converted">Converted</span>
                      </p>
                    ) : null}
                    <p className="bcard-meta">{keyDatum(p)}</p>
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
        <p className="u-eyebrow mt-3">B-SYSTEMS · PARTNERS PIPELINE</p>
        <h1 className="u-h1 flex items-center gap-3 flex-wrap">
          {prospect.companyName}
          <StageBadge stage={prospect.stage} header />
          {prospect.converted ? (
            <span className="badge badge--converted">Converted</span>
          ) : null}
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <div className="card card--flush0">
            <div className="fields-grid">
              <div className="fields-cell">
                <p className="fields-value">
                  <span className="fields-label block mb-1.5">Contact:</span> {prospect.name}
                  {prospect.role ? ` · ${prospect.role}` : ""}
                </p>
              </div>
              <div className="fields-cell">
                <p className="fields-value">
                  <span className="fields-label block mb-1.5">Number:</span> {prospect.number}
                </p>
              </div>
              {parseNumbers(prospect.nonAnsweringNumbers).length > 0 ? (
                <div className="fields-cell">
                  <p className="fields-value">
                    <span className="fields-label block mb-1.5">Non-answering number(s):</span>{" "}
                    {parseNumbers(prospect.nonAnsweringNumbers).join(" · ")}
                  </p>
                </div>
              ) : null}
              {parseNumbers(prospect.alternativeNumbers).length > 0 ? (
                <div className="fields-cell">
                  <p className="fields-value">
                    <span className="fields-label block mb-1.5">Alternative numbers:</span>{" "}
                    {parseNumbers(prospect.alternativeNumbers).join(" · ")}
                  </p>
                </div>
              ) : null}
              <div className="fields-cell">
                <p className="fields-value">
                  <span className="fields-label block mb-1.5">Email:</span> {prospect.email ?? "—"}
                </p>
              </div>
              <div className="fields-cell">
                <p className="fields-value">
                  <span className="fields-label block mb-1.5">Business activity:</span>{" "}
                  {prospect.businessActivity}
                </p>
              </div>
              {prospect.description ? (
                <div className="fields-cell">
                  <p className="fields-value whitespace-pre-wrap">{prospect.description}</p>
                </div>
              ) : null}
              {prospect.partner ? (
                <div className="fields-cell">
                  <p className="fields-value">
                    <Link
                      href={`/b-systems/partners/${prospect.partner.id}`}
                      className="text-brand-primary underline underline-offset-2"
                    >
                      View in Partners directory
                    </Link>
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card card-pad">
            <AlternativeNumbersForm
              prospectId={prospect.id}
              inDidntAnswer={prospect.stage === "didnt_answer"}
            />
          </div>

          <div className="card card-pad space-y-3">
            <h2 className="u-mono">Cold-call recordings</h2>
            {prospect.recordings.length === 0 ? (
              <p className="empty">No recordings yet.</p>
            ) : (
              <ul className="space-y-3">
                {prospect.recordings.map((r) => (
                  <li key={r.id} className="text-sm border border-brand-border rounded-brand-control p-3">
                    <p className="td-mono mb-1.5">{r.filename}</p>
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

          <div className="card card-pad">
            <h2 className="u-mono mb-3">Next action</h2>
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
            <h2 className="u-mono mb-2">Stage records</h2>
            <GroupHistory
              followUps={prospect.followUps}
              meetings={prospect.meetings}
              lostInfo={prospect.lostInfo}
            />
          </div>
          <div className="card card-pad">
            <h2 className="u-mono mb-2">History</h2>
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
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · PARTNERS</p>
          <h1 className="u-h1">Partners</h1>
        </div>
      </div>
      {partners.length === 0 ? (
        <p className="empty">
          No partners yet — they appear automatically when a pipeline card is Won.
        </p>
      ) : (
        <div className="ecard-grid">
          {partners.map((p) => (
            <Link key={p.id} href={`/b-systems/partners/${p.id}`} className="ecard">
              <span className="ecard-top">
                <span className="ecard-mark" aria-hidden="true">
                  {p.companyName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="chip-outline">{p.importance}</span>
              </span>
              <span className="ecard-title">{p.companyName}</span>
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
        <div className="page-head">
          <div>
            <p className="u-eyebrow mt-3">B-SYSTEMS · PARTNERS</p>
            <h1 className="u-h1">{partner.companyName}</h1>
          </div>
          <p className="text-brand-meta text-brand-muted">
            Date joined: {formatCairoDate(partner.dateJoined)}
          </p>
        </div>
      </div>

      <div className="card card--flush0">
        <div className="fields-grid">
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">Key person:</span> {partner.keyPersonName} ·{" "}
              {partner.keyPersonRole}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">Importance:</span> {partner.importance}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">Address:</span> {partner.address}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">Number:</span> {partner.number}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">Email:</span> {partner.email ?? "—"}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">Business activity:</span> {partner.businessActivity}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="u-h2">Leads from this partner</h2>
          <PartnerAddLead partnerId={partner.id} reps={reps.map((r) => ({ id: r.id, name: r.name }))} />
        </div>
        {partner.leads.length === 0 ? (
          <p className="empty">No leads yet.</p>
        ) : (
          <div className="card card--flush0">
            <div className="table-scroll">
              <table className="table table--embedded">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Number</th>
                    <th>Rep</th>
                    <th>Created</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {partner.leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <Link href={`/b-systems/crm/lead/${lead.id}`} className="td-title">
                          {lead.name}
                        </Link>
                      </td>
                      <td className="td-mono">{lead.number}</td>
                      <td>{lead.salesRep?.name ?? "Unassigned"}</td>
                      <td>{formatCairoDate(lead.createdAt)}</td>
                      <td>
                        <StageBadge stage={lead.stage} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
