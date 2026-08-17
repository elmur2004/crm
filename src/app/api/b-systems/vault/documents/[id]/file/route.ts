import { ApiError } from "@/lib/api-error";
import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { replaceVaultDocumentFile } from "@/lib/services/vault/documents";
import { fieldFile } from "@/lib/services/vault/multipart";

/* ADR-053 — replace the document's file: APPEND, never overwrite. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const file = fieldFile(await req.formData());
    if (!file) throw new ApiError(400, "No file provided");
    return Response.json(
      await replaceVaultDocumentFile(id, file, { id: user.id, label: user.name }),
    );
  },
);
