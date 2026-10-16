import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { acctCompanyOf } from "@/lib/accounting/tenancy";
import { acctRefusalResponse, attempt } from "@/lib/accounting/undo-reasons";
import { performAcctRedo } from "@/lib/services/accounting-undo";

/* ADR-086 — the accounting Redo endpoint: put back what this account's last
   accounting undo reversed. Same guard, same company wall, same service guards
   and the same `{ error, reason }` refusal body as ../undo/route.ts — see the
   note there for all four, including why the body is shaped in the route
   instead of in the shared `handleRoute`. Redo never offers an undo entry and
   vice versa; the direction is a flag inside the entry's payload, not something
   a caller can ask for. */

export const POST = handleRoute(async (req: Request) => {
  try {
    const user = await attempt("not_permitted", [403], () => requireAccounting());
    const body = (await req.json().catch(() => ({}))) as { company?: unknown };
    const company = await attempt("no_company", [400, 404], () =>
      acctCompanyOf(user, body.company),
    );
    const { label, labelAr } = await performAcctRedo(
      { id: user.id, label: user.name },
      company,
    );
    return Response.json({ ok: true, label, labelAr });
  } catch (err) {
    const refusal = acctRefusalResponse(err);
    if (refusal) return refusal;
    throw err;
  }
});
