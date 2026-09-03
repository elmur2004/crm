import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { deleteLead } from "@/lib/services/leads";
import { internalCrmHandlers } from "@/lib/api/internal-crm";

const handlers = internalCrmHandlers("mindoo");
export const PATCH = handlers.updateLead;

/* ADR-074 — DELETE, which this namespace did not have.

   ADR-073 gave Mindoo the lead detail and the Won Leads cards, both of which
   render a Delete button, and not the endpoint behind it: the button existed,
   asked for confirmation, and answered 405. `internalCrmHandlers` has no delete
   because ByteForce's screens do not offer one; Mindoo copies B-SYSTEMS, whose
   screens do.

   The wall is B-Systems' own, verbatim: `requireLeadAccess` resolves the lead
   and its role, and only that company's administrator may delete. For Mindoo
   that is `mindoo_staff` — `isAdmin` is true for it, because it is the whole of
   the company's staff and there is nobody else to be its admin. */
export const DELETE = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user, isAdmin } = await requireLeadAccess(id);
    if (!isAdmin) throw new ApiError(403, "Only the admin can delete a lead");
    await deleteLead("mindoo", id, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);
