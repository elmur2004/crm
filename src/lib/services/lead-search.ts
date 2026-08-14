import type { Prisma } from "../../../generated/prisma/client";

/* Founder (filter rounds 2 & 3): ONE search box that hits the lead name, the
   company, OR the number — "either way, we put anything into it" — used by the
   B-Systems Leads list, the B-Systems board, and the ByteForce board. Matching
   is SERVER-SIDE (case-insensitive contains); a query that looks like a phone
   number is also matched digits-only, so "010 123" finds "0101234567".
   Brand-agnostic and dependency-free on purpose: every lead surface composes it
   into its own where clause. */
export function leadSearchWhere(search?: string): Prisma.LeadWhereInput {
  const q = search?.trim();
  if (!q) return {};
  const digits = q.replace(/\D/g, "");
  /* "looks numeric" = digits plus the usual phone punctuation, nothing else */
  const numeric = digits.length > 0 && /^[\d\s+()\-.]+$/.test(q);
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { number: { contains: q } },
      ...(numeric && digits !== q ? [{ number: { contains: digits } }] : []),
    ],
  };
}

/** The Type filter shared by the same three surfaces ("any" = no narrowing). */
export function leadTypeWhere(type?: string): Prisma.LeadWhereInput {
  return type && type !== "any" ? { type } : {};
}
