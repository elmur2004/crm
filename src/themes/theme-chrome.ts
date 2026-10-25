/* The colour the mobile browser chrome (and the installed app's title bar)
   wears in DARK mode, emitted as <meta name="theme-color">.

   Asset exemption (the src/app/manifest.ts precedent, SPEC §4.4): a <meta>
   content attribute cannot consume a CSS variable, so this one value is a
   literal. It lives in src/themes/ — inside the brand-audit allowlist — and
   it mirrors branding/b-systems/tokens.css exactly: #0B0F3D = --bs-indigodeep,
   the brand's own "dramatic dark canvas".

   LIGHT deliberately has no entry. Before dark mode there was no theme-color
   meta at all — the browser used its default chrome and the installed app
   used the manifest's theme_color (#1D267D) — and a person on the light theme
   must see exactly what they saw before. */
export const THEME_CHROME_DARK = "#0B0F3D";
