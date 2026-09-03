import { z } from "zod";
import { handleRoute, requireRole } from "@/lib/auth/guards";
import { deleteUser, setUserActive, updateUser, updateUserSchema } from "@/lib/services/users";

const bodySchema = z.object({ active: z.boolean().optional() }).and(updateUserSchema);

/* ADR-075 — edit / deactivate / delete ONE Mindoo account. The service checks
   the account is Mindoo's before it touches anything (assertUserInScope) and
   404s otherwise, so a guessed id from another company is not confirmed to
   exist. The B-Systems twin is the same file with the other literal. */

export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole("mindoo_staff");
    const { id } = await ctx.params;
    const input = bodySchema.parse(await req.json());
    const actor = { id: user.id, label: user.name };
    const { active, ...edit } = input;
    if (Object.values(edit).some((v) => v !== undefined)) {
      await updateUser(id, edit, "mindoo", actor);
    }
    if (active !== undefined) {
      await setUserActive(id, active, "mindoo", actor);
    }
    return Response.json({ ok: true });
  },
);

export const DELETE = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireRole("mindoo_staff");
    const { id } = await ctx.params;
    await deleteUser(id, "mindoo", { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);
