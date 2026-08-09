import { handleRoute, requireRole } from "@/lib/auth/guards";
import { bsRoleOf, bucketFor } from "@/lib/api/bsystems";
import { createLead, createLeadSchema } from "@/lib/services/leads";

/* V2 §2.2 — role-aware creation: admins → admin bucket, agents/partners → their
   own bucket, sales → internal. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireRole(
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  const role = bsRoleOf(user);
  const { ownerType, owned } = bucketFor(role);
  const input = createLeadSchema.parse(await req.json());
  const lead = await createLead(
    "bsystems",
    input,
    { id: user.id, label: user.name },
    { ownerType, ownerUserId: owned ? user.id : undefined },
  );
  return Response.json(lead, { status: 201 });
});
