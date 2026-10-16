import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { acctCompanyOf } from "@/lib/accounting/tenancy";
import { acctRefusalResponse, attempt } from "@/lib/accounting/undo-reasons";
import { performAcctUndo } from "@/lib/services/accounting-undo";

/* ADR-086 — the accounting Undo endpoint. Founder: "add an undo and redo button
   for the accounting system"; one step, personal.

   The SAME wall as every other accounting route, for the same two reasons
   (ADR-066 + ADR-074): `requireAccounting()` is the module guard, so admin is
   the floor and a per-admin flag can take Accounting away on top of it (a role
   check written here by hand would miss the flag, and
   module-access.integration.test reads this directory to make sure nobody
   writes one), and `acctCompanyOf` is the company wall — `company` arrives on
   the wire, so it is checked against this account's live roles rather than
   trusted. A company this account does not hold is a 404, never a 403, because
   a 403 on a valid company name confirms that company exists (ADR-073/074).

   Everything else is in the service: ownership, the company inside the
   payload, the ten-minute window, the fingerprint, the single-use claim. This
   route can only ever reach this account's own last accounting action.

   THE REFUSAL BODY. A refusal answers with `{ error, reason }`: the same human
   message it always sent, plus a one-word machine code so the browser picks the
   bookkeeper's explanation from DATA instead of pattern-matching English prose
   (see lib/accounting/undo-reasons.ts for why that mattered). `handleRoute` is
   shared by some forty endpoints and only ever sends `{ error }`, so it is not
   widened here: the body is shaped INSIDE this route on the way out, and
   anything that is not a coded refusal is re-thrown untouched so the shared
   handler answers it exactly as it answers every other route's (401 Not signed
   in, a ZodError, an unexpected 500). The two guards cannot carry codes of
   their own — they are shared too — so `attempt` labels each guard CALL with
   the reason that guard's refusals mean, which is structural rather than
   another text match, and labels only the statuses that guard really raises. */

export const POST = handleRoute(async (req: Request) => {
  try {
    const user = await attempt("not_permitted", [403], () => requireAccounting());
    const body = (await req.json().catch(() => ({}))) as { company?: unknown };
    const company = await attempt("no_company", [400, 404], () =>
      acctCompanyOf(user, body.company),
    );
    const { label, labelAr } = await performAcctUndo(
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
