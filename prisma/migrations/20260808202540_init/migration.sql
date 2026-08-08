-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    PRIMARY KEY ("userId", "role"),
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalesRep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "salesRepId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "partnerId" TEXT,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "email" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "SalesRep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "portalDealId" TEXT,
    "context" TEXT NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "method" TEXT NOT NULL,
    "ownerSalesRepId" TEXT,
    "ownerPortalRepId" TEXT,
    "followingUpWith" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_portalDealId_fkey" FOREIGN KEY ("portalDealId") REFERENCES "PortalDeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_ownerSalesRepId_fkey" FOREIGN KEY ("ownerSalesRepId") REFERENCES "SalesRep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_ownerPortalRepId_fkey" FOREIGN KEY ("ownerPortalRepId") REFERENCES "PortalRep" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "portalDealId" TEXT,
    "arranged" BOOLEAN NOT NULL DEFAULT false,
    "datetime" DATETIME,
    "mode" TEXT,
    "withAttendees" TEXT,
    "technicalSupport" TEXT,
    "outcome" TEXT,
    "outcomeDestination" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Meeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_portalDealId_fkey" FOREIGN KEY ("portalDealId") REFERENCES "PortalDeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "portalDealId" TEXT,
    "service" TEXT NOT NULL,
    "estimatedValue" INTEGER,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Proposal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Proposal_portalDealId_fkey" FOREIGN KEY ("portalDealId") REFERENCES "PortalDeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LostInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "portalDealId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LostInfo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LostInfo_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LostInfo_portalDealId_fkey" FOREIGN KEY ("portalDealId") REFERENCES "PortalDeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WonInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "estimatedValue" INTEGER NOT NULL,
    "technicalOwner" TEXT NOT NULL,
    "collectedAmount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WonInfo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "leadId" TEXT,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "service" TEXT,
    "estimatedValue" INTEGER,
    "collected" INTEGER,
    "toBeCollected" INTEGER,
    "dueDate" DATETIME,
    "retainer" BOOLEAN NOT NULL DEFAULT false,
    "technicalOwner" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartnerProspect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "number" TEXT NOT NULL,
    "number2" TEXT,
    "number3" TEXT,
    "businessActivity" TEXT NOT NULL,
    "description" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'lead',
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "keyPersonName" TEXT NOT NULL,
    "keyPersonRole" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "email" TEXT,
    "businessActivity" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "dateJoined" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Partner_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "PartnerProspect" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortalRep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,
    CONSTRAINT "PortalRep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PortalDeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "email" TEXT,
    "companyName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "requirements" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'leads',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PortalDeal_repId_fkey" FOREIGN KEY ("repId") REFERENCES "PortalRep" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WonDeal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "estimatedValue" INTEGER,
    "totalCommission" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WonDeal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "PortalDeal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wonDealId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    CONSTRAINT "Milestone_wonDealId_fkey" FOREIGN KEY ("wonDealId") REFERENCES "WonDeal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "portalRepId" TEXT,
    "partnerProspectId" TEXT,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_portalRepId_fkey" FOREIGN KEY ("portalRepId") REFERENCES "PortalRep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attachment_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "trigger" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "SalesRep_brand_idx" ON "SalesRep"("brand");

-- CreateIndex
CREATE INDEX "Lead_brand_stage_idx" ON "Lead"("brand", "stage");

-- CreateIndex
CREATE INDEX "Lead_brand_salesRepId_idx" ON "Lead"("brand", "salesRepId");

-- CreateIndex
CREATE INDEX "Lead_partnerId_idx" ON "Lead"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "WonInfo_leadId_key" ON "WonInfo"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_leadId_key" ON "Client"("leadId");

-- CreateIndex
CREATE INDEX "Client_brand_idx" ON "Client"("brand");

-- CreateIndex
CREATE INDEX "PartnerProspect_stage_idx" ON "PartnerProspect"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_prospectId_key" ON "Partner"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalRep_userId_key" ON "PortalRep"("userId");

-- CreateIndex
CREATE INDEX "PortalDeal_repId_stage_idx" ON "PortalDeal"("repId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "WonDeal_dealId_key" ON "WonDeal"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_wonDealId_index_key" ON "Milestone"("wonDealId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_portalRepId_key" ON "Attachment"("portalRepId");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_createdAt_idx" ON "ActivityLog"("entityType", "entityId", "createdAt");
