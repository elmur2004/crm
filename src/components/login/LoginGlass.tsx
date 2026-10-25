import Link from "next/link";
import { login } from "@/lib/auth/actions";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { tFor, type Locale } from "@/lib/i18n/core";
import { login as msgs } from "@/lib/i18n/dict/auth";
import { loginGlass as glass } from "@/lib/i18n/dict/login-glass";
import { BRAND_ASSETS } from "@/themes/assets";
import { GlassPasswordField } from "./GlassPasswordField";
import { GlassSubmit } from "./GlassSubmit";
import { LoginAmbient } from "./LoginAmbient";
import "@/themes/login.css";

/* ============================================================================
   THE GLASS SIGN-IN — the consolidated /login (ADR-028), redesigned from the
   founder's glassmorphism reference. One page for every account; the
   identifier is an email or a phone; after sign-in every account lands on the
   app launcher (ADR-090). NOTHING about the form changed: the form posts the same two
   fields (`identifier`, `password`) to the same `login` server action, the
   four ?error= messages are the same strings in the same role="alert", and
   the accessible names the e2e suite signs in with — "Email or phone",
   "Password", the "Sign in" button, the "One door, every account." heading —
   are byte-identical (they still come from dict/auth.ts).

   A server component. The only client code is three islands: the password
   eye, the submit button (it reads useFormStatus for its pending state) and
   LoginAmbient (the desktop pointer light — inert on touch and under reduced
   motion). Everything visual is src/themes/login.css; no colour or font
   lives here.

   Deliberately NOT here: "Remember me" and "Forgot password?" (the reference
   has both). Neither would work today — the session length is not
   selectable and there is no reset flow — and a control that does nothing is
   worse than none. Nor any third-party sign-in (founder: "don't add sign in
   with other methods").
   ========================================================================== */

function errorMessage(error: string, t: (m: { en: string; ar: string }) => string): string {
  if (error === "pending") return t(msgs.errPending);
  if (error === "rejected") return t(msgs.errRejected);
  if (error === "health") return t(msgs.errHealth);
  return t(msgs.errDefault);
}

/** One mark on its glass tile: a frosted bezel (with the sweeping sheen)
    round a FLAT, opaque plate in the brand's own canvas colour, the mark on
    the plate. The tile re-stamps its brand (ADR-054) only so that canvas
    colour resolves from the brand file; the artwork is the supplied file,
    unaltered (src/themes/assets.ts), and nothing passes over or behind it. */
function MarkTile({ brand, src, width, height, word }: {
  brand: "byteforce" | "bsystems";
  src: string | null;
  width: number;
  height: number;
  word: string;
}) {
  return (
    <span className={`lg-tile lg-tile--${brand}`} data-brand={brand}>
      <span className="lg-tile-glass">
        <span className="lg-tile-sheen" />
        <span className="lg-tile-plate">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- small static brand PNGs, as BrandLogo
            <img
              className={`lg-mark lg-mark--${brand}`}
              src={src}
              alt=""
              width={width}
              height={height}
              decoding="async"
              draggable={false}
            />
          ) : (
            <span className="lg-mark-word">{word}</span>
          )}
        </span>
      </span>
    </span>
  );
}

export function LoginGlass({ locale, error }: { locale: Locale; error?: string }) {
  const t = tFor(locale);
  const bf = BRAND_ASSETS.byteforce;
  const bs = BRAND_ASSETS.bsystems;
  return (
    <main className="lg-shell">
      {/* the ground: a wash, three soft single-hue glows, four glass
          bubbles. Decorative only; it re-stamps B-Systems so that brand
          file's palette resolves here and nowhere else (never nested). */}
      <div className="lg-ground" aria-hidden="true">
        <div className="lg-aurora" data-brand="bsystems">
          <div className="lg-depth lg-depth--far">
            <span className="lg-blob lg-blob--lavender" />
            <span className="lg-blob lg-blob--indigo" />
            <span className="lg-blob lg-blob--mist" />
          </div>
          <div className="lg-depth lg-depth--near">
            <span className="lg-orb lg-orb--1" />
            <span className="lg-orb lg-orb--2" />
            <span className="lg-orb lg-orb--3" />
            <span className="lg-orb lg-orb--4" />
          </div>
        </div>
      </div>

      <div className="lg-top">
        <LanguageToggle />
        <ThemeToggle compact />
      </div>

      <div className="lg-stage">
        <div className="lg-card">
          <div className="lg-light" aria-hidden="true">
            <span className="lg-spot" />
          </div>

          <div className="lg-duo" role="img" aria-label={t(glass.marks)}>
            <MarkTile
              brand="byteforce"
              src={bf.logoHorizontal ?? bf.logoMark}
              width={475}
              height={360}
              word={bf.wordmark}
            />
            <span className="lg-x">×</span>
            <MarkTile
              brand="bsystems"
              src={bs.logoMark ?? bs.logoHorizontal}
              width={636}
              height={1101}
              word={bs.wordmark}
            />
          </div>

          <h1 className="lg-title">{t(msgs.title)}</h1>
          <p className="lg-kicker">{t(glass.kicker)}</p>
          <p className="lg-sub">{t(msgs.sub)}</p>

          {error ? (
            <p role="alert" className="lg-alert">
              <span className="lg-alert-icon" aria-hidden="true">
                !
              </span>
              <span>{errorMessage(error, t)}</span>
            </p>
          ) : null}

          <form action={login} className="lg-form">
            <div className="lg-field lg-field--id">
              <input
                id="lg-identifier"
                className="lg-input"
                type="text"
                name="identifier"
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t(msgs.identifierPlaceholder)}
              />
              <label className="lg-label" htmlFor="lg-identifier">
                {t(msgs.identifierLabel)}
              </label>
              <svg
                className="lg-lead"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20.5c1.4-3.6 4.4-5.5 8-5.5s6.6 1.9 8 5.5" />
              </svg>
            </div>

            <GlassPasswordField
              label={t(msgs.passwordLabel)}
              reveal={t(glass.reveal)}
              titleShow={t(glass.revealTitleShow)}
              titleHide={t(glass.revealTitleHide)}
            />

            <GlassSubmit label={t(msgs.submit)} />
          </form>

          <p className="lg-foot">
            {t(msgs.footNew)} <Link href="/portal">{t(msgs.footLink)}</Link>
          </p>
        </div>
      </div>

      <p className="lg-tagline">{t(glass.tagline)}</p>

      <LoginAmbient />
    </main>
  );
}
