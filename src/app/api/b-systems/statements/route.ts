import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { createStatement, createStatementSchema } from "@/lib/services/statements";

/* V2 §7 — Create a statement from a checked milestone (the Generate→Create flow). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireBsAdmin();
  const input = createStatementSchema.parse(await req.json());
  const statement = await createStatement(input, { id: user.id, label: user.name });
  return Response.json(statement, { status: 201 });
});
