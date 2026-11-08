import type { Msg } from "@/lib/i18n/core";

/* ============================================================================
   Assigned leads only (founder, 2026-11-08) — the words of the three new
   controls: the follow-up hand-over ("Hand this follow-up to"), ByteForce's
   lead OWNER (accounts, not rep cards), and the owner cards on ByteForce's
   Leads page. Every string in both languages, as everywhere in this product.
   ========================================================================== */

/** The follow-up form's optional hand-over select — the company admin's only. */
export const handOver = {
  label: { en: "Hand this follow-up to", ar: "سلّم هذه المتابعة إلى" },
  keep: { en: "Keep the current owner", ar: "إبقاء المالك الحالي" },
  hint: {
    en: "The lead moves to them: it becomes theirs, sits in their Following Up column and To-Do, and they are notified.",
    ar: "ينتقل العميل المحتمل إليه: يصبح مسؤوليته، ويظهر في عمود «متابعة» وفي «مهام اليوم» لديه، ويصله إشعار.",
  },
  /* the admin's own row in the list */
  me: { en: "{name} (me)", ar: "{name} (أنا)" },
} satisfies Record<string, Msg>;

/** The History pill of the one-time ownership backfill (the migration's
    `backfill_owner` ActivityLog rows, actor "System"). */
export const ownerHistory = {
  backfill: {
    en: "Owner set when leads became assigned-only",
    ar: "عُيّن المالك عند قصر العملاء على المُسندين",
  },
} satisfies Record<string, Msg>;

/** ByteForce's lead OWNER — a staff account, where it used to be a rep card. */
export const bfOwner = {
  ownerColon: { en: "Owner:", ar: "المالك:" },
  ownerOptional: { en: "Owner (optional)", ar: "المالك (اختياري)" },
  choose: { en: "Choose a ByteForce teammate…", ar: "اختر زميلًا من ByteForce…" },
  noOwners: {
    en: "No active ByteForce staff account yet — create one in the Users app.",
    ar: "لا يوجد حساب فريق ByteForce نشط بعد — أنشئه من تطبيق المستخدمين.",
  },
  note: {
    en: "The lead moves to their board and counts as theirs.",
    ar: "ينتقل العميل المحتمل إلى لوحته ويُحتسب له.",
  },
} satisfies Record<string, Msg>;

/** ByteForce's Leads page — owner cards for the admin, own list for everyone else. */
export const bfLeadsPage = {
  /* the admin's grid: one card per staff account, plus Unassigned */
  noOwnersYet: {
    en: "No ByteForce staff accounts yet. Create them in the Users app — every unassigned lead is under Unassigned.",
    ar: "لا توجد حسابات لفريق ByteForce بعد. أنشئها من تطبيق المستخدمين — كل العملاء غير المُعيَّنين تحت «غير مُعيَّن».",
  },
  /* the Unassigned card's monogram — a letter of the reader's own alphabet */
  unassignedMark: { en: "U", ar: "غ" },
  /* a teammate's own list */
  myLeads: { en: "My leads", ar: "عملائي المحتملون" },
  myLeadsNote: {
    en: "The leads assigned to you. The admin hands out the rest.",
    ar: "العملاء المحتملون المُسندون إليك. المدير يوزّع الباقي.",
  },
} satisfies Record<string, Msg>;
