import type { Msg } from "@/lib/i18n/core";

/* Shared lead chat (LeadChat) strings. EN values are byte-identical to the
   original literals — the e2e suite asserts on them. */

export const chat = {
  title: { en: "Team chat", ar: "محادثة الفريق" },
  empty: {
    en: "No messages yet — ask a question or leave context for the team.",
    ar: "لا توجد رسائل بعد — اطرح سؤالًا أو اترك ملاحظة للفريق.",
  },
  sendFailed: { en: "Could not send", ar: "تعذّر الإرسال" },
  mentionListLabel: { en: "Mention a teammate", ar: "الإشارة إلى زميل" },
  composerPlaceholder: {
    en: "Message the team — type @ to mention someone",
    ar: "راسل الفريق — اكتب @ للإشارة إلى شخص",
  },
  composerLabel: { en: "Message the team", ar: "راسل الفريق" },
  enterHint: {
    en: "Enter sends · Shift+Enter for a new line",
    ar: "Enter للإرسال · Shift+Enter لسطر جديد",
  },
  send: { en: "Send", ar: "إرسال" },
} satisfies Record<string, Msg>;
