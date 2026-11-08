import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { createLead, createLeadSchema } from "@/lib/services/leads";

/* §7.4 / PP-5 — a lead added inside a partner's detail is created in the B-Systems
   CRM with permanent attribution (source=partner, "Partner: {Company}" badge),
   in the partner bucket. Founder 2026-11-08 ("assigned leads only"): a legacy
   rep card decides nobody's visibility, so a `salesRepId` sent here is not
   written — the owner is the partner's account, or nobody (the admin's). */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const partner = await db.partner.findUnique({ where: { id } });
    if (!partner) throw new ApiError(404, "Partner not found");
    const { salesRepId: _legacy, ...input } = createLeadSchema.parse(await req.json());
    void _legacy;
    const lead = await createLead(
      "bsystems",
      input,
      { id: user.id, label: user.name },
      {
        attribution: { partnerId: partner.id },
        // V2 §1: partner-sourced leads live in the partner bucket; owned by the
        // partner's account when one exists (auto-provisioned at conversion)
        ownerType: "partner",
        ownerUserId: partner.userId ?? undefined,
      },
    );
    return Response.json(lead, { status: 201 });
  },
);
