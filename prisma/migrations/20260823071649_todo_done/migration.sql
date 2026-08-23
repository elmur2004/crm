-- CreateTable
CREATE TABLE "TodoDone" (
    "id" TEXT NOT NULL,
    "followUpId" TEXT,
    "meetingId" TEXT,
    "statementId" TEXT,
    "milestoneId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedById" TEXT,
    "completedByLabel" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoDone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TodoDone_followUpId_key" ON "TodoDone"("followUpId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoDone_meetingId_key" ON "TodoDone"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoDone_statementId_key" ON "TodoDone"("statementId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoDone_milestoneId_key" ON "TodoDone"("milestoneId");

-- CreateIndex
CREATE INDEX "TodoDone_completedAt_idx" ON "TodoDone"("completedAt");

-- AddForeignKey
ALTER TABLE "TodoDone" ADD CONSTRAINT "TodoDone_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoDone" ADD CONSTRAINT "TodoDone_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoDone" ADD CONSTRAINT "TodoDone_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoDone" ADD CONSTRAINT "TodoDone_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoDone" ADD CONSTRAINT "TodoDone_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
