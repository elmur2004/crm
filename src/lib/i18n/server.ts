import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./core";

/** Server-side locale (cookie; default English keeps tests + existing users
    unchanged). Import ONLY from server components/actions. */
export async function getLocale(): Promise<Locale> {
  const raw = (await cookies()).get(LOCALE_COOKIE)?.value;
  return raw === "ar" ? "ar" : "en";
}
