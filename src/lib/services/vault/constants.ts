import type { Msg } from "@/lib/i18n/core";

/* Data Vault constants (ADR-053). The reference Vault app is the spec: these
   unions mirror its 9 Postgres enums, lowercased into the house's String
   pseudo-enums (Zod + these unions are the real constraint, the columns are
   plain String — src/lib/pipeline-engine/constants.ts pattern). */

/* ADR-074 — MINDOO joins the vault, for the reason it joined the books: the
   Data Vault is a MODULE with a company filter, not one registry per company.
   WHICH of these an account may see is `moduleCompaniesFor`
   (lib/module-companies.ts), never this constant. */
export const VAULT_COMPANIES = ["byteforce", "bsystems", "mindoo"] as const;
export type VaultCompany = (typeof VAULT_COMPANIES)[number];

/* brand names stay untranslated — the dict/accounting precedent */
export const VAULT_COMPANY_LABELS: Record<VaultCompany, Msg> = {
  byteforce: { en: "ByteForce", ar: "ByteForce" },
  bsystems: { en: "B-Systems", ar: "B-Systems" },
  mindoo: { en: "Mindoo", ar: "Mindoo" },
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

/* links (ADR-070) — the founder's own two lists, and they are NOT the same kind
   of list, which is the whole point of this section:

   TYPE is CLOSED at his eight ("what is behind the link"). It is a plain String
   column held by Zod, the VAULT_SHEET_TYPES / VAULT_DOCUMENT_TYPES pattern, and
   it carries EN + AR labels because it is OUR vocabulary, not his words.

   CATEGORY is FREE TEXT. He asked in the same breath for suggestions AND for
   the ability to type a new one, so these eight are DEFAULTS offered in a
   datalist — never a validated set. A stored category is his own words and is
   therefore rendered VERBATIM in both languages (a Msg would imply we could
   translate whatever he types, and we cannot). The Arabic here is only what the
   SUGGESTION reads as while he is choosing; picking it stores that Arabic
   string, exactly as typing it would. */
export const VAULT_LINK_TYPES = [
  "video",
  "image",
  "document",
  "sheet",
  "form",
  "folder",
  "website",
  "other",
] as const;
export type VaultLinkType = (typeof VAULT_LINK_TYPES)[number];

export const VAULT_LINK_TYPE_LABELS: Record<VaultLinkType, Msg> = {
  video: { en: "Video", ar: "فيديو" },
  image: { en: "Image", ar: "صورة" },
  document: { en: "Document", ar: "مستند" },
  sheet: { en: "Sheet", ar: "جدول" },
  form: { en: "Form", ar: "نموذج" },
  folder: { en: "Folder", ar: "مجلد" },
  website: { en: "Website", ar: "موقع إلكتروني" },
  other: { en: "Other", ar: "أخرى" },
};

/** Suggestions only — the column takes anything he types (ADR-070). */
export const VAULT_LINK_CATEGORY_SUGGESTIONS: Msg[] = [
  { en: "Portfolio", ar: "بورتفوليو" },
  { en: "Content Calendar", ar: "خطة المحتوى" },
  { en: "Reference", ar: "مرجع" },
  { en: "Social Media", ar: "سوشيال ميديا" },
  { en: "Marketing", ar: "تسويق" },
  { en: "Project", ar: "مشروع" },
  { en: "Assets", ar: "أصول" },
  { en: "Other", ar: "أخرى" },
];

/* tasks */
export const VAULT_TASK_STATUSES = ["open", "completed"] as const;
export type VaultTaskStatus = (typeof VAULT_TASK_STATUSES)[number];

/* the five archivable kinds — employees DEACTIVATE instead (reference BR-13).
   ADR-070 added vault_link: the founder wrote "Delete", and in this module
   Delete has meant Archive since ADR-053, so a link removes exactly the way a
   form does — out of every list and count, restorable from the Archive tab. */
export const VAULT_ARCHIVE_KINDS = [
  "vault_form",
  "vault_link",
  "vault_sheet",
  "vault_document",
  "vault_task",
] as const;
export type VaultArchiveKind = (typeof VAULT_ARCHIVE_KINDS)[number];
