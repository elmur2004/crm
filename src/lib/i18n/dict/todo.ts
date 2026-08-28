import type { Msg } from "@/lib/i18n/core";

/* Founder (ADR-041) — the To-Do page: "no fancy stuff, so I don't miss
   anything". ONE page since ADR-067 — /b-systems/todo, for both companies. */

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
  /* Founder 2.2/2.3 (ADR-062) — the completion checkbox and the Done section.
     A task completes manually (the checkbox) or automatically (the CRM moved
     on); completed tasks land under "Done" instead of vanishing. */
  done: { en: "Done", ar: "منجز" },
  /* Review: the Done list is TODAY's, and a manual tick on a still-pending
     money task is only good for the day it was made — so the section says so
     on the page, not only in the ADR. Without it "the statement I ticked is
     back tomorrow" reads as a bug. */
  doneScope: { en: "Completed today", ar: "أُنجزت اليوم" },
  markDoneAria: { en: "Mark done: {title}", ar: "وضع علامة الإنجاز: {title}" },
  restoreAria: { en: "Restore to Today: {title}", ar: "إعادة إلى مهام اليوم: {title}" },
  autoDoneAria: {
    en: "Completed by CRM activity: {title}",
    ar: "اكتملت من حركة النظام: {title}",
  },
  doneBy: { en: "Done · {name}", ar: "أنجزها {name}" },
  doneMoved: { en: "Moved to {stage}", ar: "انتقل إلى {stage}" },
  doneSuperseded: { en: "Superseded by a newer step", ar: "حلّت محلها خطوة أحدث" },
  doneMeetingAttended: { en: "Meeting attended", ar: "تم حضور الاجتماع" },
  doneMeetingCancelled: { en: "Meeting cancelled", ar: "أُلغي الاجتماع" },
  doneMeetingDelayed: { en: "Meeting delayed", ar: "تأجل الاجتماع" },
  donePaid: { en: "Paid", ar: "مدفوع" },
  doneMilestone: { en: "Milestone completed", ar: "اكتملت مرحلة الدفع" },
  checkFailed: { en: "Could not update the task", ar: "تعذر تحديث المهمة" },
} satisfies Record<string, Msg>;
