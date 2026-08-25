import { z } from "zod";
import { handleRoute, requireVault } from "@/lib/auth/guards";
import {
  setVaultEmployeeActive,
  updateVaultEmployee,
  vaultEmployeeSchema,
} from "@/lib/services/vault/employees";

/* ADR-053 — edit an employee card, or flip its active state ({active} alone).
   Cards deactivate, never delete — there is deliberately no DELETE here. */

const activeSchema = z.object({ active: z.boolean() });

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    const body = (await req.json()) as Record<string, unknown>;
    const actor = { id: user.id, label: user.name };

    if ("active" in body && Object.keys(body).length === 1) {
      const { active } = activeSchema.parse(body);
      return Response.json(await setVaultEmployeeActive(id, active, actor));
    }
    const input = vaultEmployeeSchema.parse(body);
    return Response.json(await updateVaultEmployee(id, input, actor));
  },
);
