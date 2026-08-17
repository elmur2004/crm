import type { Msg } from "@/lib/i18n/core";

/* Data Vault constants (ADR-053). The reference Vault app is the spec: these
   unions mirror its 9 Postgres enums, lowercased into the house's String
   pseudo-enums (Zod + these unions are the real constraint, the columns are
   plain String — src/lib/pipeline-engine/constants.ts pattern). */

export const VAULT_COMPANIES = ["byteforce", "bsystems"] as const;
export type VaultCompany = (typeof VAULT_COMPANIES)[number];

export const VAULT_COMPANY_LABELS: Record<VaultCompany, Msg> = {
  byteforce: { en: "ByteForce", ar: "ByteForce" },
  bsystems: { en: "B-Systems", ar: "B-Systems" },
};

/* sheets */
export const VAULT_SHEET_TYPES = ["leads", "employees", "data", "campaign_leads"] as const;
export type VaultSheetType = (typeof VAULT_SHEET_TYPES)[number];

export const VAULT_SHEET_TYPE_LABELS: Record<VaultSheetType, Msg> = {
  leads: { en: "Leads", ar: "عملاء محتملون" },
  employees: { en: "Employees", ar: "موظفون" },
  data: { en: "Data", ar: "بيانات" },
  campaign_leads: { en: "Campaign Leads", ar: "عملاء الحملات" },
};

export const VAULT_SHEET_STORAGE = ["link", "file"] as const;
export type VaultSheetStorage = (typeof VAULT_SHEET_STORAGE)[number];

/* documents — closed at the reference app's nine (its D-04) */
export const VAULT_DOCUMENT_TYPES = [
  "contract",
  "proposal",
  "invoice",
  "report",
  "presentation",
  "brand_asset",
  "legal",
  "hr",
  "other",
] as const;
export type VaultDocumentType = (typeof VAULT_DOCUMENT_TYPES)[number];

export const VAULT_DOCUMENT_TYPE_LABELS: Record<VaultDocumentType, Msg> = {
  contract: { en: "Contract", ar: "عقد" },
  proposal: { en: "Proposal", ar: "عرض" },
  invoice: { en: "Invoice", ar: "فاتورة" },
  report: { en: "Report", ar: "تقرير" },
  presentation: { en: "Presentation", ar: "عرض تقديمي" },
  brand_asset: { en: "Brand Asset", ar: "أصول الهوية" },
  legal: { en: "Legal", ar: "قانوني" },
  hr: { en: "HR", ar: "موارد بشرية" },
  other: { en: "Other", ar: "أخرى" },
};

/* tasks */
export const VAULT_TASK_STATUSES = ["open", "completed"] as const;
export type VaultTaskStatus = (typeof VAULT_TASK_STATUSES)[number];

/* the four archivable kinds — employees DEACTIVATE instead (reference BR-13) */
export const VAULT_ARCHIVE_KINDS = [
  "vault_form",
  "vault_sheet",
  "vault_document",
  "vault_task",
] as const;
export type VaultArchiveKind = (typeof VAULT_ARCHIVE_KINDS)[number];
