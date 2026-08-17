import type { Msg } from "@/lib/i18n/core";

/* Founder (ADR-041) — the To-Do page: "no fancy stuff, so I don't miss
   anything". Shared by both apps (/b-systems/todo and /byteforce/todo). */

export const todoPage = {
  navItem: { en: "To-Do", ar: "مهام اليوم" },
  eyebrow: { en: "TO-DO", ar: "المهام" },
  title: { en: "To-Do", ar: "مهام اليوم" },
  overdue: { en: "Overdue", ar: "متأخر" },
  today: { en: "Today", ar: "اليوم" },
  empty: { en: "Nothing due today.", ar: "لا توجد مهام مستحقة اليوم." },
  kindFollowUp: { en: "Follow-up", ar: "متابعة" },
  kindMeeting: { en: "Meeting", ar: "اجتماع" },
  /* the board carries partner AND agent cards — the row must fit both */
  kindProspectFollowUp: { en: "Partner or agent follow-up", ar: "متابعة شريك أو وكيل" },
  kindProspectMeeting: { en: "Partner or agent meeting", ar: "اجتماع شريك أو وكيل" },
  kindStatement: { en: "Statement expected", ar: "كشف حساب متوقع" },
  kindMilestone: { en: "Milestone due", ar: "مرحلة دفع مستحقة" },
} satisfies Record<string, Msg>;
