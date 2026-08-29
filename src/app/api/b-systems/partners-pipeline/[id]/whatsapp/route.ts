import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { markProspectWhatsappSent } from "@/lib/services/whatsapp";

/* ADR-069 — the partner/agent card's mark. Identical wall to READING one: every
   surface that shows this card (the Partners & Agents board, the prospect
   detail, the partner directory and the Agents list) sits behind
   `requireBsAdminCompanyPage`, so admin is exactly who can see it and therefore
   exactly who may mark it. The data-entry role can CREATE a card but has no
   screen that shows it, so `requireProspectCreator` would have widened the mark
   past its own surface — `requireBsAdmin` is the honest match. */
export const POST = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireBsAdmin();
    const mark = await markProspectWhatsappSent(id, { id: user.id, label: user.name });
    return Response.json({
      ok: true,
      sentAt: mark.sentAt?.toISOString() ?? null,
      sentBy: mark.sentByLabel,
    });
  },
);
