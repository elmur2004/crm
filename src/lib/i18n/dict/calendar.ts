import type { Msg } from "@/lib/i18n/core";

/* ADR-071 — the calendar page. One page for both companies, like the To-Do
   since ADR-067; the company rides the URL as `?company=`. */

export const calendarPage = {
  navItem: { en: "Calendar", ar: "التقويم" },
  eyebrow: { en: "CALENDAR", ar: "التقويم" },
  title: { en: "Calendar", ar: "التقويم" },
  subtitle: {
    en: "Every arranged meeting from the CRM, plus what the team has put on their own time.",
    ar: "كل اجتماع مُرتَّب من نظام العملاء، بالإضافة إلى ما سجَّله الفريق في أوقاتهم الخاصة.",
  },

  /* ---- the month strip */
  today: { en: "Today", ar: "اليوم" },
  prevMonth: { en: "Previous month", ar: "الشهر السابق" },
  nextMonth: { en: "Next month", ar: "الشهر التالي" },

  /* ---- the week header, Sunday-first (Egypt's working week is Sun–Thu) */
  sun: { en: "Sun", ar: "أحد" },
  mon: { en: "Mon", ar: "إثنين" },
  tue: { en: "Tue", ar: "ثلاثاء" },
  wed: { en: "Wed", ar: "أربعاء" },
  thu: { en: "Thu", ar: "خميس" },
  fri: { en: "Fri", ar: "جمعة" },
  sat: { en: "Sat", ar: "سبت" },

  /* ---- entries */
  kindMeeting: { en: "Meeting", ar: "اجتماع" },
  kindPersonal: { en: "Personal", ar: "خاص" },
  /* The busy block — the ONE string that carries the whole privacy model to
     the reader. It must say who, and nothing else. */
  busy: { en: "Busy", ar: "مشغول" },
  busyHint: {
    en: "Someone else's time. You can see that it is taken, not what it is.",
    ar: "وقت شخص آخر. يظهر لك أنه محجوز فقط، دون تفاصيله.",
  },
  online: { en: "Online", ar: "عن بُعد" },
  offline: { en: "In person", ar: "حضوري" },
  outcomeAttended: { en: "Attended", ar: "تم الحضور" },
  outcomeCancelled: { en: "Cancelled", ar: "أُلغي" },
  outcomeDelayed: { en: "Delayed", ar: "مؤجَّل" },
  allDay: { en: "All day", ar: "طوال اليوم" },
  openLead: { en: "Open the lead", ar: "فتح العميل المحتمل" },

  /* ---- the day panel */
  nothingOn: { en: "Nothing on this day.", ar: "لا يوجد شيء في هذا اليوم." },
  moreCount: { en: "+{n} more", ar: "+{n} أخرى" },

  /* ---- the people filter */
  everyone: { en: "Everyone", ar: "الجميع" },
  filterPerson: { en: "Show one person", ar: "عرض شخص واحد" },
  onlyMine: { en: "Only mine", ar: "الخاص بي فقط" },

  /* ---- the add / edit form */
  addEntry: { en: "Add to my calendar", ar: "أضف إلى تقويمي" },
  editEntry: { en: "Edit entry", ar: "تعديل الإدخال" },
  formEyebrow: { en: "MY CALENDAR", ar: "تقويمي" },
  fieldTitle: { en: "What is it?", ar: "ما هو؟" },
  fieldTitlePlaceholder: {
    en: "Supplier meeting, travel, appointment…",
    ar: "اجتماع مورّد، سفر، موعد…",
  },
  fieldDate: { en: "Date", ar: "التاريخ" },
  fieldTime: { en: "Time", ar: "الوقت" },
  fieldEndDate: { en: "Ends (date)", ar: "ينتهي (التاريخ)" },
  fieldEndTime: { en: "Ends (time)", ar: "ينتهي (الوقت)" },
  fieldAllDay: { en: "All day", ar: "طوال اليوم" },
  fieldNote: { en: "Note (only you see this)", ar: "ملاحظة (تراها أنت فقط)" },
  fieldShared: { en: "Let the team see what this is", ar: "اسمح للفريق برؤية تفاصيله" },
  sharedHint: {
    en: "Off by default. Left off, colleagues see only that you are busy.",
    ar: "مُعطَّل افتراضيًا. إذا تُرك مُعطَّلًا، يرى الزملاء أنك مشغول فقط.",
  },
  save: { en: "Save", ar: "حفظ" },
  saving: { en: "Saving…", ar: "جارٍ الحفظ…" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  remove: { en: "Delete", ar: "حذف" },
  removeConfirm: {
    en: "Delete this entry? Your time stops showing as busy.",
    ar: "حذف هذا الإدخال؟ لن يظهر وقتك محجوزًا بعد الآن.",
  },
  saveFailed: { en: "That did not save. Try again.", ar: "لم يتم الحفظ. حاول مرة أخرى." },

  /* ---- the "Also blocks" picker on the meeting */
  alsoBlocks: { en: "Also blocks", ar: "يحجز وقت أيضًا" },
  alsoBlocksHint: {
    en: "Whoever has to be in this meeting. Their calendar shows the time as taken.",
    ar: "من يجب حضوره هذا الاجتماع. سيظهر الوقت محجوزًا في تقويمه.",
  },
  alsoBlocksNobody: { en: "Nobody else", ar: "لا أحد غيره" },
} satisfies Record<string, Msg>;
