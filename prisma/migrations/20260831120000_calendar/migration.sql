-- ADR-071 (founder: "the calendar is a page which takes all the meetings from
-- the meeting settings in the CRM and puts them in a calendar, with the ability
-- for every single user to add their own schedule on the calendar... so whenever
-- X is setting a meeting and Y has to be in this meeting, X will look at the
-- calendar and see if Y has any other meetings other than the CRM") — the
-- CALENDAR.
--
-- TWO tables, and neither of them stores a meeting. The CRM half of the calendar
-- is a PROJECTION over the Meeting rows that already exist (the To-Do's
-- philosophy since ADR-041: a view over records that already carry dates, never
-- a second copy that can drift). What is genuinely new is only the two things
-- the existing schema cannot answer:
--
--   MeetingAttendee  WHOSE TIME a meeting occupies. Today a meeting is reachable
--                    only through its lead's owner, so "is Y free?" — the exact
--                    question the founder asked — is unanswerable whenever Y is
--                    not the owner. `technicalSupport` beside it is FREE TEXT
--                    and cannot be it: a typed name is not an account, and the
--                    calendar has to resolve to accounts or it resolves to
--                    nothing. Composite PK, so a person is on a meeting once.
--
--   CalendarEvent    the person's OWN entries — his "personal stuff, another
--                    offline meeting or something".
--
-- CalendarEvent HAS NO COMPANY COLUMN, deliberately. A dentist appointment is
-- not a B-Systems record, and a company-scoped personal entry would make the
-- same hour read free under one label and busy under the other — which defeats
-- the one thing the page exists to do. The company decides WHOSE entries you
-- are shown (the roster of the company you are switched to, derived from
-- UserRole exactly as companiesFor does it); it never decides whose time is
-- real.
--
-- `shared` DEFAULTS TO FALSE — the founder's per-event visibility, private side
-- first. A colleague reads "Busy · Ahmed" until the owner deliberately ticks the
-- box that names the entry. Default-private is the only default whose wrong
-- guess is merely unhelpful; the other direction publishes a doctor's
-- appointment to the whole company and cannot be taken back.
--
-- NO BACKFILL. Both tables are new, nothing existing changes meaning, and no
-- other section reads them. Every statement is IF NOT EXISTS so the file is
-- re-runnable at boot (scripts/start.mjs retries `prisma migrate deploy`) — the
-- house rule since ADR-064.

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeetingAttendee" (
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("meetingId", "userId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeetingAttendee_userId_idx" ON "MeetingAttendee"("userId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEvent_userId_startsAt_idx" ON "CalendarEvent"("userId", "startsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CalendarEvent_startsAt_idx" ON "CalendarEvent"("startsAt");

-- AddForeignKey — CASCADE on both: a deleted meeting has no attendees, and a
-- deleted account must stop occupying anybody's calendar.
DO $$ BEGIN
    ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey"
        FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
