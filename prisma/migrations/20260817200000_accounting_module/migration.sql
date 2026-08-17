-- ADR-052 — the Accounting module (docs/INTEGRATION-PLAN.md Phases 1-2).
-- Rebuild-on-top of the reference SPA: its migrate()/state shape is the field
-- spec. Money = Int piasters; months/dates are calendar STRINGS (the engine
-- is lexicographic month arithmetic); payroll is DERIVED, never stored rows.

-- CreateTable
CREATE TABLE "AcctIncome" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "client" TEXT NOT NULL DEFAULT '',
    "serviceLine" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "collected" BOOLEAN NOT NULL DEFAULT false,
    "collectedDate" TEXT,
    "paidMonth" TEXT,
    "mediaEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctExpense" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "serviceLine" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "deduction" INTEGER,
    "bonus" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidDate" TEXT,
    "rosterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctRosterMember" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "serviceLine" TEXT NOT NULL DEFAULT '',
    "account" TEXT NOT NULL DEFAULT '',
    "since" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctRosterMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctRosterSegment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "salary" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AcctRosterSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctPayrollPayment" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "paidDate" TEXT NOT NULL,

    CONSTRAINT "AcctPayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctTreasuryMove" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctTreasuryMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctLoan" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctLoanPayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AcctLoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctMediaEntry" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "feeAmount" INTEGER,
    "date" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcctMediaEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctTarget" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "goal" INTEGER NOT NULL,

    CONSTRAINT "AcctTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctSettings" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AcctSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcctIncome_company_month_idx" ON "AcctIncome"("company", "month");

-- CreateIndex
CREATE INDEX "AcctIncome_company_collected_idx" ON "AcctIncome"("company", "collected");

-- CreateIndex
CREATE INDEX "AcctExpense_company_month_idx" ON "AcctExpense"("company", "month");

-- CreateIndex
CREATE INDEX "AcctRosterMember_company_idx" ON "AcctRosterMember"("company");

-- CreateIndex
CREATE UNIQUE INDEX "AcctRosterSegment_memberId_from_key" ON "AcctRosterSegment"("memberId", "from");

-- CreateIndex
CREATE INDEX "AcctPayrollPayment_company_month_idx" ON "AcctPayrollPayment"("company", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AcctPayrollPayment_memberId_month_key" ON "AcctPayrollPayment"("memberId", "month");

-- CreateIndex
CREATE INDEX "AcctTreasuryMove_company_month_idx" ON "AcctTreasuryMove"("company", "month");

-- CreateIndex
CREATE INDEX "AcctLoan_company_idx" ON "AcctLoan"("company");

-- CreateIndex
CREATE INDEX "AcctMediaEntry_company_month_idx" ON "AcctMediaEntry"("company", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AcctTarget_company_period_key" ON "AcctTarget"("company", "period");

-- CreateIndex
CREATE UNIQUE INDEX "AcctSettings_company_key" ON "AcctSettings"("company");

-- AddForeignKey
ALTER TABLE "AcctIncome" ADD CONSTRAINT "AcctIncome_mediaEntryId_fkey" FOREIGN KEY ("mediaEntryId") REFERENCES "AcctMediaEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcctExpense" ADD CONSTRAINT "AcctExpense_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "AcctRosterMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcctRosterSegment" ADD CONSTRAINT "AcctRosterSegment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "AcctRosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcctPayrollPayment" ADD CONSTRAINT "AcctPayrollPayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "AcctRosterMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcctLoanPayment" ADD CONSTRAINT "AcctLoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "AcctLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

