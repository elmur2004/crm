import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { createUser, createUserSchema } from "@/lib/services/users";

/* V2 §2.10 — admin creates accounts with role/entity assignment. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireBsAdmin();
  const input = createUserSchema.parse(await req.json());
  const created = await createUser(input, "bsystems", { id: user.id, label: user.name });
  return Response.json({ id: created.id }, { status: 201 });
});
