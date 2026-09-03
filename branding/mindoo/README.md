# Mindoo brand assets — drop zone

`tokens.css` in this folder is the canonical token file for the **Mindoo app**
(`src/app/(mindoo)/`, ADR-074). Its source is the founder's own guideline —
*"mindoo brandguidline new 6.pdf"*, Brand Identity, 16pp — kept beside it in
this folder so the tokens and the document they came from cannot drift apart.

## What the guideline actually gives, and what is derived

The palette is **four colours** (page 15) and they are in `tokens.css` verbatim:

| | | |
| --- | --- | --- |
| `#521E90` | Deep Purple | the anchor — chrome, primary, links |
| `#9044CA` | Bright Purple | the cue — CTAs, badges, the Won column |
| `#000000` | Black | headings, the dramatic canvas |
| `#FAFAEE` | Cream | the default page ground |

Everything else in that file — the muted greys, the borders, the tints, the
whole per-stage board ramp — is **derived**, and says so inline. That is the
same position the other two brands are in (B-Systems' guideline gives three
colours and its greys are derivations too), but it is worth stating plainly: if
a fuller sheet arrives, `tokens.css` is the one place it changes.

Functional colours — danger red, the accounting green, the WhatsApp chip, the
Postpone amber — are deliberately **identical across all brands** (SPEC §4 R2):
a destructive action must not change meaning when you change company.

## Founder: drop these files here (any format is fine — the agent adapts)

- `logo-mark.(svg|png)` — the "m with eyes" mark alone (favicon / app icon /
  avatar). **Outstanding.** The guideline's mark is vector artwork with no
  exportable asset embedded in the PDF, so the app header currently renders the
  documented typographic fallback: the word **MINDOO** in the brand display
  font. Drop a file here, point `BRAND_ASSETS.mindoo.logoMark` at its served
  copy in `public/brand/mindoo/`, and nothing else changes.
- `logo-horizontal.(svg|png)` — mark + wordmark lockup for light backgrounds.
- `logo-mono.(svg|png)` — single-colour lockup, Deep Purple `#521E90`.

## Fonts

- **Montserrat** — the text face. On Google Fonts; self-hosted through
  `@fontsource/montserrat` in the Mindoo root layout. Nothing to drop.
- **Monotalic** — the display face, and **outstanding**. It is not on Google
  Fonts, so `--font-display` names it FIRST and falls through to Montserrat.
  Drop `Monotalic-*.woff2` here and serve it, and every heading in the app
  changes with no code edit — the same arrangement ByteForce's Lama Sans has had
  since A-13. The token is the seam.

## Agent instructions

Reference the filenames actually present; never hardcode a colour or a font
outside this file (SPEC §4, enforced by `src/lib/brand-tokens.test.ts`, which
requires this scope to declare the IDENTICAL semantic token set as the other
three); and record any asset mapping as an ADR.
