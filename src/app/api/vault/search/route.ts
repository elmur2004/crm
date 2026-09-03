import { handleRoute, requireVault } from "@/lib/auth/guards";
import { searchVault } from "@/lib/services/vault/search";
import { vaultCompaniesOf } from "@/lib/services/vault/tenancy";

/* ADR-053 — grouped vault search (metadata only, archived excluded). */

export const GET = handleRoute(async (req: Request) => {
  const user = await requireVault();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json(await searchVault(q, vaultCompaniesOf(user)));
});
