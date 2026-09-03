import { ApiError } from "@/lib/api-error";
import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultRowVisible } from "@/lib/services/vault/tenancy";
import { replaceVaultDocumentFile } from "@/lib/services/vault/documents";
import { fieldFile } from "@/lib/services/vault/multipart";

/* ADR-053 — replace the document's file: APPEND, never overwrite. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireVault();
    const { id } = await ctx.params;
    /* ADR-074 — this record must belong to a company this account can
       see; an id alone is no longer proof of that. */
    await assertVaultRowVisible(user, "document", id);
    const file = fieldFile(await req.formData());
    if (!file) throw new ApiError(400, "No file provided");
    return Response.json(
      await replaceVaultDocumentFile(id, file, { id: user.id, label: user.name }),
    );
  },
);
