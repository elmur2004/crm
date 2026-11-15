import type { Msg } from "@/lib/i18n/core";

/* ADR-103 — the Users app (/users): the B-Systems admin's "All users" and
   everybody's "My account". The field labels it shares with the admin's user
   editor and the agent sign-up are imported from those dicts by the screens
   themselves, so one field never has two names. */

export const usersApp = {
  /* the page */
  titleMe: { en: "My account", ar: "حسابي" },
  subAll: {
    en: "Every account on the platform, in both companies — add, edit, remove or open any of them.",
    ar: "كل حسابات المنصة في الشركتين — أضف أي حساب أو عدّله أو أزِله أو افتحه.",
  },
  subMe: {
    en: "Your name, how you sign in, and your password.",
    ar: "اسمك، وطريقة تسجيل دخولك، وكلمة مرورك.",
  },
  tabsAria: { en: "Users views", ar: "عروض المستخدمين" },
  tabAll: { en: "All users", ar: "كل المستخدمين" },
  tabMe: { en: "My account", ar: "حسابي" },
  impersonationFailed: {
    en: "That account could not be opened — it may have been removed or deactivated.",
    ar: "تعذّر فتح هذا الحساب — ربما أُزيل أو أُوقف.",
  },

  /* My account */
  accessLabel: { en: "Your access", ar: "صلاحياتك" },
  accessHint: {
    en: "Only the admin can change what you can open.",
    ar: "المدير وحده يستطيع تغيير ما يمكنك فتحه.",
  },
  detailsTitle: { en: "Your details", ar: "بياناتك" },
  signInHint: {
    en: "You sign in with your email or your phone — keep at least one of them.",
    ar: "تسجّل الدخول ببريدك الإلكتروني أو رقم هاتفك — احتفظ بواحد منهما على الأقل.",
  },
  agentPhoneHint: {
    en: "You sign in with your phone, so it cannot be left empty.",
    ar: "تسجّل الدخول برقم هاتفك، لذلك لا يمكن تركه فارغًا.",
  },
  partnerNameHint: {
    en: "Your account carries your company's name — ask the admin to change it.",
    ar: "يحمل حسابك اسم شركتك — اطلب من المدير تغييره.",
  },
  pinnedEmailHint: {
    en: "The main admin's email is fixed — the system recognises the admin by it.",
    ar: "البريد الإلكتروني للمدير الرئيسي ثابت — يتعرّف النظام على المدير من خلاله.",
  },
  save: { en: "Save changes", ar: "حفظ التغييرات" },
  saved: { en: "Saved.", ar: "تم الحفظ." },
  passwordTitle: { en: "Password", ar: "كلمة المرور" },
  cvTitle: { en: "CV", ar: "السيرة الذاتية" },
  noCv: { en: "No CV on file yet.", ar: "لا توجد سيرة ذاتية محفوظة بعد." },
  companyTitle: { en: "Your company", ar: "شركتك" },
} satisfies Record<string, Msg>;

/* ADR-105 — mass assign, on the admin's "All users" view: a person's row opens
   the leads he could be given, from both CRMs, to tick and hand over at once. */
export const massAssign = {
  rowButton: { en: "Assign leads", ar: "إسناد عملاء محتملين" },
  title: { en: "Assign leads to {name}", ar: "إسناد عملاء محتملين إلى {name}" },
  sub: {
    en: "Tick the leads {name} should work, then hand them over in one go. Each lead's history records it, and {name} gets one notification.",
    ar: "حدّد العملاء المحتملين الذين سيعمل عليهم {name}، ثم سلّمهم دفعة واحدة. يُسجَّل ذلك في سجل كل عميل محتمل، ويصل إلى {name} إشعار واحد.",
  },
  close: { en: "Close", ar: "إغلاق" },
  filtersAria: { en: "Which leads to show", ar: "العملاء المحتملون المعروضون" },
  crm: { en: "CRM", ar: "إدارة العملاء" },
  bothCrms: { en: "Both CRMs", ar: "كلتا الشركتين" },
  owner: { en: "Owner now", ar: "المالك الحالي" },
  ownerFree: { en: "Unassigned or yours", ar: "غير مُسند أو لك" },
  ownerUnassigned: { en: "Unassigned", ar: "غير مُسند" },
  ownerMine: { en: "Yours", ar: "لك" },
  ownerAny: { en: "Anyone", ar: "أي شخص" },
  ownerCount: { en: "{name} ({count})", ar: "{name} ({count})" },
  stage: { en: "Stage", ar: "المرحلة" },
  stageOpen: { en: "Open (not won or lost)", ar: "مفتوحة (غير مكسوبة ولا خاسرة)" },
  stageAny: { en: "Any stage", ar: "أي مرحلة" },
  search: { en: "Search", ar: "بحث" },
  searchPlaceholder: { en: "Name, company or number", ar: "الاسم أو الشركة أو الرقم" },
  apply: { en: "Apply", ar: "تطبيق" },
  clear: { en: "Clear filters", ar: "مسح الفلاتر" },
  thLead: { en: "Lead", ar: "العميل المحتمل" },
  thAdded: { en: "Added", ar: "تاريخ الإضافة" },
  you: { en: "You", ar: "أنت" },
  showing: { en: "{n} leads", ar: "{n} من العملاء المحتملين" },
  showingOne: { en: "1 lead", ar: "عميل محتمل واحد" },
  capped: {
    en: "Showing the newest {shown} of {total}. Hand these over and the next ones appear.",
    ar: "يُعرض أحدث {shown} من أصل {total}. سلّم هؤلاء وسيظهر الباقون.",
  },
  empty: { en: "No leads match these filters.", ar: "لا يوجد عملاء محتملون يطابقون هذه الفلاتر." },
  selectAll: { en: "Select every lead shown", ar: "تحديد كل العملاء المحتملين المعروضين" },
  selectRow: { en: "Select {name}", ar: "تحديد {name}" },
  selected: { en: "{n} selected", ar: "تم تحديد {n}" },
  submitNone: { en: "Assign to {name}", ar: "إسناد إلى {name}" },
  submitOne: { en: "Assign 1 lead to {name}", ar: "إسناد عميل محتمل واحد إلى {name}" },
  submitMany: { en: "Assign {n} leads to {name}", ar: "إسناد {n} من العملاء المحتملين إلى {name}" },
  working: { en: "Assigning…", ar: "جارٍ الإسناد…" },
  doneOne: { en: "1 lead is now {name}'s.", ar: "أصبح عميل محتمل واحد لدى {name}." },
  doneMany: { en: "{n} leads are now {name}'s.", ar: "أصبح {n} من العملاء المحتملين لدى {name}." },
  undoHint: {
    en: "Changed your mind? Undo, at the bottom of the screen, gives every lead back to its previous owner.",
    ar: "غيّرت رأيك؟ زر التراجع أسفل الشاشة يعيد كل عميل محتمل إلى مالكه السابق.",
  },
  notFound: { en: "That account no longer exists.", ar: "هذا الحساب لم يعد موجودًا." },
  inactive: {
    en: "{name}'s account is removed or still awaiting approval — reactivate it before giving it leads.",
    ar: "حساب {name} مُزال أو ما زال بانتظار الموافقة — أعد تفعيله قبل إسناد عملاء محتملين إليه.",
  },
  cannotOwn: {
    en: "{name} can't be given leads — only sales, agents, partners and ByteForce staff can own one.",
    ar: "لا يمكن إسناد عملاء محتملين إلى {name} — فقط المبيعات والوكلاء والشركاء وفريق ByteForce يمكنهم امتلاكهم.",
  },
} satisfies Record<string, Msg>;
