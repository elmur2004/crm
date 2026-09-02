import { internalCrmHandlers } from "@/lib/api/internal-crm";

/* ADR-073 — Mindoo's own namespace. The BRAND COMES FROM THE ROUTE, exactly as
   it does for the other two: there is no `?company=` on any API path, because a
   company parameter would be the single way to widen access across companies.
   `internalCrmHandlers` was already brand-generic, so this whole namespace is
   one line per route — the payoff of ADR-067's design. */
const handlers = internalCrmHandlers("mindoo");
export const POST = handlers.createLead;
