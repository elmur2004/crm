import { handleRoute, requireProspectCreator } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { createProspect, createProspectSchema } from "@/lib/services/partners";

/* Founder: one board, two kinds of card. A PARTNER card posts the original JSON
   body unchanged; an AGENT card posts multipart, because its field set mirrors
   the public signup form — CV included. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireProspectCreator();
  const contentType = req.headers.get("content-type") ?? "";

  let raw: unknown;
  let cv: File | undefined;
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("cv");
    if (file instanceof File && file.size > 0) cv = file;
    else if (file !== null && !(file instanceof File)) throw new ApiError(400, "Invalid CV upload");
    const text = (key: string) => {
      const value = form.get(key);
      return typeof value === "string" && value.trim() !== "" ? value : undefined;
    };
    raw = {
      kind: text("kind"),
      name: text("name"),
      companyName: text("companyName"),
      role: text("role"),
      email: text("email"),
      number: text("number"),
      businessActivity: text("businessActivity"),
      address: text("address"),
      speciality: text("speciality"),
      description: text("description"),
    };
  } else {
    raw = await req.json();
  }

  const input = createProspectSchema.parse(raw);
  const prospect = await createProspect(input, { id: user.id, label: user.name }, { cv });
  return Response.json(prospect, { status: 201 });
});
