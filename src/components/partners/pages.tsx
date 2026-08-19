import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  getPartnerDetail,
  getProspectDetail,
  listPartners,
  parseNumbers,
  prospectKindWhere,
  prospectSearchWhere,
  prospectTitle,
} from "@/lib/services/partners";
import { telHref, waHref } from "@/lib/phone-dial";
import { listBsOwnerReps } from "@/lib/services/sales-reps";
import { partnersConfigFor } from "@/lib/pipeline-engine/configs/partners";
import { formatCairo, formatCairoDate } from "@/lib/datetime";
import { StageBadge } from "@/components/shared/StageBadge";
import { GroupHistory } from "@/components/internal/GroupHistory";
import { HistoryPanel } from "@/components/internal/HistoryPanel";
import {
  AddProspectForm,
  AlternativeNumbersForm,
  ProspectCvUpload,
  RecordingUpload,
} from "./forms";
import { PartnerAddLeadClient } from "./PartnerAddLead";
import { ProspectEventPanel } from "./ProspectEventPanel";
import { PartnersBoard, type ProspectCard } from "./PartnersBoard";
import { DeleteEntityButton, EditPartnerButton, EditProspectButton } from "./manage";
import { FilterPanel } from "@/components/shared/FilterPanel";
import { NumberActions } from "@/components/shared/NumberActions";
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
  prospectKindLabel,
} from "@/lib/i18n/dict/partners";
import { callSheet } from "@/lib/i18n/dict/call";
import { leadsFilters as lf } from "@/lib/i18n/dict/crm";
import { formatMsg } from "@/lib/i18n/core";

/* App B Partners & Agents: acquisition board (§7.2) carrying BOTH kinds of card,
   prospect detail, partners directory (§7.3), partner detail with attributed
   leads (§7.4). */

export async function PartnersPipelineBody({
  kind = "any",
  search = "",
}: {
  /** "any" | "partner" | "agent" — founder: "add a filter for agents and partners" */
  kind?: string;
  search?: string;
} = {}) {
  const locale = await getLocale();
  const t = tFor(locale);
  const prospects = await db.partnerProspect.findMany({
    where: { ...prospectKindWhere(kind), ...prospectSearchWhere(search) },
    orderBy: { updatedAt: "desc" },
    include: {
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  /* the disclosure chip counts every control that is off its default */
  const activeCount = [search !== "", kind !== "any"].filter(Boolean).length;

  function keyDatum(p: (typeof prospects)[number]): string {
    /* ADR-057 — the card's OWN config: an agent's dated follow-up lives in
       `contacted`, so a literal `following_up` case would drop his next date
       off the card and show his speciality instead. */
    const config = partnersConfigFor(p.kind);
    switch (p.stage) {
      case config.didntAnswerStage:
        return t(pPipeline.awaitingNewNumber);
      case config.followUpStage:
        return p.followUps[0]
          ? t(pPipeline.nextAt).replace("{dt}", formatCairo(p.followUps[0].dueAt))
          : t(pPipeline.noFollowUpSet);
      case config.meetingStage:
        return p.meetings[0]?.datetime
          ? t(pPipeline.meetingAt).replace("{dt}", formatCairo(p.meetings[0].datetime))
          : t(pPipeline.notArranged);
      case config.lostStage:
        return p.lostInfo[0]?.reason ?? "";
      default:
        /* the card's own headline datum: a partner trades in an activity, an
           agent sells a speciality */
        return p.kind === "agent"
          ? (p.speciality ?? "")
          : businessActivityLabel(locale, p.businessActivity ?? "");
    }
  }

  const reps = (await listBsOwnerReps()).map((r) => ({ id: r.id, name: r.name }));
  const cards: ProspectCard[] = prospects.map((p) => ({
    id: p.id,
    title: prospectTitle(p),
    kind: p.kind,
    /* under the headline: the partner's contact person, the agent's number
       (the agent IS the headline, so their number is the useful second line) */
    subtitle: p.kind === "agent" ? p.number : p.name,
    subtitleNumeric: p.kind === "agent",
    stage: p.stage,
    converted: p.converted,
    keyDatum: keyDatum(p),
    defaults: {
      kind: p.kind,
      companyName: p.companyName,
      name: p.name,
      role: p.role,
      number: p.number,
      email: p.email,
      businessActivity: p.businessActivity,
      address: p.address,
      speciality: p.speciality,
    },
    cardNumbers: [p.number, ...parseNumbers(p.alternativeNumbers)],
    telHref: telHref(p.number),
    waHref: waHref(p.number),
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
      {/* founder: "first of all add a filter for agents and partners" — the
          CRM boards' disclosure filter card, INLINE (the board is a full-bleed
          breakout, so a fixed side column would be painted over by it), with
          the Kind control plus the same one-box search. Narrowing is
          server-side, in the same query this page always ran. */}
      <FilterPanel activeCount={activeCount} variant="inline" defaultOpen={activeCount > 0}>
        <form
          method="get"
          className="card filter-card filter-card--inline"
          aria-label={t(lf.filters)}
        >
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
            <span className="filter-section-label">{t(pPipeline.filterKind)}</span>
            <select name="kind" defaultValue={kind} className="field-input">
              <option value="any">{t(pPipeline.filterAllKinds)}</option>
              <option value="partner">{t(pPipeline.filterPartners)}</option>
              <option value="agent">{t(pPipeline.filterAgents)}</option>
            </select>
          </label>
          <div className="filter-actions">
            <button type="submit" className="btn-primary btn--sm">
              {t(lf.apply)}
            </button>
            {activeCount > 0 ? (
              <Link href="/b-systems/partners-pipeline" className="filter-reset">
                {t(lf.clear)}
              </Link>
            ) : null}
          </div>
        </form>
      </FilterPanel>
      {cards.length === 0 && activeCount > 0 ? (
        <p className="empty">{t(pPipeline.noMatches)}</p>
      ) : (
        <PartnersBoard cards={cards} reps={reps} kind={kind} filtered={activeCount > 0} />
      )}
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
  const reps = await listBsOwnerReps();
  const latestMeeting = prospect.meetings.at(-1);
  const agent = prospect.kind === "agent";
  /* ADR-057 — this card's OWN pipeline: never compare a stage against a
     literal that only one of the two kinds happens to use. */
  const config = partnersConfigFor(prospect.kind);
  const gateDefaults = {
    kind: prospect.kind,
    companyName: prospect.companyName,
    name: prospect.name,
    role: prospect.role,
    number: prospect.number,
    email: prospect.email,
    businessActivity: prospect.businessActivity,
    address: prospect.address,
    speciality: prospect.speciality,
  };

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
            {prospectTitle(prospect)}
            <span className="badge badge--entity">{prospectKindLabel(locale, prospect.kind)}</span>
            <StageBadge stage={prospect.stage} header />
            {prospect.converted ? (
              <span className="badge badge--converted">{t(pPipeline.converted)}</span>
            ) : null}
          </h1>
        </div>
        <div className="page-actions">
          {/* founder: "add call and whatsapp in agents and partners" — reach
              the card's primary number straight from the header. Call is the
              page's one true action (the lead detail's rule); WhatsApp opens
              a new tab. */}
          {telHref(prospect.number) ? (
            <a href={telHref(prospect.number)!} className="btn-primary">
              {t(callSheet.navLabel)}
            </a>
          ) : null}
          {waHref(prospect.number) ? (
            <a
              href={waHref(prospect.number)!}
              target="_blank"
              rel="noopener"
              className="btn-ghost"
            >
              {t(callSheet.whatsapp)}
            </a>
          ) : null}
          {/* founder V4: the admin edits and deletes pipeline cards */}
          <EditProspectButton
            prospect={{
              id: prospect.id,
              kind: prospect.kind,
              name: prospect.name,
              companyName: prospect.companyName,
              role: prospect.role,
              email: prospect.email,
              number: prospect.number,
              businessActivity: prospect.businessActivity,
              address: prospect.address,
              speciality: prospect.speciality,
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
                  <span className="fields-label block mb-1.5">{t(pProspect.numberField)}</span>{" "}
                  <span className="u-ltr">{prospect.number}</span>
                  <NumberActions number={prospect.number} locale={locale} />
                </p>
              </div>
              {parseNumbers(prospect.nonAnsweringNumbers).length > 0 ? (
                <div className="fields-cell">
                  <p className="fields-value">
                    <span className="fields-label block mb-1.5">{t(pProspect.nonAnswering)}</span>{" "}
                    {/* each number is its own LTR run — a joined string would
                        reorder as one block in Arabic */}
                    {parseNumbers(prospect.nonAnsweringNumbers).map((n, i) => (
                      <span key={n}>
                        {i > 0 ? " · " : ""}
                        <span className="u-ltr">{n}</span>
                      </span>
                    ))}
                  </p>
                </div>
              ) : null}
              {parseNumbers(prospect.alternativeNumbers).length > 0 ? (
                <div className="fields-cell">
                  <p className="fields-value">
                    <span className="fields-label block mb-1.5">{t(pProspect.altNumbers)}</span>{" "}
                    {/* founder: call/wa PER number — each alternative gets its
                        own chip pair, right where the number is printed */}
                    {parseNumbers(prospect.alternativeNumbers).map((n, i) => (
                      <span key={n}>
                        {i > 0 ? " · " : ""}
                        <span className="u-ltr">{n}</span>
                        <NumberActions number={n} locale={locale} />
                      </span>
                    ))}
                  </p>
                </div>
              ) : null}
              <div className="fields-cell">
                <p className="fields-value">
                  <span className="fields-label block mb-1.5">{t(pProspect.emailField)}</span>{" "}
                  <span className="u-ltr">{prospect.email ?? "—"}</span>
                </p>
              </div>
              {agent ? (
                <>
                  <div className="fields-cell">
                    <p className="fields-value">
                      <span className="fields-label block mb-1.5">{t(pProspect.addressField)}</span>{" "}
                      {prospect.address ?? "—"}
                    </p>
                  </div>
                  <div className="fields-cell">
                    <p className="fields-value">
                      <span className="fields-label block mb-1.5">{t(pProspect.specialityField)}</span>{" "}
                      {prospect.speciality ?? "—"}
                    </p>
                  </div>
                  <div className="fields-cell">
                    <p className="fields-value">
                      <span className="fields-label block mb-1.5">{t(pProspect.cvField)}</span>{" "}
                      {prospect.cv ? (
                        <a
                          href={`/api/files/${prospect.cv.id}`}
                          className="text-brand-primary underline underline-offset-2"
                        >
                          {prospect.cv.filename}
                        </a>
                      ) : (
                        t(pProspect.noCv)
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <div className="fields-cell">
                  <p className="fields-value">
                    <span className="fields-label block mb-1.5">{t(pProspect.businessActivityField)}</span>{" "}
                    {businessActivityLabel(locale, prospect.businessActivity ?? "")}
                  </p>
                </div>
              )}
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
              {/* PP-4a: the account this card minted — the admin's proof that the
                  agent can sign in, and the way into the Agents section */}
              {prospect.agentUser ? (
                <div className="fields-cell">
                  <p className="fields-value">
                    {/* the address is NOT interpolated into the sentence: an
                        LTR email inside RTL prose has to be its own bidi run,
                        which a {var} substitution cannot give it */}
                    {t(pProspect.agentAccountCreated)}{" "}
                    <span className="u-ltr">{prospect.agentUser.email ?? "—"}</span>{" "}
                    <Link href="/b-systems/agents" className="text-brand-primary underline underline-offset-2">
                      {t(pProspect.viewInAgents)}
                    </Link>
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card card-pad">
            <AlternativeNumbersForm
              prospectId={prospect.id}
              inDidntAnswer={prospect.stage === config.didntAnswerStage}
            />
          </div>

          {/* the agent card's CV: attach it whenever it arrives — the Won gate
              moves it onto the agent's profile, CV and all */}
          {agent ? (
            <div className="card card-pad">
              <ProspectCvUpload prospectId={prospect.id} />
            </div>
          ) : null}

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
              defaults={gateDefaults}
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
  const reps = await listBsOwnerReps();

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
              <span className="fields-label block mb-1.5">{t(pProspect.numberField)}</span>{" "}
              <span className="u-ltr">{partner.number}</span>
              {/* founder: "add call and whatsapp in agents and partners" —
                  the directory partner's number gets the same chip pair */}
              <NumberActions number={partner.number} locale={locale} />
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
