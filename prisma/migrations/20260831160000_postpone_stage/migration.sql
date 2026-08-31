-- ADR-072 (founder: "we need to add a column in the CRM called postpone slash
-- not answering, for all the leads that are falling out of the CRM — not
-- answering, not attending the meeting, no showing. When we move the lead
-- there, the pop up will be: is he not answering at all, or is he no show in
-- the meeting, or is he not interested right now at all? These will be the
-- three options, and there will be the option 'other' written by the user.")
--
-- ONE new table, and NO change to any existing column.
--
-- The STAGE itself needs no migration: `Lead.stage` has always been a plain
-- TEXT column held by a TypeScript union and Zod (ADR-002, the house pattern
-- for every pseudo-enum in this schema), so adding `postponed` to
-- INTERNAL_STAGES and BSYSTEMS_STAGES is the whole of it. Nothing stored
-- changes meaning and no row needs rewriting.
--
-- PostponeInfo is built in LostInfo's image, one column wider:
--
--   reason  the CLOSED list of his three, plus `other` — a TEXT column held by
--           Zod exactly like LostInfo.reason's free text and VaultLink.type's
--           closed one.
--   note    the free text `other` carries. NULLABLE in the database and
--           REQUIRED BY ZOD when the reason is `other`: an "Other" with nothing
--           written records only that somebody pressed a button, and the
--           database is not where a conditional requirement belongs.
--
-- It is a TABLE and not two columns on Lead for the reason SPEC §5.2 gives for
-- every field group: history accumulates. A lead parked, revived and parked
-- again keeps both rows, so "he went quiet twice before he bought" stays
-- answerable. And it is NOT merged into LostInfo: postponed is an ACTIVE stage
-- and lost is terminal — one row says "not now", the other says "never" — and a
-- shared table would reduce that distinction to reading the lead's current
-- stage.
--
-- The `partnerProspectId` column exists only so the relation matches every
-- other group table's shape; the partners/agents funnel has no postpone stage
-- (founder's decision: both internal CRMs), so nothing writes it today.
--
-- NO BACKFILL: a brand-new table, nothing referencing it, and no existing lead
-- is moved anywhere. Every statement is IF NOT EXISTS so the file is re-runnable
-- at boot (scripts/start.mjs retries `prisma migrate deploy`) — the house rule
-- since ADR-064.

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostponeInfo" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostponeInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostponeInfo_leadId_idx" ON "PostponeInfo"("leadId");

-- AddForeignKey — CASCADE, exactly as LostInfo: a deleted lead takes its own
-- field-group history with it.
DO $$ BEGIN
    ALTER TABLE "PostponeInfo" ADD CONSTRAINT "PostponeInfo_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "PostponeInfo" ADD CONSTRAINT "PostponeInfo_partnerProspectId_fkey"
        FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
