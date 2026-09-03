import { handleRoute, requireRole } from "@/lib/auth/guards";
import { createUser, createUserSchema } from "@/lib/services/users";

/* ADR-075 — MINDOO CREATES ITS OWN PEOPLE.

   Founder: "mindoo user should appear in mindoo system not in bsystems systems
   separate their users." The scope literal is the whole wall on this side: the
   service refuses any role a Mindoo administrator may not grant, so this route
   cannot mint a B-Systems account however the body is shaped. Same shape as the
   B-Systems twin, same service, different company — derived from the ROUTE and
   never from input, exactly as every other /api/mindoo endpoint. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireRole("mindoo_staff");
  const input = createUserSchema.parse(await req.json());
  const created = await createUser(input, "mindoo", { id: user.id, label: user.name });
  return Response.json({ id: created.id }, { status: 201 });
});
