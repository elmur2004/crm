---
name: bsystems-brand
description: B-Systems brand system (Systems Indigo / Process Lavender / Signal Pink palette, 60-28-12 rule, signature gradient and mesh, Raleway + Inter + JetBrains Mono typography, voice rules) for App B (B-Systems CRM) and App C (Partnership Portal). Use when building, styling, or reviewing any B-Systems-branded screen, the portal landing/login hero, dashboards, or UI copy for these apps.
---

# B-Systems brand — condensed rulebook

Canonical tokens: `branding/b-systems/tokens.css` (consume semantic variables — never raw
hex). Full spec: SPEC.md §4.3. Logo files: founder-supplied in `branding/b-systems/` —
adapt to filenames present. Fonts via Google Fonts. Audit with `/brand-audit`.

## Palette — the 60 · 28 · 12 rule

| Token | Hex | Share | Role |
|---|---|---|---|
| Systems Indigo | `#1D267D` | 60% | The anchor — primary surfaces, headers, primary buttons, body type on light |
| Process Lavender | `#D4ADFC` | 28% | The air — secondary surfaces, callouts, gradient mid-tones |
| Signal Pink | `#FF4F87` | 12% | The cue — CTAs, badges, single-word emphasis. **Never a surface, never body text** |

Supporting: Paper `#FAFAFD` (default canvas — **never pure #FFFFFF**), Lavender Mist
`#E8D4FE` (cards/callouts), Indigo Deep `#0B0F3D` (dark hero canvas + max-contrast text).
If a composition feels off, audit pink first — it is almost always over-used.

## Signature gradient + mesh (hero moments ONLY)

`--gradient-hero`: 135°, `#0B0F3D 0% → #1D267D 25% → #4A2A8E 55% → #8B3A95 75% → #FF4F87 100%`.
Never radial, never reversed (pink is the exit), never a default background. Natural homes:
portal landing hero, login panel, cover-style statement panels. Layer `.bs-mesh` (white
grid ~4%, 60px) over hero gradients only — never behind body text. Gradient logo never
sits on a gradient surface.

## Typography

| Family | Role | Key sizes |
|---|---|---|
| Raleway | Display — headings only | H1 800/64 · H2 700/40 · H3 600/26 · H4 500/20; tracking −2%…−3.5% on 700–800 |
| Inter | Body + UI — anything over two lines | Lead 400/17 · Body 400/14 (lh 1.55) · labels/buttons 500 · KPI numbers 700 |
| JetBrains Mono | Meta — tags, IDs, table meta, page numbers | 500 / 10–12px, UPPERCASE, +0.22em tracking |

Pink may color single words inside a headline — never whole sentences.

## UI mapping

Primary buttons = indigo; the one true CTA per view may be pink. Kanban columns on Paper,
cards white-on-Mist or Mist-on-Paper; stage chips = palette tints (no green/teal/orange —
"success" stays indigo, alerts use pink). Dark headers/heroes = Indigo Deep. Dashboards:
KPI numbers Inter 700 in indigo, labels JetBrains Mono uppercase, accents pink sparingly.

## Voice in UI copy

Clear not simple · confident not arrogant · structured not rigid · direct not blunt.
CTAs state direct value: "Add lead", "Log the follow-up", "Set the meeting" — never
"discover", "unlock", "elevate". Calm authority; the operator in command.
