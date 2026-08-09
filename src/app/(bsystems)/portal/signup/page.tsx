import { BrandLogo } from "@/components/shared/BrandLogo";
import { SignupForm } from "@/components/portal/SignupForm";

export const metadata = { title: "Sign up — B-Systems Partnership Programme" };

/* §8.1 sign-up — all fields required, CV mandatory (pdf/doc/docx ≤ 10 MB).
   Split layout per spec §2.17: gradient identity pane + form pane. Perk copy
   does not exist yet — strings are frozen in this pass. */

export default function PortalSignup() {
  return (
    <main className="min-h-screen flex flex-col md:flex-row items-stretch bg-brand-surface">
      <div className="bg-brand-hero md:flex-[0.85] md:min-w-72 flex flex-col justify-center p-10 md:p-14">
        <div className="bs-mesh py-8">
          <BrandLogo brand="bsystems" variant="mark" height={48} />
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center px-7 py-11 md:px-14">
        <div className="w-full max-w-lg">
          <p className="u-eyebrow">Partnership Programme</p>
          <h1 className="u-h1 mb-5">Sign up</h1>
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
