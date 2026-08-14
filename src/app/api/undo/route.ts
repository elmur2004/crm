import { handleRoute, requireUser } from "@/lib/auth/guards";
import { performUndo } from "@/lib/services/undo";

/* ADR-045 — the undo endpoint. Brand-agnostic on purpose: an entry belongs to
   the USER who made the change, and every guard (ownership, recency, integrity,
   single-use, the financial refusals) lives in the service. Any signed-in
   account may call it; it can only ever reach that account's own last action. */

export const POST = handleRoute(async () => {
  const user = await requireUser();
  const { label, labelAr } = await performUndo({ id: user.id, label: user.name });
  return Response.json({ label, labelAr });
});
