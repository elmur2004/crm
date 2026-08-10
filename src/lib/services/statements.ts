import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { MAX_PIASTERS } from "@/lib/money";
import { validateAndStore } from "@/lib/storage";
import { writeLog, type Actor } from "./activity";

/* V2 §7 — Statements & payments.
   "Waiting to be paid out" = every CHECKED milestone of a B-Systems won lead that
   has no Statement yet. Generate → editable values → Create (code ST-####) → the
   closer sees it in Payments as pending → admin marks paid with a PROOF IMAGE. */

const money = z.number().int().min(0).max(MAX_PIASTERS);

export async function waitingToBePaidOut() {
  const milestones = await db.milestone.findMany({
    where: { completed: true, statement: null, wonDeal: { lead: { brand: "bsystems" } } },
    include: {
      wonDeal: {
        include: {
          lead: {
            include: {
              owner: { select: { id: true, name: true } },
              salesRep: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { completedAt: "asc" },
  });
  return milestones.map((m) => ({
    milestoneId: m.id,
    label: m.label ?? `Milestone ${m.index}`,
    clientName: m.wonDeal.lead.name,
    companyName: m.wonDeal.lead.companyName,
    closerLabel:
      m.wonDeal.lead.owner?.name ?? m.wonDeal.lead.salesRep?.name ?? "Admin",
    closerUserId: m.wonDeal.lead.owner?.id ?? null,
    milestoneValue: m.value,
    commissionValue: m.commissionValue ?? 0,
  }));
}

export const createStatementSchema = z.object({
  milestoneId: z.string(),
  clientName: z.string().min(1).max(200),
  milestoneLabel: z.string().min(1).max(120),
  milestoneValue: money,
  percentBp: z.number().int().min(0).max(100_00),
  amount: money,
  adjustments: z.number().int().min(-MAX_PIASTERS).max(MAX_PIASTERS).default(0),
  expectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

async function nextCode(tx: { statement: { count: () => Promise<number> } }): Promise<string> {
  const count = await tx.statement.count();
  return `ST-${String(count + 1).padStart(4, "0")}`;
}

export async function createStatement(
  input: z.infer<typeof createStatementSchema>,
  actor: Actor,
) {
  const milestone = await db.milestone.findUnique({
    where: { id: input.milestoneId },
    include: {
      statement: true,
      wonDeal: { include: { lead: { include: { owner: { select: { id: true, name: true } }, salesRep: { select: { name: true } } } } } },
    },
  });
  if (!milestone) throw new ApiError(404, "Milestone not found");
  if (!milestone.completed) throw new ApiError(400, "Only checked milestones can be paid out");
  if (milestone.statement) throw new ApiError(409, "A statement already exists for this milestone");

  return db.$transaction(async (tx) => {
    const code = await nextCode(tx);
    const statement = await tx.statement.create({
      data: {
        code,
        milestoneId: milestone.id,
        clientName: input.clientName,
        milestoneLabel: input.milestoneLabel,
        milestoneValue: input.milestoneValue,
        percentBp: input.percentBp,
        amount: input.amount,
        adjustments: input.adjustments,
        expectedDate: input.expectedDate
          ? new Date(`${input.expectedDate}T00:00:00.000Z`)
          : null,
        closerUserId: milestone.wonDeal.lead.owner?.id ?? null,
        closerLabel:
          milestone.wonDeal.lead.owner?.name ?? milestone.wonDeal.lead.salesRep?.name ?? "Admin",
      },
    });
    await writeLog(tx, {
      entityType: "statement",
      entityId: statement.id,
      actor,
      action: "create",
      trigger: code,
    });
    return statement;
  });
}

export function listStatements() {
  return db.statement.findMany({
    include: { proofs: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Founder: the printable statement DOCUMENT — everything the paper needs:
    the statement, its milestone/deal/client, and the closer's account. */
export async function statementDocument(id: string) {
  const statement = await db.statement.findUnique({
    where: { id },
    include: {
      proofs: true,
      milestone: {
        include: {
          wonDeal: {
            include: {
              lead: {
                include: {
                  owner: { select: { id: true, name: true, email: true, phone: true } },
                  salesRep: { select: { name: true } },
                  partner: { select: { companyName: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!statement) throw new ApiError(404, "Statement not found");
  const closerUser = statement.closerUserId
    ? await db.user.findUnique({
        where: { id: statement.closerUserId },
        select: { id: true, name: true, email: true, phone: true },
      })
    : null;
  return { statement, lead: statement.milestone.wonDeal.lead, closerUser };
}

/** Closer's Payments section (V2 §7) — pending + paid, with proof when paid. */
export function paymentsFor(userId: string) {
  return db.statement.findMany({
    where: { closerUserId: userId },
    include: { proofs: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Admin "Mark payment": PROOF IMAGE upload replaces a payment reference. */
export async function markStatementPaid(statementId: string, proof: File, actor: Actor) {
  const statement = await db.statement.findUnique({ where: { id: statementId } });
  if (!statement) throw new ApiError(404, "Statement not found");
  if (statement.status === "paid") throw new ApiError(400, "Already paid");
  const stored = await validateAndStore("payment_proof", proof);
  return db.$transaction(async (tx) => {
    await tx.attachment.create({
      data: {
        kind: "payment_proof",
        statementId,
        filename: stored.filename,
        storageKey: stored.key,
        mime: stored.mime,
        size: stored.size,
      },
    });
    const updated = await tx.statement.update({
      where: { id: statementId },
      data: { status: "paid", paidAt: new Date() },
    });
    await writeLog(tx, {
      entityType: "statement",
      entityId: statementId,
      actor,
      action: "update",
      trigger: "paid",
    });
    return updated;
  });
}
