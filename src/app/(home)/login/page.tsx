import { LoginGlass } from "@/components/login/LoginGlass";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { login as msgs } from "@/lib/i18n/dict/auth";

export async function generateMetadata() {
  const t = tFor(await getLocale());
  return { title: t(msgs.metaTitle) };
}

/* THE consolidated sign-in (ADR-028). One page for every account; the
   identifier is an email or a phone; after sign-in every account lands on the
   app launcher, which shows it only the apps its roles open (ADR-090). The page is the founder's glassmorphism redesign
   (src/components/login/LoginGlass.tsx, styled by src/themes/login.css): the
   same form, the same `login` action, the same four errors and the same
   accessible names — only the glass is new. It supersedes the split form +
   brand billboard of docs/DESIGN-APPLICATION-SPEC.md §2.14. */

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const locale = await getLocale();
  return <LoginGlass locale={locale} error={error} />;
}
