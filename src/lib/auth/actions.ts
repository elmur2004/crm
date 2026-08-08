"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";

/* Login/logout server actions. Auth flows are the one place server actions are used
   (business mutations are route handlers — ARCHITECTURE §3). On bad credentials the
   user returns to the login page with ?error=1; NEXT_REDIRECT rethrows are the
   framework's success path. */

async function runSignIn(
  provider: "internal" | "portal",
  payload: Record<string, string>,
  redirectTo: string,
  loginPath: string,
): Promise<never> {
  try {
    await signIn(provider, { ...payload, redirectTo });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`${loginPath}?error=1`);
    }
    throw err; // NEXT_REDIRECT on success
  }
  redirect(redirectTo);
}

export async function byteforceLogin(formData: FormData): Promise<void> {
  await runSignIn(
    "internal",
    {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    },
    "/byteforce",
    "/byteforce/login",
  );
}

export async function bsystemsLogin(formData: FormData): Promise<void> {
  await runSignIn(
    "internal",
    {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    },
    "/b-systems",
    "/b-systems/login",
  );
}

export async function portalLogin(formData: FormData): Promise<void> {
  await runSignIn(
    "portal",
    {
      identifier: String(formData.get("identifier") ?? ""),
      password: String(formData.get("password") ?? ""),
    },
    "/portal/crm",
    "/portal/login",
  );
}

export async function logout(redirectTo: string): Promise<void> {
  await signOut({ redirectTo });
}
