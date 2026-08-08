import { z } from "zod";
import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { ApiError } from "@/lib/api-error";
import { MAX_PIASTERS } from "@/lib/money";
import { writeLog, type Actor } from "./activity";

/* §6.4 — client cards. To-be-collected defaults to estimated − collected but stays
   editable (A-1). Money in piasters (ADR-018); due date is a date-only UTC instant. */

const money = z.number().int().min(0).max(MAX_PIASTERS);

export const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  number: z.string().min(1).max(50).optional(),
  service: z.string().max(300).nullable().optional(),
  estimatedValue: money.nullable().optional(),
  collected: money.nullable().optional(),
  toBeCollected: money.nullable().optional(), // editable override (A-1)
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  retainer: z.boolean().optional(),
  technicalOwner: z.string().max(200).nullable().optional(),
});

export function listClients(brand: Brand) {
  return db.client.findMany({ where: { brand }, orderBy: { createdAt: "desc" } });
}

export async function updateClient(
  brand: Brand,
  clientId: string,
  input: z.infer<typeof updateClientSchema>,
  actor: Actor,
) {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client || client.brand !== brand) throw new ApiError(404, "Client not found");

  /* If money fields change without an explicit toBeCollected, re-derive the default. */
  const estimated = input.estimatedValue !== undefined ? input.estimatedValue : client.estimatedValue;
  const collected = input.collected !== undefined ? input.collected : client.collected;
  /* A-1 formula literally: estimated − collected, unclamped (ADR-024 — an
     overpayment shows as negative). Same semantic as the T-9 creation path. */
  const deriveToBeCollected =
    input.toBeCollected === undefined &&
    (input.estimatedValue !== undefined || input.collected !== undefined)
      ? (estimated ?? 0) - (collected ?? 0)
      : undefined;

  return db.$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id: client.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.number !== undefined && { number: input.number }),
        ...(input.service !== undefined && { service: input.service }),
        ...(input.estimatedValue !== undefined && { estimatedValue: input.estimatedValue }),
        ...(input.collected !== undefined && { collected: input.collected }),
        ...(input.toBeCollected !== undefined && { toBeCollected: input.toBeCollected }),
        ...(deriveToBeCollected !== undefined && { toBeCollected: deriveToBeCollected }),
        ...(input.dueDate !== undefined && {
          dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
        }),
        ...(input.retainer !== undefined && { retainer: input.retainer }),
        ...(input.technicalOwner !== undefined && { technicalOwner: input.technicalOwner }),
      },
    });
    await writeLog(tx, {
      entityType: "client",
      entityId: client.id,
      actor,
      action: "update",
      trigger: "edit",
    });
    return updated;
  });
}
