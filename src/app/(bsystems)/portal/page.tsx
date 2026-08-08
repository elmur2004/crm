import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";

/* Portal landing (§8.1) — the signature gradient + mesh hero with the two entry
   actions (Sign up / Log in). */

export const metadata = { title: "B-Systems Partnership Programme" };

export default function PortalLanding() {
  return (
    <main className="min-h-screen bg-brand-hero flex items-center justify-center p-6">
      <div className="max-w-xl text-center">
        {/* mesh texture behind the display block only — never behind body text (§4.3) */}
        <div className="bs-mesh pb-8">
          <div className="flex justify-center mb-8 pt-8">
            <BrandLogo brand="bsystems" variant="mark" height={64} />
          </div>
          <h1 className="font-brand-display text-4xl font-extrabold tracking-tight text-brand-on-primary">
            Welcome to the <span className="text-brand-accent">B-Systems</span> Partnership
            Programme
          </h1>
        </div>
        <p className="mt-4 text-brand-on-primary opacity-80">
          Run your own pipeline. Close with our systems.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/portal/signup"
            className="bg-brand-accent text-brand-on-accent rounded-brand-control px-6 py-3 font-medium"
          >
            Sign up
          </Link>
          <Link
            href="/portal/login"
            className="border border-brand-secondary text-brand-on-primary rounded-brand-control px-6 py-3 font-medium"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
