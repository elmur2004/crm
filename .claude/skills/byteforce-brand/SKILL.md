---
name: byteforce-brand
description: ByteForce brand system (colors, Lama Sans typography, logo rules, bilingual EN/AR conventions) for App A, the ByteForce CRM. Use when building, styling, or reviewing any ByteForce-branded screen, component, email, seed content, or asset, and when mapping UI states to brand colors.
---

# ByteForce brand — condensed rulebook

Canonical tokens: `branding/byteforce/tokens.css` (consume the semantic `--color-*` /
`--font-*` variables — never raw hex). Full spec: SPEC.md §4.2. Logo files: founder-supplied
in `branding/byteforce/` — adapt to filenames actually present. Audit with `/brand-audit`.

## Palette

| Token | Hex | Role |
|---|---|---|
| Bold Orange | `#F15C24` | Primary — CTAs, primary buttons, active states, key highlights |
| Royal Violet | `#53449B` | Secondary — headings, navigation, links, section accents |
| Ink | `#231F20` | Body text |
| Light Gray | `#E6E7E8` | Borders, dividers, muted surfaces, table lines |
| Off-white | `#F4F1EA` | Default page canvas (cards may be white on top of it) |

**ADR-001:** the official brand book fixes Royal Violet at `#53449B`. An earlier design
kit used `#4B3B9C` — never use it.

## Typography

Lama Sans only — Regular (400) for body, Bold (700) for headings and emphasis. Font files
land in `branding/byteforce/fonts/` (pending, A-13); until then the fallback stack in
tokens.css applies. "Point" is an optional display face — only if its files are supplied.

## UI mapping

Primary buttons and focus states = orange on white text. Page headings, sidebar/nav,
links = violet. Stage/status chips = tints of orange and violet only — no green, red is
reserved for genuine errors (functional `--color-danger`). Tables ruled with Light Gray.
Dashboards: numbers in ink, labels in violet, the one number that matters may be orange.

## Hard rules

- Only the five palette values (plus the functional danger tint) anywhere in App A.
- Character: premium, minimal, strategic — generous whitespace, flat color blocks, no
  decorative noise. ONE sanctioned gradient (ADR-054): `--gradient-hero`
  (orange→`--bf-grad-mid`→violet), hero moments only — today exactly the kept-design
  accounting dashboard (its hero banner + target meter's under-goal fill). Never a
  default background anywhere else.
- Bilingual: EN/AR equal citizens — CSS logical properties, layouts survive `dir="rtl"`.
- No emoji in UI copy.
- Logo: never rotate, recolor, stretch, add effects, or place on busy/red backgrounds;
  bubble pattern is subtle texture only, never behind body text.
