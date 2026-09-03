import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import {
  assertGrantable,
  assertUserInScope,
  userScopeWhere,
  type UserScope,
} from "./user-tenancy";
import { hashPassword } from "@/lib/auth/hash";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import { ROLES, type Role } from "@/lib/pipeline-engine/constants";
import { storage } from "@/lib/storage";
import { writeLog, type Actor } from "./activity";
import { invalidateUndo } from "./undo";

/* V2 §2.10 / §11 — Users management (admin): list everyone, create accounts with
   role/entity assignment, deactivate/reactivate, and IMPERSONATION — the admin
   opens any account's app directly. Impersonation uses a short-lived HMAC token
   (signed with AUTH_SECRET) consumed by the dedicated credentials provider; every
   impersonation is activity-logged. */

export function listUsers(
  /* ADR-075 — WHOSE people. Required, never defaulted: a default would be "the
     whole platform", which is the leak this argument exists to close. */
  scope: UserScope,
) {
  return db.user.findMany({
    where: userScopeWhere(scope),
    include: {
      roles: true,
      portalRep: { select: { firstName: true, lastName: true, speciality: true } },
      partner: { select: { companyName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/* Founder (lead assignment) — the accounts a lead may be handed to: live,
   approved agents, partners and internal sales. Admins are deliberately absent:
   the admin bucket is where an UNASSIGNED lead sits, not a person's workload. */
export async function listAssignableOwners() {
  const users = await db.user.findMany({
    where: {
      active: true,
      registrationStatus: "approved",
      roles: { some: { role: { in: ["bsystems_agent", "bsystems_partner", "bsystems_sales"] } } },
    },
    include: { roles: true, partner: { select: { companyName: true } } },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    company: u.partner?.companyName ?? null,
    roles: u.roles.map((r) => r.role),
  }));
}

/** V2 §2.8 Registrations — every account with type + date. */
export function listRegistrations() {
  return db.user.findMany({
    include: { roles: true },
    orderBy: { createdAt: "desc" },
  });
}

export const createUserSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
    phone: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    password: z.string().min(8),
    roles: z.array(z.enum(ROLES)).min(1),
    /* ADR-066 — per-admin module access. Optional and DEFAULTED TO TRUE so the
       create form, the seed and every existing caller behave exactly as before;
       unticking a box on a new admin is the only way one arrives false. */
    canAccessAccounting: z.boolean().optional(),
    canAccessVault: z.boolean().optional(),
  })
  .refine((u) => u.email || u.phone, { message: "An email or a phone is required" })
  .refine((u) => !u.phone || isValidPhone(u.phone), {
    message: "Enter a valid phone number",
    path: ["phone"],
  });

export async function createUser(
  input: z.infer<typeof createUserSchema>,
  scope: UserScope,
  actor: Actor,
) {
  /* ADR-075 — an administrator mints only his own company's accounts. */
  assertGrantable(scope, input.roles as Role[]);
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  if (email && (await db.user.findUnique({ where: { email } }))) {
    throw new ApiError(409, "An account with this email already exists");
  }
  if (phone && (await db.user.findUnique({ where: { phone } }))) {
    throw new ApiError(409, "An account with this phone already exists");
  }
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: email ?? null,
        phone: phone ?? null,
        passwordHash,
        passwordPlain: input.password,
        /* ADR-066 — `?? true` keeps the column default's promise at the ONE
           place that could quietly break it: an omitted field means "as before". */
        canAccessAccounting: input.canAccessAccounting ?? true,
        canAccessVault: input.canAccessVault ?? true,
      },
    });
    for (const role of input.roles) {
      await tx.userRole.create({ data: { userId: user.id, role } });
    }
    await writeLog(tx, {
      entityType: "user",
      entityId: user.id,
      actor,
      action: "create",
      trigger: "users_admin",
    });
    return user;
  });
}

/* Founder V4 — the admin EDITS any user from Users: identity, identifiers,
   roles, and the password (which becomes visible in the Password column). */
export const updateUserSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
    phone: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    password: z.string().min(8, "At least 8 characters").optional(),
    roles: z.array(z.enum(ROLES)).min(1).optional(),
    /* ADR-066 — the two module flags. Absent = untouched, exactly like every
       other optional field on this schema. */
    canAccessAccounting: z.boolean().optional(),
    canAccessVault: z.boolean().optional(),
  })
  .refine((u) => !u.phone || isValidPhone(u.phone), {
    message: "Enter a valid phone number",
    path: ["phone"],
  });

export async function updateUser(
  userId: string,
  input: z.infer<typeof updateUserSchema>,
  scope: UserScope,
  actor: Actor,
) {
  /* ADR-075 — his own people, and only roles he may grant. Both walls, because
     editing an account you may not see and re-roling one you may is the same
     hole from two directions. */
  await assertUserInScope(scope, userId);
  if (input.roles) assertGrantable(scope, input.roles as Role[]);
  const user = await db.user.findUnique({ where: { id: userId }, include: { roles: true } });
  if (!user) throw new ApiError(404, "User not found");

  const email = input.email?.trim().toLowerCase();
  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  if (email && email !== user.email) {
    const clash = await db.user.findUnique({ where: { email } });
    if (clash && clash.id !== userId) throw new ApiError(409, "That email belongs to another account");
  }
  if (phone && phone !== user.phone) {
    const clash = await db.user.findUnique({ where: { phone } });
    if (clash && clash.id !== userId) throw new ApiError(409, "That phone belongs to another account");
  }
  /* the admin cannot strip their own admin role */
  if (
    input.roles &&
    actor.id === userId &&
    user.roles.some((r) => r.role === "bsystems_admin") &&
    !input.roles.includes("bsystems_admin")
  ) {
    throw new ApiError(400, "You cannot remove your own admin access");
  }
  /* ADR-066 / no self-lockout — the exact twin of the rule above it, and for
     the same reason: whoever is standing at the Users page must always be able
     to walk back into what he is configuring. An admin may take Accounting or
     the Data Vault from ANY other admin, never from himself; another admin can
     always do it for him. Enforced HERE, in the service, so the API and any
     future caller inherit it — the checkbox being disabled in the UI is a
     courtesy, never the rule. */
  if (actor.id === userId) {
    if (input.canAccessAccounting === false) {
      throw new ApiError(400, "You cannot remove your own access to Accounting");
    }
    if (input.canAccessVault === false) {
      throw new ApiError(400, "You cannot remove your own access to the Data Vault");
    }
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(input.password !== undefined && {
          passwordHash: await hashPassword(input.password),
          passwordPlain: input.password,
        }),
        ...(input.canAccessAccounting !== undefined && {
          canAccessAccounting: input.canAccessAccounting,
        }),
        ...(input.canAccessVault !== undefined && { canAccessVault: input.canAccessVault }),
      },
    });
    if (input.roles) {
      await tx.userRole.deleteMany({ where: { userId } });
      for (const role of input.roles) {
        await tx.userRole.create({ data: { userId, role } });
      }
    }
    await writeLog(tx, {
      entityType: "user",
      entityId: userId,
      actor,
      action: "update",
      trigger: "users_admin_edit",
    });
    return updated;
  });
}

export async function setUserActive(
  userId: string,
  active: boolean,
  scope: UserScope,
  actor: Actor,
) {
  /* ADR-075 — deactivating somebody is administering them. */
  await assertUserInScope(scope, userId);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");
  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: userId }, data: { active } });
    await writeLog(tx, {
      entityType: "user",
      entityId: userId,
      actor,
      action: "update",
      trigger: active ? "reactivated" : "deactivated",
    });
    return updated;
  });
}

/* ============================================================================
   Founder — "give me the ability to completely delete a user, not just
   deactivate it." (ADR-049)

   Deactivating keeps the account and everything hanging off it; deleting
   destroys the LOGIN and the person's private artefacts, and PRESERVES every
   business record they touched. The fate of every reference is decided here,
   deliberately, rather than left to whatever the FK happens to do:

     owned leads      → KEPT. ownerUserId null + ownerType "admin" (the
                        unassigned bucket), one activity row each. Deleting a
                        person must never delete the company's pipeline.
     agent profile    → DELETED (PortalRep cascades from User) — and its CV
                        Attachment is deleted FIRST, with the stored file
                        removed, because Attachment.portalRepId is SET NULL and
                        would otherwise leave an orphan row and a stray file.
     follow-up owner  → FollowUp.ownerPortalRepId SET NULL by the FK; the
                        follow-up itself survives.
     Partner.userId   → NULLED. The partner COMPANY, its prospect, its leads
                        and its commissions survive; only the login goes.
     Statement.closer → closerUserId NULLED (no FK — a plain column).
                        closerLabel is denormalised, so the money trail keeps
                        the person's name for ever.
     lead comments    → KEPT, author unlinked (SetNull); authorLabel carries
                        the name, exactly like the activity log.
     notifications    → CASCADE (they were addressed to a login that no longer
                        exists).
     UserRole         → CASCADE.
     UndoEntry        → DELETED (no FK — a plain userId column). Their pending
                        inverses die with the account.
     ActivityLog      → KEPT, untouched. actorLabel is denormalised history:
                        deleting the actor must not rewrite what happened.

   NOT UNDOABLE (like every destructive path): it retires the acting admin's
   pending undo entries so the button never offers something older instead.
   ========================================================================== */

/** The pinned, self-healing admin (bootstrap.ts) — deleting it is meaningless. */
const BOOTSTRAP_ADMIN_EMAIL = "admin@byteforce.com";

export async function deleteUser(userId: string, scope: UserScope, actor: Actor) {
  /* ADR-075 — and so is deleting them, permanently and with their history. */
  await assertUserInScope(scope, userId);
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { portalRep: { include: { cv: true } }, partner: { select: { id: true } } },
  });
  if (!user) throw new ApiError(404, "User not found");
  if (actor.id === userId) {
    throw new ApiError(400, "You cannot delete your own account");
  }
  if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
    throw new ApiError(
      400,
      "The main admin account cannot be deleted — it is recreated automatically",
    );
  }

  const orphanedFileKeys: string[] = [];

  await db.$transaction(async (tx) => {
    /* 1 — the leads go back to the admin bucket. They are the company's, not
           the person's; each move is recorded against the lead. */
    const owned = await tx.lead.findMany({ where: { ownerUserId: userId }, select: { id: true } });
    if (owned.length > 0) {
      await tx.lead.updateMany({
        where: { ownerUserId: userId },
        data: { ownerUserId: null, ownerType: "admin" },
      });
      for (const lead of owned) {
        await writeLog(tx, {
          entityType: "lead",
          entityId: lead.id,
          actor,
          action: "update",
          trigger: "owner_deleted",
        });
      }
    }

    /* 2 — the agent profile's CV: the row AND the file (the FK would only null
           the link and leave both behind). */
    if (user.portalRep?.cv) {
      orphanedFileKeys.push(user.portalRep.cv.storageKey);
      await tx.attachment.delete({ where: { id: user.portalRep.cv.id } });
    }

    /* 3 — the partner COMPANY survives; only its login link goes. */
    if (user.partner) {
      await tx.partner.update({ where: { id: user.partner.id }, data: { userId: null } });
    }

    /* 4 — the money trail keeps the name (closerLabel), loses the link. */
    await tx.statement.updateMany({ where: { closerUserId: userId }, data: { closerUserId: null } });

    /* 5 — their pending inverses die with the account (UndoEntry has no FK). */
    await tx.undoEntry.deleteMany({ where: { userId } });

    /* 6 — the account itself. UserRole, PortalRep and Notification cascade;
           LeadComment.authorUserId, Lead.ownerUserId, PartnerProspect.
           agentUserId (ADR-050) and both createdByUserId columns (ADR-051) are
           SET NULL — a converted agent's card stays converted, and a record
           keeps existing after the person who typed it in is gone. Anything
           this policy has NOT resolved would raise a foreign-key error here and
           abort the whole transaction — nothing is half-deleted. */
    try {
      await tx.user.delete({ where: { id: userId } });
    } catch {
      throw new ApiError(
        409,
        "This account is still referenced by records that cannot be released — deactivate it instead",
      );
    }

    await writeLog(tx, {
      entityType: "user",
      entityId: userId,
      actor,
      action: "update",
      trigger: "user_deleted",
    });
    /* ADR-045: a deletion is never undoable, and it must not leave an older
       entry behind for the button to offer instead. */
    await invalidateUndo(tx, actor);
  });

  for (const key of orphanedFileKeys) {
    await storage.delete(key); // best-effort, after the commit
  }
}

/* ---------- impersonation (V2 §2.10) ---------- */

const IMPERSONATION_TTL_MS = 60_000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new ApiError(500, "AUTH_SECRET is not configured");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Admin-only: mints a 60s single-purpose token for the impersonation provider.
    `impersonatorId` rides inside the token so the session remembers WHO is
    impersonating — that's what powers the "Back to admin" snap-back. */
export async function mintImpersonationToken(
  targetUserId: string,
  scope: UserScope,
  actor: Actor,
  opts?: { impersonatorId?: string; trigger?: string },
): Promise<string> {
  /* ADR-075 — IMPERSONATION IS THE SHARPEST ONE. It hands the caller a session
     AS the target, so an unscoped mint would let a B-Systems admin walk into
     Mindoo wearing its staff's face — every wall this project built, opened by
     one button. His own people only. */
  await assertUserInScope(scope, targetUserId);
  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new ApiError(404, "User not found");
  if (!target.active) throw new ApiError(400, "Account is deactivated");
  await db.activityLog.create({
    data: {
      entityType: "user",
      entityId: targetUserId,
      actorId: actor.id,
      actorLabel: actor.label,
      action: "update",
      trigger: opts?.trigger ?? "impersonation",
    },
  });
  const payload = `${targetUserId}.${opts?.impersonatorId ?? ""}.${Date.now() + IMPERSONATION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Verified by the auth provider; returns the target (and the impersonating
    admin, when the session should snap back) or null. */
export function verifyImpersonationToken(
  token: string,
): { userId: string; impersonatorId: string | null } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, impersonatorId, expiry, signature] = parts as [string, string, string, string];
  const payload = `${userId}.${impersonatorId}.${expiry}`;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expiry) < Date.now()) return null;
  return { userId, impersonatorId: impersonatorId || null };
}

/* ---------- registration approval (founder: signup is a REQUEST) ---------- */

export async function approveRegistration(userId: string, actor: Actor) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");
  if (user.registrationStatus === "approved") return user;
  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { registrationStatus: "approved", active: true },
    });
    await writeLog(tx, {
      entityType: "user",
      entityId: userId,
      actor,
      action: "update",
      trigger: "registration_approved",
    });
    return updated;
  });
}

export async function rejectRegistration(userId: string, actor: Actor) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");
  if (user.registrationStatus === "approved" && user.active) {
    throw new ApiError(400, "This account is already approved — deactivate it from Users instead");
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { registrationStatus: "rejected", active: false },
    });
    await writeLog(tx, {
      entityType: "user",
      entityId: userId,
      actor,
      action: "update",
      trigger: "registration_rejected",
    });
    return updated;
  });
}
