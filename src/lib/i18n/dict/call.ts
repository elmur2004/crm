import type { Msg } from "@/lib/i18n/core";

/* Founder — the call sheet: "when using the system from the phone there should
   be a button to call the lead instantly so it dials the lead. And whenever you
   dial, it opens the page where all the information of the lead is displayed —
   his name, his industry, the last update, the last comment, all of his story
   … so I can talk with him on the phone and see everything." Phone-first, used
   one-handed, mid-call — every string here is read at 390px. */

export const callSheet = {
  navLabel: { en: "Call", ar: "اتصال" },
  meta: { en: "Call sheet", ar: "بطاقة الاتصال" },
  eyebrow: { en: "CALL SHEET", ar: "بطاقة الاتصال" },
  backToLead: { en: "Back to the lead", ar: "العودة إلى العميل المحتمل" },
  callNow: { en: "Call now", ar: "اتصل الآن" },
  /* "Call now — 01001234567" (the accessible name of the dial button) */
  callNowAria: { en: "Call now — {number}", ar: "اتصل الآن — {number}" },
  noNumber: { en: "No number on this lead", ar: "لا يوجد رقم لهذا العميل المحتمل" },
  otherContacts: { en: "Other contacts", ar: "وسائل اتصال أخرى" },
  sendEmail: { en: "Send an email", ar: "إرسال بريد إلكتروني" },
  details: { en: "Details", ar: "التفاصيل" },
  latestUpdate: { en: "Latest update", ar: "آخر تحديث" },
  /* The field labels, the stage-records/history headings and the negotiation
     notes are NOT restated here: the call sheet shows the same facts as the
     lead detail, so it reads them from dict/crm's leadDetail — one Arabic
     wording, no drift. Only the strings this page invents live in this module. */
} satisfies Record<string, Msg>;
