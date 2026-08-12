"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "./core";

export async function setLocale(next: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, next === "ar" ? "ar" : "en", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
