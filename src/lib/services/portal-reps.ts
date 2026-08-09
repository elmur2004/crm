import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import { validateAndStore, storage } from "@/lib/storage";
import { writeLog, type Actor } from "./activity";

/* §8.1 sign-up + §8.4 profile. Sign-up creates User (portal_rep, active
   immediately — A-4) + PortalRep + CV attachment in one transaction after the CV
   passes validation. Role⇒identifier invariant: portal_rep ⇒ phone required
   (ADR-016). Profile: basics editable, CV replaceable, password change; phone
   change intentionally NOT offered (A-10 carve-out). */

export const signupSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().refine(isValidPhone, "Enter a valid phone number"),
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
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) throw new ApiError(409, "An account with this phone number already exists");

  const storedCv = await validateAndStore("cv", cv);
  const passwordHash = await hashPassword(input.password);
  const name = `${input.firstName} ${input.lastName}`;

  try {
    const userId = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, phone, passwordHash }, // active default true (A-4)
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

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(400).optional(),
  speciality: z.string().min(1).max(200).optional(),
});

export async function updateRepProfile(
  userId: string,
  input: z.infer<typeof updateProfileSchema>,
  actor: Actor,
) {
  const rep = await getRepProfile(userId);
  return db.$transaction(async (tx) => {
    const updated = await tx.portalRep.update({
      where: { id: rep.id },
      data: {
        ...(input.firstName !== undefined && { firstName: input.firstName }),
        ...(input.lastName !== undefined && { lastName: input.lastName }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.speciality !== undefined && { speciality: input.speciality }),
      },
    });
    if (input.firstName || input.lastName) {
      await tx.user.update({
        where: { id: userId },
        data: {
          name: `${input.firstName ?? rep.firstName} ${input.lastName ?? rep.lastName}`,
        },
      });
    }
    await writeLog(tx, {
      entityType: "portal_rep",
      entityId: rep.id,
      actor,
      action: "update",
      trigger: "profile_edit",
    });
    return updated;
  });
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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "At least 8 characters"),
});

export async function changePassword(
  userId: string,
  input: z.infer<typeof changePasswordSchema>,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) throw new ApiError(403, "Current password is wrong");
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
}
