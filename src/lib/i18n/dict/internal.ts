import type { Msg } from "@/lib/i18n/core";

/* Dict for the internal CRM surface (the ByteForce nav + the shared internal
   bodies). ADR-067 retired the ByteForce app CHROME into the merged B-Systems
   shell; these nav labels did NOT retire with it — they are what ByteForce
   staff read in the merged nav under company=byteforce, in both languages.
   EN strings are BYTE-IDENTICAL to the previous literals — the e2e suite asserts
   on them. Stage / lead-type labels come from "@/lib/i18n/dict/labels". */

/* ---- shared bits used across several internal components ---- */
export const common = {
  unassigned: { en: "Unassigned", ar: "غير مُعيَّن" },
  partnerPrefix: { en: "Partner:", ar: "الشريك:" },
  noValueSet: { en: "No value set", ar: "لا توجد قيمة محددة" },
  somethingWentWrong: { en: "Something went wrong", ar: "حدث خطأ ما" },
  save: { en: "Save", ar: "حفظ" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  call: { en: "Call", ar: "اتصال" },
  message: { en: "Message", ar: "رسالة" },
  visit: { en: "Visit", ar: "زيارة" },
  online: { en: "Online", ar: "عبر الإنترنت" },
  offline: { en: "Offline", ar: "حضوري" },
  technicalOwner: { en: "Technical owner", ar: "المسؤول الفني" },
  technicalOwnerColon: { en: "Technical owner:", ar: "المسؤول الفني:" },
  service: { en: "Service", ar: "الخدمة" },
} satisfies Record<string, Msg>;

/* ---- the ByteForce nav (lib/crm/nav.ts) ---- */
export const nav = {
  home: { en: "Home", ar: "الرئيسية" },
  leads: { en: "Leads", ar: "العملاء المحتملون" },
  crm: { en: "CRM", ar: "المبيعات" },
  clients: { en: "Clients", ar: "العملاء" },
  /* ADR-067 — `staff` and `byteforceDashboard` lost their call sites with the
     ByteForce header (the role line now reuses the Registrations badge, and
     the mark is the B-Systems one). Kept, not deleted: an EN string in this
     repo is asserted on, and a retired key costs nothing. */
  staff: { en: "Staff", ar: "موظف" },
  logOut: { en: "Log out", ar: "تسجيل الخروج" },
  byteforceDashboard: { en: "ByteForce dashboard", ar: "لوحة ByteForce الرئيسية" },
} satisfies Record<string, Msg>;

/* ---- home dashboard (§6.5) ---- */
export const dash = {
  eyebrowHome: { en: "HOME", ar: "الرئيسية" },
  totalLeads: { en: "Total leads", ar: "إجمالي العملاء المحتملين" },
  pipelineValue: { en: "Pipeline value", ar: "قيمة خط المبيعات" },
  activeStagesOnly: { en: "Active stages only", ar: "المراحل النشطة فقط" },
  wonValue: { en: "Won value", ar: "قيمة الصفقات المكسوبة" },
  toBeCollected: { en: "To be collected", ar: "المطلوب تحصيله" },
  acrossAllClients: { en: "Across all clients", ar: "عبر جميع العملاء" },
  leadsPerStage: { en: "Leads per stage", ar: "العملاء المحتملون حسب المرحلة" },
  newNotActioned: { en: "New / not actioned", ar: "جديد / بدون إجراء" },
} satisfies Record<string, Msg>;

/* ---- leads pages (§6.1) ---- */
export const leadsPage = {
  eyebrowLeads: { en: "LEADS", ar: "العملاء المحتملون" },
  leadOne: { en: "lead", ar: "عميل محتمل" },
  leadMany: { en: "leads", ar: "عملاء محتملين" },
  unassignedPartnerLeads: { en: "Unassigned (Partner leads)", ar: "غير مُعيَّن (عملاء الشركاء)" },
  noRepsYet: {
    en: "No sales reps yet — add the first one to start taking leads.",
    ar: "لا يوجد مندوبو مبيعات بعد — أضف أول مندوب لبدء استقبال العملاء المحتملين.",
  },
  backToAllReps: { en: "Back to all reps", ar: "العودة إلى جميع المندوبين" },
  noLeadsYet: { en: "No leads yet.", ar: "لا يوجد عملاء محتملون بعد." },
  thName: { en: "Name", ar: "الاسم" },
  thNumber: { en: "Number", ar: "الرقم" },
  thType: { en: "Type", ar: "النوع" },
  thStage: { en: "Stage", ar: "المرحلة" },
} satisfies Record<string, Msg>;

/* ---- lead detail (§6.1/§6.2) ---- */
export const leadDetail = {
  backToBoard: { en: "Back to the CRM board", ar: "العودة إلى لوحة المبيعات" },
  numberColon: { en: "Number:", ar: "الرقم:" },
  emailColon: { en: "Email:", ar: "البريد الإلكتروني:" },
  typeColon: { en: "Type:", ar: "النوع:" },
  assignedRepColon: { en: "Assigned rep:", ar: "المندوب المسؤول:" },
  dateCreatedColon: { en: "Date created:", ar: "تاريخ الإنشاء:" },
  nextAction: { en: "Next action", ar: "الإجراء التالي" },
  stageRecords: { en: "Stage records", ar: "سجلات المراحل" },
  history: { en: "History", ar: "السجل" },
} satisfies Record<string, Msg>;

/* ---- CRM board (§6.3) ---- */
export const board = {
  eyebrowCrm: { en: "CRM", ar: "المبيعات" },
  nextPrefix: { en: "Next:", ar: "التالي:" },
  noFollowUpSet: { en: "No follow-up set", ar: "لا توجد متابعة محددة" },
  meetingPrefix: { en: "Meeting:", ar: "الاجتماع:" },
  meetingNotArranged: { en: "Meeting not arranged", ar: "لم يُرتَّب الاجتماع" },
  estPrefix: { en: "Est:", ar: "تقديري:" },
  /* founder (filters round 3): search + type filtering on the board too */
  noMatches: {
    en: "No cards match these filters.",
    ar: "لا توجد بطاقات مطابقة لهذه التصفية.",
  },
} satisfies Record<string, Msg>;

/* ---- clients (§6.4) ---- */
export const clientsPage = {
  eyebrowClients: { en: "CLIENTS", ar: "العملاء" },
  noClientsYet: {
    en: "No clients yet — they appear automatically when a lead is Won.",
    ar: "لا يوجد عملاء بعد — يظهرون تلقائيًا عند كسب عميل محتمل.",
  },
  retainer: { en: "Retainer", ar: "عقد دوري" },
  serviceColon: { en: "Service:", ar: "الخدمة:" },
  estimatedColon: { en: "Estimated:", ar: "التقديري:" },
  collectedColon: { en: "Collected:", ar: "المُحصَّل:" },
  toBeCollectedColon: { en: "To be collected:", ar: "المطلوب تحصيله:" },
  due: { en: "due", ar: "يُستحق" },
} satisfies Record<string, Msg>;

/* ---- add/edit forms (forms.tsx) ---- */
export const formsDict = {
  addSalesRep: { en: "Add sales rep", ar: "إضافة مندوب مبيعات" },
  repName: { en: "Rep name", ar: "اسم المندوب" },
  add: { en: "Add", ar: "إضافة" },
  addLead: { en: "Add lead", ar: "إضافة عميل محتمل" },
  newLead: { en: "New lead", ar: "عميل محتمل جديد" },
  name: { en: "Name", ar: "الاسم" },
  number: { en: "Number", ar: "الرقم" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  type: { en: "Type", ar: "النوع" },
  description: { en: "Description", ar: "الوصف" },
  /* the BOARD's Add lead form only — the rep pages already know their rep and
     pass it as a prop. Same English as the partner form's picker (pLead), which
     is where this idiom already exists. */
  assignToRep: { en: "Assign to rep (optional)", ar: "إسناد إلى مندوب (اختياري)" },
  saveLead: { en: "Save lead", ar: "حفظ العميل المحتمل" },
  edit: { en: "Edit", ar: "تعديل" },
  estimated: { en: "Estimated", ar: "التقديري" },
  collected: { en: "Collected", ar: "المُحصَّل" },
  toBeCollected: { en: "To be collected", ar: "المطلوب تحصيله" },
  collectionDueDate: { en: "Collection due date", ar: "تاريخ استحقاق التحصيل" },
  retainer: { en: "Retainer", ar: "عقد دوري" },
} satisfies Record<string, Msg>;

/* ---- next-action panel (LeadEventPanel) ---- */
export const events = {
  followUpDate: { en: "Follow-up date", ar: "تاريخ المتابعة" },
  /* Orphaned by ADR-061 (follow-ups went date-only), RE-REFERENCED by ADR-063:
     this is the label of the optional time box, rendered through
     `optionalLabel()`. Kept alive by the house convention that never deletes a
     key — EN byte-identical across both moves. */
  followUpTime: { en: "Follow-up time", ar: "وقت المتابعة" },
  method: { en: "Method", ar: "الطريقة" },
  /* ADR-082 — ORPHANED by the founder's "remove the owner selection field":
     this labelled the follow-up form's Owner select, which is gone. Kept per
     the house rule that never deletes a key (the column it named still exists
     on FollowUp and is still restored by a backup), and it is one word — a
     field that comes back would want exactly this string. */
  owner: { en: "Owner", ar: "المسؤول" },
  /* ADR-082 — THE FOUNDER RENAMED THIS FIELD: "when I move a lead to the
     follow up it should be following up about instead of with". A DELIBERATE
     change to a shipped English string, so the byte-identical i18n rule yields
     to his instruction (the e2e that reads these strings was updated with it,
     never weakened) — recorded as the fourth such exception, after ADR-051's
     "Deal → Lead", ADR-068's twelve-hour clock and ADR-072's column name.
     The ARABIC moved with the meaning: مع ("with") → بخصوص ("about"), because a
     label that still says "with" in one language is the drift this rule exists
     to stop. The KEY keeps its name: it tracks `FollowUp.followingUpWith`, the
     database column, which deliberately did NOT get renamed — renaming a column
     for a label change is churn, and a migration that rewrites history for a
     caption is the kind nobody can undo. */
  followingUpWith: { en: "Following up about", ar: "المتابعة بخصوص" },
  /* ADR-082 — "with" takes a PERSON, "about" takes a TOPIC, so the placeholder
     had to move with the label: a field captioned "about" over a "Contact
     person" hint is worse than either alone. Examples rather than a restatement
     of the label — that is what a placeholder is for. */
  followUpTopic: { en: "The proposal, the price, a question…", ar: "العرض، السعر، سؤال…" },
  /* ADR-082 — ORPHANED: this was the placeholder of the field when it asked
     "Following up WITH" (a contact person). Kept per the house rule that never
     deletes a key; if a person field ever comes back this is its hint. */
  contactPerson: { en: "Contact person", ar: "جهة الاتصال" },
  arranged: { en: "Arranged?", ar: "تم الترتيب؟" },
  date: { en: "Date", ar: "التاريخ" },
  time: { en: "Time", ar: "الوقت" },
  mode: { en: "Mode", ar: "طريقة الانعقاد" },
  withLabel: { en: "With", ar: "مع" },
  attendees: { en: "Attendees", ar: "الحاضرون" },
  technicalSupport: { en: "Technical support", ar: "الدعم الفني" },
  nameOrRep: { en: "Name or rep", ar: "اسم أو مندوب" },
  estimatedValueEgp: { en: "Estimated value (EGP)", ar: "القيمة التقديرية (ج.م)" },
  proposalHint: {
    en: "Save the proposal, then use “Mark as sent” — sending moves the card automatically.",
    ar: "احفظ العرض ثم استخدم «تحديد كمُرسَل» — الإرسال ينقل البطاقة تلقائيًا.",
  },
  reasonRequired: { en: "Reason (required)", ar: "السبب (مطلوب)" },
  collectedAmountEgp: { en: "Collected amount (EGP)", ar: "المبلغ المُحصَّل (ج.م)" },
  /* ADR-082 — the ByteForce twin of `stageForm.postponeAsksNothing`. The
     founder: "don't ask for anything just drop it there." */
  postponeAsksNothing: {
    en: "Parking the lead asks for nothing — it can come back out at any time.",
    ar: "تأجيل العميل لا يطلب أي بيانات — ويمكن إعادته في أي وقت.",
  },
  terminalPrefix: { en: "This lead is", ar: "هذا العميل المحتمل في مرحلة" },
  terminalSuffix: { en: "— no further actions.", ar: "— لا مزيد من الإجراءات." },
  proposalReady: {
    en: "Proposal ready — mark it as sent?",
    ar: "العرض جاهز — هل تريد تحديده كمُرسَل؟",
  },
  sendingMoves: {
    en: "Sending moves this card to Following Up and opens the after-proposal follow-up.",
    ar: "الإرسال ينقل هذه البطاقة إلى «متابعة» ويفتح متابعة ما بعد العرض.",
  },
  followingUpAfterProposal: { en: "Following up after proposal", ar: "متابعة بعد العرض" },
  sentMoveToFollowingUp: {
    en: "Sent — move to Following Up",
    ar: "تم الإرسال — الانتقال إلى المتابعة",
  },
  meetingOutcome: { en: "Meeting outcome", ar: "نتيجة الاجتماع" },
  chooseOutcome: { en: "Choose an outcome…", ar: "اختر النتيجة…" },
  attended: { en: "Attended", ar: "تم الحضور" },
  cancelled: { en: "Cancelled", ar: "أُلغي" },
  delayed: { en: "Delayed", ar: "تأجَّل" },
  delayedSetNew: {
    en: "Delayed — set the new date & time.",
    ar: "تأجَّل — حدِّد التاريخ والوقت الجديدين.",
  },
  saveNewDate: { en: "Save new date", ar: "حفظ الموعد الجديد" },
  whereNext: { en: "Where does it go next?", ar: "إلى أين ينتقل بعد ذلك؟" },
  cancelledFollowUpOrLost: {
    en: "Cancelled — follow up or lost?",
    ar: "أُلغي — متابعة أم خسارة؟",
  },
  destination: { en: "Destination", ar: "الوجهة" },
  choose: { en: "Choose…", ar: "اختر…" },
  confirmMoveTo: { en: "Confirm — move to", ar: "تأكيد — الانتقال إلى" },
  nextAction: { en: "Next action", ar: "الإجراء التالي" },
  chooseNextAction: { en: "Choose a next action…", ar: "اختر الإجراء التالي…" },
  saveAndMove: { en: "Save & move", ar: "حفظ ونقل" },
  /* founder: same-stage records — nothing moves, so "Save & move" would lie */
  saveRecord: { en: "Save record", ar: "حفظ السجل" },
} satisfies Record<string, Msg>;

/* ---- stage records (GroupHistory) ---- */
export const records = {
  followUpContexts: {
    initial: { en: "Following up", ar: "متابعة" },
    after_proposal: { en: "Following up after proposal", ar: "متابعة بعد العرض" },
    after_meeting: { en: "Following up after meeting", ar: "متابعة بعد الاجتماع" },
    /* founder: the negotiation's own follow-up — the promised response date */
    after_negotiation: {
      en: "Response due after negotiation",
      ar: "الرد المتوقع بعد التفاوض",
    },
  } as Record<string, Msg>,
  due: { en: "Due", ar: "تستحق" },
  ownerColon: { en: "Owner:", ar: "المسؤول:" },
  withColon: { en: "With:", ar: "مع:" },
  /* ADR-082 — the follow-up record's own line. It used to borrow `withColon`
     above, which still serves the MEETING's attendees — people you really are
     with. A follow-up now records a TOPIC, so it gets its own word: sharing one
     key would have forced the meeting line to say "About: Omar, Sara". */
  aboutColon: { en: "About:", ar: "بخصوص:" },
  meeting: { en: "Meeting", ar: "اجتماع" },
  notArrangedYet: { en: "Not arranged yet", ar: "لم يُرتَّب بعد" },
  technicalSupportColon: { en: "Technical support:", ar: "الدعم الفني:" },
  outcomeColon: { en: "Outcome:", ar: "النتيجة:" },
  /* raw outcome codes as stored — EN stays the lowercase code byte-for-byte */
  outcomes: {
    attended: { en: "attended", ar: "تم الحضور" },
    cancelled: { en: "cancelled", ar: "أُلغي" },
    delayed: { en: "delayed", ar: "تأجَّل" },
  } as Record<string, Msg>,
  proposal: { en: "Proposal", ar: "عرض" },
  sent: { en: "Sent", ar: "أُرسل" },
  notSent: { en: "Not sent", ar: "لم يُرسَل" },
  estimated: { en: "Estimated", ar: "القيمة التقديرية" },
  collected: { en: "Collected", ar: "المُحصَّل" },
  noStageRecordsYet: { en: "No stage records yet.", ar: "لا توجد سجلات مراحل بعد." },
};

/* ---- activity history (HistoryPanel) ---- */
export const history = {
  noHistoryYet: { en: "No history yet.", ar: "لا يوجد سجل بعد." },
  /* §7.2 / §10.2 normative PP-2 wording */
  returnedToLead: {
    en: "Returned to Lead — new number added",
    ar: "أُعيد إلى عميل محتمل — أُضيف رقم جديد",
  },
  /* ADR-082 — the pill on the row the system wrote for itself. Without it the
     History reads "group added" against a follow-up nobody typed, and the only
     clue is the bare [FU-AUTO] code at the end of the line. */
  nextFollowUpAuto: {
    en: "Next follow-up logged automatically — still no answer",
    ar: "تم تسجيل المتابعة التالية تلقائيًا — لا يزال لا يرد",
  },
  /* LOG_ACTIONS display words — EN matches the previous `replace(/_/g, " ")`
     output (and the "auto-moved" special case) byte-for-byte */
  actions: {
    create: { en: "create", ar: "إنشاء" },
    stage_change: { en: "stage change", ar: "تغيير مرحلة" },
    auto_transfer: { en: "auto-moved", ar: "نُقل تلقائيًا" },
    group_added: { en: "group added", ar: "إضافة سجل" },
    milestone_define: { en: "milestone define", ar: "تحديد مرحلة إنجاز" },
    milestone_check: { en: "milestone check", ar: "إتمام مرحلة إنجاز" },
    milestone_uncheck: { en: "milestone uncheck", ar: "إلغاء إتمام مرحلة إنجاز" },
    won_deal_update: { en: "won deal update", ar: "تحديث صفقة مكسوبة" },
    update: { en: "update", ar: "تحديث" },
    comment: { en: "comment", ar: "تعليق" },
  } as Record<string, Msg>,
};
