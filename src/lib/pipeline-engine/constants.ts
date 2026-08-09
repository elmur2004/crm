/* Single source of truth for every enum-like string in the product. The Prisma
   columns are plain String (ADR-002 — SQLite has no enums); these unions + the Zod
   schemas built from them are the real constraint. UI labels live beside the ids so
   stage strings never scatter through components. */

export const ROLES = [
  "byteforce_staff",
  "bsystems_staff",
  "portal_admin",
  "portal_rep",
  "platform_admin", // ADR-029: sees/controls BOTH companies + manages users
] as const;
export type Role = (typeof ROLES)[number];

export const BRANDS = ["byteforce", "bsystems"] as const;
export type Brand = (typeof BRANDS)[number];

/* ---------------- stages per pipeline (SPEC §6.3, §7.2, §8.2) ---------------- */

export const INTERNAL_STAGES = [
  "new",
  "following_up",
  "meeting_setting",
  "sending_proposal",
  "won",
  "lost",
] as const;
export type InternalStage = (typeof INTERNAL_STAGES)[number];

export const PARTNER_STAGES = [
  "lead",
  "didnt_answer",
  "following_up",
  "meeting_setting",
  "won",
  "lost",
] as const;
export type PartnerStage = (typeof PARTNER_STAGES)[number];

export const PORTAL_STAGES = [
  "leads",
  "following_up",
  "meeting_setting",
  "proposal_sending",
  "won",
  "lost",
] as const;
export type PortalStage = (typeof PORTAL_STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  new: "New",
  lead: "Lead",
  leads: "Leads",
  didnt_answer: "Didn't Answer",
  following_up: "Following Up",
  meeting_setting: "Meeting Setting",
  sending_proposal: "Sending Proposals",
  proposal_sending: "Proposal Sending",
  won: "Won",
  lost: "Lost",
};

/* ---------------- field enums (SPEC §6.1, §6.2, §7.2) ---------------- */

export const LEAD_TYPES = [
  "cold_call",
  "event_data",
  "personal_connection",
  "campaign_lead",
] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  cold_call: "Cold call",
  event_data: "Event data",
  personal_connection: "Personal connection",
  campaign_lead: "Campaign lead",
};

export const FOLLOW_UP_CONTEXTS = ["initial", "after_proposal", "after_meeting"] as const;
export type FollowUpContext = (typeof FOLLOW_UP_CONTEXTS)[number];

export const FOLLOW_UP_CONTEXT_TITLES: Record<FollowUpContext, string> = {
  initial: "Following up",
  after_proposal: "Following up after proposal",
  after_meeting: "Following up after meeting",
};

export const FOLLOW_UP_METHODS = ["call", "message", "visit"] as const;
export type FollowUpMethod = (typeof FOLLOW_UP_METHODS)[number];

export const MEETING_MODES = ["online", "offline"] as const;
export type MeetingMode = (typeof MEETING_MODES)[number];

export const MEETING_OUTCOMES = ["attended", "cancelled", "delayed"] as const;
export type MeetingOutcome = (typeof MEETING_OUTCOMES)[number];

export const IMPORTANCE_LEVELS = ["high", "medium", "low"] as const;
export type Importance = (typeof IMPORTANCE_LEVELS)[number];

export const LEAD_SOURCES = ["direct", "partner"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/* ---------------- activity log (SPEC §5.6) ---------------- */

export const LOG_ENTITY_TYPES = [
  "lead",
  "partner_prospect",
  "portal_deal",
  "portal_rep", // profile-space events (signup, edits) — additive to §9's list
  "won_deal",
  "client",
  "partner",
] as const;
export type LogEntityType = (typeof LOG_ENTITY_TYPES)[number];

export const LOG_ACTIONS = [
  "create",
  "stage_change",
  "auto_transfer",
  "group_added",
  "milestone_define",
  "milestone_check",
  "milestone_uncheck",
  "won_deal_update",
  "update",
] as const;
export type LogAction = (typeof LOG_ACTIONS)[number];
