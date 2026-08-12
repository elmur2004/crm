import { login } from "@/lib/auth/actions";
import Link from "next/link";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { login as msgs } from "@/lib/i18n/dict/auth";

export async function generateMetadata() {
  const t = tFor(await getLocale());
  return { title: t(msgs.metaTitle) };
}

/* THE consolidated sign-in (ADR-028; visual redesign per the approved prototype,
   docs/DESIGN-APPLICATION-SPEC.md §2.14 — split form + brand billboard). One page
   for every account; the identifier is an email or a phone; after sign-in each
   account lands where its roles point. */

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const locale = await getLocale();
  const t = tFor(locale);
  return (
    <main className="login-shell">
      <div className="login-pane">
        <div className="login-inner">
          <div className="mb-4">
            <LanguageToggle />
          </div>
          <p className="login-eyebrow">{t(msgs.eyebrow)}</p>
          <h1 className="login-title">{t(msgs.title)}</h1>
          <p className="login-sub">{t(msgs.sub)}</p>
          {error ? (
            <p role="alert" className="login-error">
              <span className="login-error-icon" aria-hidden>
                !
              </span>
              {error === "pending"
                ? t(msgs.errPending)
                : error === "rejected"
                  ? t(msgs.errRejected)
                  : error === "health"
                    ? t(msgs.errHealth)
                    : t(msgs.errDefault)}
            </p>
          ) : null}
          <form action={login} className="login-form">
            <label>
              <span>{t(msgs.identifierLabel)}</span>
              <input
                type="text"
                name="identifier"
                required
                autoComplete="username"
                placeholder={t(msgs.identifierPlaceholder)}
              />
            </label>
            <label>
              <span>{t(msgs.passwordLabel)}</span>
              <PasswordInput name="password" ariaLabel={t(msgs.passwordLabel)} required autoComplete="current-password" className="" />
            </label>
            <button type="submit">{t(msgs.submit)}</button>
          </form>
          <p className="login-foot">
            {t(msgs.footNew)}{" "}
            <Link href="/portal">{t(msgs.footLink)}</Link>
          </p>
        </div>
      </div>

      {/* Brand billboard — the two companies, stacked (spec §2.14) */}
      <aside className="login-billboard" aria-hidden>
        <div className="login-bb login-bb--a">
          <div className="login-bb-head">
            <span className="login-bb-mark-a" />
            <span className="login-bb-word-a">ByteForce</span>
          </div>
          <div className="login-bb-body">
            <p className="login-bb-eyebrow-a">{t(msgs.bbAEyebrow)}</p>
            <p className="login-bb-line-a">{t(msgs.bbALine)}</p>
          </div>
        </div>
        <div className="login-bb login-bb--b">
          <div className="login-bb-head">
            <span className="login-bb-mark-b">S</span>
            <span className="login-bb-word-b">B-Systems</span>
          </div>
          <div className="login-bb-body">
            <p className="login-bb-eyebrow-b">{t(msgs.bbBEyebrow)}</p>
            <p className="login-bb-line-b">{t(msgs.bbBLine)}</p>
          </div>
        </div>
      </aside>
    </main>
  );
}
