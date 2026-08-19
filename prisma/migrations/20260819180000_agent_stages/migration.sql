-- ADR-057 — the agent pipeline gets its own stage vocabulary.
--
-- Founder: "agents stages : lead , contacted , didn't answer , meeting settting ,
-- qualified , lost , when he is in qualified he becomes an agent and we create a
-- user for hiim and fill in the data of him and I can assing leads for agents also"
--
-- This is a RENAME of two stage KEYS on AGENT cards only. Partner cards keep
-- §7.2's set verbatim — every statement below is guarded by kind = 'agent'.
--
--   following_up -> contacted   (the follow-up role slot)
--   won          -> qualified   (the terminal-success role slot / account gate)
--
-- DATA-ONLY: "stage" is TEXT with no enum and no CHECK constraint (see
-- 20260809000000_init_postgres); the only stage-touching index is the plain
-- btree PartnerProspect_stage_idx, which self-maintains on UPDATE. Nothing
-- here touches "converted", "agentUserId", the unique index on it, the FK to
-- User, or any FollowUp / Meeting / LostInfo / Attachment child — so an agent
-- card that was already at 'won' lands on 'qualified' with its live account
-- and every relation intact.
--
-- IDEMPOTENT: every WHERE names the OLD value, which cannot exist after a
-- successful run, so a retry (scripts/start.mjs, or the /api/health self-heal)
-- matches zero rows and changes nothing. That includes statement 3, whose
-- predicate is the undo SNAPSHOT's old stage rather than the card's.

-- 1. the cards themselves
UPDATE "PartnerProspect" SET "stage" = 'contacted'
 WHERE "kind" = 'agent' AND "stage" = 'following_up';

UPDATE "PartnerProspect" SET "stage" = 'qualified'
 WHERE "kind" = 'agent' AND "stage" = 'won';

-- 2. the History panel on those cards, so an agent's own history stops
--    speaking the partner vocabulary. ActivityLog is append-only by policy;
--    this rewrite is deliberate and recorded in ADR-057.
UPDATE "ActivityLog" a SET "fromStage" = 'contacted'
  FROM "PartnerProspect" p
 WHERE a."entityType" = 'partner_prospect' AND a."entityId" = p."id"
   AND p."kind" = 'agent' AND a."fromStage" = 'following_up';

UPDATE "ActivityLog" a SET "toStage" = 'contacted'
  FROM "PartnerProspect" p
 WHERE a."entityType" = 'partner_prospect' AND a."entityId" = p."id"
   AND p."kind" = 'agent' AND a."toStage" = 'following_up';

UPDATE "ActivityLog" a SET "fromStage" = 'qualified'
  FROM "PartnerProspect" p
 WHERE a."entityType" = 'partner_prospect' AND a."entityId" = p."id"
   AND p."kind" = 'agent' AND a."fromStage" = 'won';

UPDATE "ActivityLog" a SET "toStage" = 'qualified'
  FROM "PartnerProspect" p
 WHERE a."entityType" = 'partner_prospect' AND a."entityId" = p."id"
   AND p."kind" = 'agent' AND a."toStage" = 'won';

-- 3. THE STRANDING GUARD. A pending UndoEntry written minutes before this
--    deploy carries payload.stage = 'following_up' (or 'won') for an agent
--    card. Prisma's @updatedAt is CLIENT-side, so the raw UPDATEs above do NOT
--    bump updatedAt and undo's fingerprint check would still MATCH — undo
--    would write the dead stage straight back and the card would render in no
--    column at all. Retiring (never deleting) those entries closes it.
--
--    It retires that user's WHOLE pending set, not only the offending row.
--    ADR-045's HONESTY invariant is that Undo never offers an action older
--    than the last one the user took; `pendingUndoFor`/`performUndo` simply
--    take the newest unconsumed row, so consuming just the agent entry would
--    PROMOTE the entry underneath it — a lead move made a minute earlier —
--    to the head of the queue, and the button would then quietly revert
--    something that was not the last thing the admin did. `invalidateUndo`
--    retires the whole set everywhere else for exactly this reason.
--
--    The inner SELECT names the OLD stage values (in the snapshot, which the
--    statements above do not touch), so after a successful run it matches
--    nothing — no agent card can sit at 'following_up' or 'won' again — and a
--    retry is the same no-op every other statement here is.
UPDATE "UndoEntry" SET "consumedAt" = NOW()
 WHERE "consumedAt" IS NULL
   AND "userId" IN (
     SELECT u."userId"
       FROM "UndoEntry" u
       JOIN "PartnerProspect" p ON p."id" = u."entityId"
      WHERE u."consumedAt" IS NULL
        AND u."entityType" = 'partner_prospect'
        AND p."kind" = 'agent'
        AND u."payload"->>'stage' IN ('following_up', 'won')
   );
