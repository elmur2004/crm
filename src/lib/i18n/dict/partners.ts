import type { Locale, Msg } from "@/lib/i18n/core";

/* Partners & Agents surface (App B): acquisition board (§7.2), prospect detail,
   directory (§7.3), partner detail (§7.4), admin manage modals.

   EN values were byte-identical to the original literals; the founder-directed
   rename of this section ("Partnership CRM" → "Partners & Agents") is the one
   deliberate exception, applied here and in every e2e assertion that read the
   old wording. Everything else stays byte-identical. */

/* ---------- shared buttons / errors / field names ---------- */

export const pCommon = {
  somethingWrong: { en: "Something went wrong", ar: "حدث خطأ ما" },
  uploadFailed: { en: "Upload failed", ar: "فشل الرفع" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  save: { en: "Save", ar: "حفظ" },
  close: { en: "Close", ar: "إغلاق" },
  edit: { en: "Edit", ar: "تعديل" },
  delete: { en: "Delete", ar: "حذف" },
  changesApply: { en: "Changes apply immediately.", ar: "تسري التغييرات فورًا." },
  name: { en: "Name", ar: "الاسم" },
  companyName: { en: "Company name", ar: "اسم الشركة" },
  role: { en: "Role", ar: "المنصب" },
  number: { en: "Number", ar: "الرقم" },
  description: { en: "Description", ar: "الوصف" },
  importance: { en: "Importance", ar: "الأهمية" },
  keyPersonName: { en: "Key person name", ar: "اسم الشخص المسؤول" },
  keyPersonRole: { en: "Key person role", ar: "منصب الشخص المسؤول" },
} satisfies Record<string, Msg>;

/* ---------- card kind (founder: one board, partners AND agents) ---------- */

export const kindMsgs: Record<string, Msg> = {
  partner: { en: "Partner", ar: "شريك" },
  agent: { en: "Agent", ar: "وكيل" },
};

/** The chip / dropdown label for a card's kind. */
export function prospectKindLabel(locale: Locale, value: string): string {
  return kindMsgs[value]?.[locale] ?? value;
}

/* ---------- fixed enums (values stay English on the wire) ---------- */

export const businessActivityMsgs: Record<string, Msg> = {
  "HR company": { en: "HR company", ar: "شركة موارد بشرية" },
  "Marketing company": { en: "Marketing company", ar: "شركة تسويق" },
  "Accounting firm": { en: "Accounting firm", ar: "مكتب محاسبة" },
  "Law firm": { en: "Law firm", ar: "مكتب محاماة" },
  "Other activities": { en: "Other activities", ar: "أنشطة أخرى" },
};

/** Fixed-list business activity in the given locale — free-text ("Other")
    values pass through untouched. EN is always the stored value. */
export function businessActivityLabel(locale: Locale, value: string): string {
  return businessActivityMsgs[value]?.[locale] ?? value;
}

export const importanceMsgs: Record<string, Msg> = {
  high: { en: "High", ar: "عالية" },
  medium: { en: "Medium", ar: "متوسطة" },
  low: { en: "Low", ar: "منخفضة" },
};

/** Dropdown label for an importance level (EN capitalized, as today). */
export function importanceOptionLabel(locale: Locale, value: string): string {
  return importanceMsgs[value]?.[locale] ?? value;
}

/** Stored importance value at render: EN shows the raw stored value
    (byte-identical to today's output), Arabic shows the translation. */
export function importanceValueLabel(locale: Locale, value: string): string {
  return locale === "ar" ? (importanceMsgs[value]?.ar ?? value) : value;
}

export const followUpMethodMsgs: Record<string, Msg> = {
  call: { en: "Call", ar: "اتصال" },
  message: { en: "Message", ar: "رسالة" },
  visit: { en: "Visit", ar: "زيارة" },
};

export function followUpMethodLabel(locale: Locale, value: string): string {
  return followUpMethodMsgs[value]?.[locale] ?? value;
}

export const meetingModeMsgs: Record<string, Msg> = {
  online: { en: "Online", ar: "عبر الإنترنت" },
  offline: { en: "Offline", ar: "حضوري" },
};

export function meetingModeLabel(locale: Locale, value: string): string {
  return meetingModeMsgs[value]?.[locale] ?? value;
}

/* ---------- pipeline board page (§7.2) ---------- */

export const pPipeline = {
  eyebrow: { en: "B-SYSTEMS · PARTNERS & AGENTS", ar: "B-SYSTEMS · الشركاء والوكلاء" },
  title: { en: "Partners & Agents", ar: "الشركاء والوكلاء" },
  awaitingNewNumber: { en: "Awaiting a new number", ar: "بانتظار رقم جديد" },
  nextAt: { en: "Next: {dt}", ar: "التالي: {dt}" },
  noFollowUpSet: { en: "No follow-up set", ar: "لا توجد متابعة محددة" },
  /* founder: "first of all add a filter for agents and partners" — All |
     Partners | Agents, in the boards' shared disclosure filter card */
  filterKind: { en: "Kind", ar: "النوع" },
  filterAllKinds: { en: "All", ar: "الكل" },
  filterPartners: { en: "Partners", ar: "شركاء" },
  filterAgents: { en: "Agents", ar: "وكلاء" },
  noMatches: {
    en: "No cards match these filters.",
    ar: "لا توجد بطاقات مطابقة لهذه التصفية.",
  },
  meetingAt: { en: "Meeting: {dt}", ar: "الاجتماع: {dt}" },
  notArranged: { en: "Not arranged", ar: "لم يُرتَّب بعد" },
  emptyColumn: { en: "Nothing here yet", ar: "لا شيء هنا بعد" },
  converted: { en: "Converted", ar: "تم التحويل" },
  /* ADR-059 — a qualified agent with no login is a legitimate state (founder
     1.3), so the card says so rather than leaving a gap where the Converted
     badge used to be. */
  noLoginYet: { en: "No login yet", ar: "لا يوجد حساب بعد" },
  /* @deprecated ADR-059 — there is no Won column on this board any more, for
     either kind. Superseded by terminalToastAgent, whose sentence is now the
     only one. Kept verbatim: existing English is never edited. */
  terminalToast: {
    en: "Won and Lost cards can no longer be moved.",
    ar: "لا يمكن نقل بطاقات «مكسب» و«خسارة» بعد الآن.",
  },
  /* ADR-057 named this "agent" because only that board's terminal pair was
     Qualified and Lost. ADR-059 gave BOTH kinds those two columns, so this is
     now the board's ONE terminal sentence; the key name is historical. */
  terminalToastAgent: {
    en: "Qualified and Lost cards can no longer be moved.",
    ar: "لا يمكن نقل بطاقات «مؤهَّل» و«خسارة» بعد الآن.",
  },
  /* @deprecated ADR-059 — the stacked two-board arrangement is gone: one board
     carries both kinds and the Kind filter simply filters the CARDS, so there
     are no sections to name and no per-section empty state. The page-level
     `noMatches` covers a filtered-empty board. Kept verbatim. */
  sectionPartners: { en: "Partners", ar: "الشركاء" },
  sectionAgents: { en: "Agents", ar: "الوكلاء" },
  noPartnerCards: { en: "No partner cards yet.", ar: "لا توجد بطاقات شركاء بعد." },
  noAgentCards: { en: "No agent cards yet.", ar: "لا توجد بطاقات وكلاء بعد." },
  modalNote: {
    en: "Complete this stage's details to confirm the move — cancel reverts it.",
    ar: "أكمل تفاصيل هذه المرحلة لتأكيد النقل — الإلغاء يتراجع عنه.",
  },
  cancelReverts: {
    en: "Cancelling reverts the card to {stage}.",
    ar: "الإلغاء يعيد البطاقة إلى {stage}.",
  },
  confirmMove: { en: "Confirm move", ar: "تأكيد النقل" },
} satisfies Record<string, Msg>;

/* ---------- prospect detail page ---------- */

export const pProspect = {
  backToPipeline: { en: "Back to the pipeline", ar: "العودة إلى المسار" },
  deleteWarning: {
    en: "Deletes this card, its records and recordings — and its directory partner if converted.",
    ar: "يحذف هذه البطاقة وسجلاتها وتسجيلاتها — وكذلك شريكها في الدليل إذا تم تحويله.",
  },
  contact: { en: "Contact:", ar: "جهة الاتصال:" },
  numberField: { en: "Number:", ar: "الرقم:" },
  nonAnswering: { en: "Non-answering number(s):", ar: "الأرقام التي لم يُرد عليها:" },
  altNumbers: { en: "Alternative numbers:", ar: "أرقام بديلة:" },
  emailField: { en: "Email:", ar: "البريد الإلكتروني:" },
  businessActivityField: { en: "Business activity:", ar: "النشاط التجاري:" },
  addressField: { en: "Address:", ar: "العنوان:" },
  specialityField: { en: "Speciality:", ar: "التخصص:" },
  cvField: { en: "CV:", ar: "السيرة الذاتية:" },
  noCv: { en: "No CV on this card yet.", ar: "لا توجد سيرة ذاتية على هذه البطاقة بعد." },
  viewInDirectory: { en: "View in Partners directory", ar: "عرض في دليل الشركاء" },
  viewInAgents: { en: "View in Agents", ar: "عرض في الوكلاء" },
  /* the email follows this line as its own bidi-isolated run, so the sentence
     deliberately ends without one — never interpolate an address into RTL prose */
  agentAccountCreated: {
    en: "Agent account created — they sign in with",
    ar: "تم إنشاء حساب الوكيل — يسجّل الدخول باستخدام",
  },
  /* ADR-059 — §7.2b: creating the login is its own explicit step now. */
  createAgentAccount: { en: "Create the agent's account", ar: "إنشاء حساب الوكيل" },
  createPartnerLogin: { en: "Create the partner's login", ar: "إنشاء حساب الشريك" },
  noAgentAccount: {
    en: "Qualified, no account yet — create their login when you are ready.",
    ar: "مؤهَّل بلا حساب بعد — أنشئ بيانات دخوله عندما تكون جاهزًا.",
  },
  noPartnerAccount: {
    en: "In the directory, no login yet — create it when you are ready.",
    ar: "مدرج في الدليل بلا حساب بعد — أنشئه عندما تكون جاهزًا.",
  },
  recordingsTitle: { en: "Cold-call recordings", ar: "تسجيلات الاتصال المباشر" },
  noRecordings: { en: "No recordings yet.", ar: "لا توجد تسجيلات بعد." },
  recordingMissing: {
    en: "Recording file missing — it was lost in a redeploy. Upload it again below.",
    ar: "ملف التسجيل مفقود — فُقد أثناء إعادة النشر. ارفعه مرة أخرى أدناه.",
  },
  nextActionTitle: { en: "Next action", ar: "الإجراء التالي" },
  stageRecords: { en: "Stage records", ar: "سجلات المراحل" },
  history: { en: "History", ar: "السجل" },
} satisfies Record<string, Msg>;

/* ---------- directory + partner detail (§7.3 / §7.4) ---------- */

export const pDirectory = {
  eyebrow: { en: "B-SYSTEMS · PARTNERS", ar: "B-SYSTEMS · الشركاء" },
  title: { en: "Partners", ar: "الشركاء" },
  /* @deprecated ADR-059 — the column is called Qualified now. Kept verbatim. */
  empty: {
    en: "No partners yet — they appear automatically when a pipeline card is Won.",
    ar: "لا يوجد شركاء بعد — يظهرون تلقائيًا عندما تصل بطاقة في المسار إلى «مكسب».",
  },
  emptyQualified: {
    en: "No partners yet — they appear automatically when a pipeline card is Qualified.",
    ar: "لا يوجد شركاء بعد — يظهرون تلقائيًا عندما تصل بطاقة في المسار إلى «مؤهَّل».",
  },
  backToAll: { en: "Back to all partners", ar: "العودة إلى جميع الشركاء" },
  dateJoined: { en: "Date joined:", ar: "تاريخ الانضمام:" },
  deleteWarning: {
    en: "Removes the partner from the directory — their leads keep living without the attribution.",
    ar: "يزيل الشريك من الدليل — يظل عملاؤه المحتملون موجودين دون الإسناد.",
  },
  keyPerson: { en: "Key person:", ar: "الشخص المسؤول:" },
  importanceField: { en: "Importance:", ar: "الأهمية:" },
  addressField: { en: "Address:", ar: "العنوان:" },
  leadsTitle: { en: "Leads from this partner", ar: "عملاء محتملون من هذا الشريك" },
  noLeads: { en: "No leads yet.", ar: "لا يوجد عملاء محتملون بعد." },
  thName: { en: "Name", ar: "الاسم" },
  thNumber: { en: "Number", ar: "الرقم" },
  thRep: { en: "Rep", ar: "المندوب" },
  thCreated: { en: "Created", ar: "تاريخ الإنشاء" },
  thStage: { en: "Stage", ar: "المرحلة" },
  unassigned: { en: "Unassigned", ar: "غير مُسند" },
} satisfies Record<string, Msg>;

/* ---------- client forms (forms.tsx) ---------- */

export const pForms = {
  businessActivity: { en: "Business activity", ar: "النشاط التجاري" },
  specifyActivity: { en: "Specify the activity", ar: "حدد النشاط" },
  addPartnerLead: { en: "Add partner or agent", ar: "إضافة شريك أو وكيل" },
  newPartnerLead: { en: "New partner or agent", ar: "شريك أو وكيل جديد" },
  savePartnerLead: { en: "Save card", ar: "حفظ البطاقة" },
  /* founder: "whenever I'm adding someone into the CRM, it could be a partner
     or an agent" — so the FIRST control on the form asks which. */
  whichKind: { en: "What are you adding?", ar: "ما الذي تضيفه؟" },
  /* @deprecated ADR-057 — superseded by kindLockedPipelines: it is no longer
     only the Won step that differs, it is the whole set of columns. */
  kindLocked: {
    en: "Chosen once: a card stays a partner or an agent — the Won step differs for each.",
    ar: "يُختار مرة واحدة: تبقى البطاقة شريكًا أو وكيلًا — لأن خطوة «مكسب» تختلف بينهما.",
  },
  /* @deprecated ADR-059 — the founder reversed the split: both kinds run the
     SAME columns again. Superseded by kindLockedQualified. Kept verbatim. */
  kindLockedPipelines: {
    en: "Chosen once: a card stays a partner or an agent — each kind runs its own columns.",
    ar: "يُختار مرة واحدة: تبقى البطاقة شريكًا أو وكيلًا — ولكل نوع أعمدته الخاصة.",
  },
  kindLockedQualified: {
    en: "Chosen once: a card stays a partner or an agent — a qualified partner joins the directory, a qualified agent gets a login.",
    ar: "يُختار مرة واحدة: تبقى البطاقة شريكًا أو وكيلًا — الشريك المؤهَّل ينضم إلى الدليل، والوكيل المؤهَّل يحصل على حساب دخول.",
  },
  /* founder: only the name and the number are required on an agent card */
  agentOptionalHint: {
    en: "Only the name and the number are required — add the rest whenever you have it.",
    ar: "الاسم والرقم فقط مطلوبان — أضف الباقي متى توفّر لديك.",
  },
  /* @deprecated ADR-057 — the CV now rides to the profile at Qualified. */
  cvOptionalHint: {
    en: "Optional — it moves to the agent's profile when you set them Won.",
    ar: "اختيارية — تنتقل إلى ملف الوكيل عند تحويله إلى «مكسب».",
  },
  /* @deprecated ADR-059 — the CV rides to the profile when the ACCOUNT is
     created, which is no longer the same moment as Qualified. Kept verbatim. */
  cvOptionalHintQualified: {
    en: "Optional — it moves to the agent's profile when you set them Qualified.",
    ar: "اختيارية — تنتقل إلى ملف الوكيل عند تحويله إلى «مؤهَّل».",
  },
  cvOptionalHintAccount: {
    en: "Optional — it moves to the agent's profile when you create their account.",
    ar: "اختيارية — تنتقل إلى ملف الوكيل عند إنشاء حسابه.",
  },
  saveCv: { en: "Save CV", ar: "حفظ السيرة الذاتية" },
  altNumbersTitle: { en: "Alternative numbers", ar: "أرقام بديلة" },
  altNumbersHint: {
    en: "Saving new number(s) returns this card to Lead automatically. You can also add them later — nothing is required now.",
    ar: "حفظ رقم (أرقام) جديدة يعيد هذه البطاقة إلى «عميل محتمل» تلقائيًا. يمكنك أيضًا إضافتها لاحقًا — لا شيء مطلوب الآن.",
  },
  newNumberN: { en: "New number {n}", ar: "رقم جديد {n}" },
  newNumberPh: { en: "New number", ar: "رقم جديد" },
  addAnotherNumber: { en: "Add another number", ar: "إضافة رقم آخر" },
  saveNumbers: { en: "Save numbers", ar: "حفظ الأرقام" },
  dropzoneTitle: {
    en: "Add cold-call recording (.mp3 / .mp4, ≤ 50 MB)",
    ar: "إضافة تسجيل اتصال مباشر (.mp3 / .mp4، بحد أقصى 50 MB)",
  },
  uploadRecording: { en: "Upload recording", ar: "رفع التسجيل" },
} satisfies Record<string, Msg>;

/* ---------- action panel + shared stage forms (ProspectEventPanel) ---------- */

export const pPanel = {
  followUpDate: { en: "Follow-up date", ar: "تاريخ المتابعة" },
  followUpTime: { en: "Follow-up time", ar: "وقت المتابعة" },
  method: { en: "Method", ar: "الطريقة" },
  owner: { en: "Owner", ar: "المسؤول" },
  followingUpWith: { en: "Following up with", ar: "المتابعة مع" },
  contactPersonPh: { en: "Contact person", ar: "جهة الاتصال" },
  /* @deprecated ADR-059 — the column is called Qualified now. Kept verbatim. */
  wonGateHint: {
    en: "Won saves only when the partner record is complete.",
    ar: "لا يُحفظ «مكسب» إلا عند اكتمال بيانات الشريك.",
  },
  qualifiedGateHint: {
    en: "Qualified saves only when the partner record is complete — no email or password is ever needed.",
    ar: "لا يُحفظ «مؤهَّل» إلا عند اكتمال بيانات الشريك — ولا يُطلب بريد إلكتروني أو كلمة مرور أبدًا.",
  },
  /* ADR-059 — the prospect panel's own label for the same-stage follow-up
     button. The SHARED sameStageActionMsgs.follow_up_again ("Log another
     follow-up") stays byte-identical for the two lead CRMs; here the action is
     offered from every active stage, so "another" would be wrong. */
  recordFollowUp: { en: "Record a follow-up", ar: "تسجيل متابعة" },
  createAccountHint: {
    en: "Set the email and password this agent signs in with — the card is already Qualified.",
    ar: "حدّد البريد الإلكتروني وكلمة المرور التي يسجّل بها الوكيل الدخول — البطاقة مؤهَّلة بالفعل.",
  },
  partnerLoginHint: {
    en: "Set the email and password this partner signs in with — they are already in the directory.",
    ar: "حدّد البريد الإلكتروني وكلمة المرور التي يسجّل بها الشريك الدخول — وهو مدرج بالفعل في الدليل.",
  },
  /* founder: "once I put them Won, I have to create for them a user and a
     password — they will not apply, I will create for them a user and a
     password." Both credentials are REQUIRED on the agent gate. */
  /* @deprecated ADR-057 moved the agent gate onto Qualified — superseded by
     qualifiedAgentHint. Kept verbatim: existing English is never edited. */
  wonAgentHint: {
    en: "Won creates the agent's account: they sign in with this email and password straight away — no registration to approve.",
    ar: "«مكسب» ينشئ حساب الوكيل: يسجّل الدخول بهذا البريد وكلمة المرور فورًا — دون طلب تسجيل ينتظر الموافقة.",
  },
  /* @deprecated ADR-059 — Qualified creates NOTHING for an agent now (founder
     1.3); the account is the separate action. Superseded by createAccountHint.
     Kept verbatim. */
  qualifiedAgentHint: {
    en: "Qualified creates the agent's account: they sign in with this email and password straight away — no registration to approve.",
    ar: "«مؤهَّل» ينشئ حساب الوكيل: يسجّل الدخول بهذا البريد وكلمة المرور فورًا — دون طلب تسجيل ينتظر الموافقة.",
  },
  /* still live — the partner-login form uses it; ADR-059 only moved WHERE it
     is asked for (§7.2b, never the Qualified gate) */
  passwordPh: { en: "Partner's sign-in password", ar: "كلمة مرور دخول الشريك" },
  agentPasswordPh: { en: "Agent's sign-in password", ar: "كلمة مرور دخول الوكيل" },
  /* @deprecated ADR-059 — the gate no longer creates anything from an email.
     Kept verbatim. */
  passwordHint: {
    en: "Email + password create the partner's account automatically.",
    ar: "البريد الإلكتروني وكلمة المرور ينشئان حساب الشريك تلقائيًا.",
  },
  date: { en: "Date", ar: "التاريخ" },
  time: { en: "Time", ar: "الوقت" },
  mode: { en: "Mode", ar: "طريقة الاجتماع" },
  reasonRequired: { en: "Reason (required)", ar: "السبب (مطلوب)" },
  dialedQuestion: {
    en: "Number dialed — which number(s) went unanswered?",
    ar: "الأرقام المتصل بها — أي رقم (أرقام) لم يُرد عليها؟",
  },
  dialedHint: {
    en: "New numbers are NOT required now — add them any time from “Alternative numbers”; doing so returns the card to Lead automatically.",
    ar: "الأرقام الجديدة غير مطلوبة الآن — أضفها في أي وقت من «أرقام بديلة»؛ وسيعيد ذلك البطاقة إلى «عميل محتمل» تلقائيًا.",
  },
  returnsToLead: {
    en: "The card returns to the Lead column.",
    ar: "تعود البطاقة إلى عمود «عميل محتمل».",
  },
  terminalCard: {
    en: "This card is {stage} — no further actions.",
    ar: "هذه البطاقة في مرحلة {stage} — لا مزيد من الإجراءات.",
  },
  meetingOutcome: { en: "Meeting outcome", ar: "نتيجة الاجتماع" },
  chooseOutcome: { en: "Choose an outcome…", ar: "اختر النتيجة…" },
  attended: { en: "Attended", ar: "تم الحضور" },
  cancelled: { en: "Cancelled", ar: "أُلغي" },
  delayed: { en: "Delayed", ar: "تأجّل" },
  saveNewDate: { en: "Save new date", ar: "حفظ الموعد الجديد" },
  destination: { en: "Destination", ar: "الوجهة" },
  chooseDestination: { en: "Choose a destination…", ar: "اختر الوجهة…" },
  confirmMoveTo: { en: "Confirm — move to {stage}", ar: "تأكيد — الانتقال إلى {stage}" },
  nextAction: { en: "Next action", ar: "الإجراء التالي" },
  chooseNextAction: { en: "Choose a next action…", ar: "اختر الإجراء التالي…" },
  saveMove: { en: "Save & move", ar: "حفظ ونقل" },
  /* founder: same-stage records — nothing moves, so "Save & move" would lie */
  saveRecord: { en: "Save record", ar: "حفظ السجل" },
} satisfies Record<string, Msg>;

/* ---------- admin edit / delete modals (manage.tsx) ---------- */

export const pManage = {
  prospectEyebrow: { en: "Partners & Agents · Edit", ar: "الشركاء والوكلاء · تعديل" },
  partnerEyebrow: { en: "Partners · Edit", ar: "الشركاء · تعديل" },
  /* §7.2b — the account modal's eyebrow */
  accountEyebrow: { en: "Partners & Agents · Account", ar: "الشركاء والوكلاء · الحساب" },
  createAccount: { en: "Create account", ar: "إنشاء الحساب" },
  yesDelete: { en: "Yes, delete", ar: "نعم، احذف" },
  keepIt: { en: "Keep it", ar: "الإبقاء عليه" },
} satisfies Record<string, Msg>;

/* ---------- add lead from a partner (PartnerAddLead) ---------- */

export const pLead = {
  addLead: { en: "Add lead", ar: "إضافة عميل محتمل" },
  newLeadTitle: { en: "New lead from this partner", ar: "عميل محتمل جديد من هذا الشريك" },
  type: { en: "Type", ar: "النوع" },
  assignToRep: { en: "Assign to rep (optional)", ar: "إسناد إلى مندوب (اختياري)" },
  unassignedPartnerLeads: { en: "Unassigned (Partner leads)", ar: "غير مُسند (عملاء الشركاء)" },
  saveLead: { en: "Save lead", ar: "حفظ العميل المحتمل" },
} satisfies Record<string, Msg>;

/* ---------- page <title>s ---------- */

export const pMeta = {
  pipelineTitle: { en: "Partners & Agents — B-Systems CRM", ar: "الشركاء والوكلاء — B-Systems CRM" },
  prospectTitle: { en: "Partner or agent — B-Systems CRM", ar: "شريك أو وكيل — B-Systems CRM" },
  directoryTitle: { en: "Partners — B-Systems CRM", ar: "الشركاء — B-Systems CRM" },
  partnerTitle: { en: "Partner — B-Systems CRM", ar: "شريك — B-Systems CRM" },
} satisfies Record<string, Msg>;
