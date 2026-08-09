import { login } from "@/lib/auth/actions";
import Link from "next/link";

export const metadata = { title: "Sign in — ByteForce × B-Systems Sales Platform" };

/* THE consolidated sign-in (ADR-028): one page for every account — staff, portal
   reps, admins. The identifier is an email or a phone; after sign-in each account
   lands in its own app. Structural design — the final visual pass comes from the
   design round (docs/DESIGN-BRIEF.md). */

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-logos">
          {/* founder assets (ADR-006) — plain imgs on the neutral surface */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/byteforce/logo-horizontal.png" alt="ByteForce" style={{ height: 36, width: "auto" }} />
          <span className="login-logo-divider" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/b-systems/logo-mark.png" alt="B-Systems" style={{ height: 36, width: "auto" }} />
        </div>
        <h1>Sign in</h1>
        <p className="neutral-muted">One sign-in for every workspace.</p>
        {error ? (
          <p role="alert" className="login-error">
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
        <p className="neutral-faint login-foot">
          New sales partner? <Link href="/portal/signup">Join the B-Systems Partnership Programme</Link>
        </p>
      </div>
    </main>
  );
}
