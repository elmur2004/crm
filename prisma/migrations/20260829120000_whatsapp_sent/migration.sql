-- ADR-069 (founder: "when I click on the WhatsApp button, it should turn to be
-- green to signal that I already sent WhatsApp to that prospect or to that lead,
-- and it signals not just for my user, for any user that we have contacted this
-- lead through WhatsApp") — the WhatsApp mark, on the RECORD.
--
-- Three columns on each of the two record kinds that wear the WhatsApp chip:
-- WHEN it was first sent, WHO sent it, and their NAME at that moment. Nothing
-- per-viewer and nothing in the browser: the point of the request is that the
-- mark speaks to everybody who opens the card.
--
-- NULLABLE with no default and NO BACKFILL, deliberately. NULL means "nobody
-- has messaged them yet", which is the honest answer for every row that exists
-- today — the system has never recorded a WhatsApp message, so inventing one
-- would be inventing due diligence that never happened. That is also why this
-- file has no UPDATE in it, unlike the ADR-064 tally migration: there is no
-- older column whose meaning has to be carried forward.
--
-- The sender is a real FOREIGN KEY (SET NULL), not a bare id: IMPLEMENTATION's
-- ADR-049 lesson is that a userId column with no relation is invisible to
-- cascade planning, and deleting the person who sent the message must never
-- delete the lead. "whatsappSentByLabel" is the denormalised name beside it —
-- the LeadComment.authorLabel / Statement.closerLabel convention — so the chip
-- still reads "WhatsApp sent by Omar on 3 Sep 2026" after that account is gone.
-- The index over the FK is the ADR-051 precedent (Lead_createdByUserId_idx):
-- without it every permanent account deletion sequentially scans both tables.
--
-- Every statement is IF NOT EXISTS / catalogue-guarded, so the whole file is
-- re-runnable at boot (scripts/start.mjs retries `prisma migrate deploy`) and a
-- half-applied deploy can be replayed safely — the house rule since ADR-064.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "whatsappSentAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "whatsappSentById" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "whatsappSentByLabel" TEXT;

-- AlterTable
ALTER TABLE "PartnerProspect" ADD COLUMN IF NOT EXISTS "whatsappSentAt" TIMESTAMP(3);
ALTER TABLE "PartnerProspect" ADD COLUMN IF NOT EXISTS "whatsappSentById" TEXT;
ALTER TABLE "PartnerProspect" ADD COLUMN IF NOT EXISTS "whatsappSentByLabel" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_whatsappSentById_idx" ON "Lead"("whatsappSentById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartnerProspect_whatsappSentById_idx" ON "PartnerProspect"("whatsappSentById");

-- AddForeignKey
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so the catalogue is asked first
-- (the ADR-065 shape).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Lead_whatsappSentById_fkey'
    ) THEN
        ALTER TABLE "Lead"
            ADD CONSTRAINT "Lead_whatsappSentById_fkey"
            FOREIGN KEY ("whatsappSentById") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PartnerProspect_whatsappSentById_fkey'
    ) THEN
        ALTER TABLE "PartnerProspect"
            ADD CONSTRAINT "PartnerProspect_whatsappSentById_fkey"
            FOREIGN KEY ("whatsappSentById") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
