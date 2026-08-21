import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { agentAccountSchema, partnerLoginSchema } from "@/lib/services/groups";
import { createAgentAccount, createPartnerLogin, getProspect } from "@/lib/services/partners";

/* §7.2b / PP-4a — creating the login, as its own explicit step.

   Founder (ADR-059): moving a card to Qualified must never ask for an email or
   a password, so the account is minted here instead, afterwards, on purpose.

   `requireBsAdmin` deliberately, NOT `requireProspectCreator`: the data-entry
   role (ADR-051) may add cards and nothing else, and minting a login from a
   data-entry session would be a real privilege escalation. Every other
   precondition — right kind, card already Qualified, no account yet, email and
   phone free — is enforced in the service, so no client can skip one. */
export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const body: unknown = await req.json();
    const actor = { id: user.id, label: user.name };
    /* the card's own kind decides which form this is — never a client-supplied
       discriminator, which would let a partner card be sent down the agent path */
    const prospect = await getProspect(id);
    const result =
      prospect.kind === "agent"
        ? await createAgentAccount(id, agentAccountSchema.parse(body), actor)
        : await createPartnerLogin(id, partnerLoginSchema.parse(body), actor);
    return Response.json(result, { status: 201 });
  },
);
