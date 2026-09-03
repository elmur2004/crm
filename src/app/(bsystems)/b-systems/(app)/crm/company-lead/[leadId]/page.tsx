import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { bsRoleOf } from "@/lib/api/bsystems";
import { getLeadDetail } from "@/lib/services/leads";
import { formatCairo } from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadTypeLabel } from "@/lib/i18n/dict/labels";
import { common, crmPage, leadDetail as m } from "@/lib/i18n/dict/crm";
import { StageBadge } from "@/components/shared/StageBadge";
import { NoAnswerBadge } from "@/components/shared/NoAnswerBadge";
import { GroupHistory } from "@/components/internal/GroupHistory";

export const metadata = { title: "Lead — B-Systems CRM" };

/* ============================================================================
   ADR-075 — ANOTHER COMPANY'S LEAD, READ ONLY.

   Founder: "mindoo leads should appear in bsystems crm with a label called
   mindoo… clickable, opens the lead read-only."

   This is the ONE window in the wall ADR-074 built, and it is deliberately a
   window rather than a door:

   · ADMIN ONLY, the same narrowing the board applies before it ever renders a
     foreign card. Internal sales, agents and partners never reach here.
   · THE COMPANY IS PINNED IN THE CODE, never taken from the URL. A `?company=`
     here would be a way to ask this page for any brand's lead, which is exactly
     the widening every API namespace in this codebase refuses.
   · NOTHING WRITES. No event panel, no edit form, no archive, no chat, no
     assign, no delete — not disabled versions of them, ABSENT. A disabled
     control is still a promise, and every one of those posts to
     /api/b-systems, where a Mindoo lead is refused by the brand wall.

   It is a separate route from the editable detail on purpose. Adding a
   read-only MODE to that page would have put the two behaviours one boolean
   apart, and a boolean that decides whether a screen can write is the kind of
   thing that gets inverted by a later edit. Two files cannot be confused.
   ========================================================================== */

/** the company this window looks into — a literal, for the reason above */
const FOREIGN_BRAND = "mindoo" as const;
const FOREIGN_LABEL = "Mindoo";

export default async function ForeignLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  const { user } = await requireCompanySection(
    "bsystems",
    (await searchParams).company,
    BS_PIPELINE_ROLES,
  );
  /* the board only ever renders these cards for the admin; this is the wall
     that makes that true rather than merely tidy */
  if (bsRoleOf(user) !== "bsystems_admin") notFound();

  const { leadId } = await params;
  const locale = await getLocale();
  const t = tFor(locale);

  let lead;
  try {
    ({ lead } = await getLeadDetail(FOREIGN_BRAND, leadId));
  } catch {
    /* not a lead of that company — 404, never a confirmation that the id
       belongs to something else somewhere */
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(crmPage.eyebrow)}</p>
          <Link
            href="/b-systems/crm?company=bsystems"
            className="text-sm text-brand-muted underline underline-offset-2"
          >
            {t(m.backToBoard)}
          </Link>
        </div>
      </div>

      <div className="card card--flush0" data-foreign-company={FOREIGN_LABEL}>
        <div className="identity-head">
          <h1 className="identity-name flex items-center gap-3 flex-wrap">
            {lead.name}
            <span className="bcard-company">{FOREIGN_LABEL}</span>
            <StageBadge stage={lead.stage} header />
            <NoAnswerBadge locale={locale} count={lead.noAnswerCount} />
          </h1>
        </div>
        <div className="fields-grid">
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldNumber)}</p>
            <p className="fields-value">{lead.number}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldEmail)}</p>
            <p className="fields-value">{lead.email ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldType)}</p>
            <p className="fields-value">{leadTypeLabel(locale, lead.type)}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldCompany)}</p>
            <p className="fields-value">{lead.companyName ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldIndustry)}</p>
            <p className="fields-value">{lead.industry ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldDateCreated)}</p>
            <p className="fields-value">{formatCairo(lead.createdAt, locale)}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldRequirements)}</p>
            <p className="fields-value whitespace-pre-wrap">{lead.requirements ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldNotes)}</p>
            <p className="fields-value whitespace-pre-wrap">{lead.description ?? "—"}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="u-h3 mb-2">{t(m.stageRecords)}</h2>
        {/* the pipeline records, read as they stand. GroupHistory renders and
            never writes, which is why it is the one panel that belongs here. */}
        <GroupHistory
          followUps={lead.followUps}
          meetings={lead.meetings}
          proposals={lead.proposals}
          lostInfo={lead.lostInfo}
          postponeInfos={lead.postponeInfos}
          won={lead.wonInfo}
        />
      </div>

      <p className="u-footnote">
        {t(common.readOnlyForeignLead).replace("{company}", FOREIGN_LABEL)}
      </p>
    </div>
  );
}
