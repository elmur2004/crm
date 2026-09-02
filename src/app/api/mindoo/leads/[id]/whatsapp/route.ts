import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import { markLeadWhatsappSent } from "@/lib/services/whatsapp";

/* ADR-069 / ADR-073 — Mindoo's WhatsApp mark. Same rule and same wall as
   READING a Mindoo lead; the service's brand-scoped lookup refuses another
   company's id through this door. */
export const POST = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireBrandStaff("mindoo");
    const mark = await markLeadWhatsappSent("mindoo", id, { id: user.id, label: user.name });
    return Response.json({
      ok: true,
      sentAt: mark.sentAt?.toISOString() ?? null,
      sentBy: mark.sentByLabel,
    });
  },
);
