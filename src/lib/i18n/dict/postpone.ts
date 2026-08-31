import type { Msg } from "@/lib/i18n/core";

/* ADR-072 — the "Postpone / Not answering" column and the popup that opens
   when a lead is moved into it. The founder dictated the three options; they
   are his words, kept whole. */

export const postponeMsgs = {
  question: { en: "Why is this being postponed?", ar: "لماذا يتم تأجيله؟" },
  hint: {
    en: "The lead stays live and can come back out at any time — this is not Lost.",
    ar: "يظل العميل نشطًا ويمكن إعادته في أي وقت — هذا ليس خسارة.",
  },
  /* the free-text box that only "Other" opens */
  otherLabel: { en: "Write the reason", ar: "اكتب السبب" },
  otherPlaceholder: {
    en: "In your own words…",
    ar: "بكلماتك…",
  },
  /* the note the three NAMED reasons may optionally carry */
  noteLabel: { en: "Anything to add? (optional)", ar: "هل تريد إضافة شيء؟ (اختياري)" },
  /* the lead-detail history row and the card chip */
  historyTitle: { en: "Postponed", ar: "مؤجَّل" },
  cardLabel: { en: "Postponed", ar: "مؤجَّل" },
} satisfies Record<string, Msg>;
