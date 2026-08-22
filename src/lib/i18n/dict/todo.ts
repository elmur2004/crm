import type { Msg } from "@/lib/i18n/core";

/* Founder (ADR-041) — the To-Do page: "no fancy stuff, so I don't miss
   anything". Shared by both apps (/b-systems/todo and /byteforce/todo). */

export const todoPage = {
  navItem: { en: "To-Do", ar: "مهام اليوم" },
  eyebrow: { en: "TO-DO", ar: "المهام" },
  title: { en: "To-Do", ar: "مهام اليوم" },
  /* UNREFERENCED since ADR-061 (founder: the Overdue section is gone) — kept
     per house convention: existing keys are never deleted, EN stays
     byte-identical. */
  overdue: { en: "Overdue", ar: "متأخر" },
  today: { en: "Today", ar: "اليوم" },
  empty: { en: "Nothing due today.", ar: "لا توجد مهام مستحقة اليوم." },
  kindFollowUp: { en: "Follow-up", ar: "متابعة" },
  kindMeeting: { en: "Meeting", ar: "اجتماع" },
  /* UNREFERENCED since ADR-061 (founder: partner tasks left the To-Do) — kept
     per the same convention. (They labeled partner AND agent cards alike.) */
  kindProspectFollowUp: { en: "Partner or agent follow-up", ar: "متابعة شريك أو وكيل" },
  kindProspectMeeting: { en: "Partner or agent meeting", ar: "اجتماع شريك أو وكيل" },
  kindStatement: { en: "Statement expected", ar: "كشف حساب متوقع" },
  kindMilestone: { en: "Milestone due", ar: "مرحلة دفع مستحقة" },
  /* Founder — "I can assign these to do as an admin or just take it myself":
     the one-click self-assign on a lead row (admin only). The Assign modal
     reuses the crm dict's assignLead.* keys; the owner label reuses
     ownerFilters.unassigned. */
  takeIt: { en: "Take it", ar: "أتولاه بنفسي" },
} satisfies Record<string, Msg>;
