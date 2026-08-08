import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "./config";
import { verifyPassword } from "./hash";
import { identifierKind, normalizePhone } from "./phone";
import type { Role } from "@/lib/pipeline-engine/constants";

/* Full NextAuth v5 instance (node runtime). Two Credentials providers (ADR-008,
   ADR-016): `internal` = staff email + password (Apps A & B); `portal` = one
   identifier field accepting a rep's phone or an admin's email. authorize() rejects
   inactive accounts (A-4) — and guards.ts re-checks on every request (ADR-017). */

const internalSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const portalSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

type AuthedUser = { id: string; name: string; email: string | null; roles: Role[] };

async function verifyUser(
  where: { email: string } | { phone: string },
  password: string,
): Promise<AuthedUser | null> {
  const user = await db.user.findUnique({ where: where as never, include: { roles: true } });
  if (!user || !user.active) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map((r) => r.role as Role),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "internal",
      name: "Internal staff",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = internalSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await verifyUser({ email: parsed.data.email }, parsed.data.password);
        // internal provider serves staff only
        if (!user || !user.roles.some((r) => r === "byteforce_staff" || r === "bsystems_staff")) {
          return null;
        }
        return user;
      },
    }),
    Credentials({
      id: "portal",
      name: "Partnership portal",
      credentials: { identifier: {}, password: {} },
      async authorize(raw) {
        const parsed = portalSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { identifier, password } = parsed.data;
        const where =
          identifierKind(identifier) === "email"
            ? { email: identifier }
            : { phone: normalizePhone(identifier) };
        const user = await verifyUser(where, password);
        // portal provider serves portal roles only (§3: apps invisible across sides)
        if (!user || !user.roles.some((r) => r === "portal_rep" || r === "portal_admin")) {
          return null;
        }
        return user;
      },
    }),
  ],
});
