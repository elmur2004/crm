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
  /* founder: "a WhatsApp (message on WhatsApp) button on every lead next to
     the call button." The brand name stays "WhatsApp" in both languages. */
  whatsapp: { en: "WhatsApp", ar: "WhatsApp" },
  /* "Message on WhatsApp — 01001234567" (accessible name; opens a new tab) */
  whatsappAria: { en: "Message on WhatsApp — {number}", ar: "مراسلة عبر WhatsApp — {number}" },
  /* ADR-069 (founder: "it should turn to be green to signal that I already sent
     WhatsApp … it signals not just for my user, for any user that we have
     contacted this lead through WhatsApp") — the words that go WITH the green,
     so the state is never carried by colour alone. They become the chip's
     accessible name and its title once the record is marked.
     "{when}" arrives already formatted by the ONE clock (lib/datetime), so this
     sentence never renders a date of its own. */
  whatsappSentBy: {
    en: "WhatsApp sent by {who} on {when}",
    ar: "أرسل {who} رسالة WhatsApp في {when}",
  },
  /* the same sentence with nobody to name — a restored row whose sender label
     never made it, which the UI must survive rather than print "undefined" */
  whatsappSentOn: {
    en: "WhatsApp sent on {when}",
    ar: "تم إرسال رسالة WhatsApp في {when}",
  },
  /* what the chip says the instant it is pressed, before any page has reloaded:
     the mark is fire-and-forget, so who/when only arrive on the next server
     render — saying so plainly beats guessing at a date */
  whatsappSentJustNow: { en: "WhatsApp sent", ar: "تم إرسال رسالة WhatsApp" },
  otherContacts: { en: "Other contacts", ar: "وسائل اتصال أخرى" },
  sendEmail: { en: "Send an email", ar: "إرسال بريد إلكتروني" },
  details: { en: "Details", ar: "التفاصيل" },
  latestUpdate: { en: "Latest update", ar: "آخر تحديث" },
  /* The field labels, the stage-records/history headings and the negotiation
     notes are NOT restated here: the call sheet shows the same facts as the
     lead detail, so it reads them from dict/crm's leadDetail — one Arabic
     wording, no drift. Only the strings this page invents live in this module. */
} satisfies Record<string, Msg>;
