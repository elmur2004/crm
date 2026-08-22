import type { Msg } from "@/lib/i18n/core";
import { pPipeline } from "./partners";
import { entryPage } from "./entry";

/* B-Systems core surface dictionary (shell + admin home + CRM board + leads +
   lead detail + role-aware stage forms). EN strings are byte-identical to the
   pre-i18n literals — the e2e suite asserts on them. */

/* ---- app shell: nav + roles ---- */

export const nav = {
  home: { en: "Home", ar: "الرئيسية" },
  leads: { en: "Leads", ar: "العملاء المحتملون" },
  crm: { en: "CRM", ar: "إدارة العملاء" },
  wonLeads: { en: "Won Leads", ar: "الصفقات المكسوبة" },
  /* founder rename: the section carries partner AND agent cards. It is the
     PAGE'S OWN title, not a copy — nav and h1 can never disagree. */
  partnersAndAgents: pPipeline.title,
  partners: { en: "Partners", ar: "الشركاء" },
  agents: { en: "Agents", ar: "الوكلاء" },
  registrations: { en: "Registrations", ar: "طلبات التسجيل" },
  statements: { en: "Statements", ar: "كشوف الحساب" },
  users: { en: "Users", ar: "المستخدمون" },
  /* ADR-051 — the data-entry role's single destination. The PAGE's own
     title, so the nav item and the h1 cannot disagree (as partnersAndAgents
     above). The role BADGE is a different surface and keeps its own wording. */
  dataEntry: entryPage.title,
  payments: { en: "Payments", ar: "المدفوعات" },
  profile: { en: "Profile", ar: "الملف الشخصي" },
  logOut: { en: "Log out", ar: "تسجيل الخروج" },
  bsystemsHome: { en: "B-Systems home", ar: "الصفحة الرئيسية لـ B-Systems" },
} satisfies Record<string, Msg>;

export const roles = {
  bsystems_admin: { en: "Admin", ar: "مدير" },
  bsystems_sales: { en: "Internal sales", ar: "مبيعات داخلية" },
  bsystems_agent: { en: "Agent", ar: "وكيل" },
  bsystems_partner: { en: "Partner", ar: "شريك" },
  bsystems_data_entry: { en: "Data entry", ar: "إدخال بيانات" },
} satisfies Record<string, Msg>;

/* ---- shared bits across the surface ---- */

export const common = {
  name: { en: "Name", ar: "الاسم" },
  number: { en: "Number", ar: "الرقم" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  type: { en: "Type", ar: "النوع" },
  owner: { en: "Owner", ar: "المالك" },
  position: { en: "Position", ar: "المنصب" },
  company: { en: "Company", ar: "الشركة" },
  companyName: { en: "Company name", ar: "اسم الشركة" },
  industry: { en: "Industry", ar: "المجال" },
  requirements: { en: "Requirements", ar: "المتطلبات" },
  notes: { en: "Notes", ar: "ملاحظات" },
  stage: { en: "Stage", ar: "المرحلة" },
  created: { en: "Created", ar: "تاريخ الإنشاء" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  save: { en: "Save", ar: "حفظ" },
  somethingWentWrong: { en: "Something went wrong", ar: "حدث خطأ ما" },
  readyToClose: { en: "Ready to close", ar: "جاهز للإغلاق" },
  markReadyToClose: { en: "Mark ready to close", ar: "تحديد كجاهز للإغلاق" },
  noAnswer: { en: "No answer", ar: "لم يرد" },
  markNoAnswer: { en: "Didn't answer", ar: "لم يرد على الاتصال" },
  clearNoAnswer: { en: "Answered — clear flag", ar: "تم الرد — إزالة العلامة" },
  nextAction: { en: "Next action", ar: "الإجراء التالي" },
  confirmWin: { en: "Confirm win", ar: "تأكيد المكسب" },
  ownerFilter: { en: "Owner filter", ar: "تصفية حسب المالك" },
  /* the board card's drag grip (founder, on his phone): a finger on the CARD
     scrolls, a finger on the GRIP drags */
  dragHandle: { en: "Drag to move this card", ar: "اسحب لنقل هذه البطاقة" },
} satisfies Record<string, Msg>;

/* Owner-bucket filter chips (EN mirrors OWNER_TYPE_LABELS + "Any"). */
export const ownerFilters = {
  any: { en: "Any", ar: "الكل" },
  internal: { en: "Internal", ar: "داخلي" },
  agent: { en: "Agents", ar: "وكلاء" },
  partner: { en: "Partners", ar: "شركاء" },
  admin: { en: "Admins", ar: "مديرون" },
  /* ADR-051 — the queue a data-entry user fills: internal bucket, no rep,
     no owner. This is A-6's unassigned state, now findable. */
  unassigned: { en: "Unassigned", ar: "غير مُسند" },
} satisfies Record<string, Msg>;

/* Founder (ADR-043) — archive: soft-hide with a way back. */
export const archiveMsgs = {
  archive: { en: "Archive", ar: "أرشفة" },
  unarchive: { en: "Unarchive", ar: "إلغاء الأرشفة" },
  archived: { en: "Archived", ar: "مؤرشف" },
  active: { en: "Active", ar: "نشط" },
  confirmArchive: {
    en: "Archive this lead? It leaves the board and lists — restore it any time from the Archived view.",
    ar: "أرشفة هذا العميل المحتمل؟ سيغادر اللوحة والقوائم — يمكن استعادته في أي وقت من عرض المؤرشف.",
  },
  archiveFailed: { en: "Could not archive the lead", ar: "تعذّرت أرشفة العميل المحتمل" },
  archivedNote: {
    en: "This lead is archived — unarchive it to make changes.",
    ar: "هذا العميل المحتمل مؤرشف — ألغِ الأرشفة لإجراء تغييرات.",
  },
} satisfies Record<string, Msg>;

/* Founder — leads list filters + ordering ("filter of the stage and the type
   and the owner", "last edited, last added, closer-to-the-finish first").
   V2 of the round: the controls live in a sidebar and lead with one universal
   search box (name / company / number). */
export const leadsFilters = {
  filters: { en: "Filters", ar: "التصفية" },
  apply: { en: "Apply", ar: "تطبيق" },
  sort: { en: "Sort", ar: "الترتيب" },
  sortAdded: { en: "Newest added", ar: "الأحدث إضافة" },
  sortUpdated: { en: "Recently updated", ar: "الأحدث تعديلاً" },
  sortPriority: { en: "Pipeline priority", ar: "أولوية خط المبيعات" },
  search: { en: "Search", ar: "بحث" },
  searchPlaceholder: {
    en: "Name, company or number",
    ar: "الاسم أو الشركة أو الرقم",
  },
  view: { en: "View", ar: "العرض" },
  clear: { en: "Clear filters", ar: "مسح التصفية" },
  activeCount: { en: "active filters", ar: "تصفية نشطة" },
} satisfies Record<string, Msg>;

/* ---- admin Home dashboard ---- */

export const home = {
  eyebrow: { en: "B-SYSTEMS · HOME", ar: "B-SYSTEMS · الرئيسية" },
  title: { en: "Home", ar: "الرئيسية" },
  totalLeads: { en: "Total leads", ar: "إجمالي العملاء المحتملين" },
  pipelineValue: { en: "Pipeline value", ar: "قيمة الصفقات الجارية" },
  activeStagesOnly: { en: "Active stages only", ar: "المراحل النشطة فقط" },
  wonValue: { en: "Won value", ar: "قيمة الصفقات المكسوبة" },
  toBeCollected: { en: "To be collected", ar: "قيد التحصيل" },
  acrossAllClients: { en: "Across all clients", ar: "عبر جميع العملاء" },
  leadsPerStage: { en: "Leads per stage", ar: "العملاء المحتملون حسب المرحلة" },
  newNotActioned: { en: "New / not actioned", ar: "جديد / بدون إجراء" },
  agents: { en: "Agents", ar: "الوكلاء" },
  partners: { en: "Partners", ar: "الشركاء" },
  externalPipeline: { en: "Agent & partner pipeline", ar: "صفقات الوكلاء والشركاء" },
} satisfies Record<string, Msg>;

/* ---- CRM board page ---- */

export const crmPage = {
  eyebrow: { en: "B-SYSTEMS · CRM", ar: "B-SYSTEMS · إدارة العملاء" },
  title: { en: "CRM", ar: "إدارة العملاء" },
  /* founder (filters round 3): the board gets the Leads page's search/filters */
  noMatches: {
    en: "No cards match these filters.",
    ar: "لا توجد بطاقات مطابقة لهذه التصفية.",
  },
  nextPrefix: { en: "Next: ", ar: "التالي: " },
  noFollowUp: { en: "No follow-up set", ar: "لا توجد متابعة محددة" },
  meetingPrefix: { en: "Meeting: ", ar: "الاجتماع: " },
  meetingNotArranged: { en: "Meeting not arranged", ar: "لم يتم ترتيب الاجتماع" },
  estPrefix: { en: "Est: ", ar: "تقديري: " },
  noValue: { en: "No value set", ar: "لم تُحدد قيمة" },
  /* founder: the negotiation card's key datum — the promised response date */
  responsePrefix: { en: "Response: ", ar: "الرد: " },
  noResponseDate: { en: "No response date set", ar: "لم يُحدد موعد الرد" },
} satisfies Record<string, Msg>;

/* ---- Leads (admin list) page ---- */

export const leadsPage = {
  eyebrow: { en: "B-SYSTEMS · LEADS", ar: "B-SYSTEMS · العملاء المحتملون" },
  title: { en: "Leads", ar: "العملاء المحتملون" },
  empty: { en: "No leads in this bucket yet.", ar: "لا يوجد عملاء محتملون في هذه الفئة بعد." },
  noMatches: {
    en: "No leads match these filters.",
    ar: "لا يوجد عملاء محتملون مطابقون لهذه التصفية.",
  },
} satisfies Record<string, Msg>;

/* ---- lead detail page (labels keep the trailing colon) ---- */

export const leadDetail = {
  backToBoard: { en: "Back to the CRM board", ar: "الرجوع إلى لوحة إدارة العملاء" },
  fieldName: { en: "Name:", ar: "الاسم:" },
  fieldNumber: { en: "Number:", ar: "الرقم:" },
  fieldEmail: { en: "Email:", ar: "البريد الإلكتروني:" },
  fieldType: { en: "Type:", ar: "النوع:" },
  fieldOwner: { en: "Owner:", ar: "المالك:" },
  fieldPosition: { en: "Position:", ar: "المنصب:" },
  fieldCompany: { en: "Company:", ar: "الشركة:" },
  fieldIndustry: { en: "Industry:", ar: "المجال:" },
  fieldDateCreated: { en: "Date created:", ar: "تاريخ الإنشاء:" },
  fieldRequirements: { en: "Requirements:", ar: "المتطلبات:" },
  fieldNotes: { en: "Notes:", ar: "ملاحظات:" },
  wonDeal: { en: "Won deal", ar: "الصفقة المكسوبة" },
  milestonesCompleted: { en: "milestones completed", ar: "مراحل مكتملة" },
  openInWonLeads: { en: "open in Won Leads", ar: "فتح في الصفقات المكسوبة" },
  negotiationNotes: { en: "Negotiation notes", ar: "ملاحظات التفاوض" },
  stageRecords: { en: "Stage records", ar: "سجلات المراحل" },
  history: { en: "History", ar: "السجل" },
} satisfies Record<string, Msg>;

/* ---- add / edit / copy / delete lead actions ---- */

export const leadForm = {
  addLead: { en: "Add lead", ar: "إضافة عميل محتمل" },
  newLead: { en: "New lead", ar: "عميل محتمل جديد" },
  saveLead: { en: "Save lead", ar: "حفظ العميل المحتمل" },
  editLead: { en: "Edit lead", ar: "تعديل العميل المحتمل" },
  deleteLead: { en: "Delete lead", ar: "حذف العميل المحتمل" },
  deleteFailed: { en: "Delete failed", ar: "فشل الحذف" },
  confirmDelete: { en: "Yes, delete permanently", ar: "نعم، احذف نهائيًا" },
  keepIt: { en: "Keep it", ar: "الإبقاء عليه" },
  copyData: { en: "Copy data", ar: "نسخ البيانات" },
  copied: { en: "Copied!", ar: "تم النسخ!" },
} satisfies Record<string, Msg>;

/* ---- founder: assign a lead to an agent / partner (admin only) ---- */

export const assignLead = {
  assign: { en: "Assign owner", ar: "إسناد المالك" },
  eyebrow: { en: "LEAD · OWNER", ar: "العميل المحتمل · المالك" },
  owner: { en: "Responsible for this lead", ar: "المسؤول عن هذا العميل المحتمل" },
  choose: { en: "Choose an agent, partner or colleague…", ar: "اختر وكيلًا أو شريكًا أو زميلًا…" },
  confirm: { en: "Assign", ar: "إسناد" },
  noOwners: {
    en: "No active agent, partner or internal sales account yet.",
    ar: "لا يوجد حساب وكيل أو شريك أو مبيعات داخلية نشط بعد.",
  },
  note: {
    en: "The lead moves to their board and counts as theirs. The referring partner does not change.",
    ar: "ينتقل العميل المحتمل إلى لوحته ويُحتسب له. لا يتغيّر الشريك المُحيل.",
  },
} satisfies Record<string, Msg>;

/* ---- BsEventPanel (lead-detail action panel) ---- */

export const eventPanel = {
  /* "This lead is {stage} — no further actions." */
  terminalNote: {
    en: "This lead is {stage} — no further actions.",
    ar: "هذا العميل المحتمل في مرحلة {stage} — لا إجراءات أخرى.",
  },
  requestReceived: {
    en: "Your request was received — we'll confirm on WhatsApp.",
    ar: "تم استلام طلبك — سنؤكد لك عبر واتساب.",
  },
  proposalReady: {
    en: "Proposal ready — mark it as sent?",
    ar: "العرض جاهز — هل تريد تحديده كمُرسَل؟",
  },
  sentBackToFollowUp: { en: "Sent — back to Following Up", ar: "تم الإرسال — العودة إلى المتابعة" },
  followUpAfterProposal: { en: "Following up after proposal", ar: "المتابعة بعد إرسال العرض" },
  sentMoveToFollowUp: { en: "Sent — move to Following Up", ar: "تم الإرسال — الانتقال إلى المتابعة" },
  meetingOutcome: { en: "Meeting outcome", ar: "نتيجة الاجتماع" },
  chooseOutcome: { en: "Choose an outcome…", ar: "اختر النتيجة…" },
  attended: { en: "Attended", ar: "تم الحضور" },
  cancelled: { en: "Cancelled", ar: "أُلغي" },
  delayed: { en: "Delayed", ar: "تأجل" },
  saveNewDate: { en: "Save new date", ar: "حفظ الموعد الجديد" },
  destination: { en: "Destination", ar: "الوجهة" },
  chooseDestination: { en: "Choose a destination…", ar: "اختر الوجهة…" },
  /* "Confirm — move to {stage}" */
  confirmMoveTo: { en: "Confirm — move to {stage}", ar: "تأكيد — الانتقال إلى {stage}" },
  chooseNextAction: { en: "Choose a next action…", ar: "اختر الإجراء التالي…" },
  saveAndMove: { en: "Save & move", ar: "حفظ ونقل" },
  /* founder: same-stage records — nothing moves, so "Save & move" would lie */
  saveRecord: { en: "Save record", ar: "حفظ السجل" },
} satisfies Record<string, Msg>;

/* ---- role-aware stage forms (roleForms.tsx) ---- */

export const stageForm = {
  followUpDate: { en: "Follow-up date", ar: "تاريخ المتابعة" },
  /* UNREFERENCED since ADR-061 (founder: follow-ups are date-only) — kept per
     house convention: existing keys are never deleted, EN stays byte-identical. */
  followUpTime: { en: "Follow-up time", ar: "وقت المتابعة" },
  method: { en: "Method", ar: "الوسيلة" },
  methodCall: { en: "Call", ar: "مكالمة" },
  methodMessage: { en: "Message", ar: "رسالة" },
  methodVisit: { en: "Visit", ar: "زيارة" },
  followingUpWith: { en: "Following up with", ar: "المتابعة مع" },
  contactPerson: { en: "Contact person", ar: "جهة الاتصال" },
  agreedQuestion: {
    en: "Did you agree with the client on a time?",
    ar: "هل اتفقت مع العميل على موعد؟",
  },
  arranged: { en: "Arranged?", ar: "تم الترتيب؟" },
  date: { en: "Date", ar: "التاريخ" },
  dateThatSuits: { en: "Date that suits you", ar: "التاريخ المناسب لك" },
  time: { en: "Time", ar: "الوقت" },
  timeThatSuits: { en: "Time that suits you", ar: "الوقت المناسب لك" },
  mode: { en: "Mode", ar: "طريقة الاجتماع" },
  online: { en: "Online", ar: "عن بُعد" },
  offline: { en: "Offline", ar: "حضوري" },
  needsTechnical: {
    en: "Do you need a technical colleague with you?",
    ar: "هل تحتاج زميلًا تقنيًا معك؟",
  },
  withLabel: { en: "With", ar: "بحضور" },
  attendees: { en: "Attendees", ar: "الحاضرون" },
  technicalSupport: { en: "Technical support", ar: "الدعم التقني" },
  service: { en: "Service", ar: "الخدمة" },
  estimatedValue: { en: "Estimated value (EGP)", ar: "القيمة التقديرية (EGP)" },
  negotiationNote: { en: "Negotiation note", ar: "ملاحظة التفاوض" },
  negotiationPlaceholder: { en: "What is being negotiated?", ar: "ما الذي يجري التفاوض عليه؟" },
  lostReason: { en: "Reason (required)", ar: "السبب (مطلوب)" },
  totalCommission: { en: "Total commission (%)", ar: "إجمالي العمولة (%)" },
  contractDate: { en: "Contract date", ar: "تاريخ التعاقد" },
  milestoneCount: { en: "Number of milestones", ar: "عدد المراحل" },
  /* "Milestone {n}" — also the milestone name placeholder */
  milestoneN: { en: "Milestone {n}", ar: "المرحلة {n}" },
  valueEgp: { en: "Value (EGP)", ar: "القيمة (EGP)" },
  closerCommission: { en: "Closer's commission (EGP)", ar: "عمولة مسؤول الإغلاق (EGP)" },
  expectedStart: { en: "Expected start", ar: "البداية المتوقعة" },
  expectedEnd: { en: "Expected end", ar: "النهاية المتوقعة" },
  /* "Milestone values: {a} of {b}" */
  milestoneValuesLine: { en: "Milestone values: {a} of {b}", ar: "قيم المراحل: {a} من {b}" },
  mustMatchEstimated: {
    en: " — must match the estimated value",
    ar: " — يجب أن تساوي القيمة التقديرية",
  },
  /* "Commissions: {a} of expected {b}" */
  commissionsLine: { en: "Commissions: {a} of expected {b}", ar: "العمولات: {a} من المتوقع {b}" },
  mustMatchCommission: {
    en: " — must match the total commission %",
    ar: " — يجب أن تساوي نسبة العمولة الإجمالية",
  },
  backToNew: { en: "The lead returns to the New column.", ar: "يعود العميل المحتمل إلى عمود «جديد»." },
} satisfies Record<string, Msg>;

/* ---- BsBoard (kanban) ---- */

export const board = {
  adminOnlyColumn: { en: "Admin-only column", ar: "عمود خاص بالمدير فقط" },
  blocked: { en: "Blocked", ar: "محظور" },
  emptyColumn: { en: "Nothing here yet", ar: "لا يوجد شيء هنا بعد" },
  terminalMove: {
    en: "Won and Lost leads can no longer be moved.",
    ar: "لم يعد من الممكن نقل الصفقات المكسوبة أو الخاسرة.",
  },
  adminOnlyWin: { en: "Only an admin can confirm a win.", ar: "المدير فقط هو من يمكنه تأكيد المكسب." },
  close: { en: "Close", ar: "إغلاق" },
  completeToConfirm: {
    en: "Complete this stage's details to confirm the move — cancel reverts it.",
    ar: "أكمل تفاصيل هذه المرحلة لتأكيد النقل — الإلغاء يتراجع عنه.",
  },
  /* "Cancelling reverts the card to {stage}." */
  cancelReverts: {
    en: "Cancelling reverts the card to {stage}.",
    ar: "الإلغاء يعيد البطاقة إلى {stage}.",
  },
  confirmMove: { en: "Confirm move", ar: "تأكيد النقل" },
  /* founder (ADR-061): "make a little filter in top of the follow up column
     called today" — the chip's label; the count rides beside it. */
  todayFilter: { en: "Today", ar: "اليوم" },
  /* review: a pressed chip with zero matches must not claim the column is
     empty — cards may merely be hidden by the filter. */
  noTodayFollowUps: { en: "No follow-ups due today", ar: "لا توجد متابعات مستحقة اليوم" },
} satisfies Record<string, Msg>;
