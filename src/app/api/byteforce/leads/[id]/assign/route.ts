import { z } from "zod";
import { handleRoute, requireCompanyAdmin } from "@/lib/auth/guards";
import { assignLeadOwner } from "@/lib/services/leads";

/* Founder (2026-11-08) — "whenever I assign a lead for a new user, a new sales
   especially the internal sales, they can see the lead then", and "Both
   companies now": the ByteForce twin of /api/b-systems/leads/[id]/assign.

   THE BYTEFORCE ADMIN ONLY (lib/auth/lead-scope.ts: byteforce_staff AND
   bsystems_admin) — handing a lead to somebody is a management act, so the wall
   is the company-admin guard, not requireLeadAccess (a teammate must never push
   his lead onto a colleague, nor pull one to himself). The BRAND is the ROUTE.
   assignLeadOwner re-checks the lead's brand (404 for a B-Systems id through
   this door), refuses archived leads, and refuses a target that is not an
   active, approved ByteForce staff account. */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireCompanyAdmin("byteforce");
    const { id } = await ctx.params;
    const { userId } = z.object({ userId: z.string().min(1) }).parse(await req.json());
    const lead = await assignLeadOwner(id, userId, { id: user.id, label: user.name }, "byteforce");
    return Response.json({ ok: true, ownerUserId: lead.ownerUserId, ownerType: lead.ownerType });
  },
);
