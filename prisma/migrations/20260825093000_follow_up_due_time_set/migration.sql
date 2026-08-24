-- ADR-063 (founder: "let's get the time back for the follow up but it's not
-- mandtory") — a refinement of ADR-061, not a revert. `FollowUp.dueAt` stays the
-- ONE UTC instant; this flag records whether the submitter actually CHOSE that
-- slot, so a blank submission (the ADR-061 09:00 Cairo default) can keep
-- rendering date-only while a chosen time renders with its clock.

-- AlterTable
-- IF NOT EXISTS keeps the statement re-runnable at boot (scripts/start.mjs
-- retries `migrate deploy`), so a half-applied deploy can be replayed safely.
ALTER TABLE "FollowUp" ADD COLUMN IF NOT EXISTS "dueTimeSet" BOOLEAN NOT NULL DEFAULT false;

-- Backfill, stated honestly (ADR-063): a stored instant that is NOT 09:00 on the
-- CAIRO wall clock can only have come from a form that REQUIRED a time (every
-- role before ADR-061), so the user really picked it — mark it time-set and its
-- clock comes back. Rows sitting at exactly 09:00 Cairo stay date-only: that is
-- every row created during the date-only window, plus the ONE accepted false
-- negative — a pre-ADR-061 user who deliberately typed 09:00.
-- Re-runnable: after the first pass every remaining false row is at 09:00 Cairo,
-- so a second pass matches nothing.
UPDATE "FollowUp"
SET "dueTimeSet" = true
WHERE "dueTimeSet" = false
  AND ("dueAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')::time <> TIME '09:00';
