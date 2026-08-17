import { z } from "zod";
import { handleRoute, isDataEntry, requireRole } from "@/lib/auth/guards";
import { bsRoleOf, bucketFor } from "@/lib/api/bsystems";
import { createLead, createLeadSchema } from "@/lib/services/leads";
import { notifyAdminsOfEntry } from "@/lib/services/data-entry";

/* founder: on B-Systems, the company name is MANDATORY at creation.
   (ByteForce + partner-attributed routes keep the shared optional schema.) */
const bsCreateLeadSchema = createLeadSchema.extend({
  companyName: z.string().min(1, "Company name is required").max(200),
});

/* V2 §2.2 — role-aware creation: admins → admin bucket, agents/partners → their
   own bucket, sales → internal. ADR-051 adds data entry, which lands in the
   SAME internal-and-unowned state A-6 already means by "unassigned" — and tells
   the admins about it, because a lead nobody owns needs someone to notice. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireRole(
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
    "bsystems_data_entry", // ADR-051 — adding is their whole permission set
  );
  const role = bsRoleOf(user);
  const { ownerType, owned } = bucketFor(role);
  const input = bsCreateLeadSchema.parse(await req.json());
  /* a data-entry user never picks a rep either — the admin decides everything
     about ownership afterwards */
  const entering = isDataEntry(user);
  const lead = await createLead(
    "bsystems",
    entering ? { ...input, salesRepId: undefined } : input,
    { id: user.id, label: user.name },
    { ownerType, ownerUserId: owned ? user.id : undefined },
  );
  if (entering) {
    await notifyAdminsOfEntry({ leadId: lead.id, leadName: lead.name, by: user.name });
  }
  return Response.json(lead, { status: 201 });
});
