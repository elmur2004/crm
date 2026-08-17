-- ADR-051 — the data-entry role. Who TYPED a record in is not who OWNS it, so
-- the two are separate columns. Declared as real foreign keys (SET NULL) rather
-- than bare String ids: IMPLEMENTATION.md's ADR-049 lesson is that a userId
-- with no relation is invisible to cascade planning. Deleting the person who
-- entered a lead must never delete the lead.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "createdByUserId" TEXT;

-- AlterTable
ALTER TABLE "PartnerProspect" ADD COLUMN     "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_createdByUserId_idx" ON "Lead"("createdByUserId");

-- CreateIndex
CREATE INDEX "PartnerProspect_createdByUserId_idx" ON "PartnerProspect"("createdByUserId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProspect" ADD CONSTRAINT "PartnerProspect_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
