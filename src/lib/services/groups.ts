import { z } from "zod";
import {
  FOLLOW_UP_METHODS,
  IMPORTANCE_LEVELS,
  MEETING_MODES,
} from "@/lib/pipeline-engine/constants";
import { cairoToUtc } from "@/lib/datetime";
import { MAX_PIASTERS } from "@/lib/money";

/* Zod schemas for every stage field group (SPEC §6.2, §7.2). These are the
   completeness gates: a transition whose requiredGroup payload fails its schema
   never commits. Dates/times arrive as Cairo-local form values (§6.2's split
   inputs) and are combined to one UTC instant here. Money arrives in piasters
   (the client converts pounds via money.ts before submitting). */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm");
const money = z.number().int().min(0).max(MAX_PIASTERS);

export const followUpSchema = z.object({
  date: dateStr,
  /* V2 §3: agent forms collect the DAY only — time defaults to 09:00 Cairo. */
  time: timeStr.optional(),
  method: z.enum(FOLLOW_UP_METHODS),
  ownerSalesRepId: z.string().optional(),
  ownerPortalRepId: z.string().optional(),
  followingUpWith: z.string().max(200).optional(),
});
export type FollowUpInput = z.infer<typeof followUpSchema>;

export function followUpDueAt(input: FollowUpInput): Date {
  return cairoToUtc(input.date, input.time ?? "09:00");
}

export const meetingSchema = z
  .object({
    /* arranged=true ⇒ agreed with the client; arranged=false + datetime ⇒ the
       proposed "time that suits you" slot (V2 §3 agent flow). */
    arranged: z.boolean(),
    date: dateStr.optional(),
    time: timeStr.optional(),
    mode: z.enum(MEETING_MODES).optional(),
    withAttendees: z.string().max(300).optional(),
    technicalSupport: z.string().max(200).optional(),
    needsTechnical: z.boolean().optional(), // V2 §3 agent question
  })
  .refine((m) => !m.arranged || (m.date && m.time && m.mode), {
    message: "An arranged meeting needs date, time and mode",
  });
export type MeetingInput = z.infer<typeof meetingSchema>;

export const meetingRescheduleSchema = z.object({
  date: dateStr,
  time: timeStr,
});
export type MeetingRescheduleInput = z.infer<typeof meetingRescheduleSchema>;

export const proposalSchema = z.object({
  service: z.string().min(1).max(300),
  estimatedValue: money.optional(),
  sent: z.boolean().default(false),
});
export type ProposalInput = z.infer<typeof proposalSchema>;

export const lostSchema = z.object({
  reason: z.string().min(1, "A reason is required").max(1000),
});
export type LostInput = z.infer<typeof lostSchema>;

export const wonSchema = z.object({
  estimatedValue: money,
  technicalOwner: z.string().min(1).max(200),
  collectedAmount: money,
});
export type WonInput = z.infer<typeof wonSchema>;

/* §7.2 Won completeness gate (PP-4) — all required except email. */
export const wonPartnerSchema = z.object({
  companyName: z.string().min(1).max(200),
  keyPersonName: z.string().min(1).max(200),
  keyPersonRole: z.string().min(1).max(200),
  address: z.string().min(1).max(400),
  number: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  businessActivity: z.string().min(1).max(300),
  importance: z.enum(IMPORTANCE_LEVELS),
});
export type WonPartnerInput = z.infer<typeof wonPartnerSchema>;

/* V2 §1: the negotiation stage's group — a note entry (accumulates). */
export const negotiationSchema = z.object({
  note: z.string().min(1).max(2000),
});
export type NegotiationInput = z.infer<typeof negotiationSchema>;

/* V2 §4: confirm-win milestone tab — commission is a PERCENT (basis points),
   milestones carry value + closer commission + expected dates. */
export const wonDealSchema = z.object({
  estimatedValue: money,
  totalCommissionPercentBp: z.number().int().min(0).max(100_00), // ≤ 100.00%
  contractDate: dateStr.optional(),
  milestones: z
    .array(
      z.object({
        label: z.string().max(120).optional(),
        value: money,
        commissionValue: money,
        expectedStart: dateStr.optional(),
        expectedEnd: dateStr.optional(),
      }),
    )
    .min(1)
    .max(100),
});
export type WonDealInput = z.infer<typeof wonDealSchema>;

/* PP-1 (V2 §6): moving to Didn't Answer records WHICH number(s) went unanswered. */
export const numbersSchema = z.object({
  dialedNumbers: z.array(z.string().min(1).max(50)).min(1).max(20),
});
export type NumbersInput = z.infer<typeof numbersSchema>;

/* Discriminated payload matching pipeline-engine RequiredGroup. */
export const groupPayloadSchema = z.discriminatedUnion("group", [
  z.object({ group: z.literal("follow_up"), data: followUpSchema }),
  z.object({ group: z.literal("meeting"), data: meetingSchema }),
  z.object({ group: z.literal("meeting_reschedule"), data: meetingRescheduleSchema }),
  z.object({ group: z.literal("proposal"), data: proposalSchema }),
  z.object({ group: z.literal("lost"), data: lostSchema }),
  z.object({ group: z.literal("won"), data: wonSchema }),
  z.object({ group: z.literal("won_partner"), data: wonPartnerSchema }),
  z.object({ group: z.literal("won_deal"), data: wonDealSchema }),
  z.object({ group: z.literal("negotiation"), data: negotiationSchema }),
  z.object({ group: z.literal("numbers"), data: numbersSchema }),
]);
export type GroupPayload = z.infer<typeof groupPayloadSchema>;
