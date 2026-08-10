import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/lib/db";
import { authConfig } from "./config";
import { verifyPassword } from "./hash";
import { identifierKind, normalizePhone } from "./phone";
import type { Role } from "@/lib/pipeline-engine/constants";

/* ONE unified credentials provider (ADR-028, founder-directed): a single sign-in
   for every account type. The identifier is an email or a phone (resolved by
   shape); no role partitioning at login — which app a session can SEE stays
   enforced by the middleware + per-request guards (§3, ADR-017). Inactive
   accounts are rejected (A-4). */

const credentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

import { verifyImpersonationToken } from "@/lib/services/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    /* V2 §2.10 — admin impersonation: a 60s HMAC token minted by the users
       service becomes a session for the target account (activity-logged). */
    Credentials({
      id: "impersonation",
      name: "Impersonation",
      credentials: { token: {} },
      async authorize(raw) {
        const token = typeof raw?.token === "string" ? raw.token : null;
        if (!token) return null;
        const verified = verifyImpersonationToken(token);
        if (!verified) return null;
        const user = await db.user.findUnique({
          where: { id: verified.userId },
          include: { roles: true },
        });
        if (!user || !user.active) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles.map((r) => r.role as Role),
          impersonatorId: verified.impersonatorId, // null on snap-back to admin
        };
      },
    }),
    Credentials({
      id: "unified",
      name: "Sales Platform",
      credentials: { identifier: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { identifier, password } = parsed.data;
        const where =
          identifierKind(identifier) === "email"
            ? { email: identifier.trim().toLowerCase() }
            : { phone: normalizePhone(identifier) };
        const user = await db.user.findUnique({
          where: where as never,
          include: { roles: true },
        });
        if (!user || !user.active) return null;
        /* founder: self-signups are REQUESTS — no sign-in until approved */
        if (user.registrationStatus !== "approved") return null;
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles.map((r) => r.role as Role),
        };
      },
    }),
  ],
});
