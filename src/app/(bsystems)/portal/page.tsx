import Link from "next/link";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { portalLanding as msgs } from "@/lib/i18n/dict/auth";

/* Portal landing (§8.1) — the signature gradient + mesh hero with the two entry
   actions (Sign up / Log in). Restyle spec §2.17 (gradient hero + mesh, pink
   CTA). Steps strip / commission band / footer need copy that does not exist
   yet — deferred, strings are frozen in this pass.

   The system-wide glass pass brings it to the sign-in's level (glass.css
   .portal-*): the words stand in ONE pane of smoked glass on the hero, and
   the B-Systems mark — a gradient mark, which may never sit on a gradient —
   now stands on a flat Paper plate inside a glass bezel, the sign-in's tile.
   The pink CTA reads Indigo Deep on Signal Pink (5.84:1), as the dark theme
   already does; white on pink is 3.12:1. Same words, same links. */

export async function generateMetadata() {
  const t = tFor(await getLocale());
  return { title: t(msgs.metaTitle) };
}

export default async function PortalLanding() {
  const locale = await getLocale();
  const t = tFor(locale);
  return (
    <main className="portal-hero bg-brand-hero">
      {/* mesh texture over the hero gradient only — never behind body text (§4.3):
          the words sit on the smoked glass pane, which covers it */}
      <div className="portal-mesh bs-mesh" aria-hidden="true" />
      <div className="portal-card">
        <span className="glass-tile portal-tile" data-brand="bsystems">
          <span className="glass-tile-plate">
            <BrandLogo brand="bsystems" variant="mark" height={52} />
          </span>
        </span>
        <p className="portal-eyebrow">{t(msgs.eyebrow)}</p>
        <h1 className="portal-title">
          {t(msgs.welcomeBefore)}
          <span className="text-brand-accent">B-Systems</span>
          {t(msgs.welcomeAfter)}
        </h1>
        <p className="portal-tagline">{t(msgs.tagline)}</p>
        <div className="portal-actions">
          <Link href="/portal/signup" className="btn-accent portal-cta">
            {t(msgs.signUp)}
          </Link>
          <Link href="/login" className="portal-ghost">
            {t(msgs.logIn)}
          </Link>
        </div>
      </div>
    </main>
  );
}
