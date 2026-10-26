import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { LAUNCHER_PATH } from "@/lib/launcher/apps";
import { AppGround } from "@/components/shared/AppGround";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
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
   page is a message, never a wall (it grants nothing and reads no flag).

   The system-wide glass pass: it sits on the sign-in's ground in one glass
   card (glass.css .gl-*), so the one page a refused admin sees looks like the
   door he came through.

   One way to each page: its way out is the LAUNCHER — the one way between
   apps — rather than a shortcut into one app (it used to be his role landing,
   which since then is his CRM board, not "his dashboard"). */

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
    <main className="gl-stage">
      <AppGround variant="rich" />
      <div className="gl-top">
        <LanguageToggle />
        <ThemeToggle compact />
      </div>
      <div className="gl-center">
        <div className="glass-card gl-card">
          <p className="gl-eyebrow">{t(msgs.eyebrow)}</p>
          <h1 className="gl-title">{title}</h1>
          <p className="gl-sub">{t(msgs.sub)}</p>
          <p className="gl-sub">{t(msgs.ask)}</p>
          <p className="gl-actions">
            <Link href={LAUNCHER_PATH} prefetch={false} className="btn-primary gl-cta">
              {t(msgs.backToApps)}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
