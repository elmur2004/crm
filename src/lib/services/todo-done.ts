import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "./activity";
import { cairoDayWindow, type TodoKind } from "./todo";
import { configForBrand, followUpStagesFor } from "@/lib/pipeline-engine/configs/for-brand";

/* Founder 2.2/2.3 (ADR-062) — MANUAL To-Do completion. "Add a checkbox next to
   every task in the To-Do List. Checking the box manually marks the task as
   Done." The mark is REAL STATE (one TodoDone row) keyed to the UNDERLYING
   dated record — never a lead, never a rendered string — so a NEW follow-up on
   the same lead is a new id and always arrives unchecked. AUTO completion (the
   lead moved stage, a newer record superseded, an outcome/payment/completion
   landed) is never written here: the projection derives it (ADR-041), and this
   service REFUSES to mark records that are not live today's tasks, so TodoDone
   rows stay meaningful.

   Permission walls stay in the ROUTES (requireLeadAccess / requireBsAdmin —
   the projection's own scope wall re-derived from the RECORD, never from
   client input); this service takes the already-guarded caller and enforces
   the non-identity invariants: brand, ADR-061 (no prospect tasks), archived,
   liveness, today's window. */

/** Resolve the lead behind a lead-backed task record so the route can run
    requireLeadAccess on it. 404s a missing record AND a prospect-parented one
    (partnerProspectId set, leadId null) — ADR-061 took the partners funnel off
    the To-Do, so no completion may exist for it. */
export async function leadIdOfTodoRecord(
  kind: "follow_up" | "meeting",
  recordId: string,
): Promise<string> {
  const record =
    kind === "follow_up"
      ? await db.followUp.findUnique({
          where: { id: recordId },
          select: { leadId: true },
        })
      : await db.meeting.findUnique({
          where: { id: recordId },
          select: { leadId: true },
        });
  if (!record?.leadId) throw new ApiError(404, "Task not found");
  return record.leadId;
}

const NOT_TODAY = "This task is not on today's To-Do";

type UniqueKey =
  | { followUpId: string }
  | { meetingId: string }
  | { statementId: string }
  | { milestoneId: string };

function keyFor(kind: TodoKind, recordId: string): UniqueKey {
  switch (kind) {
    case "follow_up":
      return { followUpId: recordId };
    case "meeting":
      return { meetingId: recordId };
    case "statement":
      return { statementId: recordId };
    case "milestone":
      return { milestoneId: recordId };
  }
}

/* The lead-side liveness rule is the PROJECTION's, verbatim (todo.ts): the
   record must be its lead's LATEST record — across follow-ups, meetings,
   proposals AND negotiation notes — and the lead must still sit in the
   matching stage. */
const LATEST_SELECT = {
  followUps: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, createdAt: true } },
  meetings: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, createdAt: true } },
  proposals: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
  negotiationNotes: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
} as const;

function newestOf(lead: {
  followUps: { createdAt: Date }[];
  meetings: { createdAt: Date }[];
  proposals: { createdAt: Date }[];
  negotiationNotes: { createdAt: Date }[];
}): number {
  return Math.max(
    lead.followUps[0]?.createdAt.getTime() ?? 0,
    lead.meetings[0]?.createdAt.getTime() ?? 0,
    lead.proposals[0]?.createdAt.getTime() ?? 0,
    lead.negotiationNotes[0]?.createdAt.getTime() ?? 0,
  );
}

/** Check (done: true) or uncheck (done: false) one To-Do task.
    Checking validates the record IS a live task in today's Cairo window and
    upserts the mark with a `dueAt` snapshot (a rescheduled meeting therefore
    resets to unchecked — the projection honours the mark only while the
    snapshot equals the record's current due instant). Unchecking deletes the
    mark — the Done section's restore; idempotent both ways. */
export async function setTodoDone(opts: {
  brand: Brand;
  kind: TodoKind;
  recordId: string;
  done: boolean;
  actor: Actor;
  now?: Date;
}): Promise<void> {
  const key = keyFor(opts.kind, opts.recordId);

  if (!opts.done) {
    /* The uncheck IS the reversal (no UndoEntry — the comments.ts precedent
       for a lightweight self-reversing action). No liveness gate: deleting a
       mark on a record that auto-resolved is a harmless no-op in the
       projection, and the route's scope wall has already passed. */
    await db.todoDone.deleteMany({ where: key });
    return;
  }

  const now = opts.now ?? new Date();
  const { start, end } = cairoDayWindow(now);
  let dueAt: Date;

  if (opts.kind === "follow_up") {
    const f = await db.followUp.findUnique({
      where: { id: opts.recordId },
      include: {
        lead: { select: { brand: true, archived: true, stage: true, ...LATEST_SELECT } },
      },
    });
    if (!f?.lead || f.lead.brand !== opts.brand) throw new ApiError(404, "Task not found");
    if (f.lead.archived) throw new ApiError(400, NOT_TODAY); // ADR-043: archived leads carry no to-dos
    /* ADR-067 — this company's own follow-up stages (see configs/for-brand):
       the checkbox must judge liveness by the SAME rule the projection used, and
       both must read it from the pipeline the lead actually runs on. */
    const live =
      followUpStagesFor(opts.brand).includes(f.lead.stage) &&
      f.lead.followUps[0]?.id === f.id &&
      f.createdAt.getTime() === newestOf(f.lead);
    if (!live) throw new ApiError(400, NOT_TODAY);
    if (!(f.dueAt >= start && f.dueAt < end)) throw new ApiError(400, NOT_TODAY);
    dueAt = f.dueAt;
  } else if (opts.kind === "meeting") {
    const m = await db.meeting.findUnique({
      where: { id: opts.recordId },
      include: {
        lead: { select: { brand: true, archived: true, stage: true, ...LATEST_SELECT } },
      },
    });
    if (!m?.lead || m.lead.brand !== opts.brand) throw new ApiError(404, "Task not found");
    if (m.lead.archived) throw new ApiError(400, NOT_TODAY);
    const live =
      m.lead.stage === configForBrand(opts.brand).meetingStage &&
      m.lead.meetings[0]?.id === m.id &&
      m.createdAt.getTime() === newestOf(m.lead) &&
      m.arranged &&
      m.outcome === null &&
      m.datetime !== null;
    if (!live) throw new ApiError(400, NOT_TODAY);
    if (!(m.datetime! >= start && m.datetime! < end)) throw new ApiError(400, NOT_TODAY);
    dueAt = m.datetime!;
  } else if (opts.kind === "statement") {
    /* money kinds are B-Systems-admin-only and due-before-END-of-today
       (`< end`, ADR-061 — a payment expected yesterday is still today's task) */
    if (opts.brand !== "bsystems") throw new ApiError(404, "Task not found");
    const s = await db.statement.findUnique({
      where: { id: opts.recordId },
      include: {
        milestone: {
          include: { wonDeal: { include: { lead: { select: { archived: true } } } } },
        },
      },
    });
    if (!s) throw new ApiError(404, "Task not found");
    if (s.milestone.wonDeal.lead.archived) throw new ApiError(400, NOT_TODAY);
    if (s.status !== "pending") throw new ApiError(400, NOT_TODAY); // paid = auto-done, not checkable
    if (!s.expectedDate || !(s.expectedDate < end)) throw new ApiError(400, NOT_TODAY);
    dueAt = s.expectedDate;
  } else {
    if (opts.brand !== "bsystems") throw new ApiError(404, "Task not found");
    const ms = await db.milestone.findUnique({
      where: { id: opts.recordId },
      include: { wonDeal: { include: { lead: { select: { archived: true } } } } },
    });
    if (!ms) throw new ApiError(404, "Task not found");
    if (ms.wonDeal.lead.archived) throw new ApiError(400, NOT_TODAY);
    if (ms.completed) throw new ApiError(400, NOT_TODAY); // completed = auto-done
    if (!ms.expectedEnd || !(ms.expectedEnd < end)) throw new ApiError(400, NOT_TODAY);
    dueAt = ms.expectedEnd;
  }

  /* Upsert (a double-check never errors); re-checking refreshes the stamp so a
     money task checked again on a later day counts for THAT day (marks are
     valid only for the Cairo day they were made — money never vanishes). */
  const stamp = {
    dueAt,
    completedById: opts.actor.id,
    completedByLabel: opts.actor.label,
    completedAt: now,
  };
  await db.todoDone.upsert({
    where: key,
    create: { ...key, ...stamp },
    update: stamp,
  });
}
