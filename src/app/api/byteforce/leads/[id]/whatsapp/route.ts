import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { markLeadWhatsappSent } from "@/lib/services/whatsapp";

/* ADR-069 — the ByteForce twin. Same rule, same wall as READING a ByteForce
   lead: the brand has one staff role and every member of it sees every card
   (the no-answer route's precedent), so `requireBrandStaff` is the whole test —
   and the brand itself comes from the ROUTE, never from input, with the
   service's brand-scoped lookup refusing a B-Systems id through this door. */
export const POST = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireBrandStaff("byteforce");
    const mark = await markLeadWhatsappSent("byteforce", id, { id: user.id, label: user.name });
    return Response.json({
      ok: true,
      sentAt: mark.sentAt?.toISOString() ?? null,
      sentBy: mark.sentByLabel,
    });
  },
);
