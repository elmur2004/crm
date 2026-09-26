import { formatMsg, type Locale, type Msg } from "@/lib/i18n/core";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { todoPage } from "@/lib/i18n/dict/todo";
import { history } from "@/lib/i18n/dict/internal";

/* ============================================================================
   ADR-081 — THE DAILY REPORT's own words.

   Founder: "it should have a display on the number: how many leads did you
   interact with this day, and what interactions were those."

   TWO HALVES. The page chrome, and the PHRASE for one interaction.

   THE PHRASES ARE VERB-ONLY, and their English is DERIVED from keys the product
   already says — each one names the key it came from in a comment, so the report
   reads in the same voice as the screen it describes. They are not copies of
   `undoLabels`, which embed `{name}` ("Archived {name}"): the report row already
   names the lead above the line, so an embedded name would print it twice.

   NOT ONE EXISTING ENGLISH STRING IS EDITED. `todoPage.doneMoved` and
   `stageLabel` are IMPORTED rather than restated, which is also what keeps a
   stage rename in one place.

   THE RESOLVER CANNOT CRASH AND CANNOT DROP A ROW. `tFor` has no fallback by
   design, and this map is keyed on `trigger`, which the compiler cannot check —
   a §10 row added next month, or a trigger a service invents, would otherwise
   reach `t(undefined)` and take the whole screen down (the ADR-075 failure this
   product has already lived). So the last resort is a GENERIC phrase, never an
   omission: a dropped line would silently change the number he asked for twice,
   and a blank screen is worse than a vague verb. `daily-report-phrases.test.ts`
   fails the build on any trigger the product can stamp that lands on the
   generic.
   ========================================================================== */

export const dailyReport = {
  /* the nav label and the page title are the SAME Msg, so the Arabic on the tab
     and the Arabic on the heading cannot drift (the ADR-051 brand-audit finding) */
  navItem: { en: "Daily report", ar: "التقرير اليومي" },
  eyebrow: { en: "DAILY REPORT", ar: "التقرير اليومي" },
  title: { en: "Daily report", ar: "التقرير اليومي" },
  subtitle: {
    en: "What you did on your leads — today and the two days before it.",
    ar: "ما قمت به على عملائك المحتملين — اليوم واليومين السابقين.",
  },
  /* His own words, on the page rather than only in the ADR: "not the admin, not
     anyone — the user himself." An admin reads HIS OWN day here. */
  ownOnly: {
    en: "This report shows your own actions only.",
    ar: "يعرض هذا التقرير أفعالك أنت فقط.",
  },
  /* ADR-067 §8's failure mode, pre-empted: this is the one screen whose CONTENT
     does not change when you press the company switch, so it says so. Without
     the sentence the switch reads as broken. */
  bothCompanies: {
    en: "It covers both companies, so it reads the same whichever one you are switched to.",
    ar: "يشمل الشركتين، لذا يظهر بالمحتوى نفسه أيًّا كانت الشركة المحدَّدة.",
  },
  today: { en: "Today", ar: "اليوم" },
  yesterday: { en: "Yesterday", ar: "أمس" },
  /* THE NUMBER he asked for twice. Deliberately a colon form rather than a
     pluralised noun: Arabic needs four plural forms for a count and a colon form
     needs none, so "Leads touched / 3" is one string in both languages. */
  leadsTouched: { en: "Leads touched", ar: "عملاء تعاملت معهم" },
  leadsCount: { en: "Leads: {n}", ar: "عملاء: {n}" },
  interactionsCount: { en: "Interactions: {n}", ar: "التفاعلات: {n}" },
  /* the calm zero — a blank gap would read as broken */
  emptyDay: {
    en: "No leads touched on this day.",
    ar: "لم تتعامل مع أي عميل محتمل في هذا اليوم.",
  },
  emptyAll: {
    en: "Nothing to report yet. Move a lead, flag a didn't-answer, or leave a comment, and it appears here on the same day.",
    ar: "لا يوجد ما يُعرَض بعد. انقل عميلًا محتملًا، أو سجّل عدم الرد، أو اكتب تعليقًا، وسيظهر هنا في اليوم نفسه.",
  },
  /* a row that still COUNTS but carries no name and no link */
  deletedLead: { en: "Deleted lead", ar: "عميل محتمل محذوف" },
  outOfScopeLead: { en: "No longer one of your leads", ar: "لم يعد من عملائك المحتملين" },

  /* ---------------------------------------------------- the interaction verbs */

  /* derived from history.actions.auto_transfer ("auto-moved") + todoPage.doneMoved,
     so a move the ENGINE made is never claimed as a click he made — and, the other
     way round, an `auto_transfer` row whose DESTINATION he chose in the meeting
     outcome form is not claimed as the engine's (USER_CHOSEN_DESTINATION below) */
  movedAutomatically: { en: "Moved automatically to {stage}", ar: "انتقل تلقائيًا إلى {stage}" },
  /* undoLabels.added — "Added {name}" */
  addedTheLead: { en: "Added the lead", ar: "أضاف العميل المحتمل" },
  /* PP-5 — the same create, arriving with a partner's attribution (§5.5) */
  addedFromPartner: {
    en: "Added the lead from a partner referral",
    ar: "أضاف العميل المحتمل من ترشيح شريك",
  },
  /* common.markNoAnswer — "Didn't answer" (his own example) */
  flaggedNoAnswer: { en: "Flagged didn't answer", ar: "سجّل عدم الرد" },
  /* common.clearNoAnswer — "Answered — clear flag" */
  clearedNoAnswer: { en: "Cleared the didn't-answer flag", ar: "أزال علامة عدم الرد" },
  /* common.markReadyToClose — "Mark ready to close" */
  markedReadyToClose: { en: "Marked ready to close", ar: "حدّده كجاهز للإغلاق" },
  /* archiveMsgs.archive / .unarchive */
  archivedLead: { en: "Archived the lead", ar: "أرشف العميل المحتمل" },
  unarchivedLead: { en: "Unarchived the lead", ar: "ألغى أرشفة العميل المحتمل" },
  /* undoLabels.assigned — "Assigned {name} to {owner}" */
  assignedOwner: { en: "Assigned an owner", ar: "أسند مالكًا" },
  /* undoLabels.edited — "Edited {name}" */
  editedDetails: { en: "Edited the details", ar: "عدّل البيانات" },
  deletedTheLead: { en: "Deleted the lead", ar: "حذف العميل المحتمل" },
  /* history.actions.comment — "comment" (his own example) */
  commented: { en: "Commented", ar: "كتب تعليقًا" },
  /* callSheet.whatsappSentJustNow — "WhatsApp sent". ADR-069: the mark is logged
     whenever WhatsApp is OPENED, even when a colleague pressed first and the
     record therefore did not change — which is right here, because he did open
     it. Worth stating so nobody later "fixes" interactions out of the report. */
  sentWhatsapp: { en: "Sent WhatsApp", ar: "أرسل واتساب" },
  /* ADR-078 — a proposal corrected in place */
  correctedProposal: { en: "Corrected the proposal", ar: "صحّح العرض" },
  /* Deleting one account writes one of these PER LEAD it owned, all attributed
     to the deleting admin. Forty leads is forty rows on his day: technically
     true, and it must not be dropped — so it gets a phrase that makes the number
     legible instead of alarming. */
  ownerAccountDeleted: {
    en: "Returned to the admin bucket when an account was deleted",
    ar: "أُعيد إلى مجموعة المديرين عند حذف حساب",
  },
  /* undoMsgs.undo — "Undo" */
  undidLastAction: { en: "Undid the last action", ar: "تراجع عن آخر إجراء" },
  /* sameStageActionMsgs — the three records the card does not move for */
  loggedAnotherFollowUp: { en: "Logged another follow-up", ar: "سجّل متابعة أخرى" },
  setTheResponseDate: { en: "Set the response date", ar: "حدّد موعد الرد" },
  rescheduledTheMeeting: { en: "Rescheduled the meeting", ar: "أعاد جدولة الاجتماع" },
  /* UNREFERENCED, deliberately, and kept per the house convention (todoPage.overdue
     is the precedent): a CANCELLED meeting really does move the lead, so it is
     phrased from its destination stage like any other move. This is the wording to
     reach for if the founder ever asks for the outcome to be named as well. */
  recordedMeetingOutcome: { en: "Recorded the meeting's outcome", ar: "سجّل نتيجة الاجتماع" },
  /* THE LAST RESORT. Never an omission: a row the report cannot phrase is still a
     lead he touched, and the count has to include it. */
  workedOnThisLead: { en: "Worked on this lead", ar: "عمل على هذا العميل المحتمل" },
} satisfies Record<string, Msg>;

/** The two actions that carry stages. Everything else is phrased by its trigger. */
const MOVE_ACTIONS = new Set(["stage_change", "auto_transfer"]);

/* AN `auto_transfer` ROW WHOSE DESTINATION HE CHOSE HIMSELF.

   The engine stamps `auto: true` on an ATTENDED meeting outcome (transition.ts's
   `meeting_outcome` / attended branch: T-6 internally, B-7 or B-9 under
   B-Systems) because the card moves without a next-action click — but the
   destination stage comes out of the outcome FORM, which he filled in. Phrasing
   those "Moved automatically to …" would claim the engine did the very work he
   did, the exact inversion of the sentence above, and for T-6 there is no other
   shape that can reach this line (`triggerForAction` never returns T-6), so the
   honest wording would be unreachable.

   The genuinely engine-initiated moves keep the automatic wording, and they are
   the ones nobody pressed a destination for: the proposal-sent return (T-5 /
   B-6) and the partner funnel's new-number return (PP-2). Review, Run 097. */
const USER_CHOSEN_DESTINATION = new Set(["T-6", "B-7", "B-9"]);

/* A record written IN PLACE — the card did not move, so "Moved to …" would be a
   lie. Two shapes reach here: `group_added` (the founder's three same-stage
   buttons) and a meeting outcome whose destination is the stage it is already in
   (T-7's delayed meeting, which requires a new date and time). */
const IN_PLACE_BY_TRIGGER: Record<string, Msg> = {
  "FU-AGAIN": dailyReport.loggedAnotherFollowUp,
  "NEG-DUE": dailyReport.setTheResponseDate,
  "MTG-RESCHEDULE": dailyReport.rescheduledTheMeeting,
  "T-7": dailyReport.rescheduledTheMeeting, // internal: delayed meeting
  "B-7": dailyReport.rescheduledTheMeeting, // B-Systems: delayed meeting
};

/* THE FLAT TRIGGERS — every lead-touching row that is not a move. The §10 row
   ids are deliberately ABSENT: a move is phrased from its STAGES, which is what
   makes a new transition row read correctly the day it is added instead of
   needing an entry here. */
const BY_TRIGGER: Record<string, Msg> = {
  create: dailyReport.addedTheLead,
  "PP-5": dailyReport.addedFromPartner,
  "B-RTC": dailyReport.markedReadyToClose,
  no_answer: dailyReport.flaggedNoAnswer,
  no_answer_cleared: dailyReport.clearedNoAnswer,
  archived: dailyReport.archivedLead,
  unarchived: dailyReport.unarchivedLead,
  assigned: dailyReport.assignedOwner,
  edit: dailyReport.editedDetails,
  deleted: dailyReport.deletedTheLead,
  lead_chat: dailyReport.commented,
  whatsapp_sent: dailyReport.sentWhatsapp,
  proposal_edited: dailyReport.correctedProposal,
  owner_deleted: dailyReport.ownerAccountDeleted,
  undo: dailyReport.undidLastAction,
};

export interface InteractionRow {
  action: string;
  trigger: string;
  fromStage: string | null;
  toStage: string | null;
}

/** One interaction, in the reader's language. Total: every input yields a
    non-empty string, and no input throws. */
export function interactionPhrase(locale: Locale, row: InteractionRow): string {
  /* 1 — a record written in place (the card stayed where it was) */
  if (row.action === "group_added" || (MOVE_ACTIONS.has(row.action) && sameStage(row))) {
    const m = IN_PLACE_BY_TRIGGER[row.trigger];
    if (m) return m[locale];
    /* a same-stage shape this build has never seen: say the honest general thing
       rather than claim a move that did not happen */
    return dailyReport.workedOnThisLead[locale];
  }

  /* 2 — the flat triggers */
  const flat = BY_TRIGGER[row.trigger];
  if (flat) return flat[locale];

  /* 3 — a MOVE, phrased from its stages. One stage, no "→" arrow: a mirrored
     arrow is the thing HistoryPanel needs `rtl:-scale-x-100` for, and the
     destination is what a day's summary is actually about. */
  if (MOVE_ACTIONS.has(row.action) && row.toStage) {
    const template =
      row.action === "auto_transfer" && !USER_CHOSEN_DESTINATION.has(row.trigger)
        ? dailyReport.movedAutomatically
        : todoPage.doneMoved;
    return formatMsg(template, { stage: stageLabel(locale, row.toStage) })[locale];
  }

  /* 4 — the LOG_ACTIONS vocabulary, which is already bilingual */
  const byAction = history.actions[row.action];
  if (byAction) return byAction[locale];

  /* 5 — never nothing. The row still counts. */
  return dailyReport.workedOnThisLead[locale];
}

function sameStage(row: InteractionRow): boolean {
  return Boolean(row.fromStage) && row.fromStage === row.toStage;
}

/** Is this phrase the generic last resort? Exported for the completeness test,
    which fails the build if any trigger the product can stamp reaches it. */
export function isGenericPhrase(locale: Locale, phrase: string): boolean {
  return phrase === dailyReport.workedOnThisLead[locale];
}
