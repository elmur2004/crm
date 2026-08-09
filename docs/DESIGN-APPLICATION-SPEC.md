# IMPLEMENTATION SPEC — Restyle V2 App to the Claude Design Prototype
Source of truth: `D:\CRM\Claude Design Handoff\project\Sales Platform.dc.html` (prototype `tok` dictionaries + `stageSpec()` + template literals), merged from 6 extraction reports and calibrated against the live token files (`D:\CRM\branding\byteforce\tokens.css`, `D:\CRM\branding\b-systems\tokens.css`, `D:\CRM\src\themes\neutral.css`, `D:\CRM\src\app\globals.css`).

Conventions used below:
- **PROTO** = value taken verbatim from the prototype. **DERIVED** = no direct prototype equivalent; closest prototype-faithful derivation, rule stated. **PROPOSED** = new stage (Negotiation) or new var.
- Stage key mapping: `intake` = New / Lead / Leads · `following` = Following Up · `meeting` = Meeting Setting · `proposal` = Sending Proposals / Proposal Sending · `negotiation` = Negotiation · `didnt-answer` = Didn't Answer · `won` = Won · `lost` = Lost.

---

## 1. TOKEN SHEET

### 1.1 Semantic vars — final values per scope

Scopes: `:root[data-brand="byteforce"]`, `:root[data-brand="bsystems"]`, and a **new** `:root[data-brand="neutral"]` scope to be added in `src/themes/neutral.css` (the (home) shell layout stamps `data-brand="neutral"`; keeps the ADR-019 identical-set contract testable across all three).

| Var | ByteForce (A) | B-Systems (B) | Neutral (N) | Note |
|---|---|---|---|---|
| `--color-primary` | `#F15C24` | `#1D267D` | `#1A191C` | PROTO (`tok.primary`) |
| `--color-on-primary` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | PROTO. **B changes** from `#FAFAFD` |
| `--color-secondary` | `#53449B` | `#D4ADFC` | `#53449B` | PROTO |
| `--color-on-secondary` | `#FFFFFF` | `#0B0F3D` | `#FFFFFF` | PROTO |
| `--color-accent` | `#F15C24` | `#FF4F87` | `#1A191C` | PROTO |
| `--color-on-accent` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | B PROTO; A/N DERIVED (accent = primary → same on-color) |
| `--color-heading` | `#53449B` | `#0B0F3D` | `#1A191C` | PROTO. **B changes** from `#1D267D` to deep indigo |
| `--color-link` | `#53449B` | `#1D267D` | `#1D267D` | PROTO (neutral login link literally uses B indigo) |
| `--color-ink` | `#231F20` | `#1B1C33` | `#1A191C` | PROTO. **B changes** from `#0B0F3D` |
| `--color-muted` | `#6E6A6B` | `#6A6E8F` | `#6E6A66` | PROTO. A changes from `#6B6668`, B from `#5A5F8F` |
| `--color-surface` | `#F4F1EA` | `#FAFAFD` | `#F5F4F0` | PROTO |
| `--color-surface-card` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | PROTO (`tok.card`). **B changes** from Paper — see Risk R1 |
| `--color-surface-tint` | `#EFEDF6` | `#E8D4FE` | `#EDEBE5` | PROTO (`tok.tint`). **A changes** from `#E6E7E8` to violet tint |
| `--color-surface-dark` | `#231F20` | `#0B0F3D` | `#1A191C` | PROTO (`tok.dark`) |
| `--color-border` | `#E6E7E8` | `#E3E3F0` | `#DEDCD6` | PROTO. **B changes** from `#E3E1F2` |
| `--color-danger` | `#C0392B` | `#C0392B` | `#C0392B` | PROTO (`tok.danger` identical in all brands). **B changes** from pink — see Risk R2 |
| `--color-on-danger` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | PROTO (error/toast icon discs are white-on-red) |
| `--color-success` | `#2E7D5B` | `#2E7D5B` | `#2E7D5B` | DERIVED — only prototype "success" affordance is the toast ✓ disc (`#2E7D5B`). Use ONLY for toast/confirmation iconography; in-page success surfaces use `--color-primary` (released milestone circles are `tok.primary`). See Risk R4 |
| `--color-on-success` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | DERIVED (glyph on disc is white) |
| `--font-display` | `"Lama Sans","Helvetica Neue",Helvetica,Arial,sans-serif` | `"Raleway",ui-sans-serif,system-ui,sans-serif` | `"Helvetica Neue",Helvetica,Arial,sans-serif` | PROTO |
| `--font-body` | `"Lama Sans","Helvetica Neue",Helvetica,Arial,sans-serif` | `"Inter",ui-sans-serif,system-ui,sans-serif` | `Inter,system-ui,sans-serif` | PROTO |
| `--font-mono` | `"JetBrains Mono",ui-monospace,monospace` | `"JetBrains Mono",ui-monospace,monospace` | `"JetBrains Mono",ui-monospace,monospace` | PROTO. **A changes** — JetBrains Mono must be loaded for App A (Risk R6) |
| `--radius-card` | `10px` | `14px` | `10px` | PROTO (`tok.r`). **A changes** from 12px |
| `--radius-control` | `8px` | `10px` | `8px` | PROTO (`tok.rc`) |
| `--shadow-card` | `0 1px 2px rgba(35,31,32,.05), 0 6px 18px rgba(35,31,32,.05)` | `0 1px 2px rgba(11,15,61,.04), 0 8px 24px rgba(11,15,61,.06)` | `0 1px 2px rgba(0,0,0,.05), 0 6px 18px rgba(0,0,0,.05)` | PROTO |
| `--gradient-hero` | `none` | `linear-gradient(135deg,#0B0F3D 0%,#1D267D 25%,#4A2A8E 55%,#8B3A95 75%,#FF4F87 100%)` | `none` | PROTO — matches current B file exactly; keep |

### 1.2 Proposed var additions (define in all three scopes; add matching `@theme inline` lines in `globals.css`)

| New var | ByteForce | B-Systems | Neutral | Why (prototype evidence) |
|---|---|---|---|---|
| `--color-ink-soft` | `#231F20` (alias ink) | `#1B1C33` (alias ink) | `#3A3835` | Neutral login labels / drop-contract body use `#3A3835`, distinct from ink |
| `--color-faint` | `#8B8781` | `#6A6E8F` (alias muted, DERIVED) | `#8B8781` | Third gray: A header role line & inactive switcher, all neutral mono eyebrows |
| `--color-hairline` | `#F0EEEA` | `#F0F0F7` | `#EFEDE8` | Inner soft dividers (board-card meta border-top, sys-sheet inner hairlines). Note: feed/table rows use `--color-surface` as their hairline — that stays |
| `--color-primary-tint` | `#FBEAE2` | `#E9EBF7` | `#E7E5DF` | A active-nav bg + A entity-card mark bg; B rep-label chip bg + B grid-card mark bg; N inline-code chip bg |
| `--color-primary-tint-ink` | `#A0390F` | `#1D267D` | `#1A191C` | Text on primary-tint (A mark initials `#A0390F`; B `tok.primary`) |
| `--color-secondary-tint` | `#E6E2F2` | `#E1E4F4` | `#EDEBE5` (alias tint, DERIVED) | Partner/Converted badge backgrounds |
| `--color-secondary-tint-ink` | `#3B3175` | `#1D267D` | `#3A3835` (DERIVED) | Partner/Converted badge text |
| `--color-danger-tint` | `#FBEDEB` | `#FBEDEB` | `#FBEDEB` | Error box / Deactivated chip / blocked-drop well bg |
| `--color-danger-border` | `#E8C4BE` | `#E8C4BE` | `#E8C4BE` | Error box + Deactivated chip border |
| `--color-danger-border-strong` | `#E0A79E` | `#E0A79E` | `#E0A79E` | Blocked drag-over column border |
| `--color-danger-ink` | `#8E2C20` | `#8E2C20` | `#8E2C20` | Error message body text |
| `--color-toast-surface` | `#1A191C` | `#1A191C` | `#1A191C` | Global toast bg — uniform across brands (see Risk R7) |
| `--color-toast-ink` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | Toast text |
| `--color-board-card-border` | `rgba(0,0,0,.07)` | `rgba(0,0,0,.07)` | `rgba(0,0,0,.07)` | Kanban card rest border (deliberately not `--color-border`) |
| `--shadow-lift` | `0 14px 30px rgba(0,0,0,.18)` | same | same | Drag-lift shadow |
| `--shadow-modal` | `0 30px 70px rgba(0,0,0,.4)` | same | same | Modal shell |
| `--shadow-toast` | `0 18px 44px rgba(0,0,0,.45)` | same | same | Toast |
| `--color-stage-{key}-chip` / `--color-stage-{key}-chip-ink` | see 1.3 | see 1.3 | aliases (below) | Prototype has 4 values/stage (bar, well, chipBg, chipFg); our set has 2. Mapping: **well → `--color-stage-{key}`** (unchanged semantics), **bar → `--color-stage-{key}-accent`** (unchanged), **chipBg → `-chip` (NEW)**, **chipFg → `-chip-ink` (NEW)** |

Translucent chrome idiom (avoids new vars for B's white-alpha header values): express as `color-mix(in srgb, var(--color-on-primary) N%, transparent)` — e.g. header hairline 12%, active nav 14%, switcher shell 12%, inactive nav text 72%. Modal overlay: `color-mix(in srgb, var(--color-surface-dark) 55%, transparent)` + `backdrop-filter: blur(3px)` (DERIVED from `rgba(14,13,20,.55)`). Valid-drop outline: `color-mix(in srgb, var(--color-stage-{key}-accent) 33%, transparent)` (prototype `bar+'55'`).

Neutral stage vars (contract parity only — neutral never renders boards): `--color-stage-*: var(--color-surface-tint)`, `--color-stage-*-accent: var(--color-border)`, `--color-stage-*-chip: var(--color-surface-tint)`, `--color-stage-*-chip-ink: var(--color-muted)`.

### 1.3 Per-stage color tables (NORMATIVE, from `stageSpec()`)

Column meanings: `-accent` = header bar / card dot / drag border · base = column well · `-chip` = chip & count-pill bg · `-chip-ink` = chip & count-pill fg.

**ByteForce (`data-brand="byteforce"`)** — V2 board renders intake, following, meeting, proposal, won, lost:

| Stage key | `-accent` (bar) | base (well) | `-chip` | `-chip-ink` | Source |
|---|---|---|---|---|---|
| `intake` (New) | `#B4AEB0` | `#F4F2F1` | `#E8E5E2` | `#5B5556` | bar PROTO (a-home dash bar[0]); rest DERIVED — warm-neutral family mirroring Lost, lighter (stageSpec A has no New row; fallback was Lost) |
| `following` | `#53449B` | `#EFEDF6` | `#DFDAF0` | `#3B3175` | PROTO |
| `meeting` | `#7A6EB5` | `#F3F1F9` | `#E6E2F2` | `#4A3F86` | PROTO |
| `proposal` | `#F5865B` | `#FDF2ED` | `#FADDD0` | `#A0390F` | PROTO |
| `negotiation` | `#F37140` | `#FCEEE8` | `#F9D9CA` | `#973610` | DERIVED (var-parity only; not rendered on V2 A board) — RGB midpoint of proposal↔won per the same rule as B |
| `didnt-answer` | `#96928F` | `#E3E0DA` | `#D2CFC9` | `#45403F` | DERIVED (var-parity; not on A board) — ink-tint neutral family |
| `won` | `#F15C24` | `#FBEBE3` | `#F8D5C4` | `#8E3210` | PROTO (matches sys-drag "03 VALID TARGET" exactly) |
| `lost` | `#8A8285` | `#F0EEEB` | `#E2DDD8` | `#4A4446` | PROTO. **A lost-accent changes** from danger red to neutral gray ("Lost is the one neutral in both brands") |

**B-Systems (`data-brand="bsystems"`)** — V2 CRM board renders intake, following, meeting, proposal, negotiation, won, lost; Partnership CRM renders intake, didnt-answer, following, meeting, won, lost:

| Stage key | `-accent` (bar) | base (well) | `-chip` | `-chip-ink` | Source |
|---|---|---|---|---|---|
| `intake` (New / Lead) | `#1D267D` | `#ECEEF8` | `#DBDFF2` | `#1D267D` | PROTO |
| `didnt-answer` | `#3B2F8C` | `#EFEDF9` | `#E0DCF3` | `#33288A` | PROTO |
| `following` | `#5A3A96` | `#F1EDF9` | `#E6DDF5` | `#4B2F86` | PROTO |
| `meeting` | `#8B3A95` | `#F6EDF7` | `#F0DEF2` | `#7A2F85` | PROTO |
| `proposal` | `#B03D8F` | `#F9EEF6` | `#F5DDEE` | `#95307A` | PROTO |
| **`negotiation`** | **`#D8468B`** | **`#FCEFF5`** | **`#FADCEA`** | **`#A22766`** | **PROPOSED** — rule applied (below) |
| `won` | `#FF4F87` | `#FFF0F5` | `#FFDCE7` | `#B01E51` | PROTO. Signal Pink = Won bar + ~6–8% tint well only, never a saturated surface, never body text |
| `lost` | `#6B6F94` | `#F1F1F6` | `#E3E3EC` | `#4C4F6B` | PROTO. **B lost-accent changes** from pink to neutral (Risk R3) |

**Negotiation rule applied (sys-stages, stated):** "Every column is visually distinct using tints of its own brand palette — no new hues"; B columns walk the indigo→pink ramp in board order, wells ≈ 8% tint of the bar on white, chips ≈ 14% tint with a darkened AA foreground, and Signal Pink itself stays reserved as the Won cue. Negotiation sits between Proposal Sending (`#B03D8F`) and Won (`#FF4F87`), so **each of its four values is the arithmetic RGB midpoint of the flanking stages' corresponding values** — bar `#D8468B` (mid-ramp magenta-pink, not Signal Pink), well `#FCEFF5` (≈8% tint), chip `#FADCEA` (≈14% tint), chip-ink `#A22766` (darkened to AA on the chip). The A-brand parity values use the identical midpoint rule on the orange ramp.

### 1.4 Fonts, weights, radii, shadows (actually used in the prototype)

- **Raleway** (B display): 700 (h1 30, h2 20, wordmark, deal names 21, stage-sheet titles), 800 (marketing 56/34/28, logo "S" glyphs). Load 700+800.
- **Inter** (B/N body): 400, 500, 600, 700. Load all four.
- **JetBrains Mono** (all scopes): 500 (chips, meta, eyebrow-lite), 700 (eyebrows, th, column titles, switcher segs). Load 500+700.
- **Lama Sans** (A display+body): prototype styles demand 400/500/600/700; the licensed family has 400/700 only → map 500→400, 600→700 via `font-synthesis: none` + explicit weights, or buy the intermediate cuts (Risk R5).
- Radii: card 10/14, control 8/10, modal `calc(var(--radius-card) + 4px)`, chips 4–6px literal, count/select pills 20px, action pills 22px, board wells 12px, board cards 10px (all brands — board card radius is a fixed 10px, not `--radius-card`).
- Shadows: `--shadow-card`, `--shadow-lift`, `--shadow-modal`, `--shadow-toast` as in 1.2. Board card rest shadow: `0 1px 2px rgba(0,0,0,.05)` (literal, all brands).
- Keyframes (DERIVED — referenced but not defined in extracts): `fadeIn` .14s ease-out (opacity 0→1), `popIn` .16s ease-out (opacity 0→1, `scale(.96) translateY(6px)`→none), `toastIn` .18s ease-out (opacity 0→1, `translateY(10px)`→none).
- Focus (DERIVED — prototype omits focus styles): `:focus-visible { outline: 2px solid color-mix(in srgb, var(--color-primary) 45%, transparent); outline-offset: 2px; }` — mirrors the valid-drop outline idiom.

---

## 2. SHARED COMPONENT SPECS

All CSS consumes the token sheet; `.u-*` type utilities first since everything references them.

### 2.0 Shared type styles (prototype `t.*` — identical formula in every brand)

```css
.u-eyebrow  { font: 700 10px/1 var(--font-mono); letter-spacing:.22em; color:var(--color-muted); text-transform:uppercase; }
.u-h1       { margin:12px 0 0; font:700 30px/1.14 var(--font-display); letter-spacing:-.022em; color:var(--color-heading); }
.u-h2       { margin:0; font:700 20px/1.2 var(--font-display); letter-spacing:-.015em; color:var(--color-heading); }
.u-h3       { margin:0; font:600 15px/1.3 var(--font-display); letter-spacing:-.008em; color:var(--color-heading); }
.u-sub      { margin:8px 0 0; font:400 13.5px/1.55 var(--font-body); color:var(--color-muted); max-width:62ch; }
.u-label    { font:600 11.5px var(--font-body); color:var(--color-ink); }
.u-muted    { font:400 12.5px/1.5 var(--font-body); color:var(--color-muted); }
.u-footnote { margin:14px 0 0; font:400 12px/1.5 var(--font-body); color:var(--color-muted); }
.u-mono     { font:500 10.5px var(--font-mono); letter-spacing:.16em; color:var(--color-muted); text-transform:uppercase; }
```
(Existing `text-brand-meta` utility ≈ `.u-mono`; reconcile letter-spacing to .16em for in-app meta, keep .22em for `.u-eyebrow`.)

### 2.1 App shell / header (product chrome — NOT the prototype navigator)

```css
.app-header { display:flex; align-items:center; gap:22px; padding-inline:22px; height:62px; border-bottom:1px solid var(--color-border); background:var(--color-surface-card); color:var(--color-ink); }
@media (max-width:768px){ .app-header{ height:54px; gap:10px; padding-inline:12px; } .app-header .wordmark,.app-header .user-meta{ display:none; } }

/* B-Systems: dark chrome */
[data-brand="bsystems"] .app-header { background:var(--color-primary); color:var(--color-on-primary);
  border-bottom:1px solid color-mix(in srgb, var(--color-on-primary) 12%, transparent); }
[data-brand="bsystems"] [data-shell="external"] .app-header { background:var(--color-surface-dark); } /* agents/partners keep the deep-navy portal identity — Risk R8 */

/* Logo marks */
.logo-a { width:28px; height:28px; border-radius:8px 8px 8px 2px; background:var(--color-primary); }  /* ByteForce notched square, no glyph */
.logo-b { width:28px; height:28px; border-radius:9px; display:grid; place-items:center;
  background:linear-gradient(135deg,#1D267D 0%,#8B3A95 60%,#FF4F87 100%); /* compact 3-stop mark gradient — sanctioned gradient use */
  font:800 14px var(--font-display); color:#fff; } /* glyph "S" */
.wordmark { font:700 16px var(--font-display); letter-spacing:-.02em; color:inherit; }

/* Nav */
.nav-item { border:none; background:transparent; border-radius:7px; padding:8px 12px; font:500 13px var(--font-body); color:var(--color-muted); cursor:pointer; }
.nav-item[aria-current] { font-weight:600; background:var(--color-primary-tint); color:var(--color-primary); }
[data-brand="bsystems"] .nav-item { color:color-mix(in srgb, var(--color-on-primary) 72%, transparent); }
[data-brand="bsystems"] .nav-item[aria-current] { background:color-mix(in srgb, var(--color-on-primary) 14%, transparent); color:var(--color-on-primary); }
.app-nav { display:flex; gap:2px; min-width:0; overflow-x:auto; scrollbar-width:none; } /* admin has 10 items — Risk R9 */

/* Entity switcher — only for dual-entity users; links across /byteforce ↔ /b-systems */
.switcher { display:flex; gap:2px; padding:3px; border-radius:9px; background:#F2F0EC; border:1px solid var(--color-border); }
[data-brand="bsystems"] .switcher { background:color-mix(in srgb, var(--color-on-primary) 12%, transparent); border-color:color-mix(in srgb, var(--color-on-primary) 14%, transparent); }
.switcher-seg { border:none; background:transparent; border-radius:7px; padding:6px 11px; font:700 10.5px var(--font-mono); letter-spacing:.1em; color:var(--color-faint); cursor:pointer; }
.switcher-seg[aria-current] { background:var(--color-primary); color:var(--color-on-primary); }
[data-brand="bsystems"] .switcher-seg { color:color-mix(in srgb, var(--color-on-primary) 70%, transparent); }
[data-brand="bsystems"] .switcher-seg[aria-current] { background:#fff; color:var(--color-primary); }

/* User block */
.user { display:flex; align-items:center; gap:9px; padding-inline-start:6px; margin-inline-start:auto; }
.user-avatar { width:30px; height:30px; border-radius:50%; display:grid; place-items:center; font:700 11px var(--font-body);
  background:var(--color-secondary); color:var(--color-on-secondary); }           /* A: violet/white; B internal: lavender/#1D267D-ish deep */
[data-shell="external"] .user-avatar { background:var(--color-accent); color:var(--color-on-accent); } /* agents/partners: pink */
.user-name { font:600 12.5px var(--font-body); } .user-role { font:400 10.5px var(--font-body); color:var(--color-faint); }
[data-brand="bsystems"] .user-role { color:color-mix(in srgb, var(--color-on-primary) 60%, transparent); }

/* Notifications bell — NO prototype; composed from nav-item + count pill */
.bell { position:relative; width:36px; height:36px; border-radius:7px; display:grid; place-items:center; background:transparent; border:none; color:inherit; cursor:pointer; }
.bell:hover { background:var(--color-primary-tint); }
[data-brand="bsystems"] .bell:hover { background:color-mix(in srgb, var(--color-on-primary) 14%, transparent); }
.bell-count { position:absolute; top:3px; inset-inline-end:3px; min-width:16px; height:16px; padding:0 4px; border-radius:20px;
  display:grid; place-items:center; background:var(--color-accent); color:var(--color-on-accent); font:600 9.5px var(--font-body); }
.bell-menu { position:absolute; inset-inline-end:0; top:calc(100% + 8px); width:min(360px,90vw); background:var(--color-surface-card);
  border:1px solid var(--color-border); border-radius:var(--radius-card); box-shadow:var(--shadow-modal); overflow:hidden; color:var(--color-ink); }
/* menu head = card head pattern (16px 18px 12px, border-bottom border); rows = feed-row pattern (§2.16) */
```

### 2.2 Page header pattern

```css
.page { padding:26px 26px 44px; }               /* detail pages: 20px 26px 44px */
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; flex-wrap:wrap; margin-bottom:20px; }
/* left: .u-eyebrow + .u-h1 + .u-sub ; right: actions row { display:flex; gap:9px; flex-wrap:wrap; align-items:center; } */
```

### 2.3 Stat tile (KPI)

```css
.tile { background:var(--color-surface-card); border:1px solid var(--color-border); border-radius:var(--radius-card);
  box-shadow:var(--shadow-card); padding:16px 17px 15px; display:flex; flex-direction:column; gap:9px; }
.tile-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(206px,1fr)); gap:13px; }
.tile-dot { width:6px; height:6px; border-radius:2px; background:var(--color-primary); flex:none; }
.tile--warn .tile-dot { background:var(--color-danger); }
.tile-label { font:500 10.5px var(--font-mono); letter-spacing:.16em; color:var(--color-muted); text-transform:uppercase; }
.tile-value { font:700 27px/1 var(--font-display); letter-spacing:-.025em; color:var(--color-heading); }
.tile-delta { font:400 11.5px var(--font-body); color:var(--color-muted); }
.tile--warn .tile-delta { color:var(--color-danger); }
```

### 2.4 Card

```css
.card  { background:var(--color-surface-card); border:1px solid var(--color-border); border-radius:var(--radius-card); box-shadow:var(--shadow-card); }
.card--flush  { overflow:hidden; margin-top:14px; }   /* t.cardFlush */
.card--flush0 { overflow:hidden; }                    /* t.cardFlush0 */
.card-head { padding:16px 18px 12px; border-bottom:1px solid var(--color-border); display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
/* Entity (grid) card — clickable */
.ecard { composes card; padding:17px 17px 15px; cursor:pointer; text-align:start; display:flex; flex-direction:column; color:var(--color-ink); font-family:var(--font-body); min-height:190px; }
.ecard-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(272px,1fr)); gap:13px; }
.ecard-mark { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; flex:none; font:700 13px var(--font-body);
  background:var(--color-primary-tint); color:var(--color-primary-tint-ink); }
.ecard--accent .ecard-mark { background:var(--color-surface-tint); color:var(--color-heading); }
.ecard-chip { font:500 10px var(--font-mono); letter-spacing:.12em; text-transform:uppercase; border-radius:5px; padding:4px 7px;
  border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-muted); }
.ecard--accent .ecard-chip { background:var(--color-surface-tint); color:var(--color-heading); }
.ecard-title { margin-top:16px; font:600 17px/1.25 var(--font-display); letter-spacing:-.015em; color:var(--color-heading); }
.ecard-sub { margin-top:5px; font:400 12.5px/1.45 var(--font-body); color:var(--color-muted); }
.ecard-stats { display:flex; gap:16px; margin-top:auto; padding-top:15px; }
.ecard-stat-label { font:500 9.5px var(--font-mono); letter-spacing:.14em; color:var(--color-muted); text-transform:uppercase; }
.ecard-stat-value { font:700 14px var(--font-body); color:var(--color-heading); }
.ecard-footer { margin-top:13px; padding-top:11px; border-top:1px solid var(--color-surface); font:400 11px/1.4 var(--font-body); color:var(--color-muted); }
/* Add-card */
.ecard--add { display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:10px; min-height:190px;
  background:transparent; border:1.5px dashed var(--color-border); border-radius:var(--radius-card); padding:20px; cursor:pointer;
  font:600 13px var(--font-body); color:var(--color-muted); box-shadow:none; }
.ecard--add .icon { width:32px; height:32px; border-radius:9px; background:var(--color-surface-tint); color:var(--color-primary); display:grid; place-items:center; font:600 16px var(--font-body); }
```

### 2.5 Table

```css
.table-card { composes .card .card--flush0; }
.table-scroll { width:100%; overflow-x:auto; }
.table { width:100%; border-collapse:collapse; min-width:640px; }   /* embedded detail tables: 560px */
.table th { text-align:start; padding:11px 16px; border-bottom:1px solid var(--color-border); background:var(--color-surface);
  font:700 9.5px var(--font-mono); letter-spacing:.18em; color:var(--color-muted); text-transform:uppercase; white-space:nowrap; }
.table tr { border-bottom:1px solid var(--color-surface); }
.table tr[data-href] { cursor:pointer; }
.table tr[data-inactive] { opacity:.55; }
.table td { padding:13px 16px; vertical-align:middle; white-space:nowrap; }
.table td:first-child span { font:600 13px var(--font-body); color:var(--color-heading); }
.table td span { font:400 13px var(--font-body); color:var(--color-ink); }
.td-mono { font:400 12.5px var(--font-mono); color:var(--color-muted); }         /* identifiers */
.chip-outline { display:inline-block; font:400 12px var(--font-body); color:var(--color-muted); border:1px solid var(--color-border); border-radius:5px; padding:3px 8px; } /* Type cells */
.row-toggle { background:transparent; border:1px solid var(--color-border); border-radius:7px; padding:6px 11px; cursor:pointer;
  font:500 11.5px var(--font-body); color:var(--color-danger); white-space:nowrap; }   /* "Deactivate" */
.row-toggle--restore { color:var(--color-primary); }                                    /* "Reactivate" */
.info-banner { background:var(--color-surface-tint); border:1px solid var(--color-border); border-radius:var(--radius-control);
  padding:12px 15px; margin-bottom:14px; font:400 12.5px/1.5 var(--font-body); color:var(--color-ink); }
.search-input { /* = .field-input + */ width:220px; }
```

### 2.6 Stage chip (+ count pill)

```css
.stage-chip { display:inline-block; font:500 10px var(--font-mono); letter-spacing:.1em; text-transform:uppercase;
  border-radius:5px; padding:4px 8px; background:var(--color-stage-following-chip); color:var(--color-stage-following-chip-ink); }
/* per stage: swap the -chip/-chip-ink pair; unknown stage falls back to lost. Board-card variant: padding:3px 7px. */
.stage-chip--header { font-weight:600; font-size:10.5px; letter-spacing:.14em; border-radius:6px; padding:7px 11px; } /* detail identity head */
.count-pill { font:600 11px var(--font-body); border-radius:20px; padding:2px 8px; min-width:22px; text-align:center;
  background:var(--color-stage-following-chip); color:var(--color-stage-following-chip-ink); }
```

### 2.7 Board column + card (incl. drag/hover)

```css
.board { display:flex; gap:12px; align-items:flex-start; overflow-x:auto; padding-bottom:12px; }  /* DERIVED wrapper */
.col { flex:none; width:250px; display:flex; flex-direction:column; border-radius:12px; overflow:hidden;
  background:var(--color-stage-following); border:1px solid transparent; transition:background .12s ease, border-color .12s ease; }
.board[data-cols="6plus"] .col { width:218px; }        /* V2: every board is 6–7 cols → 218px */
.col-bar { height:3px; background:var(--color-stage-following-accent); flex:none; }
.col-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 13px 9px; }
.col-title { font:700 10.5px var(--font-mono); letter-spacing:.16em; text-transform:uppercase; color:var(--color-stage-following-accent); }
.col-cards { display:flex; flex-direction:column; gap:9px; padding:0 9px 12px; }
.col--over-valid { border-color:var(--color-stage-following-accent);
  outline:2px solid color-mix(in srgb, var(--color-stage-following-accent) 33%, transparent); outline-offset:2px; }
.col--over-blocked { background:var(--color-danger-tint); border-color:var(--color-danger-border-strong); }
.col-locked-note { margin:0 9px 9px; padding:7px 9px; border-radius:7px;
  background:color-mix(in srgb, var(--color-accent) 10%, transparent); border:1px dashed color-mix(in srgb, var(--color-accent) 45%, transparent);
  font:500 10px var(--font-mono); letter-spacing:.12em; text-transform:uppercase; color:var(--color-stage-won-chip-ink); } /* "ADMIN-ONLY COLUMN" */
.col-empty { border:1px dashed var(--color-stage-following-chip); border-radius:9px; padding:18px 10px; text-align:center;
  font:400 11.5px var(--font-body); color:var(--color-stage-following-chip-ink); opacity:.75; } /* text "Nothing here yet" / "Blocked" while blocked-hover */

.bcard { background:#fff; border:1px solid var(--color-board-card-border); border-radius:10px; padding:11px 12px; cursor:grab;
  color:var(--color-ink); font-family:var(--font-body); box-shadow:0 1px 2px rgba(0,0,0,.05); transition:box-shadow .12s ease, transform .12s ease; }
.bcard--lift { border-color:var(--color-stage-following-accent); box-shadow:var(--shadow-lift); transform:rotate(-1.4deg) scale(1.02); opacity:.95; }
.bcard-name-row { display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
.bcard-name { font:600 13.5px var(--font-body); letter-spacing:-.005em; }
.bcard-rep { font:400 10.5px var(--font-body); color:var(--color-muted); white-space:nowrap; }
.bcard-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:8px; } /* .stage-chip (3px 7px) + .tag */
.bcard-tag { font:500 10px var(--font-body); color:var(--color-muted); border:1px solid var(--color-border); border-radius:5px; padding:2px 6px; }
.bcard-badge { display:inline-block; margin-bottom:7px; font:500 9.5px var(--font-mono); letter-spacing:.12em; text-transform:uppercase;
  border-radius:4px; padding:3px 6px; background:var(--color-secondary-tint); color:var(--color-secondary-tint-ink); } /* "PARTNER: …" */
.bcard-meta { display:flex; align-items:center; gap:6px; margin-top:9px; padding-top:9px; border-top:1px solid var(--color-hairline);
  font:400 11.5px/1.4 var(--font-body); color:var(--color-muted); }
.bcard-meta .dot { width:5px; height:5px; border-radius:50%; background:var(--color-stage-following-accent); }
```
Behavior contract (normative): drop never commits — it opens the target stage's modal; cancel reverts; required-miss toasts field names; Won/Lost terminal (drag-out toasts "Won and Lost are terminal — cards cannot be dragged back out."); role-blocked Won toasts "Only {role} can {action}." pattern; moved card is unshifted to top of target column; every confirm writes a stage record + history line.

### 2.8 Form field

```css
.field { display:flex; flex-direction:column; gap:7px; }
.field--wide { grid-column:span 2; }
.field-label { font:600 11.5px var(--font-body); color:var(--color-ink); }   /* required: append " *" */
.field-input { background:var(--color-surface-card); border:1px solid var(--color-border); border-radius:var(--radius-control);
  padding:10px 12px; font:400 13px var(--font-body); color:var(--color-ink); width:100%; outline:none; }
.field-input::placeholder { color:var(--color-muted); }
textarea.field-input { min-height:74px; resize:vertical; font-family:var(--font-body); }
.field-hint { font:400 11px var(--font-body); color:var(--color-muted); }
.pill-select { display:flex; gap:7px; flex-wrap:wrap; }
.pill-option { border:1px solid var(--color-border); border-radius:20px; padding:7px 13px; font:500 12px var(--font-body);
  background:var(--color-surface-card); color:var(--color-muted); cursor:pointer; }
.pill-option[aria-pressed="true"] { border-color:var(--color-primary); background:var(--color-primary); color:var(--color-on-primary); }
.check-row { display:flex; align-items:center; gap:10px; background:var(--color-surface-card); border:1px solid var(--color-border);
  border-radius:var(--radius-control); padding:11px 13px; font:500 13px var(--font-body); color:var(--color-ink); text-align:start; cursor:pointer; }
.check-box { width:18px; height:18px; border-radius:5px; display:grid; place-items:center; background:transparent;
  border:1px solid var(--color-border); color:var(--color-on-primary); font:700 11px var(--font-body); }
.check-row[aria-checked="true"] .check-box { background:var(--color-primary); border-color:var(--color-primary); } /* glyph ✓ */
.dropzone { display:flex; align-items:center; gap:11px; border:1.5px dashed var(--color-border); border-radius:var(--radius-control);
  padding:13px 12px; background:transparent; cursor:pointer; text-align:start; color:var(--color-ink); }
.dropzone .icon { width:32px; height:32px; border-radius:9px; background:var(--color-surface-tint); color:var(--color-heading);
  display:grid; place-items:center; font:600 13px var(--font-body); }  /* glyph ↑ */
.dropzone .title { font:600 12.5px var(--font-body); } .dropzone .hint { display:block; margin-top:3px; font:400 11px var(--font-body); color:var(--color-muted); }
```

### 2.9 Buttons

```css
.btn-primary { background:var(--color-primary); color:var(--color-on-primary); border:none; border-radius:var(--radius-control);
  padding:11px 18px; font:600 13px var(--font-body); cursor:pointer; flex:none; }
.btn-ghost { background:var(--color-surface-card); color:var(--color-ink); border:1px solid var(--color-border);
  border-radius:var(--radius-control); padding:10px 15px; font:600 12.5px var(--font-body); cursor:pointer; flex:none; }
.btn-danger { /* prototype's destructive affordance is a ghost with danger ink (row toggles) */
  background:transparent; color:var(--color-danger); border:1px solid var(--color-border); border-radius:var(--radius-control);
  padding:10px 15px; font:600 12.5px var(--font-body); cursor:pointer; }
.btn-danger--solid { background:var(--color-danger); color:var(--color-on-danger); border:none; } /* DERIVED — destructive confirms only */
/* Event-card small variants: primary 9px 15px; ghost 9px 15px font-weight 500. Accent CTA (B marketing only): background:var(--color-accent); color:var(--color-on-accent); border-radius:10px. */
```

### 2.10 Modal

```css
.modal-overlay { position:fixed; inset:0; z-index:60; background:color-mix(in srgb, var(--color-surface-dark) 55%, transparent);
  backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:28px; animation:fadeIn .14s ease-out; }
.modal { width:min(680px,100%); max-height:90vh; display:flex; flex-direction:column; overflow:hidden;
  background:var(--color-surface-card); color:var(--color-ink); font-family:var(--font-body);
  border-radius:calc(var(--radius-card) + 4px); box-shadow:var(--shadow-modal); animation:popIn .16s ease-out; }
.modal-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:20px 24px 16px; border-bottom:1px solid var(--color-border); }
.modal-eyebrow { font:700 10px var(--font-mono); letter-spacing:.2em; color:var(--color-muted); text-transform:uppercase; } /* "FROM → TO" */
.modal-title { margin:8px 0 0; font:700 20px/1.2 var(--font-display); letter-spacing:-.015em; color:var(--color-heading); }
.modal-close { background:none; border:1px solid var(--color-border); border-radius:8px; width:30px; height:30px; color:var(--color-muted); cursor:pointer; } /* ✕ */
.modal-note { padding:12px 24px; background:var(--color-surface-tint); font:400 12.5px/1.5 var(--font-body); color:var(--color-ink); }
.modal-body { padding:20px 24px 4px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px 16px; max-height:52vh; overflow-y:auto; }
.modal-foot { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:16px 24px; margin-top:16px;
  border-top:1px solid var(--color-border); background:var(--color-surface); }
.modal-foot-note { font:400 11.5px var(--font-body); color:var(--color-muted); } /* "Cancelling reverts the card to {from}." */
/* Modal is RTL-aware: shell carries dir; all spacing logical. Confirm=.btn-primary ("Complete & move"/"Create user"/"Save"), Cancel=.btn-ghost. */
```

### 2.11 Toast

```css
.toast-wrap { position:fixed; inset-inline:0; bottom:26px; z-index:70; display:flex; justify-content:center; pointer-events:none; }
.toast { display:flex; align-items:center; gap:11px; max-width:min(520px,88vw); background:var(--color-toast-surface); color:var(--color-toast-ink);
  border-radius:11px; padding:13px 18px; font:500 13px/1.45 var(--font-body); box-shadow:var(--shadow-toast); animation:toastIn .18s ease-out; }
.toast-icon { width:20px; height:20px; border-radius:50%; display:grid; place-items:center; font:700 11px var(--font-body);
  background:var(--color-danger); color:var(--color-on-danger); flex:none; }
.toast--ok .toast-icon { background:var(--color-success); color:var(--color-on-success); }
/* auto-dismiss 3600ms */
```

### 2.12 Badge

```css
.badge { display:inline-block; font:500 9.5px var(--font-mono); letter-spacing:.14em; text-transform:uppercase; border-radius:5px; padding:4px 8px; }
.badge--partner   { background:var(--color-secondary-tint); color:var(--color-secondary-tint-ink); }  /* "PARTNER: DELTA SYSTEMS" */
.badge--converted { background:var(--color-secondary-tint); color:var(--color-secondary-tint-ink); }  /* B: #E1E4F4/#1D267D */
.badge--rep       { background:var(--color-primary-tint); color:var(--color-primary); }               /* won-deal rep label (admin) */
.badge--danger    { font-size:10px; letter-spacing:.1em; background:var(--color-danger-tint); color:var(--color-danger); border:1px solid var(--color-danger-border); } /* "DEACTIVATED" */
.badge--readonly  { font:600 9.5px var(--font-mono); letter-spacing:.18em; color:var(--color-muted); background:var(--color-surface-card);
  border:1px solid var(--color-border); border-radius:6px; padding:8px 11px; }                        /* "READ ONLY · UPDATES WITHIN 5s" */
.badge--entity    { font:500 10px var(--font-mono); letter-spacing:.1em; border:1px solid var(--color-border); border-radius:5px; padding:4px 8px;
  background:var(--color-surface); color:var(--color-muted); }
.badge--entity-both { background:var(--color-surface-tint); color:var(--color-heading); }
```

### 2.13 Empty state

```css
.empty { border:1px dashed var(--color-border); border-radius:9px; padding:20px; text-align:center; font:400 12px var(--font-body); color:var(--color-muted); }
/* Records-panel variant: padding:22px; radius var(--radius-control); font-size 12.5px.
   Table empty: wrapper padded ~40px; .empty-title{font:600 14px var(--font-display);color:var(--color-heading)} .empty-body{.u-muted} + .btn-primary. */
```

### 2.14 Login screen (neutral scope; replaces the ADR-028 centered card — Risk R18)

Split `display:flex; min-height:820px; align-items:stretch`.
- Left panel `flex:1.05; background:var(--color-surface) /*#F5F4F0*/; display:flex; flex-direction:column; justify-content:center; padding:56px clamp(32px,6vw,84px);` inner `max-width:400px`.
- Eyebrow "SIGN IN · /LOGIN" `.u-eyebrow` at `#8B8781` (`--color-faint`), ls .24em; H1 "One door, every account." `600 34px/1.12 var(--font-display); ls -.022em; color:var(--color-ink)`; sub `400 14.5px/1.6 var(--font-body); color:#5E5B57` (neutral muted-deep — neutral.css literal).
- Error box: `display:flex; gap:10px; background:var(--color-danger-tint); border:1px solid var(--color-danger-border); border-inline-start:3px solid var(--color-danger); border-radius:8px; padding:12px 14px;` icon 16px disc `background:var(--color-danger); color:var(--color-on-danger); font:700 11px/16px` "!"; message `400 13px/1.5; color:var(--color-danger-ink)`.
- Form gap 16px; labels `600 11.5px; color:var(--color-ink-soft)`; inputs `background:#fff; border:1px solid #D8D5CE; border-radius:9px; padding:13px 14px; font:400 14px var(--font-body); color:var(--color-ink); width:100%; outline:none` (neutral.css literals — sanctioned home); submit `background:var(--color-primary); color:#fff; border-radius:9px; padding:15px 18px; font:600 14px; ls .005em`.
- Footer: `margin-top:30px; padding-top:20px; border-top:1px solid var(--color-border);` copy "New partner sales rep?" + underlined link-button "Apply to the partnership programme" in `600 13px; color:var(--color-link)` → routes to `/portal`.
- Right billboard `flex:.85; min-width:300px; flex-direction:column`, two halves `flex:1`:
  - **ByteForce half**: `background:#F4F1EA; border-inline-start:1px solid var(--color-border); padding:44px 40px; justify-content:space-between`. Mark `38px; radius 10px 10px 10px 3px; background:#F15C24`; wordmark `700 19px "Helvetica Neue"…; ls -.02em; color:#231F20`; eyebrow "CREATIVE & PERFORMANCE" `700 9.5px mono; ls .22em; color:#53449B`; line `400 15px/1.5; color:#231F20; max-width:24ch`.
  - **B-Systems half**: `background:var(--gradient-hero uses B values: linear-gradient(135deg,#0B0F3D 0%,#1D267D 25%,#4A2A8E 55%,#8B3A95 75%,#FF4F87 100%)); padding:44px 40px; position:relative; overflow:hidden` + mesh overlay (`.bs-mesh` at 72px). Mark "S" `38px; radius 11px; background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.35); font:800 19px Raleway; color:#fff`; wordmark `700 19px Raleway; color:#fff`; eyebrow "SYSTEMS BEFORE SOFTWARE" `#D4ADFC`; line `rgba(255,255,255,.92); max-width:26ch`.
  (Billboard halves hardcode the two brands' values by design — put them in neutral.css or scoped billboard partials; they are brand billboards, not themed components.)

### 2.15 Hub screen (`/`, neutral scope)

- Wrapper padding 0. Hero: `padding:64px 56px 40px; border-bottom:1px solid var(--color-border)`. Eyebrow "PLATFORM ROOT · /" `700 10px/1 mono; ls .24em; color:var(--color-faint)`; H1 "Two companies. One platform." `600 44px/1.05 var(--font-display); ls -.025em; color:var(--color-ink); max-width:15ch; text-wrap:pretty`; subcopy `400 15.5px/1.6 var(--font-body); color:#5E5B57; max-width:56ch` with inline code chips `500 13px mono; background:var(--color-primary-tint /*#E7E5DF*/); padding:2px 6px; border-radius:4px`.
- App grid: `display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1px; background:var(--color-border); border-bottom:1px solid var(--color-border)` (1px-gap hairlines). **V2: 3 cards** — ByteForce CRM → `/byteforce`, B-Systems CRM → `/b-systems`, Partnership Programme → `/portal` (the portal app is gone; the third card now points at the partnership landing/signup funnel — see map).
- App card `<button>`: `background:#FBFAF7; border:none; padding:32px 30px 30px; text-align:start; flex column; min-height:250px`. Marks: A `34px; radius 10px 10px 10px 3px; background:#F15C24`; B/programme `34px; radius 10px; background:linear-gradient(135deg,#1D267D 0%,#8B3A95 60%,#FF4F87 100%); font:800 16px Raleway; color:#fff` "S". Letter label `700 9.5px mono; ls .2em; color:var(--color-faint)`; title `600 22px/1.2` in the target brand's display family, color `#1A191C`/`#0B0F3D`; desc `400 13.5px/1.55 Inter; color:#5E5B57`; path `500 11px mono; ls .1em; color:var(--color-faint)`; arrow `600 15px Inter` in `#F15C24`/`#1D267D`.
- Demo strip (dev-only): `padding:26px 56px 60px; flex wrap gap:26px; space-between`; label "DEMO ACCOUNTS · DEV ONLY" `700 9.5px mono ls .2em faint`; chips `inline-flex; gap:8px; background:#fff; border:1px solid var(--color-border); border-radius:7px; padding:7px 11px; font:400 12px Inter; color:var(--color-ink-soft)` with role sub `500 10px mono ls .1em faint`; CTA "Go to sign in" `background:var(--color-primary); color:#fff; border-radius:8px; padding:13px 22px; font:600 13.5px Inter`.

### 2.16 Supporting patterns (referenced by the map; condensed, token-mapped)

- **Dashboard stage strip**: `.card--flush` + head (`.u-h3` + `.u-mono` note); grid `repeat(auto-fit,minmax(132px,1fr)); gap:0; background:var(--color-surface-card); border-top:1px solid var(--color-border); margin-inline-end:-1px; margin-block-end:-1px`; cell `padding:14px 15px 15px; border-inline-end/block-end:1px solid var(--color-border)`; bar `26×3px r2 background:var(--color-stage-{key}-accent)`; label `500 11px body muted`; value `700 22px/1 display heading ls -.02em`; sub `400 10.5px body muted`.
- **Feed row**: `flex; gap:12px; padding:11px 0; border-bottom:1px solid var(--color-surface)`; time `500 10.5px mono muted; width:62px`; text `12.5px/1.5`; code chip `500 9.5px mono; ls .12em; muted; background:var(--color-surface); border:1px solid var(--color-border); radius 4px; padding:3px 6px`.
- **Side row**: `flex; gap:11px; padding:10px 0; border-bottom:1px solid var(--color-surface)`; avatar `30px r8 grid-center background:var(--color-surface-tint); color:var(--color-secondary-tint-ink) (A) / var(--color-primary) (B); font:700 11px`; name `600 13px`; sub `400 11px muted`; value `700 13px heading`.
- **Detail identity panel**: `.card--flush0`; head `flex; padding:20px 20px 18px; border-bottom:1px solid var(--color-border)`; name `700 25px/1.15 display heading ls -.022em`; sub `400 12.5px muted`; `.stage-chip--header`; Edit btn `transparent; 1px border; radius control; padding:7px 13px; 500 12px muted`. **Hairline fields grid**: `grid repeat(auto-fit,minmax(180px,1fr)); gap:0; background:card; margin-inline-end:-1px; margin-block-end:-1px`; cell `padding:13px 20px 14px; border-inline-end/block-end:1px solid var(--color-border)`; label `500 9.5px mono ls .16em muted uppercase`; value `margin-top:6px; 400 13px/1.5 ink; word-break:break-word`.
- **Action pills panel**: `.card--flush0`; note "OPENS THE STAGE FORM" `.u-mono`; pill `flex; gap:8px; background:card; 1px border; border-radius:22px; padding:9px 14px 9px 11px; 500 12.5px ink`; leading dot `8×8px r2 background:var(--color-stage-{key}-accent)`; hint bar `padding:12px 18px; border-top:1px solid border; background:surface; 400 12px/1.5 muted`.
- **Event banner**: `flex; gap:16px; wrap; padding:16px 18px; radius card; shadow card`; meeting-kind `background:tint; border:1px solid transparent`; others `background:card; 1px border`; title `600 14px display heading`; body `400 12px/1.5 muted; max-width:54ch`.
- **Stage-record group**: `1px border; radius control; padding:13px 14px; background:surface`; title `600 13px display heading`; time `400 11px mono muted`; inner grid `repeat(auto-fit,minmax(150px,1fr)); gap:11px 16px`.
- **History timeline**: row `flex; gap:12px`; rail `width:9px; background:linear-gradient(var(--color-border),var(--color-border)) no-repeat center/1px 100%` (transparent on last row); dot `7px circle; primary on newest else border`; time `500 10px mono ls .1em muted uppercase`; text `400 12.5px/1.45 ink`; move pill `500 11px body heading; background:tint; r5; padding:3px 7px`; code tag `500 9.5px mono ls .12em muted; 1px border; r4; padding:3px 6px`.
- **Media/audio row + upload**: row `flex; gap:11px; 1px border; radius control; padding:11px 12px; background:card`; play `32px circle primary/on-primary`; track `4px r3 background:border`; fill `background:primary`; meta `400 10.5px mono muted`; upload = `.dropzone` ("Upload a recording · mp3, mp4 · max 50MB").
- **Won-deal manager**: deal card `.card` overflow hidden; head `padding:18px 20px 16px; border-bottom:1px solid border`; name `700 21px/1.2 display heading`; money tile `min-width:150px; background:surface; 1px border; radius control; padding:11px 13px`; money label `.u-mono 9.5px`; value `700 18px display heading` (commission value `color:var(--color-accent)`); admin editable = `.field-input` `padding:7px 9px; 700 15px; width:140px`; facts = hairline fields grid (`minmax(160px,1fr)`, cell `12px 20px 13px`); mismatch warning `margin:14px 20px 0; padding:11px 13px; background:var(--color-stage-won); border:1px solid var(--color-stage-won-chip); radius control; 400 12px/1.5; color:var(--color-stage-won-chip-ink)` + 16px disc `background:var(--color-accent)` "!"; count picker `1px border (primary when selected); r7; padding:5px 10px; 600 11.5px; selected bg primary/on-primary`.
- **Milestone row**: `flex; gap:12px; padding:12px 13px; radius control; 1px solid var(--color-border)`; done `background:surface`; next `background:card; border-color:var(--color-accent)` (rep view); locked `background:repeating-linear-gradient(135deg, var(--color-surface), var(--color-surface) 8px, var(--color-surface-card) 8px, var(--color-surface-card) 16px); opacity:.72 (admin)`; admin box `22px r6; done: bg primary + ✓`; rep icon `22px circle; done ✓ primary; next ○; locked · with 1px dashed border`; label `600 13px`; note `400 11px; primary when done else muted`; rep amount `700 14px; heading when done else var(--color-accent)`; **locked mask `• • • • •` `700 13px mono ls .1em muted` — the real value must be absent from the server payload until release**.
- **Profile**: avatar `46px r12 background:var(--color-accent); color:#fff; 700 16px`; CV icon `34px r8 background:var(--color-surface-tint); color:var(--color-link); 700 9.5px mono` "PDF"; CV/replace buttons per §4 region-6 spec (ghost 7px radius / dashed dropzone).

### 2.17 Portal landing + signup (B-Systems brand scope — see Risk R13)

Implement literally per Region 2 §5–6, with these token mappings: gradient = `--gradient-hero` + `.bs-mesh` (70px landing / 64px signup); pink CTAs = `--color-accent`/`--color-on-accent` radius 9–10px; lavender eyebrows `#D4ADFC` = `--color-secondary`; steps strip hairline grid `gap:1px; background:#E3E3F0` = `--color-border`, cells `background:#FAFAFD` = `--color-surface`, numbers `--color-accent`, titles `700 19px/1.25 Raleway #0B0F3D`, body `#6A6E8F` = muted; commission band `background:#E8D4FE` = `--color-surface-tint`, headline `700 22px/1.3 Raleway #0B0F3D`, CTA indigo = `--color-primary`; footer `background:#0B0F3D` = `--color-surface-dark`, text `rgba(255,255,255,.55)`. Signup left pane = gradient + perks (16px check discs `rgba(255,255,255,.2)`); right pane `background:var(--color-surface); padding:44px clamp(28px,5vw,56px)`, inner `max-width:520px`; fields 2-col grid `gap:14px 16px`, inputs `background:#fff; border:1px solid var(--color-border); radius 10px; padding:12px 13px; 400 13.5px Inter; color:var(--color-ink)`; CV dropzone `1.5px dashed #D4C4F0` (DERIVED home: literal, or `color-mix(in srgb, var(--color-secondary) 55%, white)`); submit pink full-width `radius 10px; padding:15px 20px; 600 14px`. Signup fields: First name*, Last name*, Phone* (hint "This becomes your sign-in identifier."), Speciality*, Address* (wide), CV* (file, wide), Password*, Confirm password*. Success → route to the B-Systems CRM board.

---

## 3. SCREEN CALIBRATION MAP

| Prototype screen | V2 destination | Calibration notes |
|---|---|---|
| `hub` | `/` (neutral) | §2.15. 3 cards: `/byteforce`, `/b-systems`, `/portal` (programme funnel card replaces "App C Portal" app card; copy update: "External partner reps apply here — approved reps sign in to the B-Systems CRM"). |
| `login` | `/login` (neutral) | §2.14 split-billboard replaces current centered card. "Apply to the partnership programme" → `/portal`. |
| `a-home` | `/byteforce` Home | Dashboard template: 4 KPI tiles, stage strip (**6 cells incl. New** using `intake` tokens), feed + reps side card. |
| `a-leads` | `/byteforce/leads` | Entity card grid (§2.4), Unassigned card `--accent`. |
| `a-rep` | `/byteforce/leads/[rep]` (rep pages) | Table screen: Name/Number/Type/Stage; Type = `.chip-outline`, Stage = `.stage-chip`. |
| `a-detail` | `/byteforce/leads/[id]` | Detail template §2.16 (identity, actions, proposal event, records, history). |
| `a-board` | `/byteforce/crm` | Board §2.7 with **6 columns** (New intake + prototype 5); width 218px tier. |
| `a-clients` | `/byteforce/clients` | Entity grid, stats Estimated/Collected/To collect, "Retainer" chip. |
| `b-home` | `/b-systems` Home (admin) | **Merge base.** Dashboard template with b-home content; stage strip shows **7 stages incl. Negotiation**; stage bars = `--color-stage-*-accent` (normalize the b-home one-off bar hexes — Risk R10). |
| `pa-home` | `/b-systems` Home (admin) — merged into the same screen | Compose: add pa-home's commission KPIs (Won deals awaiting milestones — warn tile; Total commissions) as tiles 5–6 or a second tile row, and "Needs the admin" feed as a second feed card beside "Recent activity". Internal sales has no Home — nothing to build for them. |
| `b-leads` | `/b-systems/leads` (admin Leads) | Entity card grid of reps → rep table. |
| `b-rep` | `/b-systems/leads/[rep]` | Table screen (B skin). |
| `b-detail` | `/b-systems/leads/[id]` (lead detail) | Detail template; partner badge; meeting event; actions now **Following Up, Meeting Setting, Sending Proposals, Negotiation, Won, Lost** (Negotiation pill dot = `--color-stage-negotiation-accent`; Won pill role-gated — Risk R14/R19). |
| `b-board` | `/b-systems/crm` (admin + internal sales view) | Board with **7 columns** (Negotiation inserted between Sending Proposals and Won, tokens §1.3). Admin variant = `pa-crm` composition below. |
| `b-clients` | **DROP** | V2 B-Systems has no Clients section (Won Leads supersedes it). Pattern survives at `/byteforce/clients`. |
| `b-partners-board` | `/b-systems/partnership-crm` | **Exact match**: Lead, Didn't Answer, Following Up, Meeting Setting, Won, Lost. Won = completeness-gate modal (all fields required except Email; Importance select). |
| `b-prospect` | `/b-systems/partnership-crm/[id]` (prospect detail) | Detail template + media panel (cold-call recordings) + Number/Number 2/Number 3 slots + "New number found" renumber event. This IS the Partnership-CRM-numbers prototype — see composed row below. |
| `b-partners` | `/b-systems/partners` | Entity grid (High/Medium/Low chips) → partner detail. |
| `b-partner` | `/b-systems/partners/[id]` | Detail (noActions/noRecords) + embedded "Leads from this partner" table (Name/Number/Rep/Created/Stage). |
| `p-landing` | `/portal` | §2.17, B-brand scope. CTAs → `/portal/signup` and `/login`. |
| `p-signup` | `/portal/signup` | §2.17. Success routes to `/b-systems` CRM (or a pending-registration state — Registrations flow decides; Risk R23). |
| `p-board` | `/b-systems/crm` as seen by **agents/partners** | Same unified board, role-aware: Won column locked (`.col-locked-note`, blocked-drop states, "Only the admin can move a deal to Won." toast); **7 columns incl. Negotiation** (draggable-into by reps unless SPEC says otherwise); footnote "Won and Lost are terminal. Won is admin-only…". |
| `p-deal` | `/b-systems` lead detail for agents/partners | Detail with role-gated actions: Following Up, Meeting Setting, Sending Proposals, **Negotiation**, Lost — **no Won pill**; hint copy "Won is never offered to reps…". |
| `p-won` | `/b-systems/won-leads` (agents/partners view) | Won-deals manager read-only: `.badge--readonly`, rep milestone icons, masked locked values, footer "Locked milestones have no value on this page…". |
| `p-profile` | `/b-systems/profile` (agents/partners) | Profile pattern §2.16 (avatar, hairline fields, locked phone, change-password card, CV card). |
| `pa-crm` | `/b-systems/crm` (admin) | Unified board + admin extras: rep filter pills ("All reps combined" + per-rep), no CTA per prototype (V2 may add "Add lead"), dragging into Won creates the Won record. |
| `pa-won` | `/b-systems/won-leads` (admin + internal sales) | Won-deals manager editable: money inputs, milestone builder (2/3/4/5), ordered tick/untick, mismatch warning, "picked up within five seconds" note. Internal sales: same layout; edit rights per SPEC §7 (Risk R19). |
| `pa-team` | `/b-systems/agents` | Closest V2 equivalent (Agents = the rep roster). Reuse the 10-column stats table (Rep/Total/Leads/Following/Meeting/Proposal/Won/Lost/Won value/Commission) + "Invite rep" → registration invite. Add a **Negotiation** count column (11 cols) to match the 7-stage board. |
| `ad-users` | `/b-systems/users` | Users table verbatim: info banner, entity chips, admin cell, state chips, Deactivate/Reactivate toggles, Create-user modal (§ Region 6.5). |
| `sys-components` / `sys-stages` / `sys-drag` | Reference only | Normative sources for §1.3 tokens, §2 components, and drag contract. Do not build as routes. |

**Screens with no prototype — composition recipes:**

| V2 screen | Compose from |
|---|---|
| **Negotiation column** | Board column §2.7 with `--color-stage-negotiation*` tokens (§1.3); stage form modal: no `formFor` exists — reuse the Following Up form shape (date/time/method/owner/notes) retitled "Negotiation" or per SPEC §10's Negotiation row; log ADR for chosen fields. |
| **Statements** (`/b-systems/statements`) | Page header + KPI tile row (money tiles from won-deals manager) + table screen with money columns formatted `EGP 2,940,000` (pa-team style) + `.u-footnote`; per-row `.badge--entity`-style state chips (Settled/Due) using surface/tint chips; export = `.btn-ghost` "Export". |
| **Payments** (agents/partners) | p-won rep patterns: read-only badge, money tiles (commission value in accent), milestone rows with masked locked values, history-style release log (timeline §2.16). |
| **Registrations** (`/b-systems/registrations`) | Table screen + info banner (ad-users) + state chips: Pending = `.badge--entity-both` (tint/heading), Approved = `.badge--rep` (primary-tint/primary), Rejected = `.badge--danger`; row actions = `.row-toggle` pair (Approve → primary-ink ghost, Reject → danger ghost); detail drawer = modal §2.10 with hairline fields grid + CV row (profile CV pattern). |
| **Agents** (`/b-systems/agents`) | pa-team table (above) as primary; optionally entity-card grid (a-leads pattern) as an alternate view; agent detail = profile pattern read-only + their stats. |
| **Notifications bell** | §2.1 `.bell` + `.bell-count` (accent pill) + `.bell-menu` card with feed rows (time + text + mono code chips: `MS_UNLOCK`, `NEEDS_VALUE`, `SUM_WARN`, `NEW_REP`, `STAGE_MOVE`…); empty state §2.13. |
| **Partnership CRM numbers UI** | b-prospect: three Number field cells in the hairline grid (slot 3 shows "Empty slot — saving one returns this card to Lead"); "New number found" event banner with "Add number 3" primary; "Back to Lead" form (single wide "New number" field, note "Saving a new number on a Didn't-Answer prospect returns it here automatically."); Didn't Answer form (Attempted at, Note); media rows for call recordings. |

---

## 4. RISKS / AMBIGUITIES (with recommended resolutions)

1. **R1 — B cards `#FFFFFF` vs the "Paper, never pure #FFFFFF" rule.** Prototype `tok.card` (B) and every board card are `#fff` on Paper canvas; current tokens.css forbids `#FFF` for cards. Setting cards to Paper would erase card/canvas contrast the design depends on. **Resolve: adopt `#FFFFFF` for `--color-surface-card` and board cards; log an ADR superseding the comment ("Paper is the canvas; cards float white for contrast per the approved prototype").**
2. **R2 — B danger pink→red.** Current B maps danger to Signal Pink; prototype uses functional red `#C0392B` in all brands (toasts, blocked wells, deactivated chips) and keeps pink as accent/Won cue. **Resolve: `--color-danger:#C0392B` in B; extend ADR-014's exemption to B; pink remains accent-only.** Audit existing B danger usages.
3. **R3 — Lost accent.** Both brand files currently use danger/pink as lost-accent; sys-stages is explicit: "Lost is the one neutral in both brands" (`#8A8285` A, `#6B6F94` B). **Resolve: adopt neutral Lost values (§1.3).**
4. **R4 — Success green vs "no green anywhere".** Prototype's only success color is the toast disc `#2E7D5B`. **Resolve: `--color-success:#2E7D5B` as a functional-icon exemption (toast/confirm discs only); in-page success surfaces use primary/stage-won; log ADR.** Alternative (if founder rejects green): keep success=primary and use primary for the toast disc.
5. **R5 — Lama Sans weights.** Prototype A styles need 500/600; the licensed family is 400/700. **Resolve: map 600→700 and 500→400 explicitly (no faux-bolding, `font-synthesis:none`); acquire intermediate cuts if available; flag "Needs founder confirmation".**
6. **R6 — JetBrains Mono in App A.** Current A `--font-mono` is `ui-monospace`; the prototype uses JetBrains Mono for every eyebrow/chip/column title in all brands. **Resolve: load JetBrains Mono 500/700 globally; update A's var (§1.1).**
7. **R7 — Toast background discrepancy** (`#1A191C` global template vs `#231F20` sys-drag demo). **Resolve: `#1A191C` (the actual toast template wins; the sys sheet demo was illustrative).**
8. **R8 — Unified B-Systems header color.** Prototype: internal B screens `#1D267D`, portal/portal-admin `#0B0F3D`; V2 has one shared layout. **Resolve: role-aware chrome — admin + internal sales get `--color-primary` (#1D267D); agents/partners get `--color-surface-dark` (#0B0F3D) via `[data-shell="external"]`, preserving the portal identity. Needs founder confirmation** (fallback: single indigo header for all roles).
9. **R9 — Admin nav has 10 items** in a 62px top bar (prototype maxed at 6). **Resolve: keep the top-nav pattern; nav container scrolls horizontally under ~1360px (scrollbar hidden); if founder prefers, collapse the four registry sections (Agents/Registrations/Statements/Users) into a "Manage" dropdown styled as `.bell-menu`.**
10. **R10 — Dashboard stage-bar arrays deviate from `stageSpec`** (b-home New `#9AA0C0` vs Lead bar `#1D267D`; b-home Following `#53449B` vs `#5A3A96`). **Resolve: normalize all dashboards to `--color-stage-*-accent` (single source of truth); note the prototype's hand-tuned dash bars as superseded.**
11. **R11 — ByteForce "New" stage has no stageSpec row** (A board was 5 columns; dashboard gives bar `#B4AEB0` only). Derived well/chip values in §1.3 make New's column visually close to Lost (both neutral grays). **Resolve: accept the derived neutral family (bar difference is legible); if distinctness proves insufficient in QA, shift New's well/chip toward the off-white family and log an ADR.**
12. **R12 — Negotiation is entirely proposed** (colors §1.3, stage-form fields R-map). **Resolve: adopt the midpoint-rule colors; pick Negotiation's modal fields from SPEC §10's transition table (normative) — if §10 is silent, clone the Following Up field set and log an ADR flagged "Needs founder confirmation".**
13. **R13 — /portal landing+signup brand scope.** V2 routes them in the neutral (home) shell; the prototype styles them fully B-Systems (gradient hero, Raleway, pink CTAs). **Resolve: stamp `data-brand="bsystems"` on the `/portal` landing/signup layouts (they are B-Systems marketing); neutral.css keeps only `/` and `/login`. Log ADR (touches ADR-007's shell boundary).**
14. **R14 — Detail "next action" pill sets must be role-gated**: agents/partners never see a Won pill (p-deal), admin does; Negotiation pill added for B. Server-side enforcement already mandated (CLAUDE.md §7); the UI must also hide/gate per prototype. **Resolve: pill list is computed server-side per role; Won pill absent (not disabled) for reps.**
15. **R15 — Stage label copy**: prototype mixes "Proposal Sending" (portal) and "Sending Proposals" (A/B boards); V2 uses "Sending Proposals". **Resolve: "Sending Proposals" everywhere in V2; the `proposal` token key covers both.**
16. **R16 — Prototype defines no focus/hover states for inputs/buttons** (`outline:none` on inputs). **Resolve: adopt the derived `:focus-visible` spec (§1.4) and minimal hovers (ghost: border-color→muted; primary: 6% ink overlay via `color-mix`); log as DERIVED a11y additions.**
17. **R17 — RTL**: prototype treats RTL as a first-class prop; repo mandates logical properties. All specs above use logical properties — enforce in review (no `left/right/margin-left` etc.).
18. **R18 — Login redesign supersedes ADR-028's centered card.** **Resolve: implement §2.14; log superseding ADR.**
19. **R19 — Who can set Won on the unified board?** V1 rule ("only portal admin") maps cleanly to agents/partners; unclear for **internal sales** on `/b-systems/crm` and for ByteForce reps on `/byteforce/crm` (prototype allowed Won drops on a-board/b-board with a form). **Resolve: keep prototype behavior — internal (A and B staff) boards allow Won via the Won form; only the external-rep view locks Won. Flag "Needs founder confirmation" against SPEC §7/§10.**
20. **R20 — Milestone value masking is a data rule, not CSS**: locked amounts must not be present in the DOM/payload ("the number does not exist on the rep's page until release"). Applies to Won Leads (rep view) and Payments. **Resolve: enforce in the API serializer; UI renders the `• • • • •` mask token.**
21. **R21 — A `--color-surface-tint` changes** from gray `#E6E7E8` to violet tint `#EFEDF6`: any existing A component using tint as a gray callout will shift violet. **Resolve: accept (prototype uses tint = violet family for A: info banners, avatars, upload icons, history move pills); run `/brand-audit` after the swap.**
22. **R22 — A radius/shadow changes** (card 12→10px; softer two-layer shadows): visual diff across all A cards. **Resolve: accept prototype values; single-commit token change so QA sees it atomically.**
23. **R23 — Signup success destination**: prototype drops the rep straight into their board; V2 has a Registrations admin queue, implying approval may gate access. **Resolve: if Registrations gates activation, land signups on a "pending review" state styled as the empty state + info banner; update the signup footnote copy accordingly. Needs founder confirmation.**
24. **R24 — `#E9EBF7` double duty** (B grid-card mark bg AND admin rep-label chip bg) is mapped to `--color-primary-tint`; prototype B active nav uses translucent white instead (dark chrome) — the tint var is for on-light contexts only. No action, documentation note.
25. **R25 — Board container spec is DERIVED** (column row wrapper style was outside all extraction ranges). Flex row / 12px gap / overflow-x auto per §2.7; verify against the prototype visually before sign-off.