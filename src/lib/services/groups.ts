import { z } from "zod";
import {
  FOLLOW_UP_METHODS,
  IMPORTANCE_LEVELS,
  MEETING_MODES,
  POSTPONE_REASONS,
} from "@/lib/pipeline-engine/constants";
import { cairoToUtc, utcToCairo } from "@/lib/datetime";
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
  /* Founder (ADR-061): EVERY follow-up form collects the DAY only now — what
     V2 §3 gave agents is the rule for all roles. `time` stays OPTIONAL (never
     required) so API callers and old clients keep working; absent ⇒ the slot
     defaults to 09:00 Cairo in followUpDueAt. Meetings still require a time.
     Founder (ADR-063): "let's get the time back for the follow up but it's not
     mandtory" — the forms ask again, the day-only default stays the norm, and
     this field is exactly as optional as it always was on the wire. */
  time: timeStr.optional(),
  method: z.enum(FOLLOW_UP_METHODS),
  ownerSalesRepId: z.string().optional(),
  ownerPortalRepId: z.string().optional(),
  followingUpWith: z.string().max(200).optional(),
});
export type FollowUpInput = z.infer<typeof followUpSchema>;

export function followUpDueAt(input: FollowUpInput): Date {
  const at = cairoToUtc(input.date, input.time ?? "09:00");
  /* Review hardening: Egypt's spring-forward jumps AT midnight, so a caller-
     posted 00:xx wall-clock may not exist on the transition day — the solver
     then lands on the EVE. Nudge one hour forward (DST jumps are one hour,
     mirroring todo.ts startOfCairoDay) so a posted time can never move a
     follow-up off its posted date. The 09:00 default is always safe.

     ADR-063 accepts a once-a-year consequence this makes VISIBLE for the first
     time: on 2026-04-24 a posted 00:00/00:30/00:59 is stored as 01:00/01:30/
     01:59 Cairo and, now that a chosen time is printed, the screens say so.
     The posted hour simply does not exist that night — there is no instant
     that both keeps the day and shows 00:30 — and the DAY, which is what a
     follow-up is actually about, is never lost. Proved over every 2026
     transition: 45 date×time cases, 45 keep their day, and these three are the
     only clocks that move. */
  return utcToCairo(at).date === input.date ? at : new Date(at.getTime() + 60 * 60 * 1000);
}

/** ADR-063 — the marker behind `FollowUp.dueTimeSet`. `dueAt` remains the ONE
    source of the instant; this says only whether the clock on it is the
    caller's own choice or the 09:00 Cairo default, which is the difference no
    instant can express. TRUE only when a time actually arrived. */
export function followUpDueTimeSet(input: FollowUpInput): boolean {
  return input.time !== undefined;
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
    /* ADR-071 — "Also blocks": the ACCOUNTS this meeting occupies, beyond the
       lead's owner. Founder: "whenever X is setting a meeting and Y has to be
       in this meeting, X will look at the calendar and see if Y has any other
       meetings." Optional and defaulting to nothing, so every existing caller,
       test and stored payload stays valid byte-for-byte; `withAttendees` and
       `technicalSupport` above are untouched free text and keep meaning exactly
       what they meant. The ids are narrowed to the company's own roster where
       they are written (persistGroup), never trusted from the wire. */
    attendeeUserIds: z.array(z.string().min(1)).max(20).optional(),
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

/* ADR-072 — the popup the founder described, in Zod.

   Three named reasons and `other`, with the free text REQUIRED when `other` is
   chosen: an "Other" carrying nothing records only that somebody pressed a
   button, and the whole point of the column is that you can work back through
   it. The note is optional on the three named reasons — a no-show is already
   fully described by its name, and forcing a sentence would get "asd" typed
   into it. */
export const postponeSchema = z
  .object({
    reason: z.enum(POSTPONE_REASONS),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.reason !== "other" || Boolean(v.note), {
    message: "Say what the reason is",
    path: ["note"],
  });
export type PostponeInput = z.infer<typeof postponeSchema>;

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

/* §7.2 Qualified completeness gate for a PARTNER card (PP-4) — everything
   required except the email.

   Founder (ADR-059, item 1.3): "Moving a lead to Qualified should not require
   creating or entering an email or password. This applies to both Agents and
   Partners." So the password field and the email⇒password refine are GONE: this
   gate is about the partner record being complete, never about credentials.
   The login is minted afterwards by `createPartnerLogin` (§7.2b), which is where
   the email and the password are asked for. Every OTHER completeness
   requirement is preserved exactly as it was. */
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

/* §7.2b — the body of the SEPARATE "Create the agent's account" action (PP-4a).

   This is no longer a stage gate: ADR-059 took it off the move to Qualified
   because the founder asked that qualifying never demand an email or a
   password. It is the explicit, admin-only step afterwards, so this is exactly
   where those two credentials ARE required: "I will create for them a user and
   a password — they will not apply."

   Address and speciality are required here rather than at card creation (which
   asks only for a name and a number) — partly because adding must stay
   frictionless, and partly because PortalRep.address / .speciality are NOT NULL
   columns: this form is the last honest place to insist. Each message names its
   own field so the admin sees exactly what is missing. */
/* `error` (not just `min`) so a MISSING field reads the same as an empty one —
   otherwise Zod answers "expected string, received undefined", which tells the
   admin nothing about which box to fill. */
const gateField = (message: string) => z.string({ error: message }).min(1, message);

export const agentAccountSchema = z.object({
  firstName: gateField("First name is required").max(100),
  lastName: gateField("Last name is required").max(100),
  address: gateField("Address is required — it goes on the agent's profile").max(400),
  speciality: gateField("Speciality is required — it goes on the agent's profile").max(200),
  /* the login — prefilled from the card when it has one, typed in here when not */
  email: gateField("Enter a valid email — it is the agent's sign-in").email(
    "Enter a valid email — it is the agent's sign-in",
  ),
  password: gateField("Set the agent's sign-in password").min(8, "At least 8 characters"),
  /* prefilled from the card's number; the agent's second identifier (ADR-016) */
  phone: gateField("Phone number is required").max(50),
});
export type AgentAccountInput = z.infer<typeof agentAccountSchema>;

/* §7.2b — the PARTNER half of the same action: a directory partner's login. The
   gate no longer carries a password (see wonPartnerSchema), so this is the only
   path that mints a `bsystems_partner` account. */
export const partnerLoginSchema = z.object({
  email: gateField("Enter a valid email — it is the partner's sign-in").email(
    "Enter a valid email — it is the partner's sign-in",
  ),
  password: gateField("Set the partner's sign-in password").min(8, "At least 8 characters"),
});
export type PartnerLoginInput = z.infer<typeof partnerLoginSchema>;

/* V2 §1: the negotiation stage's group — a note entry (accumulates). */
export const negotiationSchema = z.object({
  note: z.string().min(1).max(2000),
});
export type NegotiationInput = z.infer<typeof negotiationSchema>;

/* V2 §4: confirm-win milestone tab — commission is a PERCENT (basis points),
   milestones carry value + closer commission + expected dates.
   Founder V3 barriers: the numbers must be mathematically coherent and the
   milestones chronological — wrong entries are refused with a clear message. */
const egp = (piasters: number) => `EGP ${(piasters / 100).toLocaleString("en-EG")}`;

export const wonDealSchema = z
  .object({
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
  })
  .superRefine((d, ctx) => {
    /* 1 — milestone values must add up to the deal's estimated value */
    const valuesTotal = d.milestones.reduce((a, m) => a + m.value, 0);
    if (valuesTotal !== d.estimatedValue) {
      ctx.addIssue({
        code: "custom",
        path: ["milestones"],
        message: `Milestone values total ${egp(valuesTotal)} but the estimated value is ${egp(d.estimatedValue)} — they must match`,
      });
    }
    /* 2 — milestone commissions must add up to the total commission %
       (±EGP 1 rounding tolerance) */
    const expectedCommission = Math.round(
      (d.estimatedValue * d.totalCommissionPercentBp) / 100_00,
    );
    const commissionTotal = d.milestones.reduce((a, m) => a + m.commissionValue, 0);
    if (Math.abs(commissionTotal - expectedCommission) > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["milestones"],
        message: `Milestone commissions total ${egp(commissionTotal)} but ${(d.totalCommissionPercentBp / 100).toString()}% of ${egp(d.estimatedValue)} is ${egp(expectedCommission)} — they must match`,
      });
    }
    /* 3 — chronology: each milestone ends after it starts, and each milestone
       starts after the previous one (YYYY-MM-DD compares lexicographically) */
    d.milestones.forEach((m, i) => {
      if (m.expectedStart && m.expectedEnd && m.expectedEnd < m.expectedStart) {
        ctx.addIssue({
          code: "custom",
          path: ["milestones", i, "expectedEnd"],
          message: `Milestone ${i + 1} ends before it starts`,
        });
      }
      if (i > 0) {
        const prev = d.milestones[i - 1]!;
        const prevAnchor = prev.expectedEnd ?? prev.expectedStart;
        const thisAnchor = m.expectedStart ?? m.expectedEnd;
        if (prevAnchor && thisAnchor && thisAnchor < prevAnchor) {
          ctx.addIssue({
            code: "custom",
            path: ["milestones", i, "expectedStart"],
            message: `Milestone ${i + 1} starts before milestone ${i} finishes — milestones must be in chronological order`,
          });
        }
      }
    });
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
  z.object({ group: z.literal("postpone"), data: postponeSchema }), // ADR-072
  z.object({ group: z.literal("won"), data: wonSchema }),
  z.object({ group: z.literal("won_partner"), data: wonPartnerSchema }),
  z.object({ group: z.literal("won_deal"), data: wonDealSchema }),
  z.object({ group: z.literal("negotiation"), data: negotiationSchema }),
  z.object({ group: z.literal("numbers"), data: numbersSchema }),
]);
export type GroupPayload = z.infer<typeof groupPayloadSchema>;
