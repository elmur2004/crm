/* Accounting module constants (ADR-052). The reference SPA is the spec: these
   unions mirror its DEPTS / EXPENSE_TYPES / INCOME_TYPES id sets exactly, so an
   imported export file needs no value mapping. Prisma columns are plain String;
   these unions + the Zod schemas built from them are the real constraint
   (house pattern, src/lib/pipeline-engine/constants.ts). */

import type { Msg } from "@/lib/i18n/core";

export const ACCT_COMPANIES = ["byteforce", "bsystems"] as const;
export type AcctCompany = (typeof ACCT_COMPANIES)[number];

/* service lines (departments) */
export const ACCT_DEPTS = [
  "social",
  "video",
  "branding",
  "web",
  "media_fee",
  "other",
] as const;
export type AcctDept = (typeof ACCT_DEPTS)[number];

export const ACCT_DEPT_LABELS: Record<AcctDept, Msg> = {
  social: { en: "Social Media Management", ar: "إدارة التواصل الاجتماعي" },
  video: { en: "Video Production", ar: "إنتاج الفيديو" },
  branding: { en: "Branding", ar: "الهوية التجارية" },
  web: { en: "Web & App Development", ar: "تطوير الويب والتطبيقات" },
  media_fee: { en: "Media Buying — Fee", ar: "شراء الإعلانات — العمولة" },
  other: { en: "Other", ar: "أخرى" },
};

export const ACCT_EXPENSE_TYPES = [
  "payroll",
  "subscription",
  "media",
  "rent",
  "freelancer",
  "tax",
  "admin",
  "loan_repay",
  "other",
] as const;
export type AcctExpenseType = (typeof ACCT_EXPENSE_TYPES)[number];

export const ACCT_EXPENSE_TYPE_LABELS: Record<AcctExpenseType, Msg> = {
  payroll: { en: "Payroll / Salary", ar: "رواتب" },
  subscription: { en: "Subscription / Tool", ar: "اشتراك / أداة" },
  media: { en: "Media Spend (pass-through)", ar: "إنفاق إعلاني (تمريري)" },
  rent: { en: "Rent", ar: "إيجار" },
  freelancer: { en: "Freelancer", ar: "مستقل" },
  tax: { en: "Tax / Government", ar: "ضرائب / حكومي" },
  admin: { en: "Admin / Office", ar: "إداري / مكتب" },
  loan_repay: { en: "Loan Repayment", ar: "سداد قرض" },
  other: { en: "Other", ar: "أخرى" },
};

export const ACCT_INCOME_TYPES = [
  "invoice",
  "media_fee",
  "consulting",
  "loan_in",
  "other",
] as const;
export type AcctIncomeType = (typeof ACCT_INCOME_TYPES)[number];

export const ACCT_INCOME_TYPE_LABELS: Record<AcctIncomeType, Msg> = {
  invoice: { en: "Client Invoice / Retainer", ar: "فاتورة / عقد عميل" },
  media_fee: { en: "Media Buying Fee", ar: "عمولة شراء إعلانات" },
  consulting: { en: "Consulting", ar: "استشارات" },
  loan_in: { en: "Loan Received (borrowed)", ar: "قرض مستلَم" },
  other: { en: "Other Income", ar: "دخل آخر" },
};

export const ACCT_TREASURY_KINDS = ["deposit", "withdraw"] as const;
export type AcctTreasuryKind = (typeof ACCT_TREASURY_KINDS)[number];

export const ACCT_LOAN_DIRECTIONS = ["borrowed", "lent"] as const;
export type AcctLoanDirection = (typeof ACCT_LOAN_DIRECTIONS)[number];

export const ACCT_MEDIA_ENTRY_TYPES = ["received", "sent"] as const;
export type AcctMediaEntryType = (typeof ACCT_MEDIA_ENTRY_TYPES)[number];

/* founder decision 5 (INTEGRATION-PLAN §7): B-Systems HIDES Media Buying —
   the media screen, the media expense type and the media_fee dept/income type
   never surface under company=bsystems. */
export function mediaHidden(company: AcctCompany): boolean {
  return company === "bsystems";
}

/** SPA loanSettled: outstanding ≤ 0.5 EGP counts as settled → 50 piasters. */
export const ACCT_LOAN_EPSILON_PIASTERS = 50;
