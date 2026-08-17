import {
  handleRoute,
  isDataEntry,
  requireBsAdmin,
  requireProspectCreator,
} from "@/lib/auth/guards";
import { deleteProspect, updateProspect, updateProspectSchema } from "@/lib/services/partners";
import { assertCanCorrect } from "@/lib/services/data-entry";

/* ADR-051: the ADMIN edits any card. A DATA-ENTRY user may correct one they
   entered, and only while it still sits untouched in the intake column —
   fixing a typo a minute later is the same act as typing it; editing after
   someone has picked the card up is not. */
export const PATCH = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireProspectCreator();
    const { id } = await ctx.params;
    if (isDataEntry(user)) await assertCanCorrect(user, { kind: "prospect", id });
    const input = updateProspectSchema.parse(await req.json());
    const prospect = await updateProspect(id, input, { id: user.id, label: user.name });
    return Response.json(prospect);
  },
);

/* founder V4 — the admin deletes a pipeline card (cascades records + files;
   a converted card also removes its directory Partner, leads keep living). */
export const DELETE = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    await deleteProspect(id, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);
