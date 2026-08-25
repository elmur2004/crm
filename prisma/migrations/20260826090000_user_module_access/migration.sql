-- ADR-066 (founder: "I want to have the ability to block some admins from
-- acsessing accounting or data vault") — PER-ADMIN access to the two switcher
-- MODULES, Accounting and Data Vault, each revocable independently.
--
-- Two BOOLEAN COLUMNS on User, not two new roles. The role union is iterated in
-- a dozen places (bsRoleOf, landingFor, bucketFor, ownerTypeForRole, the
-- assignable-owner roster, the To-Do scope, the edge proxy); a capability role
-- would have to be excluded from every one of them, which is exactly the kind
-- of cross-cutting change that has bitten this repo before. A flag is inert
-- everywhere except the two guards that read it.
--
-- DEFAULT TRUE is the whole backfill. Every account that exists today — admin
-- or not — comes out of this migration with both flags true, which for an admin
-- is precisely the access he had a second earlier, and for a non-admin means
-- nothing at all: the flags only NARROW bsystems_admin and can never widen
-- anything (the guards check the role first; see lib/auth/roles.ts).
--
-- IF NOT EXISTS keeps the file re-runnable at boot (scripts/start.mjs retries
-- `prisma migrate deploy`), so a half-applied deploy can be replayed safely —
-- the house rule since ADR-064.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canAccessAccounting" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canAccessVault" BOOLEAN NOT NULL DEFAULT true;
