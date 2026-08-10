import { handleRoute } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { signupRep, signupSchema } from "@/lib/services/portal-reps";

/* V2 — agent sign-up (unchanged flow, ADR-030): public multipart with required CV. */

export const POST = handleRoute(async (req: Request) => {
  const form = await req.formData();
  const cv = form.get("cv");
  if (!(cv instanceof File)) throw new ApiError(400, "CV file is required");
  const input = signupSchema.parse({
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    phone: form.get("phone"),
    email: form.get("email"),
    address: form.get("address"),
    speciality: form.get("speciality"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });
  const result = await signupRep(input, cv);
  return Response.json({ ok: true, phone: result.phone, userId: result.userId }, { status: 201 });
});
