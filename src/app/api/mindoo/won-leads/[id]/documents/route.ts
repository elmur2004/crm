import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { addWonDocument } from "@/lib/services/won-leads";

/* V2 §5 — proposal / contract uploads on a won lead.

   ADR-074 — Mindoo's twin, and the reason `addWonDocument` now takes a brand:
   the deal must belong to THIS company or the lookup 404s. Without it the id
   alone would have been enough to attach a document to another company's deal
   from here. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBrandStaff("mindoo");
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "");
    if (!(file instanceof File)) throw new ApiError(400, "No file provided");
    if (kind !== "proposal" && kind !== "contract") throw new ApiError(400, "Bad document kind");
    const attachment = await addWonDocument(id, "mindoo", kind, file, {
      id: user.id,
      label: user.name,
    });
    return Response.json(attachment, { status: 201 });
  },
);
