import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { landingFor } from "@/lib/auth/landing";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { noAccess as msgs } from "@/lib/i18n/dict/auth";

export async function generateMetadata() {
  const t = tFor(await getLocale());
  return { title: t(msgs.meta) };
}

/* ADR-066 — the honest refusal. An admin whose Accounting or Data Vault flag
   has been revoked lands HERE instead of on a sign-in form he does not need, a
   blank screen, or a bounce that another guard would bounce him out of again.

   It lives in the brand-neutral (home) group on purpose: outside the proxy
   matcher, outside both module route groups, so no guard runs on it and no
   redirect loop is reachable. It asks only that somebody be signed in — the
   MODULE decision was already made by the guard that sent them here, and this
   page is a message, never a wall (it grants nothing and reads no flag). */

export const dynamic = "force-dynamic";

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const me = await requireUser().catch(() => null);
  if (!me) redirect("/login");
  const { module } = await searchParams;
  const t = tFor(await getLocale());
  const title =
    module === "accounting"
      ? t(msgs.titleAccounting)
      : module === "vault"
        ? t(msgs.titleVault)
        : t(msgs.titleGeneric);

  return (
    <main className="login-shell">
      <div className="login-pane">
        {/* `mx-auto`, because this page uses the sign-in shell WITHOUT its brand
            billboard: `.login-pane` is a column flex box whose child would
            otherwise stretch from the inline start, leaving a 400px column
            pinned to the left of a very wide screen. A utility class, not a new
            rule — nothing is added to any stylesheet. */}
        <div className="login-inner mx-auto">
          <div className="mb-4">
            <LanguageToggle />
          </div>
          <p className="login-eyebrow">{t(msgs.eyebrow)}</p>
          <h1 className="login-title">{title}</h1>
          <p className="login-sub">{t(msgs.sub)}</p>
          <p className="login-sub">{t(msgs.ask)}</p>
          <p className="login-foot">
            <Link href={landingFor(me.roles)}>{t(msgs.back)}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
