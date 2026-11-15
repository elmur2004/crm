import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { massAssignLeads, massAssignSchema } from "@/lib/services/mass-assign";

/* ADR-105 — the Users app's mass assign: hand the chosen leads to THIS
   account, in one press. Founder (2026-11-15): "add a way to mass assign
   leads to someone — I can choose them in the users section and select mass
   assign and select from the crms both crms".

   Brand-neutral, like /api/me and the Users app it serves, because one batch
   may hold leads of BOTH companies. The first wall is the Users app's own
   (`requireBsAdmin`, the "All users" view's owner); the service then demands
   the COMPANY admin of every lead in the batch (ByteForce's is byteforce_staff
   AND bsystems_admin — the single assign route's wall), and `resolveAssignee`
   refuses a target who cannot own a lead of that company. */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const { leadIds } = massAssignSchema.parse(await req.json());
    const result = await massAssignLeads(user, id, leadIds);
    return Response.json({ ok: true, ...result });
  },
);
