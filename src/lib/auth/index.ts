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

/* ADR-074 — WHY a sign-in was refused, in the server log.

   next-auth answers every rejection with the single opaque `CredentialsSignin`,
   and the product answers with one deliberately vague banner — both correct,
   because telling a stranger WHICH half of a credential was wrong is how you
   enumerate accounts. But it left the operator with the same black box as the
   attacker: "Wrong email/phone or password" is identical for an account that
   does not exist, one that is deactivated, one awaiting approval and a genuine
   typo, and a deployment cannot be debugged from that. It cost three rounds of
   guessing on Mindoo's own administrator.

   So the REASON goes to the server log, where only the operator can read it,
   and the browser keeps saying exactly what it said before. The identifier is
   included because "which account" is the whole question; the password never
   is, not even its length. */
function refuse(reason: string, identifier: string | null): null {
  console.warn(
    `[auth] sign-in refused: ${reason}${identifier ? ` (identifier: ${identifier})` : ""}`,
  );
  return null;
}

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
        if (!parsed.success) return refuse("malformed request", null);
        const { identifier, password } = parsed.data;
        const kind = identifierKind(identifier);
        const where =
          kind === "email"
            ? { email: identifier.trim().toLowerCase() }
            : { phone: normalizePhone(identifier) };
        const user = await db.user.findUnique({
          where: where as never,
          include: { roles: true },
        });
        /* the four reasons, told apart in the LOG and nowhere else */
        if (!user) return refuse(`no account with that ${kind}`, identifier);
        if (!user.active) return refuse("account is deactivated", identifier);
        /* founder: self-signups are REQUESTS — no sign-in until approved */
        if (user.registrationStatus !== "approved") {
          return refuse(`registration is "${user.registrationStatus}"`, identifier);
        }
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return refuse("password does not match", identifier);
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
