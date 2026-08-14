-- CreateTable
CREATE TABLE "UndoEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "UndoEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UndoEntry_userId_consumedAt_createdAt_idx" ON "UndoEntry"("userId", "consumedAt", "createdAt");
