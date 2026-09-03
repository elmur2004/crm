import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";
import { requireLeadAccess } from "@/lib/auth/guards";
import { getLeadDetail } from "@/lib/services/leads";
import { listLeadComments, mentionableUsersFor } from "@/lib/services/comments";
import { formatCairo } from "@/lib/datetime";
import { telHref, waHref } from "@/lib/phone-dial";
import { formatMsg, tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadTypeLabel, ownerTypeLabel } from "@/lib/i18n/dict/labels";
import { callSheet as m } from "@/lib/i18n/dict/call";
/* the facts this page shows are the LEAD DETAIL's facts — same labels, same
   Arabic, one source (dict/crm); only the call sheet's own strings live in
   dict/call */
import { archiveMsgs, common as crmCommon, leadDetail as ld } from "@/lib/i18n/dict/crm";
import { StageBadge } from "@/components/shared/StageBadge";
import { NoAnswerBadge } from "@/components/shared/NoAnswerBadge";
import { WhatsappChip } from "@/components/shared/WhatsappChip";
import { waSentLabel, whatsappMarkOf } from "@/components/shared/whatsappMark";
import { LeadChat } from "@/components/shared/LeadChat";
import { GroupHistory } from "@/components/internal/GroupHistory";
import { HistoryPanel } from "@/components/internal/HistoryPanel";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";

/* Founder — the call sheet: "whenever you dial, it opens the page where all the
   information of the lead is displayed — his name, his industry, the last
   update, the last comment, all of his story — the stage records, the details,
   all inside that page … so I can talk with him on the phone and see
   everything."

   One page, PHONE-FIRST, in the order you need it mid-call: who you are ringing
   and the dial button first (sticky, so it stays reachable one-handed however
   far you scroll), then the essentials, the last thing that happened, the
   conversation, the stage records and the full history. Everything below the
   sticky block reuses the existing lead-detail renderers (GroupHistory /
   LeadChat / HistoryPanel) rather than restating them.

   The tel: link — not a script — is what opens the dialer, so coming back from
   the call leaves this page exactly as it was. Access is re-checked
   server-side by requireLeadAccess: the URL is not a way around the walls. */

export async function CallSheet({
  brand,
  leadId,
  leadPath,
  query = "",
  apiBase,
}: {
  brand: Brand;
  leadId: string;
  /** "/b-systems/crm/lead" | "/b-systems/leads/lead" (ADR-067: one shell) */
  leadPath: string;
  /** ADR-067 — "?company=byteforce"; the back link keeps the company */
  query?: string;
  apiBase: string;
}) {
  const locale = await getLocale();
  const t = tFor(locale);

  let access;
  let detail;
  try {
    access = await requireLeadAccess(leadId);
    detail = await getLeadDetail(brand, leadId);
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  const { lead, history } = detail;

  const [comments, mentionables, negotiationNotes] = await Promise.all([
    listLeadComments(leadId),
    mentionableUsersFor(leadId),
    /* ADR-074 — asked of the PIPELINE, not of a brand literal. Negotiation
       notes exist for any company whose pipeline has a negotiation stage, and
       Mindoo's does (it runs B-Systems' shape) — pinned to "bsystems" this
       hid, on Mindoo's call sheet, the notes its own staff had just written.
       ByteForce has no such stage, so it still gets none. */
    configForBrand(brand).stages.includes("negotiation")
      ? db.negotiationNote.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
  ]);

  const dial = telHref(lead.number);
  const wa = waHref(lead.number);
  /* ADR-069 — on THIS surface the chip's rest label carries what the mark's
     sentence does not: the verb and the number ("Message on WhatsApp —
     01001234567"). So the two are COMPOSED rather than swapped: a marked chip
     still announces that it messages this number, with who and when appended.
     Everywhere else the rest label is the bare word "WhatsApp", which the
     sentence already opens with, so those surfaces pass it unchanged. */
  const waRest = t(formatMsg(m.whatsappAria, { number: lead.number }));
  const waSent = waSentLabel(locale, whatsappMarkOf(lead));
  const ownerLine = [
    ownerTypeLabel(locale, lead.ownerType),
    lead.owner?.name,
    lead.salesRep?.name,
    lead.partner?.companyName,
  ]
    .filter(Boolean)
    .join(" · ");

  const facts: Array<{ label: string; value: string }> = [
    { label: t(ld.fieldOwner), value: ownerLine },
    { label: t(ld.fieldType), value: leadTypeLabel(locale, lead.type) },
    { label: t(ld.fieldIndustry), value: lead.industry ?? "—" },
    { label: t(ld.fieldPosition), value: lead.position ?? "—" },
    { label: t(ld.fieldCompany), value: lead.companyName ?? "—" },
    { label: t(ld.fieldDateCreated), value: formatCairo(lead.createdAt, locale) },
    { label: t(ld.fieldRequirements), value: lead.requirements ?? "—" },
    { label: t(ld.fieldNotes), value: lead.description ?? "—" },
  ];

  return (
    <div className="call-sheet">
      {/* 1 — who you are ringing, and the button that rings them */}
      <div className="call-top">
        <p className="u-eyebrow">{t(m.eyebrow)}</p>
        <h1 className="call-name">{lead.name}</h1>
        {lead.companyName ? <p className="call-company">{lead.companyName}</p> : null}
        <p className="call-badges">
          <StageBadge stage={lead.stage} />
          {lead.readyToClose ? (
            <span className="badge badge--accent">{t(crmCommon.readyToClose)}</span>
          ) : null}
          {/* ADR-064 — mid-call, "we tried 3 times" is exactly the context the
              caller needs, so the sheet carries the tally too */}
          <NoAnswerBadge locale={locale} count={lead.noAnswerCount} />
          {lead.archived ? (
            <span className="badge badge--archived">{t(archiveMsgs.archived)}</span>
          ) : null}
        </p>
        {dial ? (
          <a
            href={dial}
            className="call-cta"
            aria-label={t(formatMsg(m.callNowAria, { number: lead.number }))}
          >
            <svg
              className="call-cta-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2Z" />
            </svg>
            <span className="call-cta-label">{t(m.callNow)}</span>
            <span className="call-cta-number" dir="ltr">
              {lead.number}
            </span>
          </a>
        ) : (
          <p className="u-muted">{t(m.noNumber)}</p>
        )}
        {/* founder: "message on WhatsApp" beside every Call — on the
            phone-first screen that means a second big button, outlined so
            dialing stays the primary act. New tab: coming back from WhatsApp
            leaves this page exactly as it was.
            ADR-069 — and it comes back GREEN: pressing it records, for
            everybody, that this lead has been messaged. The mark is dispatched
            with sendBeacon and nothing is awaited, so the message opens exactly
            as fast as it always did. */}
        {wa ? (
          <WhatsappChip
            href={wa}
            markUrl={`${apiBase}/leads/${lead.id}/whatsapp`}
            sentLabel={waSent ? `${waRest} — ${waSent}` : null}
            justSentLabel={`${waRest} — ${t(m.whatsappSentJustNow)}`}
            restLabel={waRest}
            className="call-cta call-cta--wa"
          >
            <svg
              className="call-cta-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span className="call-cta-label">{t(m.whatsapp)}</span>
          </WhatsappChip>
        ) : null}
        {/* …and the same sentence in VISIBLE words. `title` is a hover tooltip,
            and this is the one screen built for a phone, where hover does not
            exist — so who messaged them and when is printed under the button
            rather than left to a tooltip a touch device never shows. */}
        {wa && waSent ? <p className="call-line u-muted">{waSent}</p> : null}
        <p className="call-back">
          <Link href={`${leadPath}/${lead.id}${query}`} className="text-brand-link underline underline-offset-2">
            {t(m.backToLead)}
          </Link>
        </p>
      </div>

      {/* other ways to reach them — the schema keeps ONE number per lead */}
      {lead.email ? (
        <div className="card card--flush0">
          <div className="card-head">
            <h2 className="u-h3">{t(m.otherContacts)}</h2>
          </div>
          <div className="card-pad">
            <a
              href={`mailto:${lead.email}`}
              className="call-line text-brand-link underline underline-offset-2"
            >
              {lead.email}
            </a>
            <p className="u-muted">{t(m.sendEmail)}</p>
          </div>
        </div>
      ) : null}

      {/* 2 — the essentials, in reading order */}
      <div className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(m.details)}</h2>
        </div>
        <div className="fields-grid">
          {facts.map((f) => (
            <div key={f.label} className="fields-cell">
              <p className="fields-label">{f.label}</p>
              <p className="fields-value whitespace-pre-wrap">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3 — the last thing that happened, with its date */}
      <div className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(m.latestUpdate)}</h2>
        </div>
        <div className="card-pad">
          <HistoryPanel entries={history.slice(0, 1)} />
        </div>
      </div>

      {/* 4 — the conversation (and a place to jot a note mid-call) */}
      <LeadChat
        postUrl={`${apiBase}/leads/${lead.id}/comments`}
        comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
        mentionables={mentionables}
        currentUserId={access.user.id}
      />

      {negotiationNotes.length > 0 ? (
        <div className="card card--flush0">
          <div className="card-head">
            <h2 className="u-h3">{t(ld.negotiationNotes)}</h2>
          </div>
          <div className="card-pad">
            <ul className="space-y-2 text-sm">
              {negotiationNotes.map((n) => (
                <li key={n.id}>
                  <p className="whitespace-pre-wrap">{n.note}</p>
                  <p className="record-time">{formatCairo(n.createdAt, locale)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* 5 — his whole story: every stage record */}
      <div>
        <h2 className="u-h3 mb-2">{t(ld.stageRecords)}</h2>
        <GroupHistory
          followUps={lead.followUps}
          meetings={lead.meetings}
          proposals={lead.proposals}
          lostInfo={lead.lostInfo}
          postponeInfos={lead.postponeInfos}
          won={lead.wonInfo}
        />
      </div>

      {/* 6 — and the full activity history underneath it */}
      <div className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(ld.history)}</h2>
        </div>
        <div className="card-pad">
          <HistoryPanel entries={history} />
        </div>
      </div>
    </div>
  );
}
