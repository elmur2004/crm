import { z } from "zod";
import {
  ApiError,
  handleRoute,
  isCompanyAdmin,
  requireBrandLeadAccess,
  requireBrandStaff,
  requireCompanyAdmin,
  requireLeadAccess,
} from "@/lib/auth/guards";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { staffRolesForBrand } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  applyLeadEvent,
  createLead,
  createLeadSchema,
  leadEventSchema,
  resolveAssignee,
  updateLead,
  updateLeadSchema,
} from "@/lib/services/leads";
import { createRep, createRepSchema } from "@/lib/services/sales-reps";
import { writeLog } from "@/lib/services/activity";
import { notifyUser } from "@/lib/services/notifications";
import { updateClient, updateClientSchema } from "@/lib/services/clients";
import type { EngineEvent } from "@/lib/pipeline-engine/types";

/* Route-handler factory for the two internal CRMs. The brand is fixed by the
   API namespace that instantiates the factory (/api/byteforce vs /api/b-systems) —
   never read from client input (ARCHITECTURE §3 brand partitioning).

   Founder (2026-11-08, "assigned leads only" — "Both companies now"): a
   ByteForce teammate who is not the admin works ONLY the leads he owns, so every
   per-lead write below goes through `requireLeadAccess` (404/403 for a lead
   outside his scope, exactly as on B-Systems), and only the company admin may
   pick an owner or hand a follow-up to somebody. */

type Ctx<P> = { params: Promise<P> };

/** The Add-lead form's Owner picker — the ADMIN's, and only the admin's. */
const createOwnerSchema = z.object({ ownerUserId: z.string().min(1).max(64).optional() });

export function internalCrmHandlers(brand: Brand) {
  /** Brand staff, then the brand (404), then the lead's scope (guards.ts). */
  const leadAccess = (id: string) => requireBrandLeadAccess(brand, id);

  return {
    createRep: handleRoute(async (req: Request) => {
      /* founder 2026-11-08 — rep CARDS are legacy (owners are accounts, made in
         the Users app); nothing in the UI adds one any more, so the endpoint is
         the company admin's alone rather than every staff member's */
      await requireCompanyAdmin(brand);
      const input = createRepSchema.parse(await req.json());
      const rep = await createRep(brand, input);
      return Response.json(rep, { status: 201 });
    }),

    createLead: handleRoute(async (req: Request) => {
      const user = await requireBrandStaff(brand);
      const body = await req.json();
      const input = createLeadSchema.parse(body);
      const { ownerUserId: chosen } = createOwnerSchema.parse(body);
      /* founder (2026-11-08) — "from now on a lead a sales/staff user adds is
         automatically theirs": a non-admin's lead is HIS, and he cannot name
         anybody else. The admin picks an owner or leaves it Unassigned (= his). */
      let ownerUserId: string | undefined;
      if (isCompanyAdmin(user, brand)) {
        ownerUserId = chosen ? (await resolveAssignee(brand, chosen)).id : undefined;
      } else {
        if (chosen && chosen !== user.id) {
          throw new ApiError(403, "Only the admin can choose who owns a lead");
        }
        ownerUserId = user.id;
      }
      const actor = { id: user.id, label: user.name };
      const lead = await createLead(brand, input, actor, { ownerUserId });
      /* the admin created it straight into a teammate's hands: the same news a
         hand-over carries — the `assigned` history row and his bell — so the
         lead arrives "visible in his system" with a reason attached */
      if (ownerUserId && ownerUserId !== user.id) {
        await db.$transaction(async (tx) => {
          await writeLog(tx, {
            entityType: "lead",
            entityId: lead.id,
            actor,
            action: "update",
            trigger: "assigned",
          });
          await notifyUser(tx, {
            userId: ownerUserId!,
            type: "assigned",
            title: `Assigned to you: ${lead.name}`,
            body: `${actor.label} made you the owner of "${lead.name}".`,
            leadId: lead.id,
          });
        });
      }
      return Response.json(lead, { status: 201 });
    }),

    updateLead: handleRoute(async (req: Request, ctx: Ctx<{ id: string }>) => {
      const { id } = await ctx.params;
      const { user } = await leadAccess(id);
      const input = updateLeadSchema.parse(await req.json());
      const lead = await updateLead(brand, id, input, { id: user.id, label: user.name });
      return Response.json(lead);
    }),

    applyLeadEvent: handleRoute(async (req: Request, ctx: Ctx<{ id: string }>) => {
      const { id } = await ctx.params;
      const { user, isAdmin } = await leadAccess(id);
      const input = leadEventSchema.parse(await req.json());
      /* "Hand this follow-up to" is the company admin's alone (server-side) */
      if (input.assignTo && !isAdmin) {
        throw new ApiError(403, "Only the admin can hand a follow-up to someone");
      }
      const result = await applyLeadEvent({
        brand,
        leadId: id,
        event: input.event as EngineEvent,
        group: input.group,
        actor: { id: user.id, label: user.name },
        role: staffRolesForBrand(brand)[0]!, // byteforce_staff (factory serves ByteForce only in V2)
        assignTo: input.assignTo,
        canHandOver: isAdmin,
      });
      return Response.json(result);
    }),

    updateClient: handleRoute(async (req: Request, ctx: Ctx<{ id: string }>) => {
      const user = await requireBrandStaff(brand);
      const { id } = await ctx.params;
      /* a client is a won LEAD's card: a non-admin edits only the clients of
         leads he owns (the Clients page shows him nothing else) */
      if (!isCompanyAdmin(user, brand)) {
        const client = await db.client.findUnique({ where: { id }, select: { leadId: true } });
        if (!client?.leadId) throw new ApiError(404, "Client not found");
        await requireLeadAccess(client.leadId, user);
      }
      const input = updateClientSchema.parse(await req.json());
      const client = await updateClient(brand, id, input, { id: user.id, label: user.name });
      return Response.json(client);
    }),
  };
}
