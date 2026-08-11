import { z } from "zod";
import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { setUserActive, updateUser, updateUserSchema } from "@/lib/services/users";

const bodySchema = z.object({ active: z.boolean().optional() }).and(updateUserSchema);

/* V2 §2.10 + founder V4 — deactivate/reactivate AND full admin edit
   (name / email / phone / roles / password). */
export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const input = bodySchema.parse(await req.json());
    const actor = { id: user.id, label: user.name };
    const { active, ...edit } = input;
    if (Object.values(edit).some((v) => v !== undefined)) {
      await updateUser(id, edit, actor);
    }
    if (active !== undefined) {
      await setUserActive(id, active, actor);
    }
    return Response.json({ ok: true });
  },
);
