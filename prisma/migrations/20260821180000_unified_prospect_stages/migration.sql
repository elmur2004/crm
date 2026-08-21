-- ADR-059 — ONE stage set for BOTH kinds of prospect card. Supersedes ADR-057's
-- split vocabulary.
--
-- Founder, asked whether partners and agents should keep separate stages:
-- "Same stages for both."
--
--   lead · contacted · didnt_answer · meeting_setting · waiting · qualified · lost
--
-- AGENT rows already speak it (20260819180000_agent_stages). PARTNER rows walk
-- the same two renames:
--
--   following_up -> contacted   (the stage a partner card used to follow up in)
--   won          -> qualified   (the terminal-success slot / directory gate)
--
-- The predicate is kind <> 'agent', the exact complement of the runtime rule
-- (partnersConfigFor: anything that is not 'agent' is a partner card), so a row
-- carrying an unexpected kind is migrated rather than stranded in no column.
--
-- DATA-ONLY: "stage" is TEXT, no enum and no CHECK (see 20260809000000_init_postgres);
-- the only stage-touching index is the plain btree PartnerProspect_stage_idx,
-- which self-maintains on UPDATE. Nothing here touches "converted",
-- "agentUserId", Partner, the FK to User, or any FollowUp / Meeting / LostInfo /
-- Attachment child — a partner card already at 'won' lands on 'qualified' with
-- its directory Partner row and every relation intact.
--
-- IDEMPOTENT: every WHERE names the OLD value, which cannot exist after a
-- successful run, so a retry (scripts/start.mjs, or the /api/health self-heal)
-- matches zero rows. That includes statement 3, whose predicate is the undo
-- SNAPSHOT's old stage rather than the card's.

-- 1. the cards themselves
UPDATE "PartnerProspect" SET "stage" = 'contacted'
 WHERE "kind" <> 'agent' AND "stage" = 'following_up';

UPDATE "PartnerProspect" SET "stage" = 'qualified'
 WHERE "kind" <> 'agent' AND "stage" = 'won';

-- 2. the History panel on those cards, so a partner's own history stops
--    speaking a vocabulary the board no longer has. ActivityLog is append-only
--    by policy; this rewrite is the deliberate exception ADR-059 records. The
--    entityType filter keeps the join off internal LEAD history, which still
--    uses 'following_up' and 'won' as live stage names.
UPDATE "ActivityLog" a SET "fromStage" = 'contacted'
  FROM "PartnerProspect" p
 WHERE a."entityType" = 'partner_prospect' AND a."entityId" = p."id"
   AND p."kind" <> 'agent' AND a."fromStage" = 'following_up';

UPDATE "ActivityLog" a SET "toStage" = 'contacted'
  FROM "PartnerProspect" p
 WHERE a."entityType" = 'partner_prospect' AND a."entityId" = p."id"
   AND p."kind" <> 'agent' AND a."toStage" = 'following_up';

UPDATE "ActivityLog" a SET "fromStage" = 'qualified'
  FROM "PartnerProspect" p
 WHERE a."entityType" = 'partner_prospect' AND a."entityId" = p."id"
   AND p."kind" <> 'agent' AND a."fromStage" = 'won';

UPDATE "ActivityLog" a SET "toStage" = 'qualified'
  FROM "PartnerProspect" p
 WHERE a."entityType" = 'partner_prospect' AND a."entityId" = p."id"
   AND p."kind" <> 'agent' AND a."toStage" = 'won';

-- 3. THE STRANDING GUARD (20260819180000's statement 3, predicate inverted).
--    A pending UndoEntry written minutes before this deploy carries
--    payload.stage = 'following_up' (or 'won') for a partner card. Prisma's
--    @updatedAt is CLIENT-side, so the raw UPDATEs above do NOT bump updatedAt
--    and undo's fingerprint check would still MATCH — undo would write the dead
--    stage straight back and the card would render in no column at all.
--    Retiring (never deleting) those entries closes it.
--
--    It retires that user's WHOLE pending set, not only the offending row.
--    ADR-045's HONESTY invariant is that Undo never offers an action older than
--    the last one the user took; `pendingUndoFor`/`performUndo` simply take the
--    newest unconsumed row, so consuming just the partner entry would PROMOTE
--    the entry underneath it to the head of the queue, and the button would
--    then quietly revert something that was not the last thing the admin did.
--
--    The inner SELECT names the OLD stage values (in the snapshot, which the
--    statements above do not touch), so after a successful run it matches
--    nothing — no partner card can sit at 'following_up' or 'won' again — and a
--    retry is the same no-op every other statement here is.
UPDATE "UndoEntry" SET "consumedAt" = NOW()
 WHERE "consumedAt" IS NULL
   AND "userId" IN (
     SELECT u."userId"
       FROM "UndoEntry" u
       JOIN "PartnerProspect" p ON p."id" = u."entityId"
      WHERE u."consumedAt" IS NULL
        AND u."entityType" = 'partner_prospect'
        AND p."kind" <> 'agent'
        AND u."payload"->>'stage' IN ('following_up', 'won')
   );
