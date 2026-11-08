import { handleRoute, requireBrandLeadAccess } from "@/lib/auth/guards";
import { markLeadWhatsappSent } from "@/lib/services/whatsapp";

/* ADR-069 — the ByteForce twin. Same rule, same wall as READING a ByteForce
   lead (founder 2026-11-08: the admin any lead, everybody else his own), so
   `requireLeadAccess` is the test — and the brand itself comes from the ROUTE,
   never from input, with the service's brand-scoped lookup refusing a
   B-Systems id through this door. */
export const POST = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    /* founder (2026-11-08) — a non-admin works only the leads he owns: the
       namespace's staff wall, the brand (404), then the lead's own (403) */
    const { user } = await requireBrandLeadAccess("byteforce", id);
    const mark = await markLeadWhatsappSent("byteforce", id, { id: user.id, label: user.name });
    return Response.json({
      ok: true,
      sentAt: mark.sentAt?.toISOString() ?? null,
      sentBy: mark.sentByLabel,
    });
  },
);
