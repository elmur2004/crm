-- V2 restructure (ADR-030): portal merged into B-Systems CRM.
-- HAND-WRITTEN, DATA-PRESERVING. Order is load-bearing:
-- leads gain columns → portal deals copied into Lead under the SAME ids →
-- children repointed → WonDeal rebuilt against Lead → PortalDeal dropped →
-- roles renamed → new subsystem tables.

PRAGMA foreign_keys=OFF;

-- 1. Lead: V2 columns
ALTER TABLE "Lead" ADD COLUMN "ownerType" TEXT NOT NULL DEFAULT 'internal';
ALTER TABLE "Lead" ADD COLUMN "ownerUserId" TEXT REFERENCES "User"("id");
ALTER TABLE "Lead" ADD COLUMN "position" TEXT;
ALTER TABLE "Lead" ADD COLUMN "companyName" TEXT;
ALTER TABLE "Lead" ADD COLUMN "industry" TEXT;
ALTER TABLE "Lead" ADD COLUMN "requirements" TEXT;
ALTER TABLE "Lead" ADD COLUMN "readyToClose" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX IF EXISTS "Lead_brand_salesRepId_idx";
CREATE INDEX "Lead_brand_ownerType_idx" ON "Lead"("brand", "ownerType");
CREATE INDEX "Lead_ownerUserId_idx" ON "Lead"("ownerUserId");

-- 2. Copy PortalDeal -> Lead (same ids; children keep working via leadId)
INSERT INTO "Lead" ("id","brand","ownerType","ownerUserId","salesRepId","source","partnerId",
  "name","number","email","type","description","position","companyName","industry","requirements",
  "stage","readyToClose","createdAt","updatedAt")
SELECT pd."id",'bsystems','agent',pr."userId",NULL,'direct',NULL,
  pd."name",pd."number",pd."email",'personal_connection',NULL,pd."position",pd."companyName",pd."industry",pd."requirements",
  CASE pd."stage" WHEN 'leads' THEN 'new' WHEN 'proposal_sending' THEN 'sending_proposal' ELSE pd."stage" END,
  false,pd."createdAt",pd."updatedAt"
FROM "PortalDeal" pd JOIN "PortalRep" pr ON pr."id" = pd."repId";

-- 3. Repoint field-group children, then REBUILD the four tables (SQLite cannot
--    DROP a column that appears in an FK definition)
UPDATE "FollowUp" SET "leadId" = "portalDealId" WHERE "portalDealId" IS NOT NULL;
UPDATE "Meeting"  SET "leadId" = "portalDealId" WHERE "portalDealId" IS NOT NULL;
UPDATE "Proposal" SET "leadId" = "portalDealId" WHERE "portalDealId" IS NOT NULL;
UPDATE "LostInfo" SET "leadId" = "portalDealId" WHERE "portalDealId" IS NOT NULL;

CREATE TABLE "new_FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "context" TEXT NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "method" TEXT NOT NULL,
    "ownerSalesRepId" TEXT,
    "ownerPortalRepId" TEXT,
    "followingUpWith" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_ownerSalesRepId_fkey" FOREIGN KEY ("ownerSalesRepId") REFERENCES "SalesRep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_ownerPortalRepId_fkey" FOREIGN KEY ("ownerPortalRepId") REFERENCES "PortalRep" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FollowUp" ("id","leadId","partnerProspectId","context","dueAt","method","ownerSalesRepId","ownerPortalRepId","followingUpWith","createdAt")
SELECT "id","leadId","partnerProspectId","context","dueAt","method","ownerSalesRepId","ownerPortalRepId","followingUpWith","createdAt" FROM "FollowUp";
DROP TABLE "FollowUp";
ALTER TABLE "new_FollowUp" RENAME TO "FollowUp";

CREATE TABLE "new_Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "arranged" BOOLEAN NOT NULL DEFAULT false,
    "datetime" DATETIME,
    "mode" TEXT,
    "withAttendees" TEXT,
    "technicalSupport" TEXT,
    "needsTechnical" BOOLEAN,
    "outcome" TEXT,
    "outcomeDestination" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Meeting" ("id","leadId","partnerProspectId","arranged","datetime","mode","withAttendees","technicalSupport","needsTechnical","outcome","outcomeDestination","createdAt")
SELECT "id","leadId","partnerProspectId","arranged","datetime","mode","withAttendees","technicalSupport",NULL,"outcome","outcomeDestination","createdAt" FROM "Meeting";
DROP TABLE "Meeting";
ALTER TABLE "new_Meeting" RENAME TO "Meeting";

CREATE TABLE "new_Proposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "service" TEXT NOT NULL,
    "estimatedValue" INTEGER,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Proposal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Proposal" ("id","leadId","service","estimatedValue","sent","sentAt","createdAt")
SELECT "id","leadId","service","estimatedValue","sent","sentAt","createdAt" FROM "Proposal";
DROP TABLE "Proposal";
ALTER TABLE "new_Proposal" RENAME TO "Proposal";

CREATE TABLE "new_LostInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LostInfo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LostInfo_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LostInfo" ("id","leadId","partnerProspectId","reason","createdAt")
SELECT "id","leadId","partnerProspectId","reason","createdAt" FROM "LostInfo";
DROP TABLE "LostInfo";
ALTER TABLE "new_LostInfo" RENAME TO "LostInfo";

-- 5. WonDeal: rebuild against Lead (old FK pointed at PortalDeal); commission -> percent
CREATE TABLE "new_WonDeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "estimatedValue" INTEGER,
    "totalCommissionPercent" INTEGER,
    "contractDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WonDeal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- v1 totalCommission was an AMOUNT — meaningless as a percent; reset to NULL
INSERT INTO "new_WonDeal" ("id","leadId","estimatedValue","totalCommissionPercent","contractDate","createdAt")
SELECT "id","dealId","estimatedValue",NULL,NULL,"createdAt" FROM "WonDeal";
DROP TABLE "WonDeal";
ALTER TABLE "new_WonDeal" RENAME TO "WonDeal";
CREATE UNIQUE INDEX "WonDeal_leadId_key" ON "WonDeal"("leadId");

-- 6. Milestone: V2 columns
ALTER TABLE "Milestone" ADD COLUMN "label" TEXT;
ALTER TABLE "Milestone" ADD COLUMN "commissionValue" INTEGER;
ALTER TABLE "Milestone" ADD COLUMN "expectedStart" DATETIME;
ALTER TABLE "Milestone" ADD COLUMN "expectedEnd" DATETIME;

-- 7. PartnerProspect: unbounded numbers (JSON arrays) replacing number2/number3
ALTER TABLE "PartnerProspect" ADD COLUMN "nonAnsweringNumbers" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "PartnerProspect" ADD COLUMN "alternativeNumbers" TEXT NOT NULL DEFAULT '[]';
UPDATE "PartnerProspect" SET "alternativeNumbers" =
  CASE
    WHEN "number2" IS NOT NULL AND "number3" IS NOT NULL THEN '["' || "number2" || '","' || "number3" || '"]'
    WHEN "number2" IS NOT NULL THEN '["' || "number2" || '"]'
    WHEN "number3" IS NOT NULL THEN '["' || "number3" || '"]'
    ELSE '[]'
  END;
ALTER TABLE "PartnerProspect" DROP COLUMN "number2";
ALTER TABLE "PartnerProspect" DROP COLUMN "number3";

-- 8. Partner: account link (V2 §8)
ALTER TABLE "Partner" ADD COLUMN "userId" TEXT REFERENCES "User"("id");
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- 9. Attachment: won-deal + statement links
ALTER TABLE "Attachment" ADD COLUMN "wonDealId" TEXT REFERENCES "WonDeal"("id");
ALTER TABLE "Attachment" ADD COLUMN "statementId" TEXT REFERENCES "Statement"("id");

-- 10. Drop PortalDeal
DROP INDEX IF EXISTS "PortalDeal_repId_stage_idx";
DROP TABLE "PortalDeal";

-- 11. Role renames (ADR-030)
UPDATE "UserRole" SET "role" = 'bsystems_admin' WHERE "role" = 'portal_admin';
UPDATE "UserRole" SET "role" = 'bsystems_sales' WHERE "role" = 'bsystems_staff';
UPDATE "UserRole" SET "role" = 'bsystems_agent' WHERE "role" = 'portal_rep';
DELETE FROM "UserRole" WHERE "role" = 'platform_admin';
UPDATE "ActivityLog" SET "entityType" = 'lead' WHERE "entityType" = 'portal_deal';

-- 12. New subsystem tables
CREATE TABLE "NegotiationNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NegotiationNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Statement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "milestoneLabel" TEXT NOT NULL,
    "milestoneValue" INTEGER NOT NULL,
    "percentBp" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "adjustments" INTEGER NOT NULL DEFAULT 0,
    "expectedDate" DATETIME,
    "closerUserId" TEXT,
    "closerLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Statement_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Statement_code_key" ON "Statement"("code");
CREATE UNIQUE INDEX "Statement_milestoneId_key" ON "Statement"("milestoneId");

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "leadId" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

PRAGMA foreign_keys=ON;
