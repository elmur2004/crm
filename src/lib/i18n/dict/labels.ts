import type { Locale, Msg } from "@/lib/i18n/core";
import {
  LEAD_TYPE_LABELS,
  OWNER_TYPE_LABELS,
  STAGE_LABELS,
  type LeadType,
  type OwnerType,
} from "@/lib/pipeline-engine/constants";

/* Shared render-side label translations. The ENGINE keeps its English label
   constants (tests + logs depend on them); components translate at render via
   these helpers. EN strings are byte-identical to the constants. */

export const stageMsgs: Record<string, Msg> = {
  new: { en: "New", ar: "جديد" },
  lead: { en: "Lead", ar: "عميل محتمل" },
  didnt_answer: { en: "Didn't Answer", ar: "لم يرد" },
  following_up: { en: "Following Up", ar: "متابعة" },
  meeting_setting: { en: "Meeting Setting", ar: "تحديد اجتماع" },
  sending_proposal: { en: "Sending Proposals", ar: "إرسال العروض" },
  negotiation: { en: "Negotiation", ar: "تفاوض" },
  /* agent pipeline (ADR-057) — the founder's own two words */
  contacted: { en: "Contacted", ar: "تم التواصل" },
  qualified: { en: "Qualified", ar: "مؤهَّل" },
  won: { en: "Won", ar: "مكسب" },
  lost: { en: "Lost", ar: "خسارة" },
};

export const leadTypeMsgs: Record<LeadType, Msg> = {
  cold_call: { en: "Cold call", ar: "اتصال مباشر" },
  event_data: { en: "Event data", ar: "بيانات فعالية" },
  personal_connection: { en: "Personal connection", ar: "معرفة شخصية" },
  campaign_lead: { en: "Campaign lead", ar: "عميل من حملة" },
  /* founder: "organically they just show up" — a lead that arrived on its own */
  organic: { en: "Organic", ar: "عميل وارد" },
};

/* Founder: the same-stage record buttons ("another follow-up", "the response
   date", "reschedule") — one label map shared by all three action panels, so
   every pipeline that offers the action offers the same wording. */
export const sameStageActionMsgs: Record<string, Msg> = {
  follow_up_again: { en: "Log another follow-up", ar: "تسجيل متابعة أخرى" },
  negotiation_follow_up: { en: "Set the response date", ar: "تحديد موعد الرد" },
  reschedule_meeting: { en: "Reschedule the meeting", ar: "إعادة جدولة الاجتماع" },
};

export function sameStageActionLabel(locale: Locale, action: string): string {
  return sameStageActionMsgs[action]?.[locale] ?? action;
}

export const ownerTypeMsgs: Record<OwnerType, Msg> = {
  internal: { en: "Internal", ar: "داخلي" },
  agent: { en: "Agents", ar: "وكلاء" },
  partner: { en: "Partners", ar: "شركاء" },
  admin: { en: "Admins", ar: "مديرون" },
};

/** Stage label in the given locale — falls back to the engine's English map
    for any key without a translation. */
export function stageLabel(locale: Locale, stage: string): string {
  return stageMsgs[stage]?.[locale] ?? STAGE_LABELS[stage] ?? stage;
}

export function leadTypeLabel(locale: Locale, type: string): string {
  return leadTypeMsgs[type as LeadType]?.[locale] ?? LEAD_TYPE_LABELS[type as LeadType] ?? type;
}

export function ownerTypeLabel(locale: Locale, owner: string): string {
  return (
    ownerTypeMsgs[owner as OwnerType]?.[locale] ?? OWNER_TYPE_LABELS[owner as OwnerType] ?? owner
  );
}
