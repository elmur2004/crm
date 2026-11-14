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
