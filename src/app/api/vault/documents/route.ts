import { ApiError } from "@/lib/api-error";
import { handleRoute, requireVault } from "@/lib/auth/guards";
import { createVaultDocument, vaultDocumentSchema } from "@/lib/services/vault/documents";
import { fieldFile, fieldStr } from "@/lib/services/vault/multipart";

/* ADR-053 — create a document (multipart: fields + REQUIRED file). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireVault();
  const form = await req.formData();
  const input = vaultDocumentSchema.parse({
    company: fieldStr(form, "company"),
    name: fieldStr(form, "name"),
    description: fieldStr(form, "description"),
    type: fieldStr(form, "type"),
  });
  const file = fieldFile(form);
  if (!file) throw new ApiError(400, "Choose a file — a document is its file.");
  const row = await createVaultDocument(input, file, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
