"use server";

import { cookies } from "next/headers";
import { parseCompany } from "./company";
import {
  BOARD_PERSON_COOKIE,
  BOARD_PERSON_COOKIE_MAX_AGE,
  boardPersonValue,
  parseBoardPerson,
} from "./board-person";

/* ADR-109 — the one writer of the admin's person-switch cookie. Mirrors
   setTheme (src/lib/theme/actions.ts): path "/", a year, SameSite=Lax,
   httpOnly — nothing in the browser reads it; the board reads it on the
   server.

   It asks for no session, on purpose: it writes a preference into the
   CALLER'S OWN browser, and the board ignores that preference for anybody who
   is not the company admin (board-person.ts, rule 1). So a value written here
   can only ever narrow an admin's own view. Both arguments arrive from the
   client, so both are parsed: an unknown company writes nothing, an unknown
   choice stores Everyone. */
export async function setBoardPerson(company: string, value: string): Promise<void> {
  const brand = parseCompany(company);
  if (!brand) return;
  (await cookies()).set(BOARD_PERSON_COOKIE[brand], boardPersonValue(parseBoardPerson(value)), {
    path: "/",
    maxAge: BOARD_PERSON_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
}
