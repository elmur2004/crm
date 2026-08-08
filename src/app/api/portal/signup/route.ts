import { handleRoute } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { signupRep, signupSchema } from "@/lib/services/portal-reps";

/* §8.1 — public sign-up (multipart: fields + required CV). Account is active
   immediately (A-4); the client then signs in through the portal provider. */

export const POST = handleRoute(async (req: Request) => {
  const form = await req.formData();
  const cv = form.get("cv");
  if (!(cv instanceof File)) throw new ApiError(400, "CV file is required");
  const input = signupSchema.parse({
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    phone: form.get("phone"),
    address: form.get("address"),
    speciality: form.get("speciality"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });
  const result = await signupRep(input, cv);
  return Response.json({ ok: true, phone: result.phone }, { status: 201 });
});
