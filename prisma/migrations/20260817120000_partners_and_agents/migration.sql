-- Founder: the Partnership CRM becomes "Partners & Agents" — one board, two
-- kinds of card. Every existing row is a partner (the DEFAULT does it) and keeps
-- its data: companyName/businessActivity only become NULLABLE, never emptied.

-- AlterTable
ALTER TABLE "PartnerProspect" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'partner',
ADD COLUMN     "address" TEXT,
ADD COLUMN     "speciality" TEXT,
ADD COLUMN     "agentUserId" TEXT,
ALTER COLUMN "companyName" DROP NOT NULL,
ALTER COLUMN "businessActivity" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProspect_agentUserId_key" ON "PartnerProspect"("agentUserId");

-- CreateIndex
CREATE INDEX "PartnerProspect_kind_idx" ON "PartnerProspect"("kind");

-- AddForeignKey
ALTER TABLE "PartnerProspect" ADD CONSTRAINT "PartnerProspect_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
