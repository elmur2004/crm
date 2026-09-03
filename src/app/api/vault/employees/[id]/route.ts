import { z } from "zod";
import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultCompany, assertVaultRowVisible } from "@/lib/services/vault/tenancy";
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
    /* ADR-074 — this record must belong to a company this account can
       see; an id alone is no longer proof of that. */
    await assertVaultRowVisible(user, "employee", id);
    const body = (await req.json()) as Record<string, unknown>;
    const actor = { id: user.id, label: user.name };

    if ("active" in body && Object.keys(body).length === 1) {
      const { active } = activeSchema.parse(body);
      return Response.json(await setVaultEmployeeActive(id, active, actor));
    }
    const input = vaultEmployeeSchema.parse(body);
    /* ADR-074 — the payload names a company; it must be one this
       account holds (services/vault/tenancy.ts). */
    assertVaultCompany(user, input.company);
    return Response.json(await updateVaultEmployee(id, input, actor));
  },
);
