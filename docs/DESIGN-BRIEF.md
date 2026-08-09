# Design Brief — ByteForce × B-Systems Sales Platform

**Audience: a UI designer (human or AI, e.g. Claude Design).** This file is
self-contained: everything needed to design the full product UI without reading the
codebase. Deliver screen designs (desktop 1440 + tablet 768 + mobile 390) that a
developer can map onto the existing token system described in §2. The app is built —
this is a REDESIGN/ELEVATION pass over working screens, not a green-field concept.

---

## 1. What the product is

One platform, two companies ("entities"), three applications, four kanban pipelines:

| App | URL space | Brand | Users |
|---|---|---|---|
| A — ByteForce CRM | `/byteforce` | ByteForce | Internal ByteForce sales team |
| B — B-Systems CRM + Partners | `/b-systems` | B-Systems | Internal B-Systems team |
| C — B-Systems Partnership Portal | `/portal` + `/portal/admin` | B-Systems | External sales reps + one admin |

Core interaction idea: the user never "drags a card and then remembers to fill
things in." Selecting a **Next Action** (or dropping a card on a column) opens
**exactly the field group that stage requires**; completing it moves the card.
Cancelling reverts. Every card keeps an accumulating history of these field groups
plus an activity log ("History") of every move.

Currency is EGP; timezone Africa/Cairo; UI language English v1 but **every layout
must survive `dir="rtl"`** (Arabic is a first-class future citizen — use logical
properties/start-end alignment in specs, never left/right).

---

## 2. Brand systems (both are official and non-negotiable)

The implementation consumes ONLY semantic design tokens. Design with these exact
values; name colors by token so the dev mapping is 1:1.

### 2.1 ByteForce (App A only) — "storytelling-led, premium, minimal"

| Token | Value | Use |
|---|---|---|
| Bold Orange | `#F15C24` | Primary. CTAs, active states, key highlights |
| Royal Violet | `#53449B` | Secondary. Headings, nav, links, section accents |
| Ink | `#231F20` | Body text |
| Light Gray | `#E6E7E8` | Borders, dividers, muted surfaces |
| Off-white | `#F4F1EA` | Default page canvas (avoid harsh pure-white walls) |
| Functional danger | `#C0392B` | Errors/destructive only (sanctioned exception) |

Typography: **Lama Sans** (Regular/Bold) for everything (files pending — design
with it; fallback is a clean system sans). Rules: only these values — tints of
orange/violet are allowed for data-viz/status differentiation, no new hues; no
emoji in UI copy; no gradients anywhere in App A; the speech-bubble logo (supplied:
horizontal lockup PNG) never recolored/rotated/stretched.

### 2.2 B-Systems (Apps B & C) — "Systems Before Software", calm authority

The brand three (60·28·12 rule): **Systems Indigo `#1D267D`** (60% — anchor:
primary surfaces, headers, primary buttons, structural text), **Process Lavender
`#D4ADFC`** (28% — air: secondary surfaces, callouts, tints), **Signal Pink
`#FF4F87`** (12% — cue: CTAs, badges, single-word emphasis — **never a large
surface, never body text**).

Supporting: Paper `#FAFAFD` (canvas — **never pure #FFFFFF**), Lavender Mist
`#E8D4FE` (cards/callouts), Indigo Deep `#0B0F3D` (dark hero canvas, max-contrast
text).

Signature gradient (hero moments ONLY — portal landing/login/signup covers; never a
default background): `linear-gradient(135deg, #0B0F3D 0%, #1D267D 25%, #4A2A8E 55%,
#8B3A95 75%, #FF4F87 100%)` — always 135°, pink is the exit. Optional "system mesh"
texture over hero gradients: white grid lines ~4% opacity, 60–80px spacing — never
behind body text.

Typography (Google Fonts): **Raleway** display (H1 800 / H2 700 / H3 600 / H4 500,
tight tracking on heavy weights) · **Inter** body & UI (400/14–17 body, 500 UI,
700 KPIs/data) · **JetBrains Mono** meta (500, 10–12px, ALL CAPS, +0.22em tracking
— tags, IDs, table meta, column headers). Rule: Raleway above, Inter below —
anything longer than two lines is Inter. Charts/status vary tints of the palette
only — no green/teal/orange anywhere in B/C.

Voice: clear not simple, confident not arrogant. CTAs state direct value ("Add
lead", "Log the follow-up") — never "discover/unlock/elevate".

### 2.3 Shared semantic token vocabulary (design to these names)

`primary / on-primary / secondary / on-secondary / accent / on-accent / heading /
link / ink / muted / surface / surface-card / surface-tint / surface-dark / border /
danger / on-danger / success / on-success` + `font-display / font-body / font-mono`
+ card/control radii + card shadow. Both brands define ALL of these; a shared
component must look right under either brand automatically.

---

## 3. NEW requirements to design (founder-requested, this round)

These are the priority items; the rest of the doc is the context they live in.

1. **Consolidated sign-in page** (`/login`) — ONE page for every account type
   (staff of either company, portal reps, admins). Single identifier field ("Email
   or phone") + password. It is brand-NEUTRAL ground shared by two brands: both
   logos are present (ByteForce horizontal lockup, B-Systems gradient S-mark).
   Design a distinctive, premium sign-in that respects both brands without mixing
   their palettes into one UI (neutral canvas + the two marks is the current
   approach; you may propose something bolder, e.g. a split-brand composition).
   Error state ("wrong credentials"), plus a quiet link for new partners to the
   portal sign-up. This design is used ONLY for the sign-in page.
2. **Entity access & switching** — a user can be granted access to ByteForce,
   B-Systems, or both ("admin sees both"). Design: (a) a **company switcher** in
   the app header for multi-entity users (toggle between the two branded apps —
   note the ENTIRE theme swaps when switching); (b) a **user management screen**
   (platform admin only): user list (name, identifier, entities, active state) +
   "create user" flow with **entity assignment checkboxes** (ByteForce /
   B-Systems / both) and an admin flag; deactivate/reactivate affordance.
3. **Pipeline boards, elevated** — the boards are currently flat single-tint
   columns. Wanted: **each column visually distinct** (per-stage color coding using
   brand-palette TINTS only — e.g. column header accent bar + tinted column well +
   matching stage chips), and **drag & drop everywhere**: cards draggable on ALL
   boards (both internal CRMs, the partners pipeline, the portal — portal already
   drags). A drop opens that stage's form in a modal ("complete to confirm — cancel
   reverts"); invalid targets (per the rules in §5) must read as blocked, with a
   clear message. Design the drag states: lift/shadow, valid-target highlight,
   blocked-target treatment (e.g. Won column for portal reps: visible but
   admin-only), drop-form modal.

---

## 4. Complete screen inventory (design every one)

### 4.0 Shared/neutral
- **`/` root hub** — neutral entry linking the three apps (dev shows demo logins).
- **`/login`** — see §3.1.

### 4.1 App A — ByteForce CRM (nav: Home | Leads | CRM | Clients)
- **Home dashboard**: stat tiles — Total leads, Pipeline value (EGP), Won value,
  To be collected; a "Leads per stage" row (New/not actioned, Following Up, Meeting
  Setting, Sending Proposals, Won, Lost). Numeric-first; charts (if any) use brand
  tints only.
- **Leads**: grid of **sales-rep cards** (name + lead count) + "Add sales rep";
  an "Unassigned (Partner leads)" bucket card can appear.
- **Rep leads table**: Name | Number | Type | Stage rows + "Add lead" (opens form:
  Name*, Number*, Email, Type* [Cold call / Event data / Personal connection /
  Campaign lead], Description).
- **Lead detail** (the workhorse screen): identity block (name, number, email,
  type, rep, date created, optional "Partner: {Company}" badge) · **Next action
  panel** (select → inline stage form, below) · contextual auto-event panels
  ("Mark proposal as sent…", "Meeting outcome…") · **Stage records** (accumulated
  field groups, chronological cards) · **History** (activity log lines: time,
  actor, action, from → to, trigger code chip).
- **CRM board**: 5 columns — Following Up | Meeting Setting | Sending Proposals |
  Won | Lost. Cards: lead name, type chip, rep, stage-specific key datum (next
  follow-up date / meeting datetime / estimated value / lost reason). Cards link to
  the lead detail. (Add drag per §3.3.)
- **Clients**: cards — name, number, service, Estimated, Collected, To be
  collected (+ due date), Retainer chip, technical owner; inline edit form.

### 4.2 App B — B-Systems CRM (nav: Home | Leads | CRM | Clients | Partners Pipeline | Partners)
- Identical structure to App A (same six §4.1 screens) in the B-Systems brand, plus:
- **Partners Pipeline board**: 6 columns — Lead | Didn't Answer | Following Up |
  Meeting Setting | Won | Lost. Prospect cards: company, contact, key datum;
  "Converted" chip on won-and-transferred cards.
- **Prospect detail**: fields (contact, company, role, number + Number 2/3 slots
  that appear in Didn't Answer — saving a new number auto-returns the card to Lead),
  business activity, description · **cold-call recordings** (upload mp3/mp4 ≤50MB,
  inline audio/video players, multiple) · Next action panel (incl. the **Won
  completeness gate** form: company, key person + role, address, number, email,
  business activity, importance High/Med/Low — all but email required) · stage
  records · history.
- **Partners directory**: company cards (+ importance meta).
- **Partner detail**: company name ↔ "Date joined" header, info block, **leads
  table from this partner** (Name | Number | Rep | Created | live Stage) + "Add
  lead" (same lead fields + optional "Assign to rep", default Unassigned).

### 4.3 App C — Partnership Portal (B-Systems brand)
- **Landing** (`/portal`): signature gradient + mesh hero, headline ("Welcome to
  the B-Systems Partnership Programme" spirit, pink single-word emphasis), Sign up
  (pink CTA) + Log in actions.
- **Sign-up**: First/Last name*, Phone*, Address*, Speciality*, CV upload*
  (pdf/doc/docx ≤10MB), Password*/Confirm* — on success the rep lands in their CRM.
- **Rep CRM board**: 6 columns — Leads | Following Up | Meeting Setting | Proposal
  Sending | Won | Lost. Trello-style drag; **Won is visible but admin-only**
  (blocked message on attempt). Drop → stage-form modal (cancel reverts). "Add
  deal" (Name*, Position*, Number*, Email, Company*, Industry*, Requirements).
- **Deal detail**: identity block, next-action panel (Won never offered to reps),
  stage records, history.
- **Won Deals (rep, read-only)**: cards auto-filled (name, position, number, email,
  company, industry) + admin-filled Estimated value & Total commission +
  **milestone list with locks**: milestone 1 visible; milestone i+1 shows a lock
  icon and a HIDDEN value until the admin checks i (values literally absent until
  unlocked; the page live-updates ≤5s). Design the locked vs unlocked states.
- **Profile**: sign-up info + CV download, edit basics, replace CV, change
  password. (Phone not editable.)

### 4.4 Portal Admin (nav: Dashboard | CRM | Won Deals | Sales Team)
- **Dashboard**: Total leads (all reps), Total estimated value, Won deals, Total
  commissions.
- **CRM**: toggle **All reps combined** (cards carry rep labels) / per-rep filter
  pills; admin drags INTO Won (creates the Won Deal record).
- **Won Deals management**: per won deal — rep + deal identity, Estimated value +
  Total commission inputs, **milestone builder** (choose count → that many value
  fields), then the checkbox list (sequential: check i unlocks i+1 for the rep;
  uncheck allowed in reverse); non-blocking warning when values don't sum to the
  estimate.
- **Sales Team table**: Rep | Total leads | per-stage counts (6) | Won deals |
  Won value | Total commission.

---

## 5. Interaction rules the design must respect (the pipeline logic)

- Stage forms per target: **Following Up** (date, time, method Call/Message/Visit,
  owner, "following up with") — titled "Following up", "Following up after
  proposal", or "Following up after meeting" per origin · **Meeting** ("Arranged?"
  checkbox reveals date/time/mode/attendees/technical support) · **Proposal**
  (service, estimated value; "Sent" is a separate confirm step that auto-moves the
  card) · **Lost** (required reason) · **Won** internal (estimated value —
  prefilled from latest proposal — technical owner, collected amount) · **Won**
  partners (the completeness gate) · Won portal (admin only, no form).
- Meeting outcomes: Attended → mandatory destination choice (internal: Proposals /
  Won / Lost / Following Up; partners: Following Up / Won / Lost; portal rep: no
  Won) → destination's form opens. Delayed → new date/time, card stays. Cancelled
  → Following Up or Lost.
- Auto-transfers to visualize: proposal Sent ✓ → card auto-moves to Following Up;
  new number on a Didn't-Answer prospect → auto-returns to Lead; admin Won → Won
  Deal record appears for the rep.
- Won/Lost are terminal (no dragging out).
- Blocked interactions must LOOK blocked, with the message pattern: "Only the
  portal admin can move a deal to Won."

---

## 6. Constraints & deliverables

- **Constraints**: token-only colors (§2.3 names); Paper-not-white and pink-≤-cue
  in B/C; five-values-only in A; no emoji in App A copy; RTL-safe (logical
  directions); responsive 1440/1024/768/390; WCAG AA contrast on all text;
  empty-state designs for every list/board; error/loading states for forms.
- **Components to systematize** (shared across brands via tokens): app header/nav
  (+ company switcher), stat tile, kanban column + card (+ per-stage color coding),
  stage chip, form field set, modal (drop-confirm), history/timeline line, milestone
  row (locked/unlocked/checked), file upload + audio player row, table, badge
  ("Partner: {X}", "Converted", "Retainer"), toast/banner (blocked action, A-11
  warning).
- **Deliverables**: per-screen designs (all of §4), the component sheet, the
  per-stage column color specification for BOTH brands (tints of the respective
  palettes with exact hex values), drag-and-drop state specs, and the consolidated
  sign-in. Keep annotations in terms of the §2.3 token names so implementation is
  mechanical.
