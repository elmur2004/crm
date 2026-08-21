/* Single source of truth for every enum-like string in the product. The Prisma
   columns are plain String (ADR-002 — SQLite has no enums); these unions + the Zod
   schemas built from them are the real constraint. UI labels live beside the ids so
   stage strings never scatter through components. */

export const ROLES = [
  "byteforce_staff",
  "bsystems_admin", // V2 (ADR-030): THE admin — ten sections, confirm-win, users
  "bsystems_sales", // internal sales — CRM + Won Leads
  "bsystems_agent", // external agent (was portal rep) — CRM, Won Leads, Payments, Profile
  "bsystems_partner", // partner-company account (auto-provisioned) — same as agent
  /* founder (ADR-051): "a type of user called data entry. This user is just
     able to add leads or partners or agents... they will not be the owner of
     what they add." A least-privilege role: two create actions and nothing
     else — no stage moves, no edits, no admin sections, no ownership. */
  "bsystems_data_entry",
] as const;
export type Role = (typeof ROLES)[number];

export const OWNER_TYPES = ["internal", "agent", "partner", "admin"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const OWNER_TYPE_LABELS: Record<OwnerType, string> = {
  internal: "Internal",
  agent: "Agents",
  partner: "Partners",
  admin: "Admins",
};

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

/* ADR-059 — ONE stage set for BOTH kinds of prospect card (partner and agent).

   Founder, section 1.1: "Add a new stage called Waiting. Order: Meeting Setting
   then Waiting then Qualified. Leads in Waiting must remain fully editable at
   any time." Asked whether the two kinds should keep separate vocabularies he
   answered "Same stages for both" — which deliberately reverses ADR-057's split
   while keeping the two card KINDS distinct (a qualified partner still joins
   the directory; the column is simply called Qualified now).

   THIS ARRAY IS THE BOARD'S COLUMN ORDER. `contacted` sits BEFORE
   `didnt_answer` because that is the order the founder dictated for the agent
   columns and he chose that order for both kinds. `waiting` sits between
   `meeting_setting` and `qualified`, exactly as 1.1 asks. Terminal stages are
   `qualified` and `lost`; every other member is an ordinary ACTIVE stage —
   Waiting included, which is what "fully editable at any time" costs. */
export const PROSPECT_STAGES = [
  "lead",
  "contacted",
  "didnt_answer",
  "meeting_setting",
  "waiting",
  "qualified",
  "lost",
] as const;
export type ProspectStage = (typeof PROSPECT_STAGES)[number];

/* V2 (ADR-030): the unified B-Systems CRM pipeline — negotiation is NEW. */
export const BSYSTEMS_STAGES = [
  "new",
  "following_up",
  "meeting_setting",
  "sending_proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type BsystemsStage = (typeof BSYSTEMS_STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  new: "New",
  lead: "Lead",
  didnt_answer: "Didn't Answer",
  following_up: "Following Up",
  meeting_setting: "Meeting Setting",
  sending_proposal: "Sending Proposals",
  negotiation: "Negotiation",
  /* prospect pipeline (ADR-059) — no collision: no other pipeline uses these */
  contacted: "Contacted",
  waiting: "Waiting",
  qualified: "Qualified",
  won: "Won",
  lost: "Lost",
};

/* ---------------- field enums (SPEC §6.1, §6.2, §7.2) ---------------- */

/* Founder: "for the lead types we need to add an organic type — so it can be
   from a campaign, or a personal connection, or organically they just show up".
   New members go at the END: every dropdown renders this array in order, so
   appending never reshuffles a form the team already knows. Lead.type is a
   stored STRING (no enum in the schema), so no migration is needed — the
   validation boundary is z.enum(LEAD_TYPES) in services/leads.ts. */
export const LEAD_TYPES = [
  "cold_call",
  "event_data",
  "personal_connection",
  "campaign_lead",
  "organic",
] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  cold_call: "Cold call",
  event_data: "Event data",
  personal_connection: "Personal connection",
  campaign_lead: "Campaign lead",
  organic: "Organic",
};

/* Founder: "when we put it in negotiations we need a follow-up for the
   negotiation itself — the date we will have a response for them on the
   proposal." after_negotiation is that record: a follow-up whose due date IS
   the promised response date. Appended at the END (like LEAD_TYPES) so no
   stored context ever shifts meaning. */
export const FOLLOW_UP_CONTEXTS = [
  "initial",
  "after_proposal",
  "after_meeting",
  "after_negotiation",
] as const;
export type FollowUpContext = (typeof FOLLOW_UP_CONTEXTS)[number];

export const FOLLOW_UP_CONTEXT_TITLES: Record<FollowUpContext, string> = {
  initial: "Following up",
  after_proposal: "Following up after proposal",
  after_meeting: "Following up after meeting",
  after_negotiation: "Response due after negotiation",
};

/* ---------------- same-stage records (founder) ---------------- */

/* Founder: "if I followed up with them and they need another follow-up, add a
   button inside the lead", "when we put it in negotiations we need a follow-up
   for the negotiation itself", "the meeting setting, the same thing — a button
   to reschedule". These are ENGINE next actions like any other: they run the
   whole persist/log/undo/To-Do pipeline — they simply resolve to the stage the
   card is already in, so the record is added and the card never moves. The ids
   are deliberately NOT stage names, so nothing can confuse them with a move. */
export const SAME_STAGE_ACTIONS = [
  "follow_up_again", // Following Up → another follow-up
  "negotiation_follow_up", // Negotiation → the response-due date
  "reschedule_meeting", // Meeting Setting → a NEW meeting, superseding the old
] as const;
export type SameStageAction = (typeof SAME_STAGE_ACTIONS)[number];

export function isSameStageAction(action: string): action is SameStageAction {
  return (SAME_STAGE_ACTIONS as readonly string[]).includes(action);
}

/** The stage whose field group a same-stage action reuses, for the two LEAD
    pipelines (BsEventPanel / LeadEventPanel), whose `followUpStage` and
    `meetingStage` really do hold these keys.

    ADR-059 retired the slot-indexed sibling this used to defer to
    (`SAME_STAGE_FORM_SLOT`): with `followUpStage: null` on the prospect config
    it composed to `config[null]` and rendered an EMPTY follow-up form — the
    "a null role slot breaks whatever COMPOSES from it" trap in
    docs/IMPLEMENTATION.md. The prospect UI asks the engine instead
    (`requiredGroupFor(config, fromStage, action)`), which is the answer for any
    pipeline; prefer it over this map in new code. */
export const SAME_STAGE_FORM_TARGET: Record<SameStageAction, string> = {
  follow_up_again: "following_up",
  negotiation_follow_up: "following_up",
  reschedule_meeting: "meeting_setting",
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
  "portal_rep", // agent profile events (signup, edits)
  "won_deal",
  "client",
  "partner",
  "statement", // V2 §7
  "user", // V2 §11 (users management / impersonation)
  /* accounting (ADR-052) — one type per money table; acct_books = whole-company
     operations (the import). entityId is the row id (or the company for books). */
  "acct_income",
  "acct_expense",
  "acct_roster_member",
  "acct_payroll_payment",
  "acct_treasury_move",
  "acct_loan",
  "acct_loan_payment",
  "acct_media_entry",
  "acct_target",
  "acct_settings",
  "acct_books",
  /* data vault (ADR-053) — add-only; entityId is the vault row id */
  "vault_employee",
  "vault_form",
  "vault_sheet",
  "vault_document",
  "vault_task",
  /* ADR-054 — whole-module operations on the vault (its own export/import);
     entityId is the literal "vault", the acct_books precedent */
  "vault_backup",
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
  "comment", // founder: the lead mini chat
  /* accounting (ADR-052) — add-only */
  "delete", // accounting rows hard-delete (money is never undoable, ADR-045)
  "approve", // expense / payroll approval — the cash gate
  "unapprove",
  "import", // the one-time books import (founder decision 4)
  /* data vault (ADR-053) — add-only. Archive/restore become first-class verbs
     (the vault's whole delete story), completion/reopen are the task
     invariants, replace_file marks a version append on sheets/documents. */
  "archive",
  "restore",
  "complete",
  "reopen",
  "replace_file",
  /* ADR-054 — module import/export are logged, add-only: export marks a books
     or vault download (import already exists above) */
  "export",
] as const;
export type LogAction = (typeof LOG_ACTIONS)[number];
