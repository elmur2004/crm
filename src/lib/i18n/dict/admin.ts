import type { Msg } from "@/lib/i18n/core";

/* B-Systems admin surface dictionary (won-leads, statements, payments, users,
   registrations, agents, profile, notifications bell). EN strings are
   byte-identical to the original literals — the e2e suite asserts on them.
   Brand names (B-Systems, ByteForce) and codes stay untranslated. */

export const common = {
  cancel: { en: "Cancel", ar: "إلغاء" },
  somethingWentWrong: { en: "Something went wrong", ar: "حدث خطأ ما" },
  uploadFailed: { en: "Upload failed", ar: "فشل الرفع" },
  paid: { en: "Paid", ar: "مدفوع" },
  pending: { en: "Pending", ar: "قيد الانتظار" },
  proofLink: { en: "proof", ar: "الإثبات" },
  openPrintableStatement: {
    en: "Open the printable statement",
    ar: "فتح الكشف القابل للطباعة",
  },
  /* joiner rendered between a money value and its commission share */
  commissionSep: { en: " · commission ", ar: " · العمولة " },
  labelValue: { en: "Value:", ar: "القيمة:" },
  labelTotalCommission: { en: "Total commission:", ar: "إجمالي العمولة:" },
  labelNumber: { en: "Number:", ar: "الرقم:" },
  labelEmail: { en: "Email:", ar: "البريد الإلكتروني:" },
  labelCompany: { en: "Company:", ar: "الشركة:" },
  labelPhone: { en: "Phone:", ar: "الهاتف:" },
  labelAddress: { en: "Address:", ar: "العنوان:" },
  thName: { en: "Name", ar: "الاسم" },
  thEmail: { en: "Email", ar: "البريد الإلكتروني" },
  thPhone: { en: "Phone", ar: "الهاتف" },
  thEmailOrPhone: { en: "Email / phone", ar: "البريد الإلكتروني / الهاتف" },
  thCode: { en: "Code", ar: "الكود" },
  thNumber: { en: "Number", ar: "الرقم" },
  thClient: { en: "Client", ar: "العميل" },
  thMilestone: { en: "Milestone", ar: "المرحلة" },
  thAmount: { en: "Amount", ar: "المبلغ" },
  thExpected: { en: "Expected", ar: "المتوقع" },
  thStatus: { en: "Status", ar: "الحالة" },
  thCloser: { en: "Closer", ar: "مسؤول الإغلاق" },
  thCreated: { en: "Created", ar: "تاريخ الإنشاء" },
  badgeDeactivated: { en: "Deactivated", ar: "معطّل" },
} satisfies Record<string, Msg>;

export const wonLeads = {
  metaList: { en: "Won Leads — B-Systems CRM", ar: "العملاء المكسوبون — B-Systems CRM" },
  metaDetail: { en: "Won Lead — B-Systems CRM", ar: "عميل مكسوب — B-Systems CRM" },
  eyebrowList: { en: "B-SYSTEMS · WON LEADS", ar: "B-SYSTEMS · العملاء المكسوبون" },
  eyebrowDetail: { en: "B-SYSTEMS · WON LEAD", ar: "B-SYSTEMS · عميل مكسوب" },
  title: { en: "Won Leads", ar: "العملاء المكسوبون" },
  empty: { en: "No won leads yet.", ar: "لا يوجد عملاء مكسوبون بعد." },
  milestoneProgressAria: { en: "Milestone progress", ar: "تقدّم المراحل" },
  labelCloser: { en: "Closer:", ar: "مسؤول الإغلاق:" },
  labelMilestones: { en: "Milestones:", ar: "المراحل:" },
  editLead: { en: "Edit lead", ar: "تعديل العميل" },
  lockedSuffix: { en: " (locked)", ar: " (مقفلة)" },
  /* " · due {date}" — the word before the milestone's expected-end date */
  dueWord: { en: "due", ar: "تستحق" },
  backToWonLeads: { en: "Back to Won Leads", ar: "العودة إلى العملاء المكسوبين" },
  labelEstimatedValue: { en: "Estimated value:", ar: "القيمة التقديرية:" },
  labelContractDate: { en: "Contract date:", ar: "تاريخ التعاقد:" },
  labelIndustry: { en: "Industry:", ar: "المجال:" },
  closerFallbackAdmin: { en: "Admin", ar: "المدير" },
  openLeadRecord: { en: "Open the lead record", ar: "فتح سجل العميل" },
  documents: { en: "Documents", ar: "المستندات" },
  noDocuments: { en: "No documents uploaded yet.", ar: "لم تُرفع مستندات بعد." },
  attachmentProposal: { en: "Proposal", ar: "العرض" },
  attachmentContract: { en: "Contract", ar: "العقد" },
  milestonesHeading: { en: "Milestones", ar: "المراحل" },
  milestoneFallback: { en: "Milestone {n}", ar: "المرحلة {n}" },
  checkedHint: {
    en: "Checked milestones appear under Statements → Waiting to be paid out.",
    ar: "تظهر المراحل المُحدَّدة في كشوف الحساب ضمن «في انتظار الصرف».",
  },
  /* client widgets (wonLeads.tsx) */
  milestoneCompletedAria: { en: "Milestone completed: {label}", ar: "اكتملت المرحلة: {label}" },
  toggleFailed: { en: "Failed", ar: "فشل" },
  documentLabel: { en: "Document", ar: "المستند" },
  optionProposalPdf: { en: "Proposal PDF", ar: "عرض PDF" },
  optionContractPdf: { en: "Contract PDF", ar: "عقد PDF" },
  fileLabel: { en: "File (.pdf / .doc / .docx)", ar: "الملف (.pdf / .doc / .docx)" },
  upload: { en: "Upload", ar: "رفع" },
} satisfies Record<string, Msg>;

export const statements = {
  metaList: { en: "Statements — B-Systems CRM", ar: "كشوف الحساب — B-Systems CRM" },
  metaDocument: { en: "Statement — B-Systems CRM", ar: "كشف الحساب — B-Systems CRM" },
  eyebrowList: { en: "B-SYSTEMS · STATEMENTS", ar: "B-SYSTEMS · كشوف الحساب" },
  /* "B-SYSTEMS · STATEMENT {code}" — the code is appended untranslated */
  eyebrowDocument: { en: "B-SYSTEMS · STATEMENT", ar: "B-SYSTEMS · كشف حساب" },
  title: { en: "Statements", ar: "كشوف الحساب" },
  waitingHeading: { en: "Waiting to be paid out", ar: "في انتظار الصرف" },
  waitingEmpty: {
    en: "Nothing waiting — checked milestones without a statement appear here.",
    ar: "لا شيء في الانتظار — تظهر هنا المراحل المُحدَّدة التي لا كشف لها.",
  },
  thCompany: { en: "Company", ar: "الشركة" },
  thCommission: { en: "Commission", ar: "العمولة" },
  statementHeading: { en: "Statement", ar: "كشف الحساب" },
  statementsEmpty: { en: "No statements created yet.", ar: "لم تُنشأ كشوف بعد." },
  thAdjustments: { en: "Adjustments", ar: "التسويات" },
  proofFileMissing: { en: "proof file missing", ar: "ملف الإثبات مفقود" },
  replaceProof: { en: "Replace proof", ar: "استبدال الإثبات" },
  reuploadProof: { en: "Re-upload proof", ar: "إعادة رفع الإثبات" },
  /* client widgets (statements.tsx) */
  generate: { en: "Generate", ar: "تجهيز كشف" },
  newStatement: { en: "New statement", ar: "كشف جديد" },
  fieldClient: { en: "Client", ar: "العميل" },
  fieldMilestoneName: { en: "Milestone name", ar: "اسم المرحلة" },
  fieldMilestoneValueEgp: { en: "Milestone value (EGP)", ar: "قيمة المرحلة (EGP)" },
  fieldPercentOfMilestone: { en: "% of milestone", ar: "% من المرحلة" },
  fieldAmountEgp: { en: "Amount (EGP)", ar: "المبلغ (EGP)" },
  fieldAdjustmentsEgp: { en: "Adjustments (EGP, ±)", ar: "التسويات (EGP، ±)" },
  fieldExpectedPaymentDate: { en: "Expected payment date", ar: "تاريخ الدفع المتوقع" },
  createStatement: { en: "Create statement", ar: "إنشاء الكشف" },
  newProofAria: { en: "New payment proof image", ar: "صورة إثبات دفع جديدة" },
  proofAria: { en: "Payment proof image", ar: "صورة إثبات الدفع" },
  saveProof: { en: "Save proof", ar: "حفظ الإثبات" },
  markPaid: { en: "Mark paid", ar: "تحديد كمدفوع" },
  /* printable document */
  back: { en: "Back", ar: "رجوع" },
  printStatement: { en: "Print statement", ar: "طباعة الكشف" },
  commissionStatement: { en: "Commission statement", ar: "كشف عمولة" },
  /* "Issued {date}" / "Expected payment {date}" / "Paid on {date}" */
  issuedWord: { en: "Issued", ar: "صدر في" },
  expectedPaymentWord: { en: "Expected payment", ar: "الدفع المتوقع" },
  paidOnWord: { en: "Paid on", ar: "دُفع في" },
  paidBy: { en: "Paid by", ar: "الجهة الدافعة" },
  paidTo: { en: "Paid to", ar: "المستفيد" },
  client: { en: "Client", ar: "العميل" },
  thDescription: { en: "Description", ar: "الوصف" },
  thMilestoneValue: { en: "Milestone value", ar: "قيمة المرحلة" },
  thShare: { en: "Share", ar: "النسبة" },
  totalPayable: { en: "Total payable", ar: "إجمالي المستحق" },
  proofOnFile: {
    en: "Payment proof on file ({f})",
    ar: "إثبات الدفع محفوظ ({f})",
  },
  footerPlatform: { en: "B-Systems Sales Platform", ar: "منصة مبيعات B-Systems" },
} satisfies Record<string, Msg>;

export const payments = {
  meta: { en: "Payments — B-Systems CRM", ar: "المدفوعات — B-Systems CRM" },
  eyebrow: { en: "B-SYSTEMS · PAYMENTS", ar: "B-SYSTEMS · المدفوعات" },
  title: { en: "Payments", ar: "المدفوعات" },
  empty: {
    en: "No payments yet — when the admin creates a statement for one of your milestones it appears here as pending.",
    ar: "لا مدفوعات بعد — عندما يُنشئ المدير كشفًا لإحدى مراحلك يظهر هنا بحالة قيد الانتظار.",
  },
  proofMissingAsk: {
    en: "proof file missing — ask the admin to re-upload it",
    ar: "ملف الإثبات مفقود — اطلب من المدير إعادة رفعه",
  },
} satisfies Record<string, Msg>;

export const usersAdmin = {
  meta: { en: "Users — B-Systems CRM", ar: "المستخدمون — B-Systems CRM" },
  eyebrow: { en: "B-SYSTEMS · USERS", ar: "B-SYSTEMS · المستخدمون" },
  title: { en: "Users", ar: "المستخدمون" },
  thPassword: { en: "Password", ar: "كلمة المرور" },
  thAccess: { en: "Access", ar: "الصلاحيات" },
  thActions: { en: "Actions", ar: "إجراءات" },
  impersonate: { en: "Impersonate", ar: "الدخول بحسابه" },
  impersonateFootnote: {
    en: "Impersonating signs you into that account — log out and sign back in to return to your admin account. Every impersonation is recorded in the activity log.",
    ar: "الدخول بحساب مستخدم يسجّل دخولك إلى حسابه مباشرة — سجّل الخروج ثم ادخل مجددًا للعودة إلى حساب المدير. كل عملية دخول بحساب آخر تُسجَّل في سجل النشاط.",
  },
  /* client widgets (users.tsx) */
  edit: { en: "Edit", ar: "تعديل" },
  modalEyebrowEdit: { en: "Users · Edit", ar: "المستخدمون · تعديل" },
  closeAria: { en: "Close", ar: "إغلاق" },
  fieldName: { en: "Name", ar: "الاسم" },
  fieldEmail: { en: "Email", ar: "البريد الإلكتروني" },
  fieldPhone: { en: "Phone", ar: "الهاتف" },
  fieldNewPassword: { en: "New password", ar: "كلمة مرور جديدة" },
  pinnedPasswordHint: {
    en: "The admin password is pinned — change it via the ADMIN_PASSWORD environment variable.",
    ar: "كلمة مرور المدير مثبّتة — غيّرها عبر متغير البيئة ADMIN_PASSWORD.",
  },
  keepCurrentPlaceholder: {
    en: "Leave empty to keep the current one",
    ar: "اتركه فارغًا للإبقاء على الحالية",
  },
  visibleOnceSetHint: {
    en: "Visible in the Password column once set.",
    ar: "تظهر في عمود كلمة المرور بعد تعيينها.",
  },
  accessLegend: { en: "Access", ar: "الصلاحيات" },
  changesApply: { en: "Changes apply immediately.", ar: "تسري التغييرات فورًا." },
  saveUser: { en: "Save user", ar: "حفظ المستخدم" },
  addUser: { en: "Add user", ar: "إضافة مستخدم" },
  newUser: { en: "New user", ar: "مستخدم جديد" },
  fieldPasswordMin8: { en: "Password (min 8)", ar: "كلمة المرور (8 على الأقل)" },
  create: { en: "Create", ar: "إنشاء" },
  remove: { en: "Remove", ar: "إزالة" },
  reactivate: { en: "Reactivate", ar: "إعادة تفعيل" },
} satisfies Record<string, Msg>;

/** Role badges on the Users page (EN byte-identical to the old ROLE_LABELS). */
export const roleBadges: Record<string, Msg> = {
  bsystems_admin: { en: "Admin", ar: "مدير" },
  bsystems_sales: { en: "Internal sales", ar: "مبيعات داخلية" },
  bsystems_agent: { en: "Agent", ar: "وكيل" },
  bsystems_partner: { en: "Partner", ar: "شريك" },
  byteforce_staff: { en: "ByteForce", ar: "ByteForce" },
};

/** Role labels on the Registrations page (byteforce differs: "ByteForce staff"). */
export const regRoleBadges: Record<string, Msg> = {
  bsystems_admin: { en: "Admin", ar: "مدير" },
  bsystems_sales: { en: "Internal sales", ar: "مبيعات داخلية" },
  bsystems_agent: { en: "Agent", ar: "وكيل" },
  bsystems_partner: { en: "Partner", ar: "شريك" },
  byteforce_staff: { en: "ByteForce staff", ar: "فريق ByteForce" },
};

/** Assignable-role checkbox labels in the user create/edit forms. */
export const assignableRoleLabels: Record<string, Msg> = {
  bsystems_admin: { en: "B-Systems admin", ar: "مدير B-Systems" },
  bsystems_sales: { en: "B-Systems internal sales", ar: "مبيعات B-Systems الداخلية" },
  bsystems_agent: { en: "B-Systems agent", ar: "وكيل B-Systems" },
  bsystems_partner: { en: "B-Systems partner", ar: "شريك B-Systems" },
  byteforce_staff: { en: "ByteForce staff", ar: "فريق ByteForce" },
};

export const registrations = {
  meta: { en: "Registrations — B-Systems CRM", ar: "التسجيلات — B-Systems CRM" },
  eyebrow: { en: "B-SYSTEMS · REGISTRATIONS", ar: "B-SYSTEMS · التسجيلات" },
  title: { en: "Registrations", ar: "التسجيلات" },
  awaitingApproval: { en: "Awaiting approval", ar: "في انتظار الموافقة" },
  pendingEmpty: {
    en: "No pending requests — new sign-ups land here for review.",
    ar: "لا توجد طلبات معلّقة — تصل التسجيلات الجديدة هنا للمراجعة.",
  },
  thRequested: { en: "Requested", ar: "تاريخ الطلب" },
  thDecision: { en: "Decision", ar: "القرار" },
  everyoneHeading: { en: "Everyone on the system", ar: "جميع المسجّلين في النظام" },
  thType: { en: "Type", ar: "النوع" },
  thRegistered: { en: "Registered", ar: "تاريخ التسجيل" },
  badgeDeclined: { en: "Declined", ar: "مرفوض" },
  statusActive: { en: "Active", ar: "نشط" },
  /* client widgets (registrations.tsx) */
  approve: { en: "Approve", ar: "قبول" },
  reject: { en: "Reject", ar: "رفض" },
} satisfies Record<string, Msg>;

export const agents = {
  meta: { en: "Agents — B-Systems CRM", ar: "الوكلاء — B-Systems CRM" },
  eyebrow: { en: "B-SYSTEMS · AGENTS", ar: "B-SYSTEMS · الوكلاء" },
  title: { en: "Agents", ar: "الوكلاء" },
  viewAria: { en: "View", ar: "طريقة العرض" },
  viewDetailed: { en: "Detailed", ar: "تفصيلي" },
  viewPipeline: { en: "Pipeline", ar: "مسار المبيعات" },
  empty: { en: "No agents have signed up yet.", ar: "لم يسجّل أي وكيل بعد." },
  /* "Joined {date}" */
  joinedWord: { en: "Joined", ar: "انضم في" },
  noLeadsYet: { en: "No leads yet.", ar: "لا يوجد عملاء محتملون بعد." },
  thLead: { en: "Lead", ar: "العميل المحتمل" },
  thStage: { en: "Stage", ar: "المرحلة" },
} satisfies Record<string, Msg>;

export const profile = {
  meta: { en: "Profile — B-Systems CRM", ar: "الملف الشخصي — B-Systems CRM" },
  eyebrow: { en: "B-SYSTEMS · PROFILE", ar: "B-SYSTEMS · الملف الشخصي" },
  title: { en: "Profile", ar: "الملف الشخصي" },
  labelSpeciality: { en: "Speciality:", ar: "التخصص:" },
  labelCv: { en: "CV:", ar: "السيرة الذاتية:" },
  labelKeyPerson: { en: "Key person:", ar: "الشخص المسؤول:" },
  labelBusinessActivity: { en: "Business activity:", ar: "النشاط التجاري:" },
  labelPartnerSince: { en: "Partner since:", ar: "شريك منذ:" },
  conversionHint: {
    en: "These details come from the partnership conversion — ask the B-Systems admin to correct anything.",
    ar: "هذه البيانات واردة من تحويل الشراكة — اطلب من مدير B-Systems تصحيح أي شيء.",
  },
  noPartnerRecord: {
    en: "No partner record is linked to this account.",
    ar: "لا يوجد سجل شريك مرتبط بهذا الحساب.",
  },
} satisfies Record<string, Msg>;

export const bell = {
  /* aria-label = notifications + optional " ({n} unread)" suffix */
  notificationsAria: { en: "Notifications", ar: "الإشعارات" },
  unreadSuffix: { en: " ({n} unread)", ar: " ({n} غير مقروء)" },
  empty: { en: "No notifications yet.", ar: "لا توجد إشعارات بعد." },
} satisfies Record<string, Msg>;
