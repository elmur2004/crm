import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { hashPassword } from "@/lib/auth/hash";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import { validateAndStore, storage } from "@/lib/storage";
import { writeLog, type Actor } from "./activity";
import { notifyAdmins } from "./notifications";

/* §8.1 sign-up + the agent's CV. Sign-up creates User (portal_rep, active
   immediately — A-4) + PortalRep + CV attachment in one transaction after the CV
   passes validation. Role⇒identifier invariant: portal_rep ⇒ phone required
   (ADR-016).

   §8.4's profile EDITS (basics, phone, password) moved to the Users app's
   "My account" — services/my-account.ts, for every person, not only agents
   (ADR-103). The CV stays here: it is an agent's alone. */

export const signupSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().refine(isValidPhone, "Enter a valid phone number"),
    /* founder: BOTH identifiers registered — email OR phone signs in later */
    email: z.string().email("Enter a valid email"),
    address: z.string().min(1).max(400),
    speciality: z.string().min(1).max(200),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function signupRep(
  input: z.infer<typeof signupSchema>,
  cv: File,
): Promise<{ userId: string; phone: string }> {
  const phone = normalizePhone(input.phone);
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { phone } })) {
    throw new ApiError(409, "An account with this phone number already exists");
  }
  if (await db.user.findUnique({ where: { email } })) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const storedCv = await validateAndStore("cv", cv);
  const passwordHash = await hashPassword(input.password);
  const name = `${input.firstName} ${input.lastName}`;

  try {
    const userId = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        /* founder: self-signup is an approval REQUEST — pending until the admin
           approves it on Registrations; sign-in is blocked until then */
        data: { name, phone, email, passwordHash, passwordPlain: input.password, registrationStatus: "pending" },
      });
      await tx.userRole.create({ data: { userId: user.id, role: "bsystems_agent" } });
      const rep = await tx.portalRep.create({
        data: {
          userId: user.id,
          firstName: input.firstName,
          lastName: input.lastName,
          address: input.address,
          speciality: input.speciality,
        },
      });
      await tx.attachment.create({
        data: {
          kind: "cv",
          portalRepId: rep.id,
          filename: storedCv.filename,
          storageKey: storedCv.key,
          mime: storedCv.mime,
          size: storedCv.size,
        },
      });
      await writeLog(tx, {
        entityType: "portal_rep",
        entityId: rep.id,
        actor: { id: user.id, label: name },
        action: "create",
        trigger: "signup",
      });
      return user.id;
    });
    await notifyAdmins({
      /* the partner/agent portal is B-Systems' alone (ADR-074). */
      brand: "bsystems",
      type: "registration",
      title: `New agent registration: ${name}`,
      body: `${name} (${email} · ${phone}) requested to join — review it on Registrations.`,
    });
    return { userId, phone };
  } catch (err) {
    await storage.delete(storedCv.key); // don't orphan the CV on a failed signup
    throw err;
  }
}

export async function getRepProfile(userId: string) {
  const rep = await db.portalRep.findUnique({
    where: { userId },
    include: { user: { select: { name: true, phone: true } }, cv: true },
  });
  if (!rep) throw new ApiError(404, "Profile not found");
  return rep;
}

export async function replaceCv(userId: string, cv: File, actor: Actor) {
  const rep = await getRepProfile(userId);
  const storedCv = await validateAndStore("cv", cv);
  const oldKey = rep.cv?.storageKey;
  await db.$transaction(async (tx) => {
    if (rep.cv) await tx.attachment.delete({ where: { id: rep.cv.id } });
    await tx.attachment.create({
      data: {
        kind: "cv",
        portalRepId: rep.id,
        filename: storedCv.filename,
        storageKey: storedCv.key,
        mime: storedCv.mime,
        size: storedCv.size,
      },
    });
    await writeLog(tx, {
      entityType: "portal_rep",
      entityId: rep.id,
      actor,
      action: "update",
      trigger: "cv_replaced",
    });
  });
  if (oldKey) await storage.delete(oldKey);
}
