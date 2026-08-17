-- ADR-053 — the Data Vault module (docs/INTEGRATION-PLAN.md Phases 4-5).
-- Rebuild-on-top of the reference Vault app: its schema/services are the spec,
-- nothing is ported. Employees are assignee CARDS (no auth columns); calendar
-- facts are "YYYY-MM-DD" strings (ADR-052 precedent); files are Attachment rows
-- through the storage abstraction; archive = flag + timestamp, never delete.

-- AlterTable — vault file homes on the shared Attachment model. Sheet/document
-- FKs are NOT unique: replacing a file APPENDS a row (predecessors = history).
ALTER TABLE "Attachment" ADD COLUMN     "vaultSheetId" TEXT,
ADD COLUMN     "vaultDocumentId" TEXT,
ADD COLUMN     "vaultTaskId" TEXT;

-- CreateTable
CREATE TABLE "VaultEmployee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultForm" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultSheet" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storage" TEXT NOT NULL,
    "url" TEXT,
    "dateCreated" TEXT NOT NULL,
    "recordCount" INTEGER,
    "recordCountAsOf" TEXT,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultDocument" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultTask" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "company" TEXT,
    "deadline" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resultText" TEXT,
    "resultLinks" TEXT NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "wasLate" BOOLEAN,
    "daysLate" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_vaultSheetId_idx" ON "Attachment"("vaultSheetId");

-- CreateIndex
CREATE INDEX "Attachment_vaultDocumentId_idx" ON "Attachment"("vaultDocumentId");

-- CreateIndex
CREATE INDEX "Attachment_vaultTaskId_idx" ON "Attachment"("vaultTaskId");

-- CreateIndex
CREATE INDEX "VaultEmployee_active_idx" ON "VaultEmployee"("active");

-- CreateIndex
CREATE INDEX "VaultForm_company_archived_idx" ON "VaultForm"("company", "archived");

-- CreateIndex
CREATE INDEX "VaultForm_url_idx" ON "VaultForm"("url");

-- CreateIndex
CREATE INDEX "VaultSheet_company_archived_idx" ON "VaultSheet"("company", "archived");

-- CreateIndex
CREATE INDEX "VaultSheet_type_idx" ON "VaultSheet"("type");

-- CreateIndex
CREATE INDEX "VaultDocument_company_archived_idx" ON "VaultDocument"("company", "archived");

-- CreateIndex
CREATE INDEX "VaultDocument_type_idx" ON "VaultDocument"("type");

-- CreateIndex
CREATE INDEX "VaultTask_employeeId_status_deadline_idx" ON "VaultTask"("employeeId", "status", "deadline");

-- CreateIndex
CREATE INDEX "VaultTask_company_archived_idx" ON "VaultTask"("company", "archived");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_vaultSheetId_fkey" FOREIGN KEY ("vaultSheetId") REFERENCES "VaultSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_vaultDocumentId_fkey" FOREIGN KEY ("vaultDocumentId") REFERENCES "VaultDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_vaultTaskId_fkey" FOREIGN KEY ("vaultTaskId") REFERENCES "VaultTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultTask" ADD CONSTRAINT "VaultTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "VaultEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
