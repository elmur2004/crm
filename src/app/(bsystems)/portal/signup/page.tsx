import { BrandLogo } from "@/components/shared/BrandLogo";
import { SignupForm } from "@/components/portal/SignupForm";

export const metadata = { title: "Sign up — B-Systems Partnership Programme" };

/* §8.1 sign-up — all fields required, CV mandatory (pdf/doc/docx ≤ 10 MB). */

export default function PortalSignup() {
  return (
    <main className="min-h-screen bg-brand-hero flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-brand-surface rounded-brand-card shadow-brand-card p-8">
        <div className="mb-6 flex justify-center">
          <BrandLogo brand="bsystems" variant="mark" height={48} />
        </div>
        <h1 className="font-brand-display text-2xl font-bold mb-1 text-center">Sign up</h1>
        <p className="text-brand-meta text-brand-muted text-center mb-5">Partnership Programme</p>
        <SignupForm />
      </div>
    </main>
  );
}
