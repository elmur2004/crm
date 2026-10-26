import { BrandLogo } from "@/components/shared/BrandLogo";
import { AppGround } from "@/components/shared/AppGround";
import { SignupForm } from "@/components/portal/SignupForm";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { signup as msgs } from "@/lib/i18n/dict/auth";

export async function generateMetadata() {
  const t = tFor(await getLocale());
  return { title: t(msgs.metaTitle) };
}

/* §8.1 sign-up — all fields required, CV mandatory (pdf/doc/docx ≤ 10 MB).
   Split layout per spec §2.17: gradient identity pane + form pane. Perk copy
   does not exist yet — strings are frozen in this pass.

   The system-wide glass pass ("Glass frame, solid data"): the form pane stands
   on the sign-in's ground, and the FORM itself on a solid card inside a glass
   bezel (glass.css .portal-form-card) — fields stay sharp. The B-Systems mark
   leaves the gradient for a flat Paper plate in a glass bezel: a gradient mark
   never sits on a gradient. Same form, same fields, same names. */

export default async function PortalSignup() {
  const locale = await getLocale();
  const t = tFor(locale);
  return (
    <main className="portal-split">
      <AppGround variant="rich" />
      <div className="portal-split-hero bg-brand-hero">
        <div className="portal-mesh bs-mesh" aria-hidden="true" />
        <span className="glass-tile portal-tile" data-brand="bsystems">
          <span className="glass-tile-plate">
            <BrandLogo brand="bsystems" variant="mark" height={44} />
          </span>
        </span>
      </div>
      <div className="portal-split-pane">
        <div className="portal-form-card">
          <p className="u-eyebrow">{t(msgs.eyebrow)}</p>
          <h1 className="u-h1 mb-5">{t(msgs.title)}</h1>
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
