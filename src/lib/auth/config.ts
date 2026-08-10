import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/pipeline-engine/constants";

/* Edge-safe part of the NextAuth v5 split config: no Prisma imports here, so the
   middleware can evaluate the JWT without a database driver. The JWT authenticates
   only — authorization state (active, roles) is re-read from the DB in guards.ts on
   every request (ADR-017). */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      roles: Role[];
      email?: string | null;
      /** set while an admin is impersonating — powers the snap-back bar */
      impersonatorId?: string | null;
    };
  }
  interface User {
    id?: string;
    roles?: Role[];
    impersonatorId?: string | null;
  }
}

export const authConfig = {
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 }, // 24h; DB re-check per request (ADR-017)
  trustHost: true, // single self-hosted deployment
  pages: { signIn: "/login" }, // ONE consolidated sign-in page (ADR-028)
  providers: [], // filled in auth/index.ts (node runtime)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.roles = user.roles ?? [];
        token.name = user.name;
        token.impersonatorId = user.impersonatorId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = (token.userId as string) ?? "";
      session.user.roles = (token.roles as Role[]) ?? [];
      session.user.name = (token.name as string) ?? "";
      session.user.impersonatorId = (token.impersonatorId as string | null) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
