import { handleRoute, requireLeadAccess } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { addCommentSchema, addLeadComment } from "@/lib/services/comments";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* Shared POST handler for both brand namespaces (brand comes from the ROUTE
   and must match the lead — ADR-005 partitioning). Access = requireLeadAccess:
   the exact set of people who can open the lead can chat inside it. */

export function makeCommentsPost(brand: Brand) {
  return handleRoute(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const { user } = await requireLeadAccess(id);
    const lead = await db.lead.findUniqueOrThrow({ where: { id }, select: { brand: true } });
    if (lead.brand !== brand) throw new ApiError(404, "Lead not found");
    const { body } = addCommentSchema.parse(await req.json());
    /* impersonation transparency: a message posted while acting-as carries
       "(via <admin>)" — teammates read chat as the person's own words */
    const via = user.impersonatorId
      ? ((await db.user.findUnique({ where: { id: user.impersonatorId }, select: { name: true } }))
          ?.name ?? "admin")
      : undefined;
    const comment = await addLeadComment({
      leadId: id,
      body,
      author: { id: user.id, name: user.name },
      via,
    });
    return Response.json(comment, { status: 201 });
  });
}
