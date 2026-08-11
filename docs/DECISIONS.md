# Decision log (ADRs) — append-only

Format: see `.claude/skills/project-logging/SKILL.md`. IDs sequential. Never rewrite
history; supersede with a new ADR.

## ADR-000 — 2026-08-08 — Project scaffold and default stack accepted
- Context: Repo initialized from the master spec before any code. A default stack was
  needed so Phase 0 can start without renegotiation.
- Decision: Adopt the SPEC §2 defaults (Next.js App Router + TypeScript, Tailwind on
  CSS-variable tokens, Prisma + PostgreSQL, NextAuth credentials, dnd-kit, Zod,
  Vitest + Playwright, local uploads behind a storage abstraction, EGP,
  Africa/Cairo display / UTC storage) unless a later ADR supersedes a specific item.
- Alternatives considered: Remix / SvelteKit (smaller ecosystems for this team's needs);
  Supabase-as-backend (less control over the pipeline engine's transactional side
  effects).
- Resolves: —
- Status: Accepted

## ADR-001 — 2026-08-08 — ByteForce Royal Violet is #53449B
- Context: The official "BYTEFORCE Brand Guidelines" PDF specifies Royal Violet
  #53449B (RGB 83·68·155). An earlier ByteForce design kit circulated #4B3B9C.
- Decision: #53449B is canonical everywhere (tokens, UI, assets). #4B3B9C must not
  appear in the codebase.
- Alternatives considered: keeping the design-kit value (rejected — the founder-supplied
  official brand book wins).
- Resolves: —
- Status: Accepted

## ADR-002 — 2026-08-08 — SQLite for local dev, PostgreSQL for production (Prisma 7)
- Context: SPEC §2 defaults to "PostgreSQL via Prisma (SQLite acceptable for local dev)".
  The dev machine is Windows with no Postgres service guaranteed; Phase 0 needs a
  zero-setup database. Prisma resolved to v7.9.1, which uses `prisma.config.ts` (env-based
  datasource url) and the new `prisma-client` generator (output `generated/prisma`,
  gitignored).
- Decision: `provider = "sqlite"` with `DATABASE_URL="file:./dev.db"` for all local dev
  and testing; production deploys switch the datasource provider to `postgresql` and
  regenerate migrations before first deploy. Schema stays within the type surface both
  support (no Postgres-only native types without an ADR).
- Alternatives considered: Postgres-in-Docker locally (heavier setup, blocks a cold
  start on machines without Docker); hosted dev Postgres (network dependency, secrets in
  dev).
- Resolves: — (closes ARCHITECTURE.md open question "Postgres locally vs SQLite-dev")
- Status: Accepted

## ADR-003 — 2026-08-08 — NextAuth v5 beta (Auth.js) over stable v4
- Context: SPEC §2 names "NextAuth (credentials) or equivalent session auth". npm
  `latest` is still v4.24.15 (Pages-Router era API); v5 (`next-auth@5.0.0-beta.32`) is
  the App-Router-native line (route-handler `handlers`, `auth()` in server components
  and middleware) and the de-facto standard with Next.js App Router despite the beta tag.
- Decision: next-auth v5 beta with the Credentials provider, JWT session strategy,
  role claim in the session token, bcryptjs-hashed passwords. Pinned via package.json;
  upgrade to a stable 5.x when published.
- Alternatives considered: next-auth v4 (stable tag but awkward with App Router,
  legacy API); Lucia/hand-rolled sessions (more code to audit, SPEC prefers NextAuth).
- Resolves: —
- Status: Accepted

## ADR-004 — 2026-08-08 — Tailwind CSS v4 (CSS-first) mapped to brand tokens
- Context: SPEC §2 wants "Tailwind driven by CSS variables (design tokens)". npm
  resolved Tailwind v4.3.3, which is CSS-first: no tailwind.config.js; theme lives in
  CSS via `@theme`, built through `@tailwindcss/postcss`.
- Decision: Tailwind v4. `src/app/globals.css` imports both canonical token files
  (scoped by `[data-brand]`, so they coexist inertly) and maps utilities to semantic
  tokens with `@theme inline` (e.g. `--color-brand-primary: var(--color-primary)`) so
  utilities resolve at runtime against the active `data-brand` scope. Token files in
  `branding/` remain the only place brand values live.
- Alternatives considered: Tailwind v3 with a JS config mapping to CSS vars (older
  toolchain, no advantage); vanilla CSS modules (loses utility ergonomics).
- Resolves: —
- Status: Accepted

## ADR-005 — 2026-08-08 — bcryptjs for password hashing
- Context: SPEC §2 requires hashed passwords ("argon2/bcrypt"). Native `argon2`/`bcrypt`
  packages need node-gyp toolchains, a recurring failure point on Windows dev machines.
- Decision: `bcryptjs` v3 (pure JS, zero native deps), cost factor 12. The hash call
  sits behind a small `src/lib/auth/hash.ts` wrapper so swapping to argon2 later is a
  one-file change.
- Alternatives considered: argon2 (stronger KDF, native build friction); node's built-in
  `crypto.scrypt` (fine primitive but hand-rolled parameters).
- Resolves: —
- Status: Accepted

## ADR-006 — 2026-08-08 — Founder logo files: actual filename → slot mapping
- Context: The founder dropped two files at the repo root rather than into the
  `branding/` drop zones: `bsystems logo.png` (gradient S-mark alone, indigo→pink) and
  `Byteforce Logo.png` (primary lockup: orange bubble frame + violet wordmark +
  "BY TELLING FORCE" tagline). The branding READMEs define canonical slot names and ask
  for the mapping to be recorded as an ADR.
- Decision: Relocated `bsystems logo.png` → `branding/b-systems/logo-mark.png`
  (favicon / app icon / avatar slot) and `Byteforce Logo.png` →
  `branding/byteforce/logo-horizontal.png` (primary lockup slot). Still missing and
  awaited from the founder: B-Systems horizontal/stacked/mono lockups, ByteForce
  mark/mono versions, Lama Sans font files (A-13 fallback stack stays active).
- Alternatives considered: referencing the root files in place (breaks the documented
  drop-zone contract and the asset map).
- Resolves: part of A-13 (logos; fonts still pending)
- Status: Accepted

## ADR-007 — 2026-08-08 — Root route `/` is a brand-neutral entry
- Context: ARCHITECTURE.md v0 left "brand-neutral entry or redirect" open. Redirecting
  `/` to any one app would privilege a brand and confuse the other two audiences.
- Decision: `/` is a minimal brand-neutral entry (system fonts, no brand tokens) linking
  the three app route groups once they exist. Authenticated users are redirected by
  role from their app's own entry point, not from `/`. Portal marketing lives at
  `/portal` (its landing hero), not at `/`.
- Alternatives considered: redirect to `/portal` (wrong for internal staff); host-based
  brand detection (out of scope for v1 single deployment).
- Resolves: —
- Status: Accepted

## ADR-008 — 2026-08-08 — Portal rep login identifier is phone + password
- Context: SPEC §8.1 collects phone (required, unique) at sign-up and says "Log in:
  phone + password (phone is the collected unique identifier; final choice = ADR)".
  Email is optional in the portal data model, so it cannot be the required identifier.
- Decision: Phone number (normalized, unique per portal user) + password is the portal
  credential pair. Internal staff (Apps A/B) log in with email + password, which their
  User records always carry. Phone normalization: strip spaces/dashes, store E.164-like
  digits; changing a rep's phone stays restricted per A-10 (future ADR).
- Alternatives considered: email login (optional field — cannot be required identifier);
  username (an extra invented field the founder never asked for).
- Resolves: A-4-adjacent (§8.1 note); flagged for founder confirmation
- Status: Accepted

## ADR-009 — 2026-08-08 — Milestone real-time unlock via short-interval polling in v1
- Context: P-8 requires that checking milestone *i* unlocks milestone *i+1* "in real
  time" for the rep; Phase 4 DoD verifies it live across two sessions. ARCHITECTURE v0
  left poll vs SSE/websocket open.
- Decision: v1 uses short-interval polling (≤5 s revalidation on the rep's Won Deals
  view — SWR-style focus + interval revalidation). No websocket infrastructure; works on
  any serverless host. The unlock itself is a single server-side transaction, so polling
  only affects propagation latency, never correctness. SSE upgrade path noted for later.
- Alternatives considered: SSE (cleaner push, but extra connection management for one
  view); websockets (overkill, deployment constraints).
- Resolves: — (closes ARCHITECTURE.md open question "poll vs SSE/websocket")
- Status: Accepted

## ADR-010 — 2026-08-08 — Partners meeting-attended destinations are Following Up / Won / Lost
- Context: SPEC §10.2 PP-3 imports T-6 ("attended → Sending Proposals / Won / Lost /
  Following Up"), but §7.2's Partners stage set has no proposals stage — the imported
  destination set contains an impossible target. Found by the kickoff verification
  workflow; SPEC §0.5 forbids resolving this silently.
- Decision: In `configs/partners.ts`, meeting outcome `Attended` offers destinations
  **Following Up / Won / Lost** only. A Won choice still flows through the PP-4
  completeness gate (its From column is "Any active").
- Alternatives considered: adding a proposals stage to the Partners pipeline (invents
  a stage §7.2 doesn't define); letting the engine reject at runtime (worse UX, same
  invention).
- Resolves: §7.2/§10.2 conflict — flagged for founder confirmation
- Status: Accepted

## ADR-011 — 2026-08-08 — Internal CRMs expose a direct "Won" action from every active stage
- Context: T-9's From column is "Any active" and §13 journey 1 enters Won from
  Following Up, but §6.1's printed Next-action enum omits Won — the only enumerated
  path into Won is the T-6 attended-destination. Kickoff verification flagged the gap.
- Decision: `configs/internal-crm.ts` allows a "Won" action from every active stage in
  Apps A & B, opening the §6.2 Won field group and firing T-9 (client auto-creation
  per A-1) on save.
- Alternatives considered: Won reachable only via T-6 (contradicts T-9's "Any active"
  and makes journey 1 impossible as scripted).
- Resolves: §6.1/§10.1 gap — flagged for founder confirmation
- Status: Accepted

## ADR-012 — 2026-08-08 — A card's Estimated value is its latest proposal's value
- Context: §6.5/§8.5 treat "Estimated value" as one scalar per card, but proposals
  accumulate as history (§5.2, A-2) — a card can hold several Proposal rows, and a
  naive join double-counts in dashboard sums.
- Decision: Estimated value of a non-Won card = `estimatedValue` of its most recent
  Proposal by `createdAt`, 0 if none; Won cards use `WonInfo.estimatedValue`
  (internal) / `WonDeal.estimatedValue` (portal). Applies to every dashboard formula
  and the §6.2 Won-group prefill. Metrics test fixtures include a two-proposal lead.
- Alternatives considered: max/sum of proposals (no spec basis, sum double-counts);
  denormalizing a column onto the card (drifts from the history-of-record design).
- Resolves: §6.5/§8.5 ambiguity under A-2
- Status: Accepted

## ADR-013 — 2026-08-08 — Fonts self-hosted via @font-face under literal family names
- Context: The canonical token files reference literal families ("Raleway", "Inter",
  "JetBrains Mono", "Lama Sans"). `next/font` registers generated scoped family names,
  so it can never feed those tokens — B-Systems typography would silently fall back.
  The byteforce branding README already instructs "wire through @font-face".
- Decision: No `next/font`. `src/themes/fonts.css` declares `@font-face` under the
  literal family names; woff2 files live in `public/fonts/` (Raleway/Inter/JetBrains
  Mono fetched from Google Fonts at build-prep time; Lama Sans copied from
  `branding/byteforce/fonts/` when supplied — A-13 fallback until then). Preload links
  in each brand root layout.
- Alternatives considered: next/font `variable` option with tokens consuming the
  generated variables (couples canonical token files to loader internals and fights
  `:root[data-brand]` specificity).
- Resolves: part of A-13 wiring
- Status: Accepted

## ADR-014 — 2026-08-08 — App A keeps one functional danger red outside the five-value palette
- Context: §4.2 says "no invented accent colors", yet the scaffolded ByteForce tokens
  define `--color-danger: #C0392B` and the brand-audit checklist already tolerated
  "functional danger" — SPEC, tokens, and audit disagreed, with no ADR legitimizing
  the exception.
- Decision: One functional error red `#C0392B` is allowed in App A for
  validation/destructive states only — never decorative, never a surface. Orange
  cannot signal errors (it is the primary CTA color) and §4.2's palette has no
  functional alert hue. Token comment and audit skill wording aligned to cite this ADR.
- Alternatives considered: ink-weighted or orange error styling (ambiguous with
  primary actions — worse usability than a controlled exception).
- Resolves: §4.2 conflict — flagged for founder confirmation
- Status: Accepted

## ADR-015 — 2026-08-08 — Brand-token guard test is the sole audit-allowlist exemption
- Context: §4.4's audit rule is "no hardcoded hex/fonts outside branding/ and
  src/themes/", but `src/lib/brand-tokens.test.ts` exists precisely to assert the
  canonical hexes — the literal rule could never pass.
- Decision: The audit allowlist (brand-audit skill, step 1) exempts exactly
  `src/lib/brand-tokens.test.ts`. Any other hex/font hit outside `branding/` and
  `src/themes/` remains a finding.
- Alternatives considered: moving expected hexes to a fixtures file in `branding/`
  (indirection that weakens the guard — the test should state the expected values).
- Resolves: §4.4 audit contradiction
- Status: Accepted

## ADR-016 — 2026-08-08 — portal_admin provisioning and login (refines ADR-008)
- Context: Sign-up creates only `portal_rep` accounts and ADR-008 made the portal
  login phone-based — leaving `portal_admin` (§3, journey 5) with no documented login
  or provisioning path.
- Decision: (a) Admin accounts are provisioned by the seed script / ops in v1 — no
  admin sign-up UI. (b) The portal login form takes one identifier field accepting a
  rep's phone or an admin's email (resolved by shape); dual-role B-Systems accounts
  (A-8) use their email everywhere. (c) The role⇒identifier invariant (staff ⇒ email;
  portal_rep ⇒ phone; portal_admin ⇒ email or phone) is enforced service-side on every
  user create/update.
- Alternatives considered: forcing admins to carry phones (invents a requirement);
  admin logging in only via App B then navigating (breaks journey 5's "log in" at the
  portal and standalone-admin accounts).
- Resolves: §3/§8.5/A-8 gap — flagged for founder confirmation
- Status: Accepted

## ADR-017 — 2026-08-08 — JWT authenticates; authorization state is re-read from DB per request
- Context: With JWT sessions, an issued token outlives deactivation (A-4) or role
  changes — guards trusting token claims would let a deactivated rep keep mutating
  until expiry, violating §3's server-side enforcement.
- Decision: `lib/auth/guards.ts` re-reads `active` + roles from the database on every
  guarded request; the JWT contributes identity only. The deactivated-rep-rejection
  case is part of the API-level RBAC integration tests.
- Alternatives considered: short token maxAge (still a live window); token versioning
  (extra machinery, same DB read in practice); DB-session strategy (heavier NextAuth
  path, same guarantee).
- Resolves: A-4 enforceability
- Status: Accepted

## ADR-018 — 2026-08-08 — Money stored as Int piasters (EGP minor units)
- Context: SPEC §2 requires monetary values "stored as decimal", but the SQLite dev
  connector (ADR-002) supports neither `Decimal` nor enums. Storing whole pounds would
  drop piasters (e.g. 1500.50 EGP).
- Decision: All money columns are `Int` piasters — exact decimal semantics for EGP's
  two minor digits on both SQLite and Postgres. `src/lib/money.ts` is the only
  pounds↔piasters converter and formatter; Zod caps values at Int32 (~21.4M EGP per
  field). The Postgres switch may widen to BIGINT/DECIMAL by migration if the founder
  expects larger single values.
- Alternatives considered: whole-EGP Int (loses piasters — contradicts §2); Float
  (unacceptable for money); BigInt piasters (serialization friction; premature for
  expected deal sizes).
- Resolves: §2 deviation under ADR-002's constraint — value-cap flagged for founder
  confirmation
- Status: Accepted

## ADR-019 — 2026-08-08 — Canonical semantic token contract is identical across both brands
- Context: The two token files had diverging semantic sets (e.g. only ByteForce had
  `--color-surface-card`; only B-Systems had `--color-accent`) — a shared component
  would silently hit unset variables in one brand.
- Decision: Both brand files define the identical semantic variable set; new semantic
  tokens must be added to both in the same change, using only in-palette values.
  Gaps closed in this session: ByteForce gained `--color-accent` (= orange),
  `--color-surface-tint` (= Light Gray), `--color-surface-dark` (= Ink); B-Systems
  gained `--color-on-secondary` (= Indigo Deep), `--color-surface-card` (= Paper,
  never #FFFFFF). Set-equality is asserted by `src/lib/brand-tokens.test.ts`.
- Alternatives considered: per-brand fallbacks in components (scatters brand logic
  into components, exactly what §4.1 forbids).
- Resolves: §4.1 semantic-token contract completeness
- Status: Accepted

## ADR-020 — 2026-08-08 — Terminal stages win over P-1/P-6's "From: Any"
- Context: SPEC §5.1 declares won/lost terminal, but §10.3 writes P-1's and P-6's
  From column as "Any" (the T-rows say "Any active") — internal tension the Phase 0
  spec-guardian review flagged. The engine rejects every event from a terminal stage,
  including an admin dragging a card out of Won.
- Decision: Terminal semantics win — no card leaves won/lost via pipeline events in
  v1. "From: Any" in P-1/P-6 is read as "any active". Won-deal corrections happen
  through the admin's Won Deals management (values/milestones), not by re-staging;
  an admin uncheck of a milestone is the sanctioned correction path (P-8's "logged"
  reversal).
- Alternatives considered: allowing admin-only exits from Won (invents an
  un-specced un-win flow with cascading WonDeal cleanup semantics).
- Resolves: §5.1/§10.3 tension — flagged for founder confirmation
- Status: Accepted

## ADR-021 — 2026-08-08 — ActivityLog.trigger cites the owning pipeline's §10 row id
- Context: §10.2 PP-3 and §10.3 P-3 "import" T-6…T-8 logic. The engine originally
  logged the T-row ids on partners/portal meeting outcomes, so one partners card's
  history mixed PP-3 (actions) with T-6/T-7/T-8 (outcomes) — inconsistent with §9's
  "trigger: §10 row id" read against the owning table. The admin attended→Won path
  also logged P-5 though its behavior is exactly P-6.
- Decision: trigger always cites the OWNING pipeline's row: internal outcomes →
  T-6/T-7/T-8; partners outcomes → PP-3; portal delayed/cancelled → P-3, attended →
  P-5 (rep destinations) or P-6 (admin → Won). Asserted in the engine unit tests.
- Alternatives considered: citing the imported T-row everywhere (loses the
  per-pipeline audit grouping §10's tables define).
- Resolves: §9/§10 labeling consistency
- Status: Accepted

## ADR-022 — 2026-08-09 — Additive UI columns beyond §6's printed minimal shapes
- Context: SPEC §6.1 prints the leads table as exactly Name | Number | Type and the
  lead detail without a created date; the Phase 1 UI added a Stage column and a
  "Date created" line, and the client edit form leaves Name/Number display-only.
  Spec-guardian flagged the silent additions (§0.5/§12.3).
- Decision: Additive, information-only columns/fields that surface data the schema
  already holds are sanctioned where they aid §1's core flow: Stage on the internal
  leads tables, Date created in the lead detail, and read-only identity fields on the
  client edit form (identity edits flow from the lead per A-1's mapping). Nothing
  printed in SPEC is removed or renamed.
- Alternatives considered: strict literalism (hides the pipeline state exactly where
  reps triage leads).
- Resolves: §6.1/§6.4 silence — flagged for founder confirmation
- Status: Accepted

## ADR-023 — 2026-08-09 — One-mutation commit model; proposal "Sent" is a two-step flow
- Context: §5.1 moves a card when the user selects an action AND completes the field
  group; §5.4 reverts a cancelled drop. To make cancel always mean "nothing
  happened", every transition commits event + required group in ONE mutation. A
  proposal can therefore not be created already-sent — T-5's auto-move fires from a
  dedicated "Mark as sent" step that carries the after-proposal follow-up form.
- Decision: The §6.2 proposal group saves unsent; checking Sent is the separate
  `proposal_sent` event (engine T-5/P-4) whose form collects the "Following up after
  proposal" group. Server rejects `sent:true` at creation with a guiding message.
  All §5.3 semantics (auto-move, group opens, data retained) are preserved and
  tested (unit, integration, journey 1).
- Alternatives considered: two chained transitions in one request (compound
  rollback semantics, unclear cancel meaning).
- Resolves: §6.2 Sent-checkbox mechanics
- Status: Accepted

## ADR-024 — 2026-08-09 — To-be-collected = estimated − collected, unclamped
- Context: A-1 defines the client default as "to-be-collected = estimated −
  collected" with no floor; the update path had clamped at 0 while the T-9 creation
  path did not (spec-guardian D3).
- Decision: Both paths apply the literal formula, unclamped. An overpayment shows as
  a negative to-be-collected — visible truth over silent clamping. The field stays
  editable (A-1).
- Alternatives considered: clamping at 0 (hides overpayments — invents behavior).
- Resolves: §6.4/A-1 edge — flagged for founder confirmation
- Status: Accepted

## ADR-025 — 2026-08-09 — Sign-up signs the rep in ("lands in their portal", §8.1)
- Context: §8.1 says "On success the rep lands in their portal"; the first
  implementation redirected to the login page instead, which the Phase 3
  spec-guardian flagged as unsanctioned drift.
- Decision: After a successful sign-up the client immediately signs the new
  account in through the portal provider with the just-registered credentials and
  lands on /portal/crm. The login page remains for returning reps (§13 journey 4
  verifies both paths).
- Alternatives considered: explicit login after sign-up (an extra step §8.1's text
  doesn't describe).
- Resolves: §8.1 sign-up landing
- Status: Accepted

## ADR-026 — 2026-08-09 — Portal follow-up owner is the deal's rep, implicit
- Context: §6.2's follow-up group has "Owner | rep select", and §8.2 reuses "the
  same shapes". In the portal a rep sees only themself — a one-option select is
  noise. SPEC and §11 are silent on portal owner semantics.
- Decision: Portal follow-up forms render no owner select; the server stamps
  `ownerPortalRepId` with the deal's rep. Internal CRMs keep the real rep select.
- Alternatives considered: a disabled single-option select (clutter, no
  information).
- Resolves: §8.2/§6.2 shape reuse — flagged for founder confirmation
- Status: Accepted

## ADR-027 — 2026-08-09 — Font files ship via fontsource (mechanism note to ADR-013)
- Context: ADR-013 decided self-hosted @font-face under the literal family names,
  describing hand-managed files in public/fonts/. The shipped mechanism uses
  fontsource npm packages imported in the (bsystems) root layout — the same
  @font-face-with-literal-names contract, files delivered through npm instead of a
  manual download step. The final spec-guardian review asked for the refinement to
  be recorded rather than left as doc drift.
- Decision: fontsource is the sanctioned delivery mechanism for the Google-hosted
  faces (Raleway/Inter/JetBrains Mono). ADR-013's core (literal family names, no
  next/font) is unchanged. Lama Sans, when supplied, is wired with plain @font-face
  per the byteforce README.
- Alternatives considered: scripted downloads into public/fonts/ (build-prep step
  and update burden with no contract difference).
- Resolves: — (refines ADR-013)
- Status: Accepted

## ADR-028 — 2026-08-09 — ONE consolidated sign-in page (founder-directed)
- Context: The founder hit "wrong password" using valid portal-admin credentials on
  an internal login page — the role-partitioned providers (ADR-016) rejected valid
  accounts on the "wrong" surface. The founder directed: one consolidated sign-in
  for the whole platform.
- Decision: A single `/login` page and ONE unified credentials provider: identifier
  (email or phone, resolved by shape) + password, no role filtering at login. After
  sign-in, users land by role priority (byteforce_staff → /byteforce,
  bsystems_staff → /b-systems, portal_admin → /portal/admin, portal_rep →
  /portal/crm). Which apps a session can SEE remains fully enforced by middleware +
  per-request guards (§3, ADR-017) — login-surface partitioning added confusion,
  not security. Legacy per-app login URLs redirect to /login. The page is
  brand-neutral (both logos) with styles in the sanctioned src/themes/neutral.css;
  its final visual design comes from the design round (docs/DESIGN-BRIEF.md).
- Alternatives considered: keeping per-app pages with better error copy (the trap
  remains); auto-detecting the intended app from the identifier (magic, brittle).
- Resolves: supersedes the login-surface aspects of ADR-016 and §8.1's dedicated
  portal login page (its "Log in" action now targets /login). Founder-directed.
- Status: Accepted

## ADR-029 — 2026-08-09 — Per-entity user access + platform_admin (design round pending)
- Context: The founder requires that creating a user assigns which entities they
  can see/control (ByteForce, B-Systems, or both), with an admin who sees both and
  manages users. The multi-role model (A-8/ADR-000) already carries per-entity
  staff roles; a `platform_admin` role is added (reserved in constants) for
  both-entity visibility + user management.
- Decision: Entity access = the byteforce_staff / bsystems_staff roles;
  `platform_admin` grants both plus the user-management screen (create user with
  entity checkboxes, deactivate/reactivate) and a company switcher in the app
  header. UI/UX ships after the founder's design round (docs/DESIGN-BRIEF.md §3.2
  specifies it for the designer); guards/nav/service implementation follows the
  approved design.
- Alternatives considered: separate account per entity (splits identity, fights
  A-8); an entities junction table (redundant with roles).
- Resolves: founder requirement — implementation deferred to the design round
- Status: Accepted (implementation pending design)

## ADR-030 — 2026-08-09 — V2 restructure (founder-directed): portal merged into B-Systems CRM
- Context: The founder's V2 brief (docs/REQUIREMENTS-V2.md, translated from the
  voice-note revision) restructures the product: the standalone Portal is removed;
  the B-Systems CRM becomes role-aware for four user types (admin, internal sales,
  agent, partner); a `negotiation` stage and a ready-to-close flag are added; won
  flow becomes admin-confirmed with percentage commissions and dated milestones;
  new subsystems land (notifications, statements/payments, users management with
  impersonation, partner account auto-provisioning); the partners-pipeline numbers
  flow is reworked to unbounded alternative numbers.
- Decision: REQUIREMENTS-V2.md is normative and supersedes the affected parts of
  SPEC.md (§3 roles, §8 portal structure, §10.3 board ownership, A-7 for the
  B-Systems board). Role migration: portal_admin→bsystems_admin,
  bsystems_staff→bsystems_sales, portal_rep→bsystems_agent, new bsystems_partner;
  platform_admin (ADR-029) is dropped — the founder's model has bsystems_admin as
  THE admin. All [A]-marked defaults in REQUIREMENTS-V2.md are ADR-grade
  assumptions flagged for founder confirmation.
- Alternatives considered: keeping the portal as a thin shell (contradicts the
  founder's explicit two-apps instruction).
- Resolves: founder V2 brief — [A] items flagged for founder confirmation
- Status: Accepted

## ADR-031 — 2026-08-09 — Claude Design prototype adopted as the visual source of truth (handoff applied, calibrated to V2)
- Context: The founder supplied a Claude Design handoff bundle ("Claude Design
  Handoff/") built against the V1 brief. It was extracted and calibrated to the
  V2 app per docs/DESIGN-APPLICATION-SPEC.md — the normative token sheet +
  component specs + screen map. Sub-decision bullets below cite that spec's
  risk ids (R#).
- Decision:
  - B-Systems cards float #FFFFFF on the Paper canvas — supersedes the "never
    pure #FFF for cards" token-file comment (R1).
  - --color-danger is the functional red #C0392B in ALL brands (extends
    ADR-014); Signal Pink stays accent/Won-cue only (R2).
  - Lost stage accent is neutral in both brands ("Lost is the one neutral"),
    no longer danger/pink (R3).
  - --color-success #2E7D5B is a functional-indicator exemption
    (toast/indicator discs only) — flagged "Needs founder confirmation"
    against the B-brand "no green" rule (R4).
  - JetBrains Mono is the meta face in all brands incl. ByteForce (R6);
    Lama Sans weight mapping 500→400/600→700 with font-synthesis none (R5,
    founder to confirm intermediate cuts).
  - Role-aware B-Systems chrome: indigo header for admin + internal sales,
    deep-navy (data-shell="external") for agents/partners — flagged "Needs
    founder confirmation" (R8).
  - The stage color system is now four values per stage (well / bar / chip /
    chip-ink) via --color-stage-{key}[-accent|-chip|-chip-ink]; Negotiation's
    colors are DERIVED by the spec's ramp-midpoint rule (flanking
    Proposal↔Won) since the prototype predates the stage — flagged for
    founder (R12).
  - The consolidated /login is the prototype's split form + brand-billboard
    layout — supersedes ADR-028's centered-card visual (R18).
  - The neutral (home) shell now defines its own [data-brand="neutral"] token
    scope in src/themes/neutral.css (extends ADR-007); the token contract is
    identical across all three scopes.
  - Entity switcher in the app headers renders ONLY for accounts whose roles
    span both companies (founder instruction this session); the seeded admin
    account now carries both bsystems_admin and byteforce_staff.
  - ByteForce surface-tint moved to the violet family, radius-card 12→10px,
    prototype two-layer shadows (R21/R22 accepted).
  - The /portal landing's marketing sections from the prototype (steps strip,
    commission band, footer) were NOT built — they need new marketing copy;
    flagged "Needs founder confirmation" for a copy-approved pass (R23).
  - Consequences: all components consume the design-system class layer
    (src/themes/design-system.css) + brand utilities; no raw values in
    components (brand-auditor PASS).
- Alternatives considered: none recorded — the prototype is the founder's
  approved design deliverable; the per-risk calibration alternatives are
  recorded in docs/DESIGN-APPLICATION-SPEC.md §4 (25 resolved risks).
- Resolves: the design-round deliverable awaited since Entry 008; no SPEC §11
  A-# resolved. The flagged items above join the "Needs founder confirmation"
  thread (PROGRESS Entry 010).
- Status: Accepted

### ADR-031 — Resolution (2026-08-09, founder)
Founder resolutions on ADR-031's flagged items (addendum — amends, does not
supersede; ADR-031 stays Accepted):
- R4 (success green): REJECTED — the B-brand "no green anywhere" rule stands.
  --color-success is now in-palette: B-Systems → Systems Indigo, ByteForce →
  Royal Violet, neutral → ink. Token files updated; verified (vitest 60/60,
  build green).
- R8 (role-aware chrome — indigo staff / deep-navy agents+partners): CONFIRMED.
- R12 (derived Negotiation colors — ramp-midpoint rule, bar #D8468B): CONFIRMED.
- R23 (portal marketing sections): founder chose "draft copy for approval" —
  copy drafted and awaiting founder sign-off before the sections are built.
Still open from ADR-031's flags: Lama Sans intermediate cuts (R5/A-13) and the
R23 copy sign-off — carried in PROGRESS (Entry 011).

## ADR-032 — 2026-08-09 — Full-system backup: one JSON file, replace-all restore
- Context: Founder directive — the admin needs an Export/Import pair such that
  importing an export restores the system EXACTLY, even onto a fully wiped
  database.
- Decision:
  - Format: one JSON file `{ version, app, exportedAt, tables, files }` —
    every table's rows verbatim (ids preserved, so ALL relations and the
    admin's own session survive a restore), plus every uploaded file
    base64-embedded, keyed by its storage key.
  - Restore semantics: REPLACE-ALL — one transaction deletes everything in
    FK-safe reverse order, then re-inserts in parent-first order; file blobs
    are restored after the commit (a bad blob never aborts the data restore).
    The version/app fields are validated; a newer-version file is refused;
    failed validation changes nothing.
  - Admin-only (requireBsAdmin) at /api/b-systems/backup (GET export,
    POST import); UI on the admin Home with an explicit "replaces ALL current
    data" confirm.
  - The export contains password hashes — the file itself is a secret;
    flagged for the founder: store backups securely.
  - Every import writes a `backup_import` activity-log row on top of the
    restored log.
- Alternatives considered: none recorded — the Export/Import pair is
  founder-directed, and merge-style import semantics cannot satisfy "restores
  the system exactly onto a fully wiped database".
- Resolves: — (founder directive; the secure-backup-storage flag joins the
  "Needs founder confirmation" thread, PROGRESS Entry 013)
- Status: Accepted

## ADR-033 — 2026-08-09 — PostgreSQL everywhere (executes ADR-002's production switch)
- Context: Production runs PostgreSQL (founder), while the app was SQLite
  end-to-end; ADR-002 had planned this switch as a deploy-time step.
- Decision:
  - Datasource provider → postgresql; driver adapter → @prisma/adapter-pg in
    src/lib/db.ts and prisma/seed.ts (@prisma/adapter-better-sqlite3 removed).
  - The SQLite migration history is RETIRED and replaced by one fresh
    Postgres init migration (prisma/migrations/20260809000000_init_postgres,
    generated offline via `prisma migrate diff --from-empty --to-schema`);
    migration_lock.toml now says postgresql. Existing SQLite databases are
    not migrated in place — data crosses via the ADR-032 backup Export/Import
    (proven: the dev database's 16 leads + users crossed SQLite→Postgres
    losslessly).
  - Local dev/tests use EMBEDDED PostgreSQL (the `embedded-postgres`
    package — real PG binaries from node_modules, no Docker): dev on port
    5433 (`npm run db:up`, persistent .pgdata/dev), vitest on 5434 (fresh per
    run, its globalSetup owns the lifecycle), Playwright on 5435 (fresh per
    run, globalSetup/globalTeardown own it). .pgdata/ is gitignored.
  - `next build` requires no database (force-dynamic pages) — the Playwright
    webServer no longer migrates; each suite's global setup does.
  - DATABASE_URL has no fallback anymore — db.ts throws a clear error when
    unset.
- Alternatives considered: keeping SQLite locally with Postgres only in
  production (rejected: two engines diverge and prod-only bugs hide — the
  switch ADR-002 planned was due); Docker Postgres locally (rejected per
  ADR-002's original cold-start reasoning — embedded-postgres needs no
  Docker); translating the SQLite migration history migration-by-migration
  (rejected: it contains hand-written SQLite SQL, incl. the V2 data
  migration, that does not translate — a fresh init migration is cleaner).
- Resolves: — (executes the production switch planned in ADR-002; no SPEC
  §11 A-#)
- Consequences: production deploys use a managed Postgres URL +
  `prisma migrate deploy` at boot; integration tests got ~6x faster than
  SQLite-on-Windows.
- Status: Accepted

## ADR-034 — 2026-08-10 — Founder V3 flows: snap-back impersonation, registration approval, won-deal math barriers
- Context: Founder V3 review round directed a batch of flow changes across
  impersonation, agent registration, won-deal financial coherence,
  commission statements, and lead-detail/board UI.
- Decision:
  - Impersonation is two-way: the JWT carries impersonatorId; a persistent
    bar offers one-click "Back to admin" (endImpersonation re-verifies the
    admin server-side; the return trigger `impersonation_return` is
    logged).
  - Agent signup registers BOTH identifiers (email now required alongside
    phone; either signs in — refines ADR-008's phone-only identifier) AND
    is an approval REQUEST: new User.registrationStatus
    (pending/approved/rejected, migration 20260810110642); pending/rejected
    users cannot sign in (provider + requireUser + explicit login-page
    messages); Registrations gained the Awaiting-approval queue with
    Approve/Reject (admin API /api/b-systems/registrations/[id]) and an
    admin bell notification per request; no auto-login after signup
    (supersedes ADR-025's sign-in-on-signup by founder direction).
  - Won-deal coherence rules (server-enforced in wonDealSchema, live totals
    in the milestone tab): milestone values must total the estimated value;
    milestone commissions must total the commission % (±EGP 1);
    per-milestone end ≥ start; milestones strictly chronological.
    handleRoute now surfaces the first zod issue message to every form.
  - Printable branded commission-statement document at
    /b-systems/statements/[id]/document (admin + the statement's closer),
    token-driven branding, print CSS strips chrome; linked from Statements
    and Payments codes.
  - Lead detail: every creation field always visible; Edit offered to the
    lead's OWNER (API access rules unchanged). Modal-crop root cause fixed
    (fill-mode backwards releases Chromium containing blocks). Required
    controls show an automatic star. Boards render full-bleed
    (scrollbar-safe breakout). Owner buckets are color-coded chips
    (internal indigo / agent magenta / partner pink / admin navy).
- Alternatives considered: none — founder-directed flows adopted as
  specified.
- Resolves: — (founder directives; no SPEC §11 A-#. Refines ADR-008;
  supersedes ADR-025's auto-login-after-signup point.)
- Status: Accepted (all founder-directed).

## ADR-035 — 2026-08-11 — Uploads require a persistent volume; UPLOADS_DIR env selects the storage root
- Context: Production incident 2026-08-11 — the founder clicked a
  statement's proof link and got {"error":"File missing from storage"}.
  Uploads were stored in `<cwd>/uploads` INSIDE the app container; the
  hosting platform rebuilds the container on every deploy, wiping every
  uploaded file (payment proofs, CVs, recordings, proposal/contract
  PDFs), while the external Postgres kept the attachment rows — so the
  UI kept linking blobs that no longer existed.
- Decision: keep the local-disk storage driver behind the existing
  storage abstraction; the storage root now honors the UPLOADS_DIR env
  (default `<cwd>/uploads` unchanged; helpers uploadsDir() /
  uploadsDirConfigured() in src/lib/storage/index.ts). Missing files
  are surfaced instead of dead-linked: /api/health gained an `uploads`
  diagnostic section (dir path, persistentDirConfigured, writable
  probe, missing-attachment scan), services return per-proof fileOk
  flags with missing-file UI states, and admins get re-upload/replace
  paths (replaceStatementProof, paid statements only, via
  PUT /api/b-systems/statements/[id]/paid).
- Alternatives considered: switching to object storage (S3-compatible)
  — rejected for now: the storage abstraction already isolates the
  driver, a persistent volume fixes durability with no new
  infrastructure or credentials, and object storage stays available as
  a future driver swap behind the same interface. Refusing to boot /
  failing health hard when no persistent dir is configured — rejected:
  the app must keep serving; health reports the gap instead.
- Resolves: — (production incident response; no SPEC §11 A-#)
- Consequences: the founder must attach a persistent volume on the host
  and set UPLOADS_DIR to its mount path — until then EVERY redeploy
  wipes uploads; backup exports (ADR-032) include file blobs and remain
  the disaster-recovery path.
- Status: Accepted
