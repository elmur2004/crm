import { portalLogin } from "@/lib/auth/actions";
import { BrandLogo } from "@/components/shared/BrandLogo";

export const metadata = { title: "Log in — B-Systems Partnership Portal" };

/* Portal login (§8.1): one identifier field — reps use their phone (ADR-008),
   admins their email (ADR-016). Full §8.1 landing/hero styling lands in Phase 3. */

export default async function PortalLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-brand-hero">
      <div className="w-full max-w-sm bg-brand-surface rounded-brand-card shadow-brand-card p-8">
        <div className="mb-6 flex justify-center">
          <BrandLogo brand="bsystems" variant="mark" height={48} />
        </div>
        <h1 className="font-brand-display text-2xl font-bold mb-1 text-center">Log in</h1>
        <p className="text-brand-meta text-brand-muted text-center mb-5">Partnership Portal</p>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-brand-danger">
            Wrong phone number or password. Try again.
          </p>
        ) : null}
        <form action={portalLogin} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1">Phone number</span>
            <input
              type="text"
              name="identifier"
              required
              autoComplete="username"
              placeholder="e.g. 01012345678"
              className="w-full border border-brand-border rounded-brand-control px-3 py-2 bg-brand-surface"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Password</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full border border-brand-border rounded-brand-control px-3 py-2 bg-brand-surface"
            />
          </label>
          <button
            type="submit"
            className="w-full bg-brand-accent text-brand-surface rounded-brand-control py-2 font-medium"
          >
            Log in
          </button>
        </form>
      </div>
    </main>
  );
}
