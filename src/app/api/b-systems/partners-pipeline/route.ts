import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { createProspect, createProspectSchema } from "@/lib/services/partners";

export const POST = handleRoute(async (req: Request) => {
  const user = await requireBsAdmin();
  const input = createProspectSchema.parse(await req.json());
  const prospect = await createProspect(input, { id: user.id, label: user.name });
  return Response.json(prospect, { status: 201 });
});
