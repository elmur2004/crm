import { handleRoute, requireBrandStaff } from "@/lib/auth/guards";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { staffRoleForBrand } from "@/lib/auth/guards";
import {
  applyLeadEvent,
  createLead,
  createLeadSchema,
  leadEventSchema,
  updateLead,
  updateLeadSchema,
} from "@/lib/services/leads";
import { createRep, createRepSchema } from "@/lib/services/sales-reps";
import { updateClient, updateClientSchema } from "@/lib/services/clients";
import type { EngineEvent } from "@/lib/pipeline-engine/types";

/* Route-handler factory for the two internal CRMs. The brand is fixed by the
   API namespace that instantiates the factory (/api/byteforce vs /api/b-systems) —
   never read from client input (ARCHITECTURE §3 brand partitioning). */

type Ctx<P> = { params: Promise<P> };

export function internalCrmHandlers(brand: Brand) {
  return {
    createRep: handleRoute(async (req: Request) => {
      await requireBrandStaff(brand);
      const input = createRepSchema.parse(await req.json());
      const rep = await createRep(brand, input);
      return Response.json(rep, { status: 201 });
    }),

    createLead: handleRoute(async (req: Request) => {
      const user = await requireBrandStaff(brand);
      const input = createLeadSchema.parse(await req.json());
      const lead = await createLead(brand, input, { id: user.id, label: user.name });
      return Response.json(lead, { status: 201 });
    }),

    updateLead: handleRoute(async (req: Request, ctx: Ctx<{ id: string }>) => {
      const user = await requireBrandStaff(brand);
      const { id } = await ctx.params;
      const input = updateLeadSchema.parse(await req.json());
      const lead = await updateLead(brand, id, input, { id: user.id, label: user.name });
      return Response.json(lead);
    }),

    applyLeadEvent: handleRoute(async (req: Request, ctx: Ctx<{ id: string }>) => {
      const user = await requireBrandStaff(brand);
      const { id } = await ctx.params;
      const input = leadEventSchema.parse(await req.json());
      const result = await applyLeadEvent({
        brand,
        leadId: id,
        event: input.event as EngineEvent,
        group: input.group,
        actor: { id: user.id, label: user.name },
        role: staffRoleForBrand(brand),
      });
      return Response.json(result);
    }),

    updateClient: handleRoute(async (req: Request, ctx: Ctx<{ id: string }>) => {
      const user = await requireBrandStaff(brand);
      const { id } = await ctx.params;
      const input = updateClientSchema.parse(await req.json());
      const client = await updateClient(brand, id, input, { id: user.id, label: user.name });
      return Response.json(client);
    }),
  };
}
