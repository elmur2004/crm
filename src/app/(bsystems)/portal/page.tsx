import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { portalLanding as msgs } from "@/lib/i18n/dict/auth";

/* Portal landing (§8.1) — the signature gradient + mesh hero with the two entry
   actions (Sign up / Log in). Restyle spec §2.17 (gradient hero + mesh, pink
   CTA). Steps strip / commission band / footer need copy that does not exist
   yet — deferred, strings are frozen in this pass. */

export async function generateMetadata() {
  const t = tFor(await getLocale());
  return { title: t(msgs.metaTitle) };
}

export default async function PortalLanding() {
  const locale = await getLocale();
  const t = tFor(locale);
  return (
    <main className="min-h-screen bg-brand-hero flex items-center justify-center p-6">
      <div className="max-w-xl text-center">
        {/* mesh texture behind the display block only — never behind body text (§4.3) */}
        <div className="bs-mesh pb-8">
          <div className="flex justify-center mb-8 pt-8">
            <BrandLogo brand="bsystems" variant="mark" height={64} />
          </div>
          <p className="text-brand-eyebrow text-brand-secondary mb-4">
            {t(msgs.eyebrow)}
          </p>
          <h1 className="font-brand-display text-4xl font-extrabold tracking-tight text-brand-on-primary">
            {t(msgs.welcomeBefore)}
            <span className="text-brand-accent">B-Systems</span>
            {t(msgs.welcomeAfter)}
          </h1>
        </div>
        <p className="mt-4 text-brand-on-primary opacity-80">{t(msgs.tagline)}</p>
        <div className="mt-10 flex justify-center gap-4">
          <Link href="/portal/signup" className="btn-accent inline-block">
            {t(msgs.signUp)}
          </Link>
          <Link
            href="/login"
            className="inline-block border border-brand-secondary text-brand-on-primary rounded-brand-control px-6 py-3 font-medium"
          >
            {t(msgs.logIn)}
          </Link>
        </div>
      </div>
    </main>
  );
}
