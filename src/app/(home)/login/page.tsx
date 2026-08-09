import { login } from "@/lib/auth/actions";
import Link from "next/link";

export const metadata = { title: "Sign in — ByteForce × B-Systems Sales Platform" };

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
  return (
    <main className="login-shell">
      <div className="login-pane">
        <div className="login-inner">
          <p className="login-eyebrow">Sign in · /login</p>
          <h1 className="login-title">One door, every account.</h1>
          <p className="login-sub">
            Staff, partners and agents use the same credentials. We route you to what you
            have access to.
          </p>
          {error ? (
            <p role="alert" className="login-error">
              <span className="login-error-icon" aria-hidden>
                !
              </span>
              Wrong email/phone or password. Try again.
            </p>
          ) : null}
          <form action={login} className="login-form">
            <label>
              <span>Email or phone</span>
              <input
                type="text"
                name="identifier"
                required
                autoComplete="username"
                placeholder="you@company.com or 01012345678"
              />
            </label>
            <label>
              <span>Password</span>
              <input type="password" name="password" required autoComplete="current-password" />
            </label>
            <button type="submit">Sign in</button>
          </form>
          <p className="login-foot">
            New partner sales rep?{" "}
            <Link href="/portal">Apply to the partnership programme</Link>
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
            <p className="login-bb-eyebrow-a">Creative &amp; performance</p>
            <p className="login-bb-line-a">Campaigns, content and growth for bold brands.</p>
          </div>
        </div>
        <div className="login-bb login-bb--b">
          <div className="login-bb-head">
            <span className="login-bb-mark-b">S</span>
            <span className="login-bb-word-b">B-Systems</span>
          </div>
          <div className="login-bb-body">
            <p className="login-bb-eyebrow-b">Systems before software</p>
            <p className="login-bb-line-b">
              Operations, ERP and the partner network that sells it.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
