import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { markReadyToClose } from "@/lib/services/leads";

/* V2 §3 — "Mark ready to close": any active stage, any role with lead access.

   ADR-074 — Mindoo's twin of the B-Systems route, and it was MISSING. ADR-073
   gave Mindoo the B-Systems board and lead detail but not this endpoint, so the
   "Mark ready to close" link those screens render posted into B-Systems'
   namespace and was refused: a control that could never do anything. The brand
   comes from the ROUTE, as it does everywhere in these namespaces, and
   `requireLeadAccess` then re-checks the specific lead. */

export const POST = handleRoute(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user } = await requireLeadAccess(id);
    const lead = await markReadyToClose("mindoo", id, { id: user.id, label: user.name });
    return Response.json({ ok: true, readyToClose: lead.readyToClose });
  },
);
