-- ASSIGNED LEADS ONLY — the one-time ownership backfill. DATA ONLY: no table,
-- column or index changes anywhere in this file.
--
-- Founder, verbatim (2026-11-08): "Currently, all the unassigned leads are seen
-- by everyone. I want them just to be seen by the admin. And whenever I assign
-- a lead for a new user … they can see the lead then." Asked about the leads a
-- sales user already added with nobody owning them: "Give them to whoever added
-- them". Asked about ByteForce: "Both companies now".
--
-- The build that ships with this migration shows a non-admin ONLY the leads he
-- OWNS (`Lead.ownerUserId`), in both companies. Until today a B-Systems sales
-- user saw the whole internal bucket and a ByteForce teammate saw every
-- ByteForce lead, so neither ever needed to own anything — and the morning this
-- deploys, every one of them would open an empty board. This hands each of them
-- back the leads that are plainly theirs, and leaves everything else UNASSIGNED,
-- which now means: visible to the company admin, who hands it out.
--
-- WHY A MIGRATION AND NOT A SCRIPT (ADR-080's precedent, the Mindoo purge). The
-- production launcher runs `prisma migrate deploy` at boot and never a seed or a
-- script (scripts/start.mjs), so a migration is the only thing that runs by
-- itself on the live database, exactly once, in order, before the new code
-- serves a request.
--
-- THE RULE (only rows with "ownerUserId" IS NULL are ever touched — a lead that
-- already has an owner is never re-decided):
--
--   1. B-Systems (brand 'bsystems', ownerType 'internal', no owner).
--      a. The lead's legacy rep CARD (SalesRep) carries a name EXACTLY equal to
--         the name of EXACTLY ONE active, approved account holding
--         `bsystems_sales` → that account owns it. Exact, because B-Systems
--         cards were auto-provisioned from those very account names
--         (listBsOwnerReps).
--      b. Otherwise, the account that TYPED it in (createdByUserId) is active,
--         approved, holds `bsystems_sales` and is NOT `bsystems_admin` → the
--         creator owns it ("give them to whoever added them").
--      c. Otherwise unchanged: unassigned, the admin's.
--
--   2. ByteForce (brand 'byteforce', no owner).
--      a. The rep card's name matches — case- and surrounding-whitespace-
--         INSENSITIVE, because ByteForce cards were typed by hand — EXACTLY ONE
--         active, approved account holding `byteforce_staff` and NOT
--         `bsystems_admin` → that account owns it.
--      b. Otherwise the creator, when he is an active, approved `byteforce_staff`
--         account that is NOT `bsystems_admin`.
--      c. Otherwise unassigned — the ByteForce admin (the platform admin) hands
--         it out.
--
--   An AMBIGUOUS card (two accounts share the name) never guesses: it falls to
--   the creator rule, then to unassigned. ARCHIVED leads follow the same rule —
--   this is ownership, not visibility of the archive. `ownerType` is untouched
--   (B-Systems' stays 'internal', ByteForce's stays whatever it was), and so is
--   `salesRepId`: the card stays on the row as history, it just decides nothing.
--
-- HISTORY: every lead this hands to somebody gets ONE ActivityLog row (action
-- 'update', trigger 'backfill_owner', actor 'System', no actor id), so the lead's
-- History panel says when and why it became his. The row id is DERIVED from the
-- lead id ('backfill_owner_' || md5(lead id)) — ActivityLog.id is a plain text
-- column whose cuid default lives in the Prisma client, not in the database —
-- and `ON CONFLICT (id) DO NOTHING` makes a second run write nothing twice.
--
-- `updatedAt` IS DELIBERATELY NOT BUMPED. Prisma's @updatedAt is client-side, so
-- raw SQL leaves it alone, and that is the right outcome here: the boards order
-- by `updatedAt`, so bumping it would shuffle every board on deploy morning for
-- a change no person made. No pending undo entry is put at risk by the stale
-- fingerprint: the only inverse that writes the owner (`lead_assign`) belongs to
-- leads that already HAVE an owner, which this never touches.
--
-- IDEMPOTENT, SAFE TO RE-RUN: every UPDATE is gated on "ownerUserId" IS NULL, so
-- a lead this owned is never re-decided, and the log insert cannot duplicate.
-- Run twice, the second run changes nothing.
--
-- KNOWN GAP, stated rather than discovered: restoring a backup taken BEFORE this
-- deploy brings back the old unowned rows, and the backup importer has no twin
-- of this rule (src/lib/services/backup.ts was out of bounds for this change).
-- Nothing leaks — an unowned lead is the admin's alone — but those leads would
-- need handing out again by hand.

BEGIN;

-- ------------------------------------------------------- 1. B-Systems ----
WITH sales AS (
  SELECT u.id, u.name
  FROM "User" u
  WHERE u.active = true
    AND u."registrationStatus" = 'approved'
    AND EXISTS (SELECT 1 FROM "UserRole" r WHERE r."userId" = u.id AND r.role = 'bsystems_sales')
),
card_match AS (
  SELECT l.id AS lead_id, MIN(s.id) AS owner_id
  FROM "Lead" l
  JOIN "SalesRep" rep ON rep.id = l."salesRepId"
  JOIN sales s ON s.name = rep.name
  WHERE l.brand = 'bsystems'
    AND l."ownerType" = 'internal'
    AND l."ownerUserId" IS NULL
  GROUP BY l.id
  HAVING COUNT(*) = 1
),
creator_match AS (
  SELECT l.id AS lead_id, l."createdByUserId" AS owner_id
  FROM "Lead" l
  JOIN sales s ON s.id = l."createdByUserId"
  WHERE l.brand = 'bsystems'
    AND l."ownerType" = 'internal'
    AND l."ownerUserId" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "UserRole" r WHERE r."userId" = l."createdByUserId" AND r.role = 'bsystems_admin'
    )
    AND NOT EXISTS (SELECT 1 FROM card_match c WHERE c.lead_id = l.id)
),
plan AS (
  SELECT lead_id, owner_id FROM card_match
  UNION ALL
  SELECT lead_id, owner_id FROM creator_match
),
moved AS (
  UPDATE "Lead" l
  SET "ownerUserId" = p.owner_id
  FROM plan p
  WHERE l.id = p.lead_id
    AND l."ownerUserId" IS NULL
  RETURNING l.id
)
INSERT INTO "ActivityLog" (id, "entityType", "entityId", "actorId", "actorLabel", action, trigger, "createdAt")
SELECT 'backfill_owner_' || md5(m.id), 'lead', m.id, NULL, 'System', 'update', 'backfill_owner', CURRENT_TIMESTAMP
FROM moved m
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------- 2. ByteForce ----
WITH staff AS (
  SELECT u.id, u.name
  FROM "User" u
  WHERE u.active = true
    AND u."registrationStatus" = 'approved'
    AND EXISTS (SELECT 1 FROM "UserRole" r WHERE r."userId" = u.id AND r.role = 'byteforce_staff')
    AND NOT EXISTS (SELECT 1 FROM "UserRole" r WHERE r."userId" = u.id AND r.role = 'bsystems_admin')
),
card_match AS (
  SELECT l.id AS lead_id, MIN(s.id) AS owner_id
  FROM "Lead" l
  JOIN "SalesRep" rep ON rep.id = l."salesRepId"
  JOIN staff s
    ON lower(regexp_replace(s.name, '^\s+|\s+$', '', 'g'))
     = lower(regexp_replace(rep.name, '^\s+|\s+$', '', 'g'))
  WHERE l.brand = 'byteforce'
    AND l."ownerUserId" IS NULL
  GROUP BY l.id
  HAVING COUNT(*) = 1
),
creator_match AS (
  SELECT l.id AS lead_id, l."createdByUserId" AS owner_id
  FROM "Lead" l
  JOIN staff s ON s.id = l."createdByUserId"
  WHERE l.brand = 'byteforce'
    AND l."ownerUserId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM card_match c WHERE c.lead_id = l.id)
),
plan AS (
  SELECT lead_id, owner_id FROM card_match
  UNION ALL
  SELECT lead_id, owner_id FROM creator_match
),
moved AS (
  UPDATE "Lead" l
  SET "ownerUserId" = p.owner_id
  FROM plan p
  WHERE l.id = p.lead_id
    AND l."ownerUserId" IS NULL
  RETURNING l.id
)
INSERT INTO "ActivityLog" (id, "entityType", "entityId", "actorId", "actorLabel", action, trigger, "createdAt")
SELECT 'backfill_owner_' || md5(m.id), 'lead', m.id, NULL, 'System', 'update', 'backfill_owner', CURRENT_TIMESTAMP
FROM moved m
ON CONFLICT (id) DO NOTHING;

COMMIT;
