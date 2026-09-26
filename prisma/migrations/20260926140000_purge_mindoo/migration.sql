-- ADR-080 — THE MINDOO PURGE. This migration DELETES DATA and cannot be undone.
--
-- Founder, shown the risk in as many words (that this erases real customer
-- records — real names, real SAR deals — the moment it deploys) and answering
-- anyway, verbatim: "no also delete all mindoo data don't mind the screenshot".
--
-- WHY A MIGRATION AND NOT A SCRIPT. The production launcher runs
-- `prisma migrate deploy` at boot and never `prisma db seed` (scripts/start.mjs),
-- so a migration is the only thing that runs by itself on the live database. A
-- script would have needed somebody to remember.
--
-- WHY IT RUNS AFTER THE CODE REMOVAL AND NOT BEFORE. The build that ships with
-- it no longer knows the value 'mindoo': `BRANDS` is two literals, every
-- Record<Brand, …> table has two entries, and `requireLeadAccess` now 404s a
-- brand it does not recognise. So between the code landing and this migration
-- running there is no window in which a Mindoo row is reachable — and if this
-- migration failed, the rows would sit unreachable rather than half-deleted.
--
-- ============================================================================
-- THE THREE HAZARDS THIS ORDER EXISTS FOR
--
-- 1. RESTRICT, TWICE. `WonDeal.leadId` and `Statement.milestoneId` are required
--    relations with no onDelete, which Prisma emits as RESTRICT. A plain
--    `DELETE FROM "Lead" WHERE brand='mindoo'` FAILS on any won lead, and the
--    seed made one. Won deals and statements go first, innermost outward.
--
-- 2. SET NULL, WHICH IS WORSE THAN AN ERROR. `Client.leadId`, and
--    `Attachment.wonDealId` / `Attachment.statementId`, are optional relations
--    with no onDelete — also implicit, also invisible. Deleting the parent does
--    not delete these rows, it NULLS their pointer: an Attachment with every FK
--    null is unreachable garbage plus an orphaned blob on disk. Deleted
--    explicitly, before their parents.
--
-- 3. THREE COLUMNS THAT ARE NOT FOREIGN KEYS AT ALL. `Notification.leadId`,
--    `ActivityLog.actorId`/`entityId` and `UndoEntry.userId`/`entityId` are bare
--    strings — no FK, no cascade, nothing. They are the reason this migration
--    SNAPSHOTS THE ID SETS FIRST: `ActivityLog` and `UndoEntry` are polymorphic
--    and carry no brand, so the ONLY way to identify a Mindoo row is to match
--    `entityId` against the Mindoo leads — and the instant the leads are gone
--    that set is unrecoverable. `UndoEntry.payload` holds JSON snapshots of
--    Mindoo lead fields, so it is real data, not bookkeeping.
--
-- WHAT IS DELIBERATELY NOT TOUCHED: `VaultTask.company IS NULL` and
-- `VaultEmployee.company IS NULL`. Null means UNTAGGED, and every untagged row
-- was created by an account of the original pair before a third company existed
-- (the ruling is in src/lib/services/vault/tenancy.ts). Those are the founder's
-- own rows. Every filter below is `company = 'mindoo'`, never `IS NULL`.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------- step 0 ----
-- Snapshot every id set BEFORE anything is destroyed. Temp tables, so they go
-- away with the connection whether this commits or rolls back.
CREATE TEMP TABLE md_user   AS SELECT DISTINCT "userId" AS id FROM "UserRole" WHERE role = 'mindoo_staff';
CREATE TEMP TABLE md_lead   AS SELECT id FROM "Lead" WHERE brand = 'mindoo';
CREATE TEMP TABLE md_deal   AS SELECT id FROM "WonDeal"   WHERE "leadId"      IN (SELECT id FROM md_lead);
CREATE TEMP TABLE md_mstone AS SELECT id FROM "Milestone" WHERE "wonDealId"   IN (SELECT id FROM md_deal);
CREATE TEMP TABLE md_stmt   AS SELECT id FROM "Statement" WHERE "milestoneId" IN (SELECT id FROM md_mstone);
CREATE TEMP TABLE md_fu     AS SELECT id FROM "FollowUp"  WHERE "leadId"      IN (SELECT id FROM md_lead);
CREATE TEMP TABLE md_meet   AS SELECT id FROM "Meeting"   WHERE "leadId"      IN (SELECT id FROM md_lead);

-- ------------------------------------------------- step 1: the won-deal chain
-- Attachments first (their FKs SET NULL, they do not cascade), then the chain
-- inwards-out: Statement RESTRICTs Milestone, WonDeal RESTRICTs Lead.
DELETE FROM "Attachment" WHERE "statementId" IN (SELECT id FROM md_stmt);
DELETE FROM "Statement"  WHERE id            IN (SELECT id FROM md_stmt);
DELETE FROM "Attachment" WHERE "wonDealId"   IN (SELECT id FROM md_deal);
DELETE FROM "Milestone"  WHERE id            IN (SELECT id FROM md_mstone);
DELETE FROM "WonDeal"    WHERE id            IN (SELECT id FROM md_deal);

-- ------------------------------------------------ step 2: the SET NULL orphan
-- Only ByteForce's pipeline writes a Client (internal-crm's wonSideEffect), so
-- this should find nothing — it is here because "should" is not "does", and a
-- surviving Client row with a NULLed leadId would be invisible and permanent.
DELETE FROM "Client" WHERE brand = 'mindoo' OR "leadId" IN (SELECT id FROM md_lead);

-- ------------------------------------------- step 3: the non-FK back-pointers
-- Notification.leadId is a bare String? with no relation, so nothing cascades
-- it. Rows carry the lead's NAME in their title/body.
DELETE FROM "Notification" WHERE "leadId" IN (SELECT id FROM md_lead)
                              OR "userId" IN (SELECT id FROM md_user);

-- ActivityLog: polymorphic (entityType + a bare entityId), no brand column, and
-- `actorId` is a bare user id. Both directions matter — the rows ABOUT a Mindoo
-- record, and the rows a Mindoo account wrote about anything (its own vault and
-- accounting edits land here with entityTypes like 'acct_settings').
DELETE FROM "ActivityLog"
WHERE ("entityType" = 'lead'      AND "entityId" IN (SELECT id FROM md_lead))
   OR ("entityType" = 'won_deal'  AND "entityId" IN (SELECT id FROM md_deal))
   OR ("entityType" = 'statement' AND "entityId" IN (SELECT id FROM md_stmt))
   OR ("entityType" = 'user'      AND "entityId" IN (SELECT id FROM md_user))
   OR "actorId" IN (SELECT id FROM md_user);

-- UndoEntry: same polymorphic shape, plus a `payload Json` holding the INVERSE
-- snapshot — i.e. the lead's prior field values. `userId` is NOT NULL and not a
-- foreign key, so a Mindoo user's rows would dangle forever.
DELETE FROM "UndoEntry"
WHERE ("entityType" = 'lead' AND "entityId" IN (SELECT id FROM md_lead))
   OR "userId" IN (SELECT id FROM md_user);

-- TodoDone marks: the follow-up/meeting/milestone ones cascade, but a mark a
-- Mindoo account left on ANY record carries `completedById` (SetNull) and is
-- that account's work.
DELETE FROM "TodoDone"
WHERE "followUpId"    IN (SELECT id FROM md_fu)
   OR "meetingId"     IN (SELECT id FROM md_meet)
   OR "milestoneId"   IN (SELECT id FROM md_mstone)
   OR "completedById" IN (SELECT id FROM md_user);

-- Meeting attendees: cascades from Meeting, and explicitly here so a Mindoo
-- account's attendance on a meeting of ANOTHER company goes too.
DELETE FROM "MeetingAttendee" WHERE "meetingId" IN (SELECT id FROM md_meet)
                                 OR "userId"    IN (SELECT id FROM md_user);

-- ------------------------------------------------------ step 4: the leads
-- Cascades FollowUp, Meeting, Proposal, LostInfo, PostponeInfo,
-- NegotiationNote, WonInfo and LeadComment.
DELETE FROM "Lead" WHERE brand = 'mindoo';

-- SalesRep after the leads, because Lead.salesRepId is SET NULL.
DELETE FROM "SalesRep" WHERE brand = 'mindoo';

-- ----------------------------------------------------- step 5: the books
-- Income and Expense first: they hold the SET NULL references to the roster and
-- the media ledger. AcctRosterMember cascades its segments and payroll
-- payments; AcctLoan cascades its payments.
DELETE FROM "AcctIncome"         WHERE company = 'mindoo';
DELETE FROM "AcctExpense"        WHERE company = 'mindoo';
DELETE FROM "AcctMediaEntry"     WHERE company = 'mindoo';
DELETE FROM "AcctPayrollPayment" WHERE company = 'mindoo';
DELETE FROM "AcctRosterMember"   WHERE company = 'mindoo';
DELETE FROM "AcctLoan"           WHERE company = 'mindoo';
DELETE FROM "AcctTreasuryMove"   WHERE company = 'mindoo';
DELETE FROM "AcctTarget"         WHERE company = 'mindoo';
DELETE FROM "AcctSettings"       WHERE company = 'mindoo';

-- ----------------------------------------------------- step 6: the vault
-- Tasks before employees: VaultTask.employeeId RESTRICTs VaultEmployee. Each of
-- the four record kinds cascades its own Attachment rows.
DELETE FROM "VaultTask"     WHERE company = 'mindoo';
DELETE FROM "VaultSheet"    WHERE company = 'mindoo';
DELETE FROM "VaultDocument" WHERE company = 'mindoo';
DELETE FROM "VaultForm"     WHERE company = 'mindoo';
DELETE FROM "VaultLink"     WHERE company = 'mindoo';
DELETE FROM "VaultEmployee" WHERE company = 'mindoo';

-- ---------------------------------------------------- step 7: the accounts
-- Cascades UserRole, PushSubscription, CalendarEvent, MeetingAttendee and the
-- account's own Notifications; SetNulls the labelled authorship this platform
-- deliberately denormalises (LeadComment.authorLabel, TodoDone.completedByLabel)
-- on rows of OTHER companies, which keep their history intact.
--
-- The bootstrap table in src/lib/services/bootstrap.ts lost its Mindoo entry in
-- the previous commit. Without that, `ensureAdminExists` — which runs on every
-- single sign-in attempt — would recreate this account minutes after the deploy.
DELETE FROM "UserRole" WHERE role = 'mindoo_staff';
DELETE FROM "User"     WHERE id IN (SELECT id FROM md_user);

-- ------------------------------------------- step 8: the two dead columns
-- ADR-077's ByteForce sub-price: `bfService`/`bfValue` on Proposal. They could
-- only ever be set on a Mindoo proposal (the service proved the proposal's brand
-- before writing), so every row that carried them has just been deleted, and no
-- code in this build reads or writes them.
ALTER TABLE "Proposal" DROP COLUMN IF EXISTS "bfService";
ALTER TABLE "Proposal" DROP COLUMN IF EXISTS "bfValue";

COMMIT;
