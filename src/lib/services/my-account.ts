import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import type { Role } from "@/lib/pipeline-engine/constants";
import { writeLog, type Actor } from "./activity";
import { BOOTSTRAP_ADMIN_EMAILS, isReservedAdminEmail } from "./bootstrap";

/* ============================================================================
   MY ACCOUNT — every person edits his own details (ADR-103).

   Founder, 2026-11-14: "If it's for a normal user, he can click on it [the
   Users icon] to change his information too, so he can change his name, he can
   change his password and all of that."

   What a person may change about HIMSELF, and nothing else:

     name            his own; an AGENT's is his first + last name (the profile
                     he signed up with), and a PARTNER account's is its
                     company's name, which the admin keeps (the partner record
                     is the admin's — "ask the admin to correct anything")
     email, phone    the two sign-in identifiers. At least ONE must remain (you
                     sign in with one of them), an agent who has a phone keeps
                     it (ADR-016: an agent signs in with it), and nobody may
                     take one of the healer's addresses (below)
     address,        an agent's profile basics (§8.4, A-10)
     speciality
     password        with the CURRENT password, always

   NEVER his roles, his module flags, whether he is active or approved: those
   are the admin's, in the same Users app, through /api/b-systems/users and
   `requireBsAdmin`. The schemas below simply have no such keys, and zod drops
   anything it was not told about — a request that sends `roles` changes
   nothing (my-account.integration.test proves it).

   THE PINNED ADMIN (bootstrap.ts) keeps two things out of his own hands, for
   the healer's sake: his EMAIL is the key the healer finds him by (change it
   and the next sign-in would create a second admin), and his PASSWORD is
   re-asserted from ADMIN_PASSWORD on every sign-in (a change here would be
   silently undone). Both are refused with the reason, here in the service.
   And the healer's addresses are NOBODY ELSE'S (`isReservedAdminEmail`): an
   account sitting on the legacy one would be renamed into the admin the first
   time he is missing at a sign-in (the pre-push review's finding).

   WHO IS AN AGENT, OR A PARTNER, HERE: the role AND the record together — an
   agent holds `bsystems_agent` and has his profile (PortalRep); a partner
   account holds `bsystems_partner` and is its company's login (Partner.userId).
   An agent the admin made in Users has no profile, so he edits a plain name; a
   former agent who still has one is a person, with no CV to replace.

   `passwordPlain` follows every password change — the founder's standing
   directive that the admin sees every password (schema comment on User).
   ========================================================================== */

export type AccountKind = "agent" | "partner" | "person";

/** The pinned, self-healing admin accounts — never their email or password. */
export function isPinnedAdminEmail(email: string | null): boolean {
  return email !== null && BOOTSTRAP_ADMIN_EMAILS.includes(email);
}

/** The role AND the record (see the header). One function for the view and
    the write, so the form and the rule cannot disagree. */
function kindOf(u: {
  roles: Array<{ role: string }>;
  portalRep: unknown;
  partner: unknown;
}): AccountKind {
  const roles = u.roles.map((r) => r.role);
  if (u.portalRep && roles.includes("bsystems_agent")) return "agent";
  if (u.partner && roles.includes("bsystems_partner")) return "partner";
  return "person";
}

/** Who did it, as the History says it: the person — or, while the admin is
    acting as him, "<person> (via <admin>)", the chat's impersonation rule
    (lib/api/leadComments.ts). */
export async function selfActor(user: {
  id: string;
  name: string;
  impersonatorId: string | null;
}): Promise<Actor> {
  if (!user.impersonatorId) return { id: user.id, label: user.name };
  const admin = await db.user.findUnique({
    where: { id: user.impersonatorId },
    select: { name: true },
  });
  return { id: user.id, label: `${user.name} (via ${admin?.name ?? "admin"})` };
}

/** Everything the My account view shows — the person's own row only. */
export async function getMyAccount(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      portalRep: { include: { cv: { select: { id: true, filename: true } } } },
      partner: true,
    },
  });
  if (!user) throw new ApiError(404, "Account not found");
  const kind = kindOf(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    roles: user.roles.map((r) => r.role as Role),
    kind,
    pinned: isPinnedAdminEmail(user.email),
    agent:
      kind === "agent" && user.portalRep
        ? {
            firstName: user.portalRep.firstName,
            lastName: user.portalRep.lastName,
            address: user.portalRep.address,
            speciality: user.portalRep.speciality,
            cv: user.portalRep.cv,
          }
        : null,
    partner:
      kind === "partner" && user.partner
        ? {
            companyName: user.partner.companyName,
            keyPersonName: user.partner.keyPersonName,
            keyPersonRole: user.partner.keyPersonRole,
            number: user.partner.number,
            email: user.partner.email,
            address: user.partner.address,
            businessActivity: user.partner.businessActivity,
            dateJoined: user.partner.dateJoined,
          }
        : null,
  };
}

export type MyAccount = Awaited<ReturnType<typeof getMyAccount>>;

/* An identifier field: "" clears it, anything else must be valid. Trimmed
   first, so a pasted address with a trailing space is not "invalid". */
const emailField = z
  .string()
  .max(200)
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email");
const phoneField = z
  .string()
  .max(40)
  .transform((v) => v.trim())
  .refine((v) => v === "" || isValidPhone(v), "Enter a valid phone number");
const text = (max: number, message: string) =>
  z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, message)
    .refine((v) => v.length <= max, `At most ${max} characters`);

export const myAccountSchema = z.object({
  name: text(200, "Enter your name").optional(),
  firstName: text(100, "Enter your first name").optional(),
  lastName: text(100, "Enter your last name").optional(),
  email: emailField.optional(),
  phone: phoneField.optional(),
  address: text(400, "Enter your address").optional(),
  speciality: text(200, "Enter your speciality").optional(),
});

export type MyAccountInput = z.infer<typeof myAccountSchema>;

/** A unique-constraint race (two people taking the same address at once)
    reads as the clash it is, never as a 500. */
function isUniqueClash(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: unknown }).code === "P2002");
}

export async function updateMyAccount(userId: string, input: MyAccountInput, actor: Actor) {
  const me = await db.user.findUnique({
    where: { id: userId },
    include: { roles: true, portalRep: true, partner: { select: { id: true } } },
  });
  if (!me) throw new ApiError(404, "Account not found");
  const kind = kindOf(me);
  const isAgentRole = me.roles.some((r) => r.role === "bsystems_agent");

  /* a field that is not this person's to send is REFUSED, not ignored — an
     ignored field would let a form believe it saved something it did not */
  const agentOnly = [input.firstName, input.lastName, input.address, input.speciality];
  if (kind !== "agent" && agentOnly.some((v) => v !== undefined)) {
    throw new ApiError(400, "Only an agent's profile has a first name, last name, address and speciality");
  }
  if (kind === "agent" && input.name !== undefined) {
    throw new ApiError(400, "Change your first and last name instead");
  }
  if (kind === "partner" && input.name !== undefined && input.name !== me.name) {
    throw new ApiError(400, "Your account carries your company's name — ask the admin to change it");
  }

  const email = input.email === undefined ? me.email : input.email || null;
  const phone =
    input.phone === undefined ? me.phone : input.phone ? normalizePhone(input.phone) : null;
  if (isPinnedAdminEmail(me.email) && email !== me.email) {
    throw new ApiError(400, "The main admin's email is fixed — the system recognises the admin by it");
  }
  if (email && email !== me.email && isReservedAdminEmail(email)) {
    throw new ApiError(409, "That email is reserved for the main admin");
  }
  if (!email && !phone) {
    throw new ApiError(400, "Keep an email or a phone — you sign in with one of them");
  }
  /* ADR-016 — an agent signs in with his phone. One the admin made in Users
     may have none (Add user asks for an email OR a phone), so the rule is that
     a phone he HAS is never taken away, not that he must add one to save. */
  if (isAgentRole && me.phone && !phone) {
    throw new ApiError(400, "An agent signs in with his phone — it cannot be removed");
  }
  if (email && email !== me.email) {
    const clash = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (clash && clash.id !== userId) throw new ApiError(409, "That email belongs to another account");
  }
  if (phone && phone !== me.phone) {
    const clash = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (clash && clash.id !== userId) throw new ApiError(409, "That phone belongs to another account");
  }

  try {
    await db.$transaction(async (tx) => {
      let name = kind === "person" && input.name !== undefined ? input.name : me.name;
      if (kind === "agent" && me.portalRep) {
        const rep = await tx.portalRep.update({
          where: { id: me.portalRep.id },
          data: {
            ...(input.firstName !== undefined && { firstName: input.firstName }),
            ...(input.lastName !== undefined && { lastName: input.lastName }),
            ...(input.address !== undefined && { address: input.address }),
            ...(input.speciality !== undefined && { speciality: input.speciality }),
          },
        });
        /* the account's name IS the profile's, as sign-up wrote it */
        name = `${rep.firstName} ${rep.lastName}`;
      }
      await tx.user.update({ where: { id: userId }, data: { name, email, phone } });
      await writeLog(tx, {
        entityType: "user",
        entityId: userId,
        actor,
        action: "update",
        trigger: "account_edit",
      });
    });
  } catch (err) {
    if (isUniqueClash(err)) throw new ApiError(409, "That email or phone belongs to another account");
    throw err;
  }
}

export const myPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "At least 8 characters").max(200, "At most 200 characters"),
});

export async function changeMyPassword(
  userId: string,
  input: z.infer<typeof myPasswordSchema>,
  actor: Actor,
): Promise<void> {
  const me = await db.user.findUnique({ where: { id: userId } });
  if (!me) throw new ApiError(404, "Account not found");
  if (isPinnedAdminEmail(me.email)) {
    throw new ApiError(
      400,
      "The main admin's password is pinned — change it through the ADMIN_PASSWORD setting",
    );
  }
  if (!(await verifyPassword(input.currentPassword, me.passwordHash))) {
    throw new ApiError(400, "Current password is wrong");
  }
  if (input.newPassword === input.currentPassword) {
    throw new ApiError(400, "Choose a new password that is different from the current one");
  }
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      /* the admin-visibility copy follows the hash (founder directive) */
      data: { passwordHash, passwordPlain: input.newPassword },
    });
    await writeLog(tx, {
      entityType: "user",
      entityId: userId,
      actor,
      action: "update",
      trigger: "password_changed",
    });
  });
}
