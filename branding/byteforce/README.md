# ByteForce brand assets — drop zone

`tokens.css` in this folder is the canonical token file for App A (ByteForce CRM).
The condensed rulebook lives in `.claude/skills/byteforce-brand/SKILL.md`; the full
spec is SPEC.md §4.2; the official brand book PDF is the ultimate reference.

## Founder: drop these files here (any format is fine — the agent adapts)

- `logo-horizontal.(svg|png)` — primary lockup (orange bubble frame + violet wordmark + tagline)
- `logo-mark.(svg|png)` — the speech-bubble mark alone (favicon / avatar / compact spaces)
- `logo-mono-dark.(svg|png)` — single-color version for light backgrounds
- `logo-mono-light.(svg|png)` — single-color version for dark/orange backgrounds
- `pattern.(svg|png)` — optional bubble pattern texture
- `fonts/LamaSans-Regular.(ttf|otf|woff2)` and `fonts/LamaSans-Bold.(ttf|otf|woff2)`
- `fonts/Point-*.…` — optional display face named in the brand book

## Agent instructions

Reference the filenames actually present (do not assume the list above is complete),
wire them through @font-face and an assets map, and record the mapping as an ADR.
Until Lama Sans files arrive, the fallback stack in tokens.css applies (A-13).
