import { handleRoute, isDataEntry, requireProspectCreator } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { setProspectCv } from "@/lib/services/partners";
import { assertCanCorrect } from "@/lib/services/data-entry";

/* Founder: an AGENT card carries the same CV a self-applied agent uploads. It
   can arrive with the card or later — at the Won gate it moves onto the created
   agent's profile, so the two routes into the system end up identical. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireProspectCreator();
    const { id } = await ctx.params;
    /* ADR-051: an admin may attach a CV to any card; a data-entry user only to
       one they entered and nobody has picked up — the CV is part of ADDING. */
    if (isDataEntry(user)) await assertCanCorrect(user, { kind: "prospect", id });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided");
    const attachment = await setProspectCv(id, file, { id: user.id, label: user.name });
    return Response.json(attachment, { status: 201 });
  },
);
