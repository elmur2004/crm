import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { markLeadWhatsappSent } from "@/lib/services/whatsapp";

/* ADR-069 — "we have contacted this lead through WhatsApp", recorded.

   The wall is the SAME `requireLeadAccess` that governs reading this lead:
   whoever can open the card is the person doing the messaging, so whoever can
   open it may say so — and nobody can mark a lead he cannot see. The actor is
   derived from the SESSION inside that guard; there is no body on this request
   at all, so a client cannot claim to be somebody else (nor can it, as the chip
   fires this with `navigator.sendBeacon`, which sends none).

   NO ZOD SCHEMA, deliberately: with no input there is nothing to validate, and
   an empty-body parse would 400 the very beacon shape this endpoint exists for. */
export const POST = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user } = await requireLeadAccess(id);
    const mark = await markLeadWhatsappSent("bsystems", id, { id: user.id, label: user.name });
    return Response.json({
      ok: true,
      sentAt: mark.sentAt?.toISOString() ?? null,
      sentBy: mark.sentByLabel,
    });
  },
);
