-- ADR-064 (founder: "make the didn't answer button a counter so we can know how
-- many times we tried") — the "didn't answer" marker becomes a TALLY.
--
-- `Lead.noAnswer` is deliberately KEPT, not replaced: the backup/restore path
-- recreates rows verbatim, so dropping a column would break restoring any
-- backup file taken before today. The boolean stays maintained as
-- `noAnswerCount > 0`, so every existing reader, filter, query and test on the
-- flag keeps working unchanged.

-- AlterTable
-- IF NOT EXISTS keeps the statement re-runnable at boot (scripts/start.mjs
-- retries `migrate deploy`), so a half-applied deploy can be replayed safely.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "noAnswerCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: a lead already carrying the flag was tried at least ONCE, and once
-- is all history can honestly claim — the old column recorded that it happened,
-- never how often. An unflagged lead is 0, which the DEFAULT already gave it.
-- Re-runnable: the `= 0` guard means a second pass matches nothing, and it can
-- never reset a lead that has since counted higher.
UPDATE "Lead"
SET "noAnswerCount" = 1
WHERE "noAnswer" = true
  AND "noAnswerCount" = 0;
