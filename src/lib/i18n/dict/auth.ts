import type { Msg } from "@/lib/i18n/core";

/* auth-home surface strings: the consolidated /login page, the portal landing
   and sign-up, portal profile forms, portal stage group forms and the shared
   shell chrome (impersonation bar, nav burger, entity switcher). EN values are
   byte-identical to the original literals — the e2e suite asserts on them. */

export const login = {
  metaTitle: {
    en: "Sign in — ByteForce × B-Systems Sales Platform",
    ar: "تسجيل الدخول — منصة مبيعات ByteForce × B-Systems",
  },
  eyebrow: { en: "Sign in · /login", ar: "تسجيل الدخول · /login" },
  title: { en: "One door, every account.", ar: "باب واحد لكل الحسابات." },
  sub: {
    en: "Staff, partners and agents use the same credentials. We route you to what you have access to.",
    ar: "الموظفون والشركاء والوكلاء يستخدمون نفس بيانات الدخول، ونوجّهك مباشرة إلى ما تملك صلاحية الوصول إليه.",
  },
  errPending: {
    en: "Your registration is awaiting approval — the admin reviews new sign-ups.",
    ar: "طلب تسجيلك في انتظار الموافقة — يراجع المدير طلبات التسجيل الجديدة.",
  },
  errRejected: {
    en: "Your registration was declined. Contact B-Systems if you think this is a mistake.",
    ar: "تم رفض طلب تسجيلك. تواصل مع B-Systems إذا كنت تعتقد أن ذلك حدث عن طريق الخطأ.",
  },
  errHealth: {
    en: "The system database is not ready — open /api/health for the exact fix.",
    ar: "قاعدة بيانات النظام غير جاهزة — افتح ‎/api/health لمعرفة الحل الدقيق.",
  },
  errDefault: {
    en: "Wrong email/phone or password. Try again.",
    ar: "البريد الإلكتروني/الهاتف أو كلمة المرور غير صحيحة. حاول مرة أخرى.",
  },
  identifierLabel: { en: "Email or phone", ar: "البريد الإلكتروني أو الهاتف" },
  identifierPlaceholder: {
    en: "you@company.com or 01012345678",
    ar: "you@company.com أو 01012345678",
  },
  passwordLabel: { en: "Password", ar: "كلمة المرور" },
  submit: { en: "Sign in", ar: "تسجيل الدخول" },
  footNew: { en: "New partner sales rep?", ar: "مندوب مبيعات شريك جديد؟" },
  footLink: {
    en: "Apply to the partnership programme",
    ar: "قدِّم طلب الانضمام إلى برنامج الشراكة",
  },
  bbAEyebrow: { en: "Creative & performance", ar: "الإبداع والأداء" },
  bbALine: {
    en: "Campaigns, content and growth for bold brands.",
    ar: "حملات ومحتوى ونمو للعلامات الجريئة.",
  },
  bbBEyebrow: { en: "Systems before software", ar: "الأنظمة قبل البرمجيات" },
  bbBLine: {
    en: "Operations, ERP and the partner network that sells it.",
    ar: "العمليات وأنظمة ERP وشبكة الشركاء التي تبيعها.",
  },
} satisfies Record<string, Msg>;

export const portalLanding = {
  metaTitle: {
    en: "B-Systems Partnership Programme",
    ar: "برنامج شراكة B-Systems",
  },
  eyebrow: {
    en: "B-SYSTEMS · PARTNERSHIP PROGRAMME",
    ar: "B-SYSTEMS · برنامج الشراكة",
  },
  /* h1 splits around the highlighted brand span — Arabic puts the brand last,
     so its "after" half is empty. */
  welcomeBefore: { en: "Welcome to the ", ar: "مرحبًا بكم في برنامج شراكة " },
  welcomeAfter: { en: " Partnership Programme", ar: "" },
  tagline: {
    en: "Run your own pipeline. Close with our systems.",
    ar: "أدر خط مبيعاتك بنفسك، وأغلق صفقاتك بأنظمتنا.",
  },
  signUp: { en: "Sign up", ar: "إنشاء حساب" },
  logIn: { en: "Log in", ar: "تسجيل الدخول" },
} satisfies Record<string, Msg>;

/* Field labels + generic errors shared by the sign-up and profile forms. */
export const fields = {
  firstName: { en: "First name", ar: "الاسم الأول" },
  lastName: { en: "Last name", ar: "اسم العائلة" },
  address: { en: "Address", ar: "العنوان" },
  speciality: { en: "Speciality", ar: "التخصص" },
  password: { en: "Password", ar: "كلمة المرور" },
  somethingWentWrong: { en: "Something went wrong", ar: "حدث خطأ ما" },
} satisfies Record<string, Msg>;

export const signup = {
  metaTitle: {
    en: "Sign up — B-Systems Partnership Programme",
    ar: "إنشاء حساب — برنامج شراكة B-Systems",
  },
  eyebrow: { en: "Partnership Programme", ar: "برنامج الشراكة" },
  title: { en: "Sign up", ar: "إنشاء حساب" },
  successBanner: {
    en: "Request received — the admin reviews new registrations. You'll be able to sign in with your email or phone once you're approved.",
    ar: "تم استلام طلبك — يراجع المدير طلبات التسجيل الجديدة. ستتمكن من تسجيل الدخول ببريدك الإلكتروني أو رقم هاتفك بعد الموافقة.",
  },
  alreadyApproved: { en: "Already approved?", ar: "تمت الموافقة عليك بالفعل؟" },
  signIn: { en: "Sign in", ar: "تسجيل الدخول" },
  phone: { en: "Phone number", ar: "رقم الهاتف" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  emailHint: {
    en: "You'll sign in with your email or your phone.",
    ar: "ستسجّل الدخول ببريدك الإلكتروني أو رقم هاتفك.",
  },
  specialityPlaceholder: { en: "e.g. ERP consulting", ar: "مثال: استشارات ERP" },
  cvTitle: {
    en: "CV (.pdf / .doc / .docx, ≤ 10 MB)",
    ar: "السيرة الذاتية (‎.pdf / .doc / .docx، بحد أقصى 10 ميجابايت)",
  },
  confirmPassword: { en: "Confirm password", ar: "تأكيد كلمة المرور" },
  submit: { en: "Sign up", ar: "إنشاء حساب" },
} satisfies Record<string, Msg>;

export const profile = {
  editProfile: { en: "Edit profile", ar: "تعديل الملف الشخصي" },
  save: { en: "Save", ar: "حفظ" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  uploadFailed: { en: "Upload failed", ar: "فشل الرفع" },
  replaceCvTitle: {
    en: "Replace CV (.pdf / .doc / .docx, ≤ 10 MB)",
    ar: "استبدال السيرة الذاتية (‎.pdf / .doc / .docx، بحد أقصى 10 ميجابايت)",
  },
  uploadNewCv: { en: "Upload new CV", ar: "رفع سيرة ذاتية جديدة" },
  passwordUpdated: { en: "Password updated.", ar: "تم تحديث كلمة المرور." },
  currentPassword: { en: "Current password", ar: "كلمة المرور الحالية" },
  newPassword: {
    en: "New password (min 8 characters)",
    ar: "كلمة المرور الجديدة (8 أحرف على الأقل)",
  },
  changePassword: { en: "Change password", ar: "تغيير كلمة المرور" },
} satisfies Record<string, Msg>;

/* §8.2 portal stage group forms (follow-up / meeting / proposal / lost). */
export const stageForms = {
  followUpDate: { en: "Follow-up date", ar: "تاريخ المتابعة" },
  /* UNREFERENCED since ADR-061 (founder: follow-ups are date-only) — kept per
     house convention: existing keys are never deleted, EN stays byte-identical. */
  followUpTime: { en: "Follow-up time", ar: "وقت المتابعة" },
  method: { en: "Method", ar: "الوسيلة" },
  methodCall: { en: "Call", ar: "اتصال" },
  methodMessage: { en: "Message", ar: "رسالة" },
  methodVisit: { en: "Visit", ar: "زيارة" },
  followingUpWith: { en: "Following up with", ar: "المتابعة مع" },
  contactPersonPlaceholder: { en: "Contact person", ar: "جهة الاتصال" },
  arranged: { en: "Arranged?", ar: "تم الترتيب؟" },
  date: { en: "Date", ar: "التاريخ" },
  time: { en: "Time", ar: "الوقت" },
  mode: { en: "Mode", ar: "طريقة الاجتماع" },
  online: { en: "Online", ar: "أونلاين" },
  offline: { en: "Offline", ar: "حضوري" },
  withLabel: { en: "With", ar: "مع" },
  attendeesPlaceholder: { en: "Attendees", ar: "الحاضرون" },
  technicalSupport: { en: "Technical support", ar: "الدعم الفني" },
  service: { en: "Service", ar: "الخدمة" },
  estimatedValue: { en: "Estimated value (EGP)", ar: "القيمة التقديرية (EGP)" },
  proposalHint: {
    en: "Save the proposal, then use “Mark as sent” — sending moves the card automatically.",
    ar: "احفظ العرض ثم استخدم «تحديد كمُرسَل» — الإرسال ينقل البطاقة تلقائيًا.",
  },
  reasonRequired: { en: "Reason (required)", ar: "السبب (مطلوب)" },
} satisfies Record<string, Msg>;

/* Shared shell chrome. */
export const shell = {
  impersonating: {
    en: "Impersonating {name} — you are seeing exactly what they see",
    ar: "تتصفح باسم {name} — أنت ترى تمامًا ما يراه هذا الحساب",
  },
  backToAdmin: { en: "Back to admin", ar: "العودة إلى حساب المدير" },
  openMenu: { en: "Open menu", ar: "فتح القائمة" },
  closeMenu: { en: "Close menu", ar: "إغلاق القائمة" },
  /* founder (screenshot: "Registrations" clipped to "Regi"): the desktop nav
     strip is a slider — chevrons page it when it overflows */
  navScrollBack: { en: "Scroll navigation backward", ar: "تمرير شريط التنقل للخلف" },
  navScrollForward: { en: "Scroll navigation forward", ar: "تمرير شريط التنقل للأمام" },
  switchCompany: { en: "Switch company", ar: "تبديل الشركة" },
  /* module switcher segments (ADR-054) — the two CRMs keep their literal brand
     names; the modules are words, so they translate. Uppercase EN matches the
     brand segments; Arabic has no case. */
  switchAccounting: { en: "ACCOUNTING", ar: "الحسابات" },
  switchVault: { en: "VAULT", ar: "الخزنة" },
} satisfies Record<string, Msg>;
