import type { Msg } from "@/lib/i18n/core";

/* ADR-051 — the data-entry role's single page: the two Add actions and a
   read-only record of what this person has entered. Founder: "They are just
   adding, and they will not be the owner of what they add." */

export const entryPage = {
  meta: { en: "Data entry — B-Systems CRM", ar: "إدخال البيانات — B-Systems CRM" },
  eyebrow: { en: "B-SYSTEMS · DATA ENTRY", ar: "B-SYSTEMS · إدخال البيانات" },
  title: { en: "Data entry", ar: "إدخال البيانات" },
  intro: {
    en: "Add leads and partner or agent cards. What you add has no owner — the admin decides who takes it.",
    ar: "أضف عملاء محتملين وبطاقات شركاء أو وكلاء. ما تضيفه بلا مالك — المدير هو من يقرر من يتسلّمه.",
  },
  leadsHeading: { en: "Leads you added", ar: "العملاء المحتملون الذين أضفتهم" },
  cardsHeading: { en: "Cards you added", ar: "البطاقات التي أضفتها" },
  leadsEmpty: { en: "No leads yet — add your first one above.", ar: "لا يوجد عملاء محتملون بعد — أضف أولهم بالأعلى." },
  cardsEmpty: { en: "No cards yet — add your first one above.", ar: "لا توجد بطاقات بعد — أضف أولها بالأعلى." },
  /* Name / Company / Number come from dict/crm's `common` — the same labels the
     Leads table and the Correct modal use, so one column cannot drift from the
     field that edits it. Only the role-facing wording lives here. */
  thAdded: { en: "Added", ar: "تاريخ الإضافة" },
  thStatus: { en: "Status", ar: "الحالة" },
  thKind: { en: "Kind", ar: "النوع" },
  /* the two states an entry can be in, from this person's point of view */
  statusWaiting: { en: "Waiting for an owner", ar: "بانتظار مالك" },
  statusTaken: { en: "Picked up", ar: "تم تسلّمه" },
  statusInPipeline: { en: "In the pipeline", ar: "في المسار" },
  correct: { en: "Correct the details", ar: "تصحيح البيانات" },
  correctHint: {
    en: "You can correct an entry until someone picks it up.",
    ar: "يمكنك تصحيح ما أدخلته إلى أن يتسلّمه شخص ما.",
  },
} satisfies Record<string, Msg>;
