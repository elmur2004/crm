import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPartnerDetail, getProspectDetail, listPartners, parseNumbers } from "@/lib/services/partners";
import { listReps } from "@/lib/services/sales-reps";
import { formatCairo, formatCairoDate } from "@/lib/datetime";
import { StageBadge } from "@/components/shared/StageBadge";
import { GroupHistory } from "@/components/internal/GroupHistory";
import { HistoryPanel } from "@/components/internal/HistoryPanel";
import { AddProspectForm, AlternativeNumbersForm, RecordingUpload } from "./forms";
import { PartnerAddLeadClient } from "./PartnerAddLead";
import { ProspectEventPanel } from "./ProspectEventPanel";
import { PartnersBoard, type ProspectCard } from "./PartnersBoard";
import { DeleteEntityButton, EditPartnerButton, EditProspectButton } from "./manage";
import { ApiError } from "@/lib/api-error";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import {
  businessActivityLabel,
  importanceValueLabel,
  pCommon,
  pDirectory,
  pPipeline,
  pProspect,
} from "@/lib/i18n/dict/partners";

/* App B Partners: acquisition board (§7.2), prospect detail, directory (§7.3),
   partner detail with attributed leads (§7.4). */

export async function PartnersPipelineBody() {
  const locale = await getLocale();
  const t = tFor(locale);
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
        return t(pPipeline.awaitingNewNumber);
      case "following_up":
        return p.followUps[0]
          ? t(pPipeline.nextAt).replace("{dt}", formatCairo(p.followUps[0].dueAt))
          : t(pPipeline.noFollowUpSet);
      case "meeting_setting":
        return p.meetings[0]?.datetime
          ? t(pPipeline.meetingAt).replace("{dt}", formatCairo(p.meetings[0].datetime))
          : t(pPipeline.notArranged);
      case "lost":
        return p.lostInfo[0]?.reason ?? "";
      default:
        return businessActivityLabel(locale, p.businessActivity);
    }
  }

  const reps = (await listReps("bsystems")).map((r) => ({ id: r.id, name: r.name }));
  const cards: ProspectCard[] = prospects.map((p) => ({
    id: p.id,
    companyName: p.companyName,
    name: p.name,
    stage: p.stage,
    converted: p.converted,
    keyDatum: keyDatum(p),
    defaults: {
      companyName: p.companyName,
      name: p.name,
      role: p.role,
      number: p.number,
      email: p.email,
      businessActivity: p.businessActivity,
    },
    cardNumbers: [p.number, ...parseNumbers(p.alternativeNumbers)],
  }));

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(pPipeline.eyebrow)}</p>
          <h1 className="u-h1">{t(pPipeline.title)}</h1>
        </div>
        <div className="page-actions">
          <AddProspectForm />
        </div>
      </div>
      <PartnersBoard cards={cards} reps={reps} />
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
  const locale = await getLocale();
  const t = tFor(locale);
  const reps = await listReps("bsystems");
  const latestMeeting = prospect.meetings.at(-1);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <Link
            href="/b-systems/partners-pipeline"
            className="text-sm text-brand-muted underline underline-offset-2"
          >
            {t(pProspect.backToPipeline)}
          </Link>
          <p className="u-eyebrow mt-3">{t(pPipeline.eyebrow)}</p>
          <h1 className="u-h1 flex items-center gap-3 flex-wrap">
            {prospect.companyName}
            <StageBadge stage={prospect.stage} header />
            {prospect.converted ? (
              <span className="badge badge--converted">{t(pPipeline.converted)}</span>
            ) : null}
          </h1>
        </div>
        <div className="page-actions">
          {/* founder V4: the admin edits and deletes pipeline cards */}
          <EditProspectButton
            prospect={{
              id: prospect.id,
              name: prospect.name,
              companyName: prospect.companyName,
              role: prospect.role,
              email: prospect.email,
              number: prospect.number,
              businessActivity: prospect.businessActivity,
              description: prospect.description,
            }}
          />
          <DeleteEntityButton
            url={`/api/b-systems/partners-pipeline/${prospect.id}`}
            label={t(pCommon.delete)}
            warning={t(pProspect.deleteWarning)}
            redirectTo="/b-systems/partners-pipeline"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <div className="card card--flush0">
            <div className="fields-grid">
              <div className="fields-cell">
                <p className="fields-value">
                  <span className="fields-label block mb-1.5">{t(pProspect.contact)}</span> {prospect.name}
                  {prospect.role ? ` · ${prospect.role}` : ""}
                </p>
              </div>
              <div className="fields-cell">
                <p className="fields-value">
                  <span className="fields-label block mb-1.5">{t(pProspect.numberField)}</span> {prospect.number}
                </p>
              </div>
              {parseNumbers(prospect.nonAnsweringNumbers).length > 0 ? (
                <div className="fields-cell">
                  <p className="fields-value">
                    <span className="fields-label block mb-1.5">{t(pProspect.nonAnswering)}</span>{" "}
                    {parseNumbers(prospect.nonAnsweringNumbers).join(" · ")}
                  </p>
                </div>
              ) : null}
              {parseNumbers(prospect.alternativeNumbers).length > 0 ? (
                <div className="fields-cell">
                  <p className="fields-value">
                    <span className="fields-label block mb-1.5">{t(pProspect.altNumbers)}</span>{" "}
                    {parseNumbers(prospect.alternativeNumbers).join(" · ")}
                  </p>
                </div>
              ) : null}
              <div className="fields-cell">
                <p className="fields-value">
                  <span className="fields-label block mb-1.5">{t(pProspect.emailField)}</span> {prospect.email ?? "—"}
                </p>
              </div>
              <div className="fields-cell">
                <p className="fields-value">
                  <span className="fields-label block mb-1.5">{t(pProspect.businessActivityField)}</span>{" "}
                  {businessActivityLabel(locale, prospect.businessActivity)}
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
                      {t(pProspect.viewInDirectory)}
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
            <h2 className="u-mono">{t(pProspect.recordingsTitle)}</h2>
            {prospect.recordings.length === 0 ? (
              <p className="empty">{t(pProspect.noRecordings)}</p>
            ) : (
              <ul className="space-y-3">
                {prospect.recordings.map((r) => (
                  <li key={r.id} className="text-sm border border-brand-border rounded-brand-control p-3">
                    <p className="td-mono mb-1.5">{r.filename}</p>
                    {!r.fileOk ? (
                      <p className="text-brand-danger text-xs">
                        {t(pProspect.recordingMissing)}
                      </p>
                    ) : r.mime.startsWith("video/") ? (
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
            <h2 className="u-mono mb-3">{t(pProspect.nextActionTitle)}</h2>
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
            <h2 className="u-mono mb-2">{t(pProspect.stageRecords)}</h2>
            <GroupHistory
              followUps={prospect.followUps}
              meetings={prospect.meetings}
              lostInfo={prospect.lostInfo}
            />
          </div>
          <div className="card card-pad">
            <h2 className="u-mono mb-2">{t(pProspect.history)}</h2>
            <HistoryPanel entries={history} />
          </div>
        </section>
      </div>
    </div>
  );
}

export async function PartnersDirectoryBody() {
  const locale = await getLocale();
  const t = tFor(locale);
  const partners = await listPartners();
  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(pDirectory.eyebrow)}</p>
          <h1 className="u-h1">{t(pDirectory.title)}</h1>
        </div>
      </div>
      {partners.length === 0 ? (
        <p className="empty">
          {t(pDirectory.empty)}
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
                <span className="chip-outline">{importanceValueLabel(locale, p.importance)}</span>
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
  const locale = await getLocale();
  const t = tFor(locale);
  const reps = await listReps("bsystems");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/b-systems/partners"
          className="text-sm text-brand-muted underline underline-offset-2"
        >
          {t(pDirectory.backToAll)}
        </Link>
        <div className="page-head">
          <div>
            <p className="u-eyebrow mt-3">{t(pDirectory.eyebrow)}</p>
            <h1 className="u-h1">{partner.companyName}</h1>
            <p className="text-brand-meta text-brand-muted mt-2">
              {t(pDirectory.dateJoined)} {formatCairoDate(partner.dateJoined)}
            </p>
          </div>
          <div className="page-actions">
            {/* founder V4: the admin edits and deletes directory partners */}
            <EditPartnerButton
              partner={{
                id: partner.id,
                companyName: partner.companyName,
                keyPersonName: partner.keyPersonName,
                keyPersonRole: partner.keyPersonRole,
                address: partner.address,
                number: partner.number,
                email: partner.email,
                businessActivity: partner.businessActivity,
                importance: partner.importance,
              }}
            />
            <DeleteEntityButton
              url={`/api/b-systems/partners/${partner.id}`}
              label={t(pCommon.delete)}
              warning={t(pDirectory.deleteWarning)}
              redirectTo="/b-systems/partners"
            />
          </div>
        </div>
      </div>

      <div className="card card--flush0">
        <div className="fields-grid">
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">{t(pDirectory.keyPerson)}</span> {partner.keyPersonName} ·{" "}
              {partner.keyPersonRole}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">{t(pDirectory.importanceField)}</span> {importanceValueLabel(locale, partner.importance)}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">{t(pDirectory.addressField)}</span> {partner.address}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">{t(pProspect.numberField)}</span> {partner.number}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">{t(pProspect.emailField)}</span> {partner.email ?? "—"}
            </p>
          </div>
          <div className="fields-cell">
            <p className="fields-value">
              <span className="fields-label block mb-1.5">{t(pProspect.businessActivityField)}</span> {businessActivityLabel(locale, partner.businessActivity)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="u-h2">{t(pDirectory.leadsTitle)}</h2>
          <PartnerAddLead partnerId={partner.id} reps={reps.map((r) => ({ id: r.id, name: r.name }))} />
        </div>
        {partner.leads.length === 0 ? (
          <p className="empty">{t(pDirectory.noLeads)}</p>
        ) : (
          <div className="card card--flush0">
            <div className="table-scroll">
              <table className="table table--embedded">
                <thead>
                  <tr>
                    <th>{t(pDirectory.thName)}</th>
                    <th>{t(pDirectory.thNumber)}</th>
                    <th>{t(pDirectory.thRep)}</th>
                    <th>{t(pDirectory.thCreated)}</th>
                    <th>{t(pDirectory.thStage)}</th>
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
                      <td>{lead.salesRep?.name ?? t(pDirectory.unassigned)}</td>
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
