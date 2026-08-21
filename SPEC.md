# ByteForce × B-Systems Sales Platform — Master Build Specification

Version 1.1 — 2026-08-08 (v1.0 + official brand systems integrated for both companies)
Status: Ready for kickoff. Logo files and Lama Sans font files pending in `/branding` (see §4, A-13).
Audience: AI coding agents (Claude Code, Antigravity) and human reviewers.
File role: This file is simultaneously the **kickoff prompt**, the **product specification**, and the **process contract** (documentation, logging, testing, Definition of Done) for the entire project. It lives at the repository root and stays immutable except through ADRs; the Assumptions register (§11) is resolved via `docs/DECISIONS.md`.

---

## 0. Agent instructions — read first

You are the lead engineer for this project. Operate under these rules at all times:

1. **This file is the single source of truth.** Read it in full before writing any code. Where anything you infer conflicts with §6–§10, the spec wins.
2. **Session discipline.** At the start of every working session, read `docs/PROGRESS.md` and any open items. At the end of every session, update `docs/PROGRESS.md`, and `docs/TESTING.md` / `docs/DECISIONS.md` if tests were run or decisions made. Never end a session with undocumented changes. The goal is that any new session (or a different agent) can resume with zero lost context. In Claude Code, `/session-start` and `/session-end` run this ritual.
3. **Log everything.** Every architectural decision, every assumption, every test round, every bug and its fix, every progress step is logged per the protocol in §12. If it isn't logged, it didn't happen.
4. **Build in phases.** Follow §14 strictly. Do not begin a phase before the previous phase's Definition of Done is met and logged (`/phase-gate`).
5. **Ambiguity handling.** First check §11 (Assumptions & open questions). If the answer is there, apply the stated default. If not, choose the most reasonable default, record it as an ADR in `docs/DECISIONS.md`, and flag it in `docs/PROGRESS.md` under "Needs founder confirmation". Never silently invent behavior.
6. **Branding.** Never hardcode colors, fonts, or logos in components. Everything goes through the theming layer in §4; canonical tokens live in `branding/byteforce/tokens.css` and `branding/b-systems/tokens.css`. The `byteforce-brand` and `bsystems-brand` skills condense the rules.
7. **The pipeline engine (§5, §10) is the heart of the product.** Implement it once, as a shared, well-tested module, and reuse it across all three applications.
8. **No dead ends.** Every screen described in §6–§8 must exist, every field must persist, every automatic transfer must actually fire. "UI exists but logic is stubbed" does not count as done.
9. **This repo ships pre-scaffolded** with `docs/` templates, brand tokens, Claude Code skills, subagents, and permissions. Use them instead of re-inventing them.

---

## 1. Project overview

One platform, two brands, three applications:

| App | Brand | Users | Purpose |
|---|---|---|---|
| **A. ByteForce CRM** | ByteForce | Internal ByteForce team | Lead intake → sales pipeline → clients, with a KPI dashboard |
| **B. B-Systems CRM** | B-Systems | Internal B-Systems team | Identical to App A, **plus** a Partners acquisition pipeline and a Partners directory whose leads feed the CRM with attribution |
| **C. B-Systems Partnership Portal** | B-Systems | External sales reps + B-Systems admin | Self-signup portal where outside sales reps run their own pipeline; admin controls Won deals, milestone-based commission disclosure, and team analytics |

All three live in **one codebase and one deployment**, separated by route groups and role-based access, but each app is fully skinned in its own brand (§4).

Core product idea shared by all pipelines: the user never "drags a card and then remembers to fill things in." Instead, **selecting a Next Action (or completing a stage-specific checkbox) automatically moves the card to the right pipeline column and opens exactly the field group that stage requires.** The Portal additionally allows free drag-and-drop (Trello-style), with the same field groups triggered on drop.

---

## 2. Recommended tech stack

The agent may substitute any item with justification logged as an ADR. Defaults:

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Single app, route groups: `/byteforce`, `/b-systems`, `/portal`, `/portal/admin` |
| Styling | Tailwind CSS driven by CSS variables (design tokens) | Tokens per brand, see §4 |
| Database | PostgreSQL via Prisma (SQLite acceptable for local dev) | Schema documented in `docs/ARCHITECTURE.md` |
| Auth | NextAuth (credentials) or equivalent session auth | Roles per §3; passwords hashed (argon2/bcrypt) |
| Kanban DnD | dnd-kit (or equivalent) | Portal CRM only in v1 (§8); internal CRMs are action-driven |
| File storage | Local `/uploads` in dev behind a storage abstraction (S3-compatible ready) | CVs, call recordings |
| Validation | Zod on every mutation, server-side | Client-side mirrors for UX |
| Testing | Vitest (unit/integration) + Playwright (E2E) | Test plan in §13 |
| Charts (dashboards) | Recharts or simple stat cards | Dashboards are numeric-first; charts vary tints of the brand palette only |

Constraints: server-side enforcement of all permissions (§3); all monetary values stored as decimal with a configurable currency (default **EGP**, assumption A-9); all timestamps stored UTC, displayed in Africa/Cairo.

---

## 3. Roles & access matrix

| Role | Scope | Can |
|---|---|---|
| `byteforce_staff` | App A | Full CRUD on ByteForce leads, pipeline, clients, sales reps; view ByteForce dashboard |
| `bsystems_staff` | App B | Full CRUD on B-Systems leads, pipeline, clients, partners pipeline, partners directory; view B-Systems dashboard |
| `portal_admin` | App C admin + full visibility of App C data | Everything a rep can, plus: move any deal to **Won**, create/fill Won Deal records, define milestones and check milestone boxes, view all reps' CRMs (combined or per-rep), view Sales Team table and admin dashboard |
| `portal_rep` | App C, own data only | Sign up, log in, manage **their own** deals across all stages **except Won** (cannot drag into Won, cannot select Won as Next Action), view their own Won Deals read-only with milestone locks, view/edit own profile |

Hard rules enforced server-side, not just hidden in UI:
- A `portal_rep` can never read or mutate another rep's deals.
- Only `portal_admin` can set a Portal deal's stage to `won`, check milestone boxes, or edit Won Deal fields.
- Internal apps (A, B) are invisible to portal roles and vice versa.
- Every privileged mutation is written to the activity log (§5.6).

(Whether `bsystems_staff` and `portal_admin` are the same accounts is open question A-8; default: one B-Systems account can carry both roles.)

---

## 4. Branding & multi-brand theming

### 4.1 Architecture

- One `ThemeProvider` keyed by app scope via a `data-brand` attribute: `byteforce` (App A) or `bsystems` (Apps B and C — the Portal is B-Systems-branded).
- Canonical tokens live in `branding/byteforce/tokens.css` and `branding/b-systems/tokens.css` as CSS custom properties scoped to `[data-brand="…"]`. Components consume only semantic tokens (`--color-primary`, `--color-surface`, `--font-display`, `--gradient-hero`, logo slots, radii). **Zero hardcoded brand values in components.** Tailwind maps utilities to these variables.
- Logo and font files are founder-supplied into `branding/byteforce/` and `branding/b-systems/` (each folder's README lists expected files). The agent wires whatever filenames are actually present and records the mapping as an ADR.

### 4.2 ByteForce brand (App A) — source: official "BYTEFORCE Brand Guidelines" (provided)

ByteForce is a strategic marketing agency — storytelling-led, premium, minimal. The UI should read as confident and clean, never playful or noisy.

| Token | Value | Use |
|---|---|---|
| Bold Orange | `#F15C24` | Primary. CTAs, primary buttons, active states, key highlights, the logo's speech-bubble frame |
| Royal Violet | `#53449B` | Secondary. Headings, navigation, links, section accents |
| Ink | `#231F20` | Body text |
| Light Gray | `#E6E7E8` | Borders, dividers, muted surfaces, table lines |
| Off-white | `#F4F1EA` | Default working surface (from the ByteForce design kit); avoid harsh pure-white full canvases |

Note: the official brand book fixes Royal Violet as `#53449B`; an earlier design kit circulated `#4B3B9C`. **`#53449B` is canonical — see ADR-001.**

Typography: **Lama Sans** (Regular + Bold) for everything — headings, body, UI. The brand book also names **Point** as an optional bold display face; use it only if its font files are supplied, otherwise Lama Sans Bold covers display. Font files land in `branding/byteforce/fonts/` (A-13); until then use a clean system-sans fallback stack behind the same tokens.

Logo: the speech-bubble mark (orange L-shape frame + violet BYTE FORCE wordmark + "BY TELLING FORCE" tagline). Horizontal lockup is primary; mono light/dark versions for single-color uses. Never rotate, recolor, stretch, add effects, or place on clashing/red or busy backgrounds.

Conventions: only the two brand hues plus ink/gray/off-white — no invented accent colors; Arabic + English are equal citizens (all layouts must survive `dir="rtl"` — use CSS logical properties); no emoji in UI copy; the bubble pattern may appear only as subtle texture, never behind body text.

### 4.3 B-Systems brand (Apps B & C) — source: "B-Systems Brand Guidelines · Edition 01 · April 2026" (provided)

B-Systems is a Business Systems Partner — "Systems Before Software." The UI voice is calm authority: structured, clear, confident, never flashy. This is a perfect match for a CRM: the product itself should feel like an operations system.

**The brand three (60 · 28 · 12 rule):**

| Token | Value | Share | Use |
|---|---|---|---|
| Systems Indigo | `#1D267D` | 60% | The anchor. Primary surfaces, headers, primary buttons, body type on light |
| Process Lavender | `#D4ADFC` | 28% | The air. Secondary surfaces, callouts, gradient mid-tones |
| Signal Pink | `#FF4F87` | 12% | The cue. CTAs, highlights, single-word emphasis, badges. **Never a large surface, never body text** |

**Supporting tokens:**

| Token | Value | Use |
|---|---|---|
| Paper | `#FAFAFD` | Default canvas. **Never pure `#FFFFFF`** for page backgrounds |
| Lavender Mist | `#E8D4FE` | Card backgrounds, callout panels, secondary surfaces |
| Indigo Deep | `#0B0F3D` | Dramatic dark canvas (heroes, login), high-contrast text |

**Signature gradient** (hero moments ONLY — login hero, landing header, cover-style moments; never a default background):
`linear-gradient(135deg, #0B0F3D 0%, #1D267D 25%, #4A2A8E 55%, #8B3A95 75%, #FF4F87 100%)` — always 135°, never radial, never reversed (pink is the exit). Layer the **system mesh** over hero gradients: white grid/diagonal lines at ~4% strength, 60–80px spacing, 30–60% pattern opacity — texture only, never behind body text, never a primary graphic.

**Typography (Google Fonts):**

| Family | Role | Scale |
|---|---|---|
| Raleway | Display voice — headlines, section titles | H1 800/64 · H2 700/40 · H3 600/26 · H4 500/20; tracking −2% to −3.5% on weights 700–800 |
| Inter | Body & UI workhorse | Lead 400/17 · Body 400/14 (1.55 line-height) · UI labels/buttons 500 · KPIs/data 700 |
| JetBrains Mono | Meta — tags, page numbers, table meta, IDs | 500/10–12px, ALL CAPS, +0.22em tracking |

Rule of thumb: Raleway above, Inter below — anything longer than two lines is Inter. Pink colors single words inside headlines, never whole sentences.

**Logo:** horizontal color lockup (gradient S-mark + SYSTEMS wordmark + "COMPLETE YOUR PROCESS") is the default on light backgrounds; stacked version for square/vertical spaces; the gradient S-mark alone for favicon/avatar/app icon; mono version always Indigo `#1D267D`. Minimums: 120px lockup / 24px icon (digital). Clear space: 1× icon height on all sides. Never gradient logo on a gradient background; never stretch, rotate, recolor, or add effects.

**Voice in UI copy:** clear not simple, confident not arrogant, structured not rigid, direct not blunt. CTAs state direct value ("Add lead", "Log the follow-up", "Diagnose your pipeline") — never "discover", "unlock", "elevate". Charts and status colors vary tints of the palette only — no green/teal/orange hues anywhere in Apps B & C.

### 4.4 Definition of "branded" for the Global DoD

Every page of App A reads unmistakably as ByteForce; every page of Apps B and C reads unmistakably as B-Systems; switching between `/byteforce` and `/b-systems` demonstrates the theming layer with no brand bleed (logos, colors, typography all swap). `/brand-audit` (and the `brand-auditor` subagent) verify: no hardcoded hex/fonts outside `branding/` and `src/themes/`, B-Systems pink ≤ accent usage and no pure-white canvases, gradient confined to hero components, ByteForce palette discipline, RTL-safe layouts, no emoji in ByteForce UI copy.

---

## 5. Shared mechanics — the pipeline engine

These behaviors are shared by all pipelines (App A CRM, App B CRM, App B Partners pipeline, App C Portal CRM). Implement once, parameterized per pipeline.

### 5.1 Stage + Next Action pattern
- Every card has a current `stage`. Each pipeline defines its stage set (§6–§8) and which stages are terminal (`won`, `lost`).
- From any non-terminal stage, the user can select a **Next Action** from the allowed set. Selecting it (and completing the required field group) **automatically moves the card** to the matching column. There is no manual "move" step in internal apps.

### 5.2 Conditional field groups
- Each stage owns a field group that appears the moment that stage is selected (full definitions in §6–§8, transition side effects in §10).
- Field groups are **additive history, not replacement**: entering Proposal Sending does not erase the earlier Follow-up record; the card detail shows all accumulated groups chronologically.
- Follow-up groups carry a `context` label: `initial`, `after_proposal`, or `after_meeting`, and the UI titles them accordingly ("Following up", "Following up after proposal", "Following up after meeting").

### 5.3 Automatic transfers (side effects)
Certain field events move the card without the user picking a Next Action, e.g. "Proposal → Sent ✓" auto-moves to Following Up; "Meeting → Attended ✓" forces a destination choice; a new number typed on a Didn't-Answer partner auto-returns it to Lead. All such triggers are enumerated in §10 and each must be integration-tested.

### 5.4 Drag & drop (Portal only, v1)
- App C reps drag cards freely between columns like Trello, **except into Won**.
- On drop into a stage, the stage's field-group form opens immediately; cancelling the form reverts the drop. Internal apps (A, B) are action-driven only in v1 (extension noted in A-7).

### 5.5 Attribution
- Leads created from a Partner (App B, §7.4) carry `source = partner` + `partner_id` and display a prominent badge "Partner: {Company}" on the pipeline card and in the lead detail. Attribution is permanent and survives every stage change.

### 5.6 Activity log (in-product audit trail)
- Every stage change, automatic transfer, milestone check, and record creation writes an entry: actor, timestamp, from → to, trigger. Each card/record shows a "History" panel. This is a product feature and the runtime counterpart of the documentation discipline in §12.

### 5.7 Terminology normalization
The founder's original wording is preserved in meaning but normalized in the UI (full glossary in §16): "salesman" → sales rep, "propasel" → proposal, "tap" → tab/detail panel, "signing in (first time)" → sign up, "fate joined" → date joined.

---

## 6. App A — ByteForce CRM (full specification)

Navigation: **Home (Dashboard) | Leads | CRM | Clients**. All screens themed ByteForce (§4.2).

### 6.1 Leads section
- Grid of **sales rep cards**; reps can be added without limit (name required; show lead count per rep on the card). Selecting a rep opens their assigned-leads table.
- **Leads table** (per rep), columns: `Name | Number | Type`, plus an "Add lead" action. Clicking a row opens the **lead detail**.
- **Lead detail fields:**

| Field | Type | Required |
|---|---|---|
| Name | text | yes |
| Number | phone | yes |
| Email | email | no |
| Type | enum: `Cold call` / `Event data` / `Personal connection` / `Campaign lead` | yes |
| Description | long text | no |
| Next action | enum: `Following up` / `Meeting setting` / `Sending proposal` / `Lost` | — (selecting it triggers the pipeline) |

- Selecting a Next Action creates/moves the card in the CRM section under the matching column carrying all gathered info, and opens the stage's field group **right here in the lead detail** (the Leads section and the CRM card are two views of the same record).

### 6.2 Stage field groups (used by App A and App B CRMs, and by App C with the same shapes)

**Following up** (context: `initial` | `after_proposal` | `after_meeting`)

| Field | Type |
|---|---|
| Follow-up date | date |
| Follow-up time | time |
| Method | enum: `Call` / `Message` / `Visit` |
| Owner | rep select |
| Following up with | text (contact person) |

**Meeting setting**

| Field | Type |
|---|---|
| Arranged? | checkbox — the fields below appear only when checked |
| Date & time | datetime |
| Mode | enum: `Online` / `Offline` |
| With | text (attendees) |
| Technical support | text / rep select |
| Meeting outcome | enum: `Attended` / `Cancelled` / `Delayed` |

Outcome logic: `Attended` → user **must** pick a destination stage (`Sending proposal` / `Won` / `Lost` / `Following up`) and the card auto-transfers, opening that stage's group (a Following-up destination opens with context `after_meeting`). `Delayed` → require a new date & time, card stays in Meeting Setting (assumption A-3). `Cancelled` → user picks `Following up` or `Lost` (assumption A-3).

**Sending proposal**

| Field | Type |
|---|---|
| Service | text / service select |
| Estimated value | money |
| Sent | checkbox |

When `Sent` is checked: card **auto-moves to Following Up** and a new group titled **"Following up after proposal"** opens (Date, Method `Call/Message/Visit`, Owner, Following up with). The proposal data remains attached to the card.

**Lost**

| Field | Type |
|---|---|
| Reason | text, required |

**Won** (extra fields on entering Won)

| Field | Type |
|---|---|
| Estimated value | money (prefilled from proposal if present) |
| Technical owner | text / rep select |
| Collected amount | money |

On saving Won fields, a Client card is auto-created/linked (assumption A-1, default ON).

### 6.3 CRM section (pipeline board)
- Five columns: **Following Up | Meeting Setting | Sending Proposals | Won | Lost**.
- Cards display: lead name, type badge, assigned rep, and the key datum of the current stage (next follow-up date, meeting datetime, estimated value…). Clicking a card opens the same detail as §6.1 with all accumulated field groups and the History panel.
- All movement between columns is automatic per §6.2 / §10 (no free drag in v1).

### 6.4 Clients section
Cards, one per client:

| Field | Type |
|---|---|
| Name | text |
| Number | phone |
| Service | text |
| Estimated value | money |
| Collected | money |
| To be collected | money, with a due **date** |
| Retainer | checkbox |
| Technical owner | text / rep select |

Default: `To be collected = Estimated value − Collected`, editable (assumption A-1).

### 6.5 Home dashboard

| Metric | Formula |
|---|---|
| Total leads | count of all lead records (any stage, incl. not-yet-actioned) |
| Leads per stage | count grouped by stage: Following Up, Meeting Setting, Sending Proposals, Won, Lost (+ "New / not actioned") |
| Pipeline value | sum of Estimated value over all leads whose stage is **not** Won and **not** Lost (missing values count as 0) |
| Won value | sum of Estimated value over Won leads |
| Won count | count of Won leads |
| Lost count | count of Lost leads |
| To be collected | sum of `To be collected` across all Client cards |

Each dashboard number must be backed by a tested query — see §13.

---

## 7. App B — B-Systems CRM

### 7.1 Base
Identical to App A in structure and behavior (§6.1–§6.5), themed B-Systems, operating on B-Systems data only. Navigation: **Home | Leads | CRM | Clients | Partners Pipeline | Partners**.

### 7.2 Partners Pipeline (partner acquisition board)
**Seven columns, the SAME set for BOTH kinds of card** (partner and agent), in this order:
**Lead | Contacted | Didn't Answer | Meeting Setting | Waiting | Qualified | Lost**.

Founder (ADR-059), asked whether partners and agents should keep separate vocabularies: *"Same
stages for both."* One engine, one config; the two kinds differ **only** in what Qualified does — a
qualified partner joins the directory (§7.3), a qualified agent is simply qualified and the admin
mints his login afterwards (§7.2b). Terminal stages are **Qualified** and **Lost**; every other
column is an ordinary **active** stage, **Waiting included**.

**Lead stage fields** — required-ness is conditional on the kind:

| Field | Type | Required (partner) | Required (agent) |
|---|---|---|---|
| Name | text | yes | yes |
| Number | phone | yes | yes |
| Company name | text | yes | — (not collected) |
| Business activity | text | yes | — (not collected) |
| Role | text | no | — (not collected) |
| Address | text | — (not collected) | no |
| Speciality | text | — (not collected) | no |
| Email | email | no | no |
| Description | long text | no | no |
| Cold call record | file upload, `.mp3` / `.mp4` (multiple allowed), playable inline | no | no |
| CV | file upload | — (not collected) | no |
| Next action | enum: every other column | — | — |

**Didn't Answer stage:** records which number(s) went unanswered and reveals the alternative-number
fields. **The moment a non-empty alternative number is saved, the card automatically returns to the
Lead stage** (logged in History as "Returned to Lead — new number added").

**Contacted:** records that contact has been made — **nothing more**. Founder: *"The system should
not require any additional details or mandatory fields when moving a lead to Contacted. This applies
to both Agents and Partners."* No field group opens, by action or by drag, for either kind, and the
card does **not** become a Follow Up task (§7.2c).

**Waiting:** the holding column between Meeting Setting and Qualified. No field group opens. It is
**not** terminal: the card stays **fully editable at any time** (no locked fields, the edit form
always available) and can be moved out again **in both directions** — forwards to Qualified, or back
to Meeting Setting, Contacted, Didn't Answer or Lead.

**Meeting Setting / Lost:** identical field groups and logic to §6.2.

**Qualified — the completeness gate (PARTNER cards only).** A partner card saves Qualified only when
all of these are filled. **Neither an email nor a password is ever required** (founder: *"Moving a
lead to Qualified should not require creating or entering an email or password"*):

| Field | Required |
|---|---|
| Company name | yes |
| Key person name | yes |
| Key person role | yes |
| Address | yes |
| Number | yes |
| Business activity | yes |
| Importance | enum: `High` / `Medium` / `Low` — yes |
| Email | no |
| Password | **never asked for** |

On completion the partner is **automatically transferred to the Partners directory** (record created
with `date_joined = now`, `userId = null`); the pipeline card stays in Qualified as history with a
"Converted" badge (A-5).

**Qualified — AGENT cards.** A pure stage move: no field group, no credentials, no account. **A
qualified agent with no login is a legitimate, non-broken state** and the UI says so honestly
("Qualified, no account yet") rather than leaving a gap.

### 7.2a Agent cards (`PartnerProspect.kind = agent`)
Superseded by §7.2 (ADR-059): agent cards run the **same seven columns** as partner cards. What
remains specific to the kind is the Lead-stage field set (above) and the account action (§7.2b).

### 7.2b Creating the login — a separate, explicit, admin-only action
Founder: qualifying must never ask for credentials, so minting the account is its own step, offered
on the card **after** it reaches Qualified and available at any time afterwards.

- **Who:** B-Systems **admin only** (never data entry — ADR-051).
- **Where:** a clearly labelled button on the prospect **detail** whenever the card is in Qualified
  and has no account yet. The board **card** carries the STATE, not the action — a "No login yet"
  chip for either kind (a partner card wears the Converted badge from PP-4 the moment it qualifies,
  so the badge alone cannot say whether a login is still owed). The card is a drag surface and a
  whole-card link; a form-opening button inside it would fight both (ADR-059).
- **Agent fields** (all required *here*, not at the stage move):

| Field | Required |
|---|---|
| First name | yes |
| Last name | yes |
| Phone number | yes |
| Email | yes |
| Password (set by the admin) | yes |
| Speciality | yes |
| Address | yes |

  On submit, in one transaction: a User (active, `registrationStatus = approved` — never a pending
  Registration), the `bsystems_agent` role, a PortalRep profile carrying name/address/speciality, and
  the card's CV re-parented onto that profile. The card gains the "Converted" badge and the account is
  **immediately assignable as a lead owner** (§7.4 / the To-Do assign) with no further step.
- **Partner fields:** email + password. Creates a User with the `bsystems_partner` role and links it
  to the directory `Partner.userId`.
- Refused when an account already exists, when the email or phone is already taken, or when the card
  is not in Qualified. Never undoable (it retires the actor's pending undo entries).

### 7.2c Follow-ups on this pipeline
**No stage implies a follow-up.** Founder: *"Agents/Partners moved to Contacted should not
automatically be treated as Follow Up tasks... Contacted should only indicate that contact has been
made unless an actual Follow Up task is required."*

A follow-up exists only when someone deliberately records one, with the **"Record a follow-up"**
action offered from **every active stage** (Lead, Contacted, Didn't Answer, Meeting Setting,
Waiting). It writes the usual follow-up group (date, time, method, owner, following-up-with), the
card never moves, and only then does the card appear on the admin's To-Do as a follow-up — driven by
the **existence of the record**, never by the column the card sits in.

### 7.3 Partners directory
- Cards, one per partner, showing the **Company name** (importance badge optional).
- Tapping a card opens the partner detail: company name on the left, **Date joined** on the right; then the partner's info (key person, role, address, numbers, email, business activity, importance); then a **Leads table** for that partner.

### 7.4 Partner leads → CRM with attribution
- Adding a lead inside a partner's detail uses **the same fields as §6.1's lead detail** (Name, Number, Email, Type, Description, Next action), plus an auto-recorded **Date created**.
- When a Next Action is selected, the lead is **automatically transferred into the B-Systems CRM** at the matching stage, exactly like a normal lead, but it is clearly marked as partner-sourced: badge "Partner: {Company}" on the CRM card and in the detail, permanent (§5.5). The partner's leads table always shows each lead's current stage (live link, not a copy).
- Ownership of partner-sourced leads: optional "Assign to rep" on creation; default bucket "Unassigned (Partner leads)" visible in the Leads section (assumption A-6).

---

## 8. App C — B-Systems Partnership Portal

Two layers: **Sales rep layer** and **Admin layer**. All themed B-Systems (§4.3) — the landing/login hero is the natural home of the signature gradient + mesh.

### 8.1 Sales rep journey

**Landing page:** headline in the spirit of "Welcome to the B-Systems Partnership Programme" (final copy follows the brand voice — direct, calm authority), with two actions: **Sign up** and **Log in**.

**Sign-up fields:**

| Field | Type | Required |
|---|---|---|
| First name | text | yes |
| Last name | text | yes |
| Phone number | phone | yes |
| Address | text | yes |
| Speciality | text | yes |
| CV | file upload, `.pdf`/`.doc`/`.docx`, ≤ 10 MB | yes |
| Password | password, min 8 chars | yes |
| Confirm password | must match | yes |

On success the rep lands in their portal (immediately active; admin approval is open question A-4). Log in: phone + password (phone is the collected unique identifier; final choice = ADR).

**Portal navigation (rep):** **CRM | Won Deals | Profile**.

### 8.2 Rep CRM
- Six columns: **Leads | Following Up | Meeting Setting | Proposal Sending | Won | Lost**.
- **Trello-style drag & drop between all columns — except no card can be dragged into Won** (admin-only). Dropping into a stage opens that stage's field group; cancel reverts (§5.4).
- **Deal card fields:**

| Field | Type | Required |
|---|---|---|
| Name | text | yes |
| Position | text | yes |
| Number | phone | yes |
| Email | email | no |
| Company name | text | yes |
| Industry | text | yes |
| Requirements | long text | no |
| Next action | enum of the other stages, **excluding Won for reps** | — |

- Selecting a Next Action auto-moves the card and opens the stage field group — the same groups and automatic-transfer rules as §6.2 (follow-up contexts, meeting outcome logic, proposal Sent → auto Following Up with "after proposal" group, Lost reason).

### 8.3 Won Deals (rep view — read-only)
- Every deal moved to Won (by admin) is **automatically recorded here** as a card.
- Auto-filled from the CRM card: Name, Role/Position, Number, Email, Company name, Industry.
- Admin-filled fields visible to the rep: Estimated value, Total commission, and the milestone list.
- **Milestone locking:** the card shows one checkbox per milestone (admin-only to check). Milestone 1's value is visible immediately. Milestone *i+1* appears **locked with a lock icon and hidden value** until the admin checks milestone *i*'s box — at which moment milestone *i+1* unlocks and its value becomes visible to the rep. Unlimited milestones.

### 8.4 Profile (rep)
Shows all sign-up info (name, phone, address, speciality, CV download). Editable basics + CV replacement + password change (assumption A-10).

### 8.5 Admin layer — four sections

**1) Dashboard**

| Metric | Formula |
|---|---|
| Total leads | count of all deals across all reps, all stages |
| Total estimated value | sum of Estimated value across all deals (missing = 0) |
| Won deals | count of Won deals |
| Total commissions | sum of Total commission across all Won Deal records |

**2) CRM** — a toggle: **All reps combined** (one board aggregating every rep's cards, each card labeled with its rep) or **Per rep** (rep picker → that rep's board). Admin is the **only** role that can move a deal into Won (drag or action). Doing so immediately auto-creates the Won Deal record (§8.3) — this is transition P-6 in §10.

**3) Won Deals (management)** — every won deal regardless of rep. Admin fills: Estimated value, Total commission, then defines milestones: choosing the number of milestones generates that many checkboxes on the card, and each milestone gets a value field (Milestone 1 value, Milestone 2 value, …). Checking milestone *i* unlocks milestone *i+1* for the rep in real time. Optional non-blocking warning if milestone values don't sum to Estimated value (assumption A-11).

**4) Sales Team** — table:

| Column | Content |
|---|---|
| Rep name | — |
| Total leads | all their deals |
| Per-stage counts | Leads / Following Up / Meeting Setting / Proposal Sending / Won / Lost |
| Won deals | count |
| Won value | sum of Estimated value of their Won deals |
| Total commission | sum of Total commission of their Won deals |

---

## 9. Data model (logical — agent finalizes the physical schema in ARCHITECTURE.md)

| Entity | Key fields (beyond id/timestamps) |
|---|---|
| `User` | role (§3), name, phone, email?, password_hash, active |
| `SalesRep` (internal, per brand) | brand (`byteforce`/`bsystems`), name |
| `Lead` (Apps A & B) | brand, sales_rep_id?, source (`direct`/`partner`), partner_id?, name, number, email?, type, description, stage, created_at |
| `FollowUp` | lead_or_deal ref, context (`initial`/`after_proposal`/`after_meeting`), date, time, method, owner, following_up_with |
| `Meeting` | ref, arranged, datetime, mode, with, technical_support, outcome, outcome_destination |
| `Proposal` | ref, service, estimated_value, sent, sent_at |
| `LostInfo` | ref, reason |
| `WonInfo` (internal) | ref, estimated_value, technical_owner, collected_amount |
| `Client` (Apps A & B) | brand, lead_id?, name, number, service, estimated_value, collected, to_be_collected, due_date, retainer, technical_owner |
| `PartnerProspect` (App B pipeline) | fields of §7.2 incl. number_2, number_3, recordings[], stage |
| `Partner` (directory) | company_name, key_person_name, key_person_role, address, number, email?, business_activity, importance, date_joined, prospect_id |
| `PortalRep` | User ref + first/last name, phone, address, speciality, cv_file |
| `PortalDeal` | rep_id, fields of §8.2, stage (+ reuses FollowUp/Meeting/Proposal/LostInfo groups) |
| `WonDeal` (portal) | deal_id, estimated_value, total_commission |
| `Milestone` | won_deal_id, index, value, completed, completed_at |
| `Attachment` | owner ref, kind (`cv`/`recording`), file, mime, size |
| `ActivityLog` | entity ref, actor, action, from_stage?, to_stage?, trigger, at |

Field groups are separate child records (not columns on the card) so history accumulates per §5.2.

---

## 10. Business rules — transition tables (normative)

Every row below is a rule the code must implement and a test case §13 must cover. "Active" = any non-terminal stage.

### 10.1 Internal CRMs (Apps A & B)

| # | Trigger | From | To | Side effects |
|---|---|---|---|---|
| T-1 | Next action = Following up | New lead / any active | Following Up | Open Follow-up group (context per origin) |
| T-2 | Next action = Meeting setting | New lead / any active | Meeting Setting | Open Meeting group |
| T-3 | Next action = Sending proposal | New lead / any active | Sending Proposals | Open Proposal group |
| T-4 | Next action = Lost | Any active | Lost | Open Reason (required) |
| T-5 | Proposal `Sent` checked | Sending Proposals | Following Up | Auto-move; open Follow-up group, context `after_proposal`; proposal data retained |
| T-6 | Meeting outcome = Attended | Meeting Setting | User-chosen: Sending Proposals / Won / Lost / Following Up | Destination choice is mandatory; destination group opens (Follow-up context `after_meeting`) |
| T-7 | Meeting outcome = Delayed | Meeting Setting | Meeting Setting | Require new date & time (A-3) |
| T-8 | Meeting outcome = Cancelled | Meeting Setting | Following Up or Lost (user choice) | (A-3) |
| T-9 | Won saved | Any active | Won | Require Estimated value, Technical owner, Collected amount; auto-create/link Client card (A-1) |
| T-10 | Any transition | — | — | ActivityLog entry; dashboard metrics reflect the change immediately |

### 10.2 Partners & Agents Pipeline (App B) — one pipeline, two kinds of card

**Seven columns for BOTH kinds: Lead | Contacted | Didn't Answer | Meeting Setting | Waiting |
Qualified | Lost.** One engine, one config; the two kinds differ ONLY in what Qualified does.
Terminal stages are Qualified and Lost. (ADR-059 — supersedes the §10.2/§10.2a split.)

| # | Trigger | From | To | Side effects |
|---|---|---|---|---|
| PP-1 | Next action = Didn't answer | Lead / any active | Didn't Answer | Record which number(s) went unanswered; reveal the alternative-number fields |
| PP-2 | Non-empty value saved in an alternative number | Didn't Answer | Lead | Automatic return; History: "Returned to Lead — new number added" |
| PP-3 | Next action = Contacted / Meeting setting / **Waiting** / Lead / Lost, and every meeting outcome | Any active | Matching stage | **Contacted and Waiting open NO field group and require NO fields — the move commits immediately, by action or by drag, for BOTH kinds.** Meeting setting opens the Meeting group; Lost opens the Reason (required); a move back to Lead opens nothing. Meeting outcomes follow T-6–T-8: Attended → Contacted / Waiting / Qualified / Lost (choice mandatory); Delayed → stays, new date & time required (A-3); Cancelled → Contacted / Waiting / Lost (never Qualified) |
| PP-4 | Qualified saved — **partner** card | Any active | Qualified | §7.2 completeness gate (company, key person, role, address, number, business activity, importance). **Neither an email nor a password is ever required.** Auto-create the directory Partner (`date_joined = now`, `userId = null`); card stays in Qualified with the "Converted" badge (A-5) |
| PP-5 | Lead added inside a Partner + Next action selected | — | B-Systems CRM at matching stage | Lead created with `source = partner`, permanent "Partner: {Company}" badge, auto `Date created`; the partner's leads table shows the live stage |
| PP-6 | Qualified saved — **agent** card | Any active | Qualified | **No field group, no credentials, no account.** A pure stage move. A qualified agent with no login is a legitimate state and the UI shows it honestly |
| PP-4a | Admin runs "Create the agent's account" (or the partner login) on a card already in Qualified | Qualified | Qualified — no stage change | Separate, explicit, **admin-only** (§7.2b). Agent: User (active, `approved`) + `bsystems_agent` role + PortalRep + CV re-parent, sets `converted` / `agentUserId`; the account is immediately assignable as a lead owner. Partner: User + `bsystems_partner` role linked to `Partner.userId`. Refused if an account already exists or the card is not Qualified; **not undoable** (it retires the actor's pending undo entries) |
| PP-7 | Waiting, in and out | Any active ⟷ Waiting | Waiting ⟷ Lead / Contacted / Didn't Answer / Meeting Setting / Qualified / Lost | Waiting is an ORDINARY ACTIVE stage: never terminal, no field group on the way in, and it moves out **in both directions**, each target keeping its own group (if any) |
| PP-8 | "Record a follow-up" on an active card | Any active | Same stage | Writes a FollowUp (date, time, method, owner, following-up-with) and puts the card on the To-Do. **No stage implies a follow-up; this action is the only way one is created** (founder item 2.1). History reads "group added"; the card never moves |
| PP-9 | Any transition | — | — | ActivityLog entry (actor, from → to, trigger, timestamp); the card stays **fully editable in every active stage, Waiting included** — no locked fields, the edit form always available |

### 10.2a Agents Pipeline (App B) — superseded

**Superseded by §10.2 (ADR-059).** PA-1…PA-5 are retired: agent cards run the same rows as partner
cards, and the only agent-specific row is PP-6 (plus PP-4a's account action). ActivityLog rows
already carrying `PA-1`…`PA-5` remain valid history and keep their original meaning.

### 10.3 Portal CRM (App C)

| # | Trigger | From | To | Side effects |
|---|---|---|---|---|
| P-1 | Rep drags card to any column except Won | Any | Target | Target stage's field group opens; cancel reverts the drop |
| P-2 | Rep attempts drag into Won or selects Won | — | — | Blocked with clear message: only admin can mark Won |
| P-3 | Rep Next action selected | Any active | Matching stage | Same groups & automatic rules as T-1…T-8 |
| P-4 | Proposal `Sent` checked | Proposal Sending | Following Up | As T-5 |
| P-5 | Meeting outcome = Attended | Meeting Setting | Rep-chosen destination (Won excluded) | As T-6, Won excluded for reps |
| P-6 | **Admin** moves deal to Won | Any | Won | Auto-create WonDeal record; auto-fill Name, Position, Number, Email, Company, Industry; appears in rep's Won Deals and admin's Won Deals management |
| P-7 | Admin defines milestone count & values | — | — | N checkboxes generated; Milestone 1 value visible to rep; milestones ≥ 2 locked, values hidden |
| P-8 | Admin checks milestone *i* | — | — | Milestone *i+1* unlocks for the rep (value revealed); ActivityLog entry; irreversible without admin unchecking (logged) |

---

## 11. Assumptions & open questions (defaults apply until the founder overrides; every application logged as an ADR)

| ID | Question | Default |
|---|---|---|
| A-1 | Does Won auto-create a Client card in Apps A & B? | Yes — mapped: name, number, service ← proposal, estimated value, technical owner, collected ← collected amount, to-be-collected = estimated − collected |
| A-2 | Can a card revisit a stage (e.g. second meeting)? | Yes — groups accumulate as history (§5.2) |
| A-3 | Meeting Delayed / Cancelled behavior | Delayed → new date, stays; Cancelled → choose Following Up or Lost |
| A-4 | Portal sign-up approval | Active immediately; admin can deactivate |
| A-5 | After a partner converts (PP-4) or an agent's account is created (PP-4a) | Card stays in **Qualified** — the terminal-success column for both kinds (ADR-059) — as history with a "Converted" badge |
| A-6 | Owner of partner-sourced leads | Optional assign-to-rep at creation; else "Unassigned (Partner leads)" bucket |
| A-7 | Drag & drop on internal CRMs | Not in v1 (action-driven only); possible later extension |
| A-8 | Are `bsystems_staff` and `portal_admin` the same people? | One account may hold both roles |
| A-9 | Currency | EGP, configurable constant |
| A-10 | Rep profile editability | Basics editable, CV replaceable, password change; phone change = ADR |
| A-11 | Must milestone values sum to Estimated value? | No — non-blocking warning only |
| A-12 | UI language | English v1; architecture RTL-ready for Arabic (ByteForce brand is bilingual) |
| A-13 | Brand asset files | Logos: founder drops into `/branding/*` (agent adapts to actual filenames). Fonts: Raleway/Inter/JetBrains Mono via Google Fonts; Lama Sans files pending → temporary system-sans fallback behind the same tokens |
| A-14 | Should Qualified be reversible, now that an agent can be qualified without an account? | No — Qualified stays terminal, as it always was; a mis-qualified card is walked back with Undo inside its window, or deleted. **Needs founder confirmation** (ADR-059) |

---

## 12. Documentation & logging protocol (mandatory)

The `docs/` skeleton ships pre-created in this repo — keep every file current. Entries are **append-only and dated**. The purpose is that project context stays clean and consistent across sessions, agents, and tools. Templates for every entry type live in `.claude/skills/project-logging/SKILL.md`.

```
docs/
  ARCHITECTURE.md    Living system architecture: stack, module map, schema, theming, auth. Update on any structural change.
  IMPLEMENTATION.md  Module-by-module implementation notes: what exists, where, how it works, known limitations.
  DECISIONS.md       ADR log. Format: ADR-### | date | context | decision | alternatives considered | status.
  TESTING.md         Test run log. Format per run: date | scope | cases executed | results | bugs found → BUGS.md refs.
  BUGS.md            Bug register: BUG-### | severity | description | status | fix commit/ref.
  PROGRESS.md        Session log. Format per session: date | done | in progress | next steps | blockers | needs founder confirmation.
  CHANGELOG.md       User-visible changes per phase/release.
```

Rules:
1. **Session open:** read `PROGRESS.md` (latest entry) before touching code. **Session close:** write a `PROGRESS.md` entry, plus `TESTING.md` if anything was tested and `DECISIONS.md` if anything was decided. (`/session-start`, `/session-end`.)
2. No feature is "done" until: code merged, behavior noted in `IMPLEMENTATION.md`, tests logged in `TESTING.md`, and the phase checklist (§14) updated.
3. Every assumption applied from §11, and every deviation from §2's stack, is an ADR.
4. Every discovered complexity, workaround, or gotcha goes into `IMPLEMENTATION.md` immediately — never only in the agent's head.
5. Keep this spec file unmodified; all evolution happens in `docs/`.

---

## 13. Testing strategy

**Unit tests** — the pipeline engine transition function (every row of §10 — §10.2a's PA rows included — as a case, including illegal moves), and every dashboard formula in §6.5 / §8.5 against fixture data with known expected numbers.

**Integration tests** — automatic side effects: T-5 proposal-sent auto-move; T-6 attended-destination flow; T-9 client auto-creation; PP-2 auto-return on new number; PP-4 partner conversion; PP-6 agent qualification (a pure move — nothing minted) and PP-4a's separate account action (minted and immediately assignable); PP-3 Lead → Contacted committing with no field group at all, and Waiting in and out of every active stage; PP-8 the To-Do carrying a Contacted card ONLY when a follow-up was actually recorded; PP-5 partner-lead attribution into the CRM; P-2 server-side rejection of a rep setting Won (API level, not just UI); P-6 WonDeal auto-creation; P-7/P-8 milestone generation, locking, and unlock; upload validation (type/size) for CVs and recordings.

**E2E journeys (Playwright)** — each must pass before its phase closes and every run is logged in `TESTING.md`:
1. ByteForce full cycle: add rep → add lead → Following Up → Meeting (attended → proposal) → Sent ✓ → auto Following Up (after proposal) → Won → Client card exists → dashboard numbers correct.
2. ByteForce lost path with reason; dashboard reflects it.
3. B-Systems partner cycle: prospect with mp3 record → Didn't Answer → add Number 2 → auto-return to Lead → Contacted (no form at all) → Meeting → Waiting (still fully editable, moves out both ways) → Qualified gate blocks until the completeness fields are filled, never asking for an email or a password → Partner in directory with date joined → add partner lead → Next Action → CRM card bears "Partner: {Company}".
4. Portal rep cycle: sign up with CV → log in → create deal → drag through stages with field groups → attempt drag into Won is blocked → sees only own deals.
5. Portal admin cycle: log in → combined and per-rep CRM views → move deal to Won → WonDeal auto-created → set Estimated value, commission, 3 milestones → rep sees Milestone 1 only, 2 & 3 locked → admin checks 1 → rep sees Milestone 2 → Sales Team table and admin dashboard numbers correct.

**Seed script** — demo data for both brands and the portal (reps, leads across all stages, a converted partner with leads, a won deal with milestones) so every screen renders meaningfully on first run.

**Manual QA checklist per phase** — responsive at 1440 / 1024 / 768 / 390 px; empty states; validation messages; brand check per §4.4 (`/brand-audit`); recordings play inline; CV downloads.

---

## 14. Build phases (each phase ends with its DoD met and logged — `/phase-gate`)

**Phase 0 — Foundation.** Repo + stack (§2), auth + roles (§3), theming layer wired to `branding/*/tokens.css` for both brands (§4), pipeline-engine module with unit tests, seed script scaffold. (The `docs/` skeleton and `.claude` tooling already ship in this repo.)
DoD: app boots with both themes demonstrable; engine unit tests green; ARCHITECTURE.md completed to v1.

**Phase 1 — App A: ByteForce CRM.** §6 complete: Leads, field groups, CRM board, Clients, Dashboard; transitions T-1…T-10; journeys 1–2 pass.
DoD: every §6 field persists; all §10.1 rows tested; dashboard formulas verified; branded per §4.2.

**Phase 2 — App B: B-Systems CRM + Partners.** Clone of App A on B-Systems data & theme; Partners Pipeline; Partners directory; attribution flow (§7); PP-1…PP-5 and PA-1…PA-5; journey 3 passes.
DoD: uploads validated & playable; auto-return and conversion gates verified; attribution visible end-to-end.

**Phase 3 — App C: Portal, rep layer.** Landing (gradient + mesh hero), sign-up with CV, login, rep CRM with drag & drop and Won restriction, Won Deals read view with locks, Profile (§8.1–§8.4); P-1…P-5; journey 4 passes.
DoD: rep isolation and Won restriction enforced server-side and proven by tests.

**Phase 4 — App C: Admin layer.** Dashboard, combined/per-rep CRM, Won Deals management with milestones, Sales Team table (§8.5); P-6…P-8; journey 5 passes.
DoD: milestone lock/unlock verified live across two sessions (admin + rep); all admin formulas verified.

**Phase 5 — Hardening & handover.** Full E2E suite green; seed data final; README (setup, run, deploy); docs brought to final state; final `/brand-audit` clean; Global DoD (§15) checklist walked and logged.

---

## 15. Global Definition of Done

The project is done only when every item below is true and checked off in `PROGRESS.md`:

- [ ] Every field, enum, screen, and rule in §6–§10 is implemented exactly; no stubbed logic, no TODOs on shipped paths.
- [ ] All §10 transitions covered by automated tests; full E2E suite (§13 journeys 1–5) passes.
- [ ] All dashboard and table formulas (§6.5, §8.5) proven correct against seeded fixtures.
- [ ] RBAC enforced server-side; proven: reps cannot access other reps' data, cannot set Won, cannot touch milestones; internal apps invisible to portal roles.
- [ ] File uploads (CV pdf/doc/docx ≤ 10 MB; recordings mp3/mp4 ≤ 50 MB) validated, stored, retrievable; recordings playable inline.
- [ ] Activity log records every transition and privileged action; History panel visible on cards.
- [ ] Theming: §4.4 satisfied; zero hardcoded brand values; both official brand systems applied (ByteForce §4.2, B-Systems §4.3, incl. the 60/28/12 rule, Paper-not-white, gradient discipline, Raleway/Inter/JetBrains Mono, Lama Sans).
- [ ] Bilingual-readiness: layouts survive `dir="rtl"` (A-12).
- [ ] `docs/` complete and current: ARCHITECTURE, IMPLEMENTATION, DECISIONS (every A-* applied has an ADR), TESTING (every run logged), BUGS (all closed or explicitly deferred), PROGRESS, CHANGELOG.
- [ ] Seed script + README (setup / run / test / deploy) allow a cold start by a stranger.
- [ ] Security basics: hashed passwords, session auth, server-side validation on every mutation, upload sanitization, no secrets in repo.
- [ ] No console errors; responsive and usable at 1440 / 1024 / 768 / 390 px; sensible empty states everywhere.

---

## 16. Glossary — founder's terms → product terms

| Original | Normalized |
|---|---|
| salesman / sales man | sales rep |
| propasel | proposal |
| tap | tab / detail panel |
| signing in (first time) | sign up |
| B systems / b-system | B-Systems |
| following with | following up with (contact person) |
| fate joined | date joined |
| cold call record | cold-call recording |
| check mark | checkbox |

---

## 17. Kickoff prompt (paste as the first message in Claude Code / Antigravity)

```
You are the lead engineer on the ByteForce × B-Systems Sales Platform.
The file SPEC.md at the repo root is the single source of truth: product
spec, process contract, testing plan, and Definition of Done. Read it in
full now. This repo is pre-scaffolded: docs/ logs, brand tokens in
branding/, and (for Claude Code) skills, subagents, and permissions in
.claude/.

Then, in this first session:
1. Initialize the stack per SPEC §2 (any substitution = ADR via /log-adr).
2. Complete docs/ARCHITECTURE.md to v1: module map, physical schema,
   theming wiring for both brands.
3. Write the session's PROGRESS entry (/session-end does this).
4. Present your Phase 0 plan for approval before writing feature code.

Standing rules: follow SPEC §0 exactly — session open/close logging, ADRs
for every assumption (§11), build strictly by phases (§14), pass each
/phase-gate before advancing. Branding: both official brand systems are
in SPEC §4 and branding/*/tokens.css; logo files are added by the founder
into branding/ — adapt to the filenames present. Never hardcode brand
values in components.
```
