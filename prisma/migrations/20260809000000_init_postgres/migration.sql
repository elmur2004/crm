-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "SalesRep" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SalesRep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL DEFAULT 'internal',
    "ownerUserId" TEXT,
    "salesRepId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "partnerId" TEXT,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "email" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "position" TEXT,
    "companyName" TEXT,
    "industry" TEXT,
    "requirements" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "readyToClose" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "context" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "ownerSalesRepId" TEXT,
    "ownerPortalRepId" TEXT,
    "followingUpWith" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "arranged" BOOLEAN NOT NULL DEFAULT false,
    "datetime" TIMESTAMP(3),
    "mode" TEXT,
    "withAttendees" TEXT,
    "technicalSupport" TEXT,
    "needsTechnical" BOOLEAN,
    "outcome" TEXT,
    "outcomeDestination" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "service" TEXT NOT NULL,
    "estimatedValue" INTEGER,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostInfo" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "partnerProspectId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LostInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WonInfo" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "estimatedValue" INTEGER NOT NULL,
    "technicalOwner" TEXT NOT NULL,
    "collectedAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WonInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "leadId" TEXT,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "service" TEXT,
    "estimatedValue" INTEGER,
    "collected" INTEGER,
    "toBeCollected" INTEGER,
    "dueDate" TIMESTAMP(3),
    "retainer" BOOLEAN NOT NULL DEFAULT false,
    "technicalOwner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProspect" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "number" TEXT NOT NULL,
    "nonAnsweringNumbers" TEXT NOT NULL DEFAULT '[]',
    "alternativeNumbers" TEXT NOT NULL DEFAULT '[]',
    "businessActivity" TEXT NOT NULL,
    "description" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'lead',
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "userId" TEXT,
    "companyName" TEXT NOT NULL,
    "keyPersonName" TEXT NOT NULL,
    "keyPersonRole" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "email" TEXT,
    "businessActivity" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "dateJoined" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalRep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,

    CONSTRAINT "PortalRep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WonDeal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "estimatedValue" INTEGER,
    "totalCommissionPercent" INTEGER,
    "contractDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WonDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "wonDealId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT,
    "value" INTEGER NOT NULL,
    "commissionValue" INTEGER,
    "expectedStart" TIMESTAMP(3),
    "expectedEnd" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "milestoneLabel" TEXT NOT NULL,
    "milestoneValue" INTEGER NOT NULL,
    "percentBp" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "adjustments" INTEGER NOT NULL DEFAULT 0,
    "expectedDate" TIMESTAMP(3),
    "closerUserId" TEXT,
    "closerLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "leadId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "portalRepId" TEXT,
    "partnerProspectId" TEXT,
    "wonDealId" TEXT,
    "statementId" TEXT,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "trigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Lead_brand_ownerType_idx" ON "Lead"("brand", "ownerType");

-- CreateIndex
CREATE INDEX "Lead_ownerUserId_idx" ON "Lead"("ownerUserId");

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
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PortalRep_userId_key" ON "PortalRep"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WonDeal_leadId_key" ON "WonDeal"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_wonDealId_index_key" ON "Milestone"("wonDealId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_code_key" ON "Statement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_milestoneId_key" ON "Statement"("milestoneId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_portalRepId_key" ON "Attachment"("portalRepId");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_createdAt_idx" ON "ActivityLog"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "SalesRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_ownerSalesRepId_fkey" FOREIGN KEY ("ownerSalesRepId") REFERENCES "SalesRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_ownerPortalRepId_fkey" FOREIGN KEY ("ownerPortalRepId") REFERENCES "PortalRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostInfo" ADD CONSTRAINT "LostInfo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostInfo" ADD CONSTRAINT "LostInfo_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationNote" ADD CONSTRAINT "NegotiationNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WonInfo" ADD CONSTRAINT "WonInfo_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "PartnerProspect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalRep" ADD CONSTRAINT "PortalRep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WonDeal" ADD CONSTRAINT "WonDeal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_wonDealId_fkey" FOREIGN KEY ("wonDealId") REFERENCES "WonDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_portalRepId_fkey" FOREIGN KEY ("portalRepId") REFERENCES "PortalRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_partnerProspectId_fkey" FOREIGN KEY ("partnerProspectId") REFERENCES "PartnerProspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_wonDealId_fkey" FOREIGN KEY ("wonDealId") REFERENCES "WonDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
