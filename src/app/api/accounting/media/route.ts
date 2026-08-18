import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import {
  mediaReceived,
  mediaReceivedSchema,
  mediaSent,
  mediaSentSchema,
} from "@/lib/services/accounting";

/* ADR-052 — media pass-through. ADMIN ONLY, and refused outright for
   company=bsystems (founder decision 5: B-Systems hides Media Buying).
   mode "received": ledger + fee income + held-budget deposit, atomically.
   mode "sent": ledger + tagged withdrawal. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireBsAdmin();
  const body = (await req.json()) as Record<string, unknown>;
  const actor = { id: user.id, label: user.name };
  if (body["mode"] === "received") {
    const input = mediaReceivedSchema.parse(body);
    return Response.json(await mediaReceived(input, actor), { status: 201 });
  }
  if (body["mode"] === "sent") {
    const input = mediaSentSchema.parse(body);
    return Response.json(await mediaSent(input, actor), { status: 201 });
  }
  throw new ApiError(400, "mode must be received or sent");
});
