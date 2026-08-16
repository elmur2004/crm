import type { Msg } from "@/lib/i18n/core";

/* Founder: "an undo button that undoes the last action I did on the system"
   (ADR-045). The control's own strings plus the LABEL TEMPLATES: an undo entry
   stores a finished English AND Arabic sentence at write time, so the header can
   always say exactly what it is about to revert without re-deriving it from
   data that may since have moved. {name} / {stage} are filled by formatMsg. */

export const undoMsgs = {
  undo: { en: "Undo", ar: "تراجع" },
  undone: { en: "Undone", ar: "تم التراجع" },
  working: { en: "Undoing…", ar: "جارٍ التراجع…" },
  failed: { en: "Could not undo that", ar: "تعذّر التراجع عن ذلك" },
} satisfies Record<string, Msg>;

export const undoLabels = {
  movedTo: { en: "Moved {name} to {stage}", ar: "نقل {name} إلى {stage}" },
  flaggedNoAnswer: { en: "Flagged {name} as no answer", ar: "تعليم {name} بأنه لم يرد" },
  clearedNoAnswer: { en: "Cleared no answer on {name}", ar: "إزالة علامة عدم الرد عن {name}" },
  markedReady: { en: "Marked {name} ready to close", ar: "تحديد {name} كجاهز للإغلاق" },
  archived: { en: "Archived {name}", ar: "أرشفة {name}" },
  unarchived: { en: "Unarchived {name}", ar: "إلغاء أرشفة {name}" },
  edited: { en: "Edited {name}", ar: "تعديل {name}" },
  added: { en: "Added {name}", ar: "إضافة {name}" },
  /* founder: same-stage records — nothing MOVED, so "Moved … to …" would lie */
  followedUpAgain: {
    en: "Recorded another follow-up on {name}",
    ar: "تسجيل متابعة أخرى على {name}",
  },
  responseDate: {
    en: "Recorded the response date on {name}",
    ar: "تسجيل موعد الرد على {name}",
  },
  rescheduledMeeting: {
    en: "Rescheduled the meeting on {name}",
    ar: "إعادة جدولة الاجتماع على {name}",
  },
} satisfies Record<string, Msg>;
