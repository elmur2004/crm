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

## ADR-036 — 2026-08-12 — Per-lead team chat with server-resolved @mentions
- Context: Founder V5 directive: "a mini chat inside every lead so that we
  can ask questions and mention each other... so that when we talk to the
  lead, we have the full picture." Every lead detail page (both apps) needs
  a thread where the team can talk and @mention each other, with mention
  bell notifications. The dangerous parts are who may be mentioned (access
  leak surface) and who claims to have written a message (impersonation).
- Decision:
  - The mentionable set for a lead is derived from the SAME access rule as
    the lead page itself: mentionableUsersFor(leadId) mirrors
    requireLeadAccess (ByteForce staff / B-Systems admins + internal-sales
    on internal-bucket leads + the lead's owner ONLY while holding an
    agent/partner/admin role — a role change drops them out of the set),
    active + approved accounts only. No separate mention ACL to drift.
  - Mentions are resolved SERVER-side only (resolveMentions:
    word-boundaried so "@Ali" never matches inside "@Alina" or an email,
    longest-name-first with span masking). Client-supplied mention ids are
    never trusted. Each resolved mention produces a bell notification (new
    Notification.type "mention"; self-mentions skipped) plus an
    activity-log row (new LOG_ACTIONS action "comment", trigger
    "lead_chat").
  - Bells are per-brand: a NEW ByteForce bell reads new
    /api/byteforce/notifications routes; ByteForce mention rows
    deliberately carry NO lead deep-link (a dual-role user's other-brand
    bell would link the wrong app) — the notification body names the lead
    instead. Deep-links return once notifications carry a brand.
  - Impersonation transparency: a message posted while acting-as is
    labeled "Name (via AdminName)" in the thread, in the mention
    notification title, and in the activity log (CurrentUser now carries
    impersonatorId from the session).
- Alternatives considered: client-supplied mention ids (rejected —
  spoofable; the server must own who can be mentioned); realtime
  websockets for the thread and bells (rejected — the existing
  short-interval polling bell suffices at this scale, per the ADR-009
  precedent).
- Resolves: — (founder V5 directive; no SPEC §11 A-#)
- Consequences: notification volume grows with chat use; ByteForce mention
  deep-links stay deferred until notifications carry a brand.
- Status: Accepted

## ADR-037 — 2026-08-13 — Hand-rolled cookie-locale i18n (Arabic ⇄ English); EN output stays byte-identical
- Context: Founder directive: "translate the whole system... a
  translation button between arabic and english for every single content
  in the entire app." Every user-visible string across all apps must
  render in Arabic or English behind one toggle — without destabilizing
  the existing English-assuming test suite or the pipeline engine's
  canonical constants.
- Decision:
  - No i18n library. A hand-rolled layer in src/lib/i18n/: core.ts
    (Locale = "en" | "ar", Msg = {en, ar}, tFor, dirFor, cookie name),
    server.ts (getLocale reads the cookie, default "en"), actions.ts
    (setLocale server action). The locale lives in a cookie — URLs never
    change.
  - IRON RULE — EN output stays byte-identical: externalizing a string
    into a Msg must not change its English rendering by a single byte.
    This kept the entire pre-existing suite green UNCHANGED (TESTING Run
    025) and is binding on all future edits: any new user-visible string
    is added as a Msg in the right dict module, with the English text
    exactly as it would have been hardcoded.
  - Engine/domain constants (stages, lead types, owner types) stay
    English in code, DB, and API payloads; translation happens at RENDER
    time only, via the helpers in src/lib/i18n/dict/labels.ts.
  - Client components read the locale from a LocaleProvider context; the
    LanguageToggle (EN | عربي chip) is mounted in both app headers and
    on /login; all three root layouts stamp <html lang dir>, so Arabic
    renders full RTL (the design system was already
    logical-properties-based).
- Alternatives considered: next-intl (or a similar library) — rejected:
  a new dependency plus message-catalog/runtime conventions for what is
  a two-locale {en, ar} record; the hand-rolled Msg shape is smaller and
  type-safe. URL-prefix locales (/ar/...) — rejected: doubles the route
  surface and breaks existing deep links and e2e paths; a cookie keeps
  every URL stable and makes the EN-byte-identical guarantee trivial.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: server-side error strings (zod/service ApiError messages
  surfaced in forms) remain English until an error-code scheme exists
  (Entry 022 item (i)); ByteForce thin-page metadata titles are partly
  English; two Arabic terminology choices await founder review — "CRM"
  rendered as "المبيعات", "Retainer" as "عقد دوري" (Entry 022 item (j)).
- Status: Accepted

## ADR-038 — 2026-08-13 — B-Systems Owner list auto-provisions rep cards from sales accounts
- Context: Founder bug report — on the /b-systems/crm board, the drag
  modal's stage forms (e.g. Following Up) render the Owner select with
  only "—", no sales reps. The reps prop threading (board page →
  BsBoard → GroupFieldsV2, and the mirrored PartnersBoard path) was
  already correct in code; the actual cause is the DATA source:
  listReps("bsystems") reads SalesRep cards, but bsystems-brand cards
  are created ONLY by the demo seed (skipped in production — "demo data
  never on production", seed.ts) and the B-Systems app has no rep-cards
  screen (§6.1 Sales Reps is ByteForce-only; nothing in the UI calls
  POST /api/b-systems/reps). On a live system the bsystems SalesRep set
  is empty forever, so EVERY admin/sales Owner select (board modal,
  lead detail panel, partners pipeline forms) rendered empty. The
  actual B-Systems sales team lives in Users (role bsystems_sales, V2
  §0 role map), created via the admin's Users section.
- Decision: new listBsOwnerReps() in src/lib/services/sales-reps.ts —
  auto-provisions a SalesRep card (brand "bsystems", matched by exact
  name, idempotent createMany of the missing ones) for every ACTIVE
  user holding bsystems_sales, then returns listReps("bsystems"). All
  five bsystems Owner-list call sites switched to it (CRM board page,
  lead detail page, partners pipeline board, prospect detail, partner
  detail). FollowUp.ownerSalesRepId keeps its SalesRep FK — no schema
  change, no migration; read-side provisioning self-heals existing
  production data on first page view. Roster is sales accounts only:
  admins appear when they also hold the sales role (A-8 allows one
  account carrying both).
- Alternatives considered: pointing the Owner select at Users directly
  — rejected: FollowUp.ownerSalesRepId FKs SalesRep; a schema/data
  migration for a presentation-source fix. Write-side sync in the users
  service (create/update hooks) — rejected: leaves existing production
  sales accounts without cards until edited; read-side ensure covers
  new AND existing accounts with less surface. Linking SalesRep to User
  by a new userId column — deferred: cleaner rename semantics, but
  needs a migration; name-matching is acceptable now (a renamed sales
  user gets a fresh card; the old card stays for history).
- Resolves: — (founder bug report; no SPEC §11 A-#)
- Consequences: demo/dev environments list the seeded demo cards PLUS
  auto-provisioned cards for demo sales accounts (e.g. Omar Farouk);
  deactivated sales accounts keep their existing card (history) but
  never mint one; renaming a sales user leaves the old card selectable
  alongside the new one until cleaned up in DB (flagged in the
  deferred-userId alternative above).
- Status: Accepted

## ADR-039 — 2026-08-14 — "Didn't answer" is a FLAG on the lead card, not a stage
- Context: Founder directive — "a button that indicates that this lead
  didn't answer, and it appears on the card in the actual CRM... just
  so we know." The MAIN B-Systems CRM has no didnt_answer stage; the
  partnership pipeline's Didn't Answer STAGE (§7.2) is a different flow
  (number slots, automatic return to Lead) and is not what was asked.
- Decision: Lead.noAnswer Boolean @default(false) (migration
  20260813205545_lead_no_answer). setNoAnswer(brand, leadId, value,
  actor) mirrors markReadyToClose: flag update + activity log
  (entityType lead, action update, trigger "no_answer" on set /
  "no_answer_cleared" on clear, from/to stages null); NO stage change,
  NO notification — deliberately OUTSIDE the SPEC §10 transition
  tables, exactly like ready_to_close (V2 §3). API: POST
  /api/b-systems/leads/[id]/no-answer {value: boolean} behind
  requireLeadAccess — every role that can act on the lead can toggle
  it. UI (B-Systems only): a toggle button on the board card beside
  "Mark ready to close" ("Didn't answer" / "Answered — clear flag",
  same drag/navigation click guards), a "No answer" chip on the card
  and on the lead detail header (.badge--noanswer, danger tokens). All
  new user-visible strings are Msg {en, ar}.
- Alternatives considered: a didnt_answer STAGE mirroring the
  partnership pipeline — rejected: the founder asked for an indicator
  ("just so we know"); a stage would rewrite the §10 B-Systems
  transition table, dashboards, and stage forms for what is a marker.
  Notifying admins like ready_to_close — rejected: the founder framed
  it as passive shared knowledge, not an action request.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: the flag survives stage moves and never expires;
  clearing is manual ("Answered — clear flag"). ByteForce is untouched
  (B-Systems only until the founder asks otherwise).
- Status: Accepted

## ADR-040 — 2026-08-14 — ByteForce CRM board gains the intake column (founder override of §6.3)
- Context: Founder bug report — "the CRM in ByteForce is not responding
  to the leads — I added a lead and it's still very empty." SPEC §6.3
  defines the board as FIVE columns (Following Up … Lost), deliberately
  excluding intake; a freshly added lead (stage "new") was therefore
  invisible on /byteforce/crm until its first stage move
  (CrmBoardBody's BOARD_STAGES filtered "new" out of both the query and
  the columns). Assignment was NOT the issue: the board query never
  filtered by salesRepId, and unassigned leads already render with the
  existing "Unassigned" label.
- Decision: BOARD_STAGES = the full engine stage set — the board gains
  a leading New column (matching the B-Systems board), so every
  ByteForce lead is visible from the moment it is created. Intake cards
  show their creation datetime as the key datum (pure data — no new
  user-visible strings; existing EN output byte-identical). Stage sets
  still come from the engine (§5.1), never hardcoded.
- Alternatives considered: keeping §6.3 verbatim and pointing the
  founder at the Leads tables — rejected: the founder's mental model is
  "the CRM responds to the leads", and the sibling B-Systems board
  already shows intake; parity is cheaper than explaining an absence.
- Resolves: founder bug report (overrides SPEC §6.3's five-column
  definition; §10 transition rows untouched — display only).
- Consequences: journey1 now asserts the freshly created lead appears
  in the New column before its first move; dashboards unchanged (the
  "New (not actioned)" tile already counted intake leads).
- Status: Accepted

## ADR-041 — 2026-08-14 — To-Do page: a read-only projection over existing dated records
- Context: Founder — "a to-do page which has the actual date of today
  with the entire tasks of today... following up or proposal or
  anything in the system with a specific date... just a way of
  representing what I have to do today, no fancy stuff, so I don't miss
  anything."
- Decision: /b-systems/todo and /byteforce/todo (nav "To-Do" for every
  role, both apps) rendering todoFor(brand, scope, now) from
  src/lib/services/todo.ts — a PROJECTION over records that already
  carry dates; no new state, nothing to keep in sync. Two sections:
  Overdue (danger accent, only when nonempty) then Today; a row = time
  (clock hidden for date-only records), kind chip, linked name. An item
  is LIVE only when it is its lead's/prospect's LATEST record AND the
  parent still sits in the matching stage (follow-up ↔ following_up;
  arranged outcome-less meeting ↔ meeting_setting) — exactly what the
  boards' key datum shows, so superseded history never resurfaces and
  Overdue stays meaningful. Days are CAIRO calendar days
  (cairoDayWindow, DST-safe via the existing datetime module). Scope
  mirrors requireLeadAccess in the query: bsystems admin all, internal
  sales the internal bucket, agents/partners own leads; ByteForce staff
  all byteforce leads. Partnership-prospect rows, pending statements
  (expectedDate), and open milestones (expectedEnd) are bsystems
  ADMIN-only extras.
- Alternatives considered: a Task table with completion state —
  rejected: the founder asked for representation, not task management;
  a table would drift from the records it mirrors. Including every
  historical follow-up in Overdue — rejected: floods the list with
  superseded rows and buries what is actually actionable.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: proposals carry no due date in the schema, so
  "proposal" appears via the follow-up that every sent proposal
  auto-creates (T-5), not as its own row; if the founder wants
  dated-proposal rows, that needs a schema addition. Rows disappear
  when handled (stage moves) rather than being checked off.
- Status: Accepted

## ADR-042 — 2026-08-14 — ByteForce board parity: drag enabled on the internal pipeline (founder override of A-7)
- Context: Founder — "the CRM in ByteForce is not draggable... it
  should have all the characteristics of the other CRM — the flags, the
  tags, the draggability, drag opens up that thing — the same." SPEC
  A-7 restricted drag to the portal (v1); the internal config carried
  dragEnabled: false and /byteforce/crm was a static server-rendered
  read-only board.
- Decision: internalCrmConfig.dragEnabled = true — the engine's
  existing generic drag path serves the internal pipeline unchanged
  (drag == the matching Next Action: same required group, same §10
  trigger id, e.g. T-1 for a drop on Following Up). The
  transition.test.ts case that asserted drag rejection on internal
  (A-7) was REWRITTEN to assert the new behavior — group + trigger
  parity — per the founder override. New client component
  src/components/internal/InternalBoard.tsx ports the BsBoard
  experience: dnd drag with the drop-opens-stage-form modal (the
  INTERNAL §6.2 field groups, now exported from LeadEventPanel — one
  source for panel and modal), whole-card click with the post-drag
  click guard, lift/clip drag layering (data-drag-origin), count
  pills, and the didn't-answer toggle + "No answer" chip (new POST
  /api/byteforce/leads/[id]/no-answer behind requireBrandStaff). The
  ByteForce lead detail header shows the chip too. CrmBoardBody stays
  the server side: it precomputes all labels so the client is
  string-free; modal copy reuses the existing board Msgs (EN
  byte-identical). A sibling component was chosen over one shared
  board: the two brands' form systems differ structurally (role-aware
  GroupFieldsV2 + milestone won-tab vs internal fields + technical
  owner/collected won form) and B-Systems e2e selectors stay untouched.
- Alternatives considered: one brand-parameterized board component —
  rejected for now (see above; revisit if the form systems converge).
  Keeping A-7 and pointing the founder at Next Actions — rejected:
  founder directive supersedes.
- Resolves: founder bug/feature report (overrides SPEC A-7 for the
  internal pipeline; §10 rows unchanged — a drag IS the matching row).
- Consequences: journey1's flow is unchanged (actions still work);
  e2e/byteforce-board.spec.ts covers drag→form→confirm, the
  didn't-answer toggle, and whole-card open on /byteforce/crm.
- Status: Accepted

## ADR-043 — 2026-08-14 — Lead archive: a soft-hide flag, no data loss, restorable
- Context: Founder — "go inside a lead and archive it, it goes into the
  archive; I can open the archive and unarchive."
- Decision: Lead.archived Boolean @default(false) + archivedAt
  DateTime? (migration 20260813232652_lead_archive). setArchived(brand,
  leadId, value, actor) toggles the flag (activity-logged "archived" /
  "unarchived"); POST /api/b-systems/leads/[id]/archive behind
  requireLeadAccess (admin any / sales internal / agent+partner own)
  and /api/byteforce/leads/[id]/archive behind requireBrandStaff.
  Archived leads leave: both CRM boards, the Leads lists' default
  views, the rep-card counts + unassigned count, every lead-based
  dashboard number, the admin-home external pipeline, and the To-Do
  projection. The way back: the B-Systems Leads page's new view select
  ("Active" default / "Archived" — that IS the archive) and a matching
  Active/Archived toggle on the ByteForce rep-leads tables; unarchive
  lives on the lead detail (Archive asks an inline confirm à la
  DeleteLeadButton; Unarchive is one click; an "Archived" badge shows
  in both detail headers, .badge--archived, surface-tint tokens).
- Alternatives considered: hard delete — exists already (admin, V2
  §11) and loses data; a terminal "archived" STAGE — rejected: archive
  is orthogonal to pipeline position (the stage survives and returns
  intact on unarchive).
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: financial surfaces deliberately KEEP archived leads'
  records — clients/toBeCollected, Won Leads, statements, and payments
  are money-trail views, not lead lists. Agent/partner detail tables in
  the admin's Agents/Partners sections also keep them (management
  views). An agent who archives an own lead restores it via the lead's
  URL or asks the admin (agents have no archive list) — flagged below.
- Status: Accepted

## ADR-044 — 2026-08-14 — Local PostgreSQL clusters are initialised UTF8 (locale C)
- Context: The universal lead search (founder: "a search that applies to the
  mobile number and to the name of the lead or the name of the company")
  500s on any Arabic query, and Arabic lead names cannot be stored at all:
  `character with byte sequence 0xd8 0xaf in encoding "UTF8" has no
  equivalent in encoding "WIN1252"` (SQLSTATE 22P05). Root cause:
  `embedded-postgres` (ADR-033) runs initdb with no flags, so on Windows the
  cluster inherits the OS locale — English_United States.1252 — and every
  database, template0/1 included, is created WIN1252. The platform is
  bilingual (ADR-037), so this is a hard defect, not a preference.
- Decision: scripts/local-postgres.ts passes
  `initdbFlags: ["-E", "UTF8", "--locale=C"]` to every cluster it creates
  (dev 5433, vitest, Playwright). UTF8 requires a matching locale and C is
  the portable one on Windows; ILIKE case-insensitivity is unaffected for
  ASCII and irrelevant for Arabic (no case). A cluster that already exists is
  never re-initialised, so startLocalPostgres now probes `SHOW
  server_encoding` on a pre-existing cluster and prints a loud warning naming
  the data dir when it is not UTF8.
- Alternatives considered: forcing client_encoding on the connection string —
  rejected: the DATABASE encoding is the constraint, no client setting lets a
  WIN1252 database hold Arabic. Sanitising/rejecting non-Latin-1 input at the
  app layer — rejected: it would amputate half the product's languages.
  `--locale=en-US.UTF-8` — not available on Windows initdb.
- Resolves: BUG-006.
- Consequences: fresh clusters (both test suites, every new dev machine) are
  UTF8 immediately. The founder's EXISTING .pgdata/dev cluster stays WIN1252
  until it is deleted and recreated (`npm run db:up` after removing the
  folder, then `npx prisma migrate deploy` + seed, or an ADR-032 backup
  export/import to carry data across) — the new warning says so on every
  start. Managed/production Postgres is UTF8 by default and was never
  affected. Collation C changes text ORDER BY to byte order on local
  clusters; the app orders by timestamps or by curated labels, and the full
  suite passes unchanged.
- Status: Accepted

## ADR-045 — 2026-08-14 — Undo: a snapshot-inverse behind an allowlist, one step, never financial
- Context: Founder — "we need an undo button; I don't know what's the best way
  to do it, but figure out the best way to have an undo button that undoes the
  last action I did on the system." The system's writes are transactional and
  side-effecting (a stage move can mint child records, clients, won deals,
  milestones and statements), so "undo" cannot mean "reverse the last SQL".
- Decision: an UndoEntry table (migration 20260814131216_undo_entry). Every
  UNDOABLE mutation writes exactly one row INSIDE its own transaction carrying
  the INVERSE — the prior state plus the ids that write created — never a
  replay log. The allowlist is explicit: lead stage event (revert the stage +
  the auto-cleared no-answer flag, delete the group record(s) it created,
  restore any record it mutated in place), no-answer toggle, ready-to-close
  flag, archive/unarchive, lead field edit (prior value of exactly the edited
  fields), lead create (delete the lead), and partner-prospect stage event.
  Everything else is simply not recorded.
  Five guards, all server-side in performUndo:
  (1) OWNERSHIP — an entry belongs to the user who made the change; admins are
      not special, they undo their own actions only.
  (2) RECENCY — only that user's latest unconsumed entry, and only within
      UNDO_WINDOW_MS (10 minutes); past it the entry is retired, not applied.
  (3) INTEGRITY — the entity's updatedAt is fingerprinted at write time; if it
      differs at undo time the answer is "This changed since — undo is no
      longer safe" and nothing is touched.
  (4) ONCE — the row is claimed with a conditional updateMany inside the undo's
      own transaction, so a double-click finds count 0 and gets a clean 409.
  (5) HONESTY — actions that are NOT undoable retire the user's pending entries
      (invalidateUndo): a Won transition, a lead delete, a partner conversion, a
      milestone check/uncheck, a statement created or marked paid. The button
      goes quiet rather than offering to revert something older than the last
      thing that happened.
  Undo is ONE STEP, not a history stack: applying it also retires that user's
  other pending entries (walking further back would offer inverses whose
  fingerprints the undo itself has just invalidated). Every undo writes an
  ActivityLog row (action "update", trigger "undo") — a reversal is history,
  not a silent rewrite. UI: a snackbar-style pill at the bottom start of every
  page in both apps (POST /api/undo), labelled with the sentence the server
  stored when the action happened, in EN or AR.
- Alternatives considered: full event-sourcing / replay (every write becomes an
  event and undo replays the log) — rejected: it demands rewriting every
  service around an event store, and inverse-replaying side effects (client
  creation, commissions) is exactly the dangerous part; generic DB-level
  rollback (savepoints, temporal tables, restoring a backup) — rejected: it
  cannot be scoped to ONE user's last action while other people keep working,
  and it would silently revert their writes too; a global "trash/restore for
  everything" — rejected as a much larger product, unasked for; making Won
  undoable while nothing financial exists yet — rejected: it would have to
  unwind a WonDeal, its milestones and the auto-created Client, and the moment
  the rule ("only if untouched") is a moment old it is a data-loss bug.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: the header stays as it was — the pill floats instead, because
  both app headers are full at 1440px (a chip there pushed nav links into the
  hidden overflow). persistGroup now RETURNS what it wrote (GroupWrites), which
  the leads and partners services thread into the snapshot. The fingerprint
  covers the ENTITY ROW: a change to a child record that never touches the lead
  row is not detected, so an undo can still delete the group record it created
  under a later, unrelated child write — bounded by the 10-minute window and by
  undo only ever deleting ids it recorded itself. Impersonated writes carry the
  impersonated user's id, so the undo belongs to that account. Seed/system
  writes have no actor id and are never undoable.
- Status: Accepted

## ADR-046 — 2026-08-17 — Same-stage records: engine next actions that add a record and never move the card
- Context: three founder asks that are one mechanism. (a) "The follow-up
  column should have a way of being a brief follow-up — if I followed up
  with them and they need another follow-up, add a button inside the
  lead." (b) "When we put it in negotiations we need a follow-up for the
  negotiation itself — the date we will have a response for them on the
  proposal." (c) "The meeting setting, the same thing — a button to
  reschedule." Each needs a NEW dated record while the card stays exactly
  where it is, and each must reach the boards, the activity log, undo and
  the To-Do page with no bespoke plumbing.
- Decision: SAME_STAGE_ACTIONS — three engine next-action ids
  (follow_up_again, negotiation_follow_up, reschedule_meeting) that the
  transition core resolves to `toStage === fromStage`. They are ordinary
  next actions in every other respect, so persistGroup, the Zod
  completeness gates, ActivityLog (T-10), ADR-045's undo snapshot and
  ADR-041's To-Do projection all serve them unchanged. Ids are
  deliberately NOT stage names, so nothing can mistake one for a move.
  · Availability comes from the CONFIGS, never from the UI:
    follow_up_again + reschedule_meeting on internal, bsystems AND
    partners (all three have Following Up and Meeting Setting);
    negotiation_follow_up on bsystems only (V2 §1's negotiation stage).
    Every role that can act on the lead gets them — they are records,
    not wins.
  · Groups: follow_up_again → the follow-up group, context "initial";
    negotiation_follow_up → the follow-up group with a NEW context
    "after_negotiation" (title "Response due after negotiation") so the
    record reads as the promised response date rather than a generic
    follow-up; reschedule_meeting → the MEETING group, i.e. a NEW
    meeting record — NOT T-7's "meeting_reschedule" group, which edits
    the existing meeting in place. A new record is what makes the boards
    and the To-Do (both "latest record" readers) swap to the new slot
    and stop counting the old one, which is exactly what the founder
    asked for ("a button to reschedule" that supersedes).
  · Triggers sit OUTSIDE the SPEC §10 tables and are named for what they
    are — FU-AGAIN, NEG-DUE, MTG-RESCHEDULE — following the existing
    non-§10 convention (B-RTC, no_answer, archived, undo). They are new
    founder rows; inventing T-11/B-10 would imply a §10 table row that
    does not exist.
  · Activity log: a same-stage action writes action "group_added" with
    NO from/to stages, because nothing moved. Every other same-stage
    case (T-7's delayed meeting, re-selecting the current stage) keeps
    its existing "stage change" wording byte-for-byte.
  · Undo: the pill says "Recorded another follow-up on X" / "Recorded
    the response date on X" / "Rescheduled the meeting on X" instead of
    ADR-045's "Moved X to …", which would be a lie.
  · To-Do (ADR-041) gains the NEGOTIATION stage, and negotiation NOTES
    join the latest-record race — otherwise a follow-up left behind by
    Following Up would resurface the moment the card entered Negotiation.
  · UI: all three panels (BsEventPanel, LeadEventPanel,
    ProspectEventPanel) filter same-stage actions OUT of the "Next
    action" select and render them as buttons above it, reusing that
    stage's existing role-aware form (SAME_STAGE_FORM_TARGET). Agents
    keep their V2 §3 day-only follow-up form. A reschedule always
    records an ARRANGED meeting, so the "did you agree on a time?"
    question is not asked (lockArranged).
- Alternatives considered: special-casing the UI with a bespoke endpoint
  per button — rejected: it would bypass the engine, the undo snapshot
  and the group gates, and it would have to be built three times. A
  dedicated "brief follow-up" record type — rejected: it is a follow-up;
  a second table would fork every reader (boards, To-Do, GroupHistory).
  Making reschedule reuse T-7's in-place meeting_reschedule group —
  rejected: mutating the old row hides the history the founder is
  keeping and leaves nothing for "supersedes" to mean.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: FOLLOW_UP_CONTEXTS gains a fourth member appended at the
  END (no stored context shifts meaning; `context` is a plain String
  column, so no migration). follow_up_again deliberately stores context
  "initial" — a repeat follow-up IS a follow-up, and the timestamps
  already tell them apart; flagged for the founder in case a distinct
  label is wanted. The B-Systems board's negotiation card now shows
  "Response: <date>", but only while that follow-up is newer than the
  negotiation note the stage was entered with.
- Status: Accepted

## ADR-047 — 2026-08-17 — Lead OWNERSHIP is assignable; referral ATTRIBUTION is not
- Context: founder — "inside the lead I have a button or an option to
  assign it to one of my partners or one of my agents who will be
  responsible for that lead, and it will be visible in his system and
  counted as his lead, and he is the owner."
- Decision: assignLeadOwner(leadId, targetUserId, actor) sets
  Lead.ownerUserId and DERIVES Lead.ownerType from the target account's
  role (bsystems_agent → "agent", bsystems_partner → "partner",
  bsystems_sales → "internal"). Those two columns already are the
  system's answer to "whose lead is this": listOwnLeads scopes the
  agent/partner board by ownerUserId, requireLeadAccess gates by it, the
  owner buckets and filters read ownerType, the To-Do scope mirrors the
  guard, and the won-lead / commission surfaces key off the owner. So
  one write makes the lead appear on that person's board and count as
  theirs everywhere, with no per-surface changes.
  · ADMIN ONLY (requireBsAdmin, not requireLeadAccess): handing work to
    someone else is a management act. An agent must never be able to
    push their own lead onto a colleague, nor pull one to themselves.
  · Targets must be ACTIVE and APPROVED and hold an assignable role;
    admins are deliberately not offered — the admin bucket is where an
    unassigned lead sits, not a person's workload.
  · Lead.partnerId is NOT touched, and the code says so at the call
    site. It is the PP-5 referral ATTRIBUTION — which partner company
    introduced the lead — and SPEC §5.5 makes it permanent. Ownership
    (who works it, whose commission surfaces list it) and attribution
    (who brought it) are different facts; conflating them would
    silently rewrite the money trail. The lead detail now shows both:
    "Agents · Karim" beside "Partner: Referrer LLC".
  · The new owner is notified (Notification type "assigned",
    userId-addressed, deep-linked through Notification.leadId) inside
    the same transaction — the founder's "visible in his system".
  · UNDOABLE (ADR-045 kind "lead_assign"): the inverse is exactly the
    two ownership columns. Blocked on archived leads by the existing
    assertNotArchived guard.
- Alternatives considered: reusing Lead.partnerId as "the partner who
  owns it" — rejected, see above. A separate assignment table with
  history — rejected: ownership is a single current fact and the
  ActivityLog already records every handover ("assigned"). Letting the
  lead's own owner reassign it — rejected: that is delegation, and the
  founder framed this as the admin distributing work.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: assigning to a bsystems_sales account sets ownerType
  "internal" AND records ownerUserId, which internal-bucket views did
  not previously carry — harmless (they filter by ownerType) and it is
  what puts the person's name on the lead. getLeadDetail now includes
  the owner account so the detail can name the person.
- Status: Accepted

## ADR-048 — 2026-08-17 — The call sheet: a phone-first page behind a tel: link
- Context: founder — "when using the system from the phone there should
  be a button to call the lead instantly so it dials the lead. And
  whenever you dial, it opens the page where all the information of the
  lead is displayed — his name, his industry, the last update, the last
  comment, all of his story — the stage records, the details, all inside
  that page that pops up when we click dial, so I can talk with him on
  the phone and see everything."
- Decision: a real ROUTE, not a modal —
  /b-systems/crm/lead/[leadId]/call and
  /byteforce/leads/lead/[leadId]/call — both rendering the shared server
  component components/shared/CallSheet.tsx, guarded by
  requireLeadAccess (the URL is not a way around the walls; an agent
  opening a colleague's call sheet gets the 404 page).
  · The DIALER is opened by a plain `<a href="tel:…">`, never a script.
    That is what makes the founder's sentence literally true: the OS
    takes over, and returning from the call leaves the sheet exactly as
    it was, still scrolled where you left it. A modal would not survive
    the hand-off and could not be linked to from a board card.
  · The href is sanitised by lib/phone-dial.ts (leading "+" or "00"→"+",
    digits only); the number is DISPLAYED exactly as the team typed it.
    Deliberately separate from auth/phone.ts's normalizePhone, which
    produces a login identifier for a stored account — a lead's number
    is free text (landlines, extensions, foreign numbers) and must never
    be rewritten in the database.
  · Order is the order you need mid-call: a STICKY identity block (name,
    company, stage/flags, the big Call button, back-link) that stays a
    thumb away however far you scroll; then other contacts (the email as
    a mailto:), the essentials grid, the LATEST update, the chat, the
    negotiation notes, the full stage records, the full history.
  · Everything below the sticky block REUSES the lead detail's own
    renderers — GroupHistory, LeadChat, HistoryPanel, StageBadge, the
    .fields-grid — so the call sheet cannot drift from the lead page.
    "Latest update" is HistoryPanel over history.slice(0, 1): one
    renderer, one wording, no second implementation of "what happened".
  · Entry points: a "Call" button in the lead-detail header (both
    brands) and a "Call" chip on every board card. The card chip stops
    propagation on BOTH click and pointerdown, so it neither starts a
    drag nor triggers the card's whole-card navigation.
- Alternatives considered: a modal over the board — rejected: it cannot
  be deep-linked, and the founder wants the page still there after the
  call. Rendering the lead detail with a `?call=1` flag — rejected: the
  lead page is a two-column work surface built for a desktop; the call
  sheet is a single reading column with a sticky CTA, and mixing them
  would compromise both. A click-to-call integration (WhatsApp/VoIP) —
  out of scope; tel: is what "so it dials the lead" means on a phone.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: Lead carries exactly ONE number in the schema
  (alternativeNumbers exists only on PartnerProspect, §7.2/V2 §6), so
  "any alternative numbers" is served by the email as a mailto: line;
  giving a lead several numbers would be a schema addition — flagged for
  the founder. The chat on the call sheet is the FULL LeadChat
  (composer included), which is deliberate: a note taken during the call
  is the note most worth having.
- Status: Accepted

  ADDENDUM (brand-auditor, pre-commit): the board card's dial chip is
  OUTLINED in link ink, not filled with --color-accent. Accent is the
  Won cue in both brands (B-Systems Signal Pink; ByteForce orange IS
  --color-stage-won-accent), so filling a chip that appears on every
  card in every column would have destroyed that cue and blown SPEC
  §4.3's 12% share on the densest view in the product — and white on
  either accent measures ~3.1–3.3:1 at 10px against AA's 4.5:1. The
  lead-detail Call button is --color-primary for the same reason: it is
  the page's one true action, and "Ready to close" already owns the
  page's pink. The displayed number carries direction: ltr +
  unicode-bidi: isolate (and dir="ltr"): a "+20 100 …" run reorders
  under RTL otherwise, and on this page the number IS the content.

## ADR-049 — 2026-08-17 — Permanent user deletion: destroy the login, preserve the business record
- Context: founder — "give me the ability to completely delete a user,
  not just deactivate it." V2 §11 already had a REVERSIBLE deactivate
  (Remove / Reactivate); the ask is a genuine hard delete. The schema
  was audited FIRST: every reference to User was enumerated with its
  actual ON DELETE clause before a line was written.
- Decision: deleteUser(userId, actor) — admin only (DELETE
  /api/b-systems/users/[id] behind requireBsAdmin), one transaction, and
  an EXPLICIT fate for every reference rather than whatever the FK
  happens to do:
  · owned LEADS — KEPT. ownerUserId → null, ownerType → "admin" (the
    unassigned bucket), one ActivityLog row per lead (trigger
    "owner_deleted"). The pipeline belongs to the company, not to the
    person; the FK's SET NULL alone would have left them in a dead
    "agent" bucket that no board renders.
  · agent profile (PortalRep) — DELETED (cascades from User); its CV
    Attachment is deleted FIRST and the stored FILE removed, because
    Attachment.portalRepId is SET NULL and would otherwise leave an
    orphan row and a stray file on disk for ever.
  · FollowUp.ownerPortalRepId — SET NULL by the FK; the follow-up
    survives its owner.
  · Partner.userId — NULLED. The partner COMPANY, its prospect, its
    referred leads and its commissions survive; only the login goes.
  · Statement.closerUserId — NULLED (there is no FK; it is a plain
    column). closerLabel is denormalised, so the MONEY TRAIL KEEPS THE
    NAME — a paid statement must never become anonymous.
  · LeadComment.authorUserId — SET NULL by the FK; authorLabel carries
    the name, exactly like the activity log.
  · Notification, UserRole — CASCADE.
  · UndoEntry — DELETED (no FK): their pending inverses die with the
    account.
  · ActivityLog — KEPT, UNTOUCHED. actorLabel is denormalised history;
    deleting the actor must not rewrite what happened.
  Guards: never yourself ("You cannot delete your own account"); never
  the pinned bootstrap admin admin@byteforce.com (bootstrap.ts recreates
  it on the next sign-in, so deleting it is meaningless). Anything this
  policy has NOT released raises a foreign-key error on the final
  user.delete, which aborts the whole transaction and REFUSES with
  "still referenced by records that cannot be released — deactivate it
  instead": nothing is ever half-deleted.
  NOT UNDOABLE, like every destructive path (ADR-045): it retires the
  acting admin's pending entries so the Undo button never offers
  something older instead. The deletion is itself activity-logged
  (entityType "user", trigger "user_deleted").
  UI: a "Delete" button beside the reversible "Remove", opening a
  two-step confirm that NAMES the person, lists what is kept and what is
  destroyed, says it cannot be undone, and points at Remove for anyone
  who only wants to block access. It is hidden for yourself and for the
  bootstrap admin (the server enforces both anyway).
- Alternatives considered: cascading the leads with the user — rejected
  outright: it would delete the company's pipeline to remove one login.
  Anonymising instead of deleting ("Deleted user" placeholder account) —
  rejected: the founder asked for the account to be GONE, and the
  denormalised labels already give history a readable actor. Deleting
  the ActivityLog rows — rejected: an audit trail that can be erased by
  deleting its actor is not an audit trail. Making it undoable —
  rejected: consistent with ADR-045, deletions are not undoable because
  the data is gone.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: a deleted agent's leads land in the ADMIN bucket, not
  back with whoever referred them — the admin redistributes them with
  the new "Assign owner" control (ADR-047), which is the intended pair.
  Statements keep paying out under a name with no account, which is
  correct: the obligation outlives the login. Deactivate remains the
  right tool for "block access, keep everything", and the confirm dialog
  says so.
- Status: Accepted

## ADR-050 — 2026-08-17 — Partners & Agents: one board, two card kinds, two Won gates

- Context: the founder — "I want the CRM of the partners to be the CRM of
  the partners and agents. So whenever I'm adding someone into the CRM,
  it could be a partner or an agent, each one with their specific
  fields, but they all appear as cards in the CRM so I can follow up
  with the partners and the agents at the same time. Whenever someone is
  applying and is waiting in the registration, they will be just waiting
  in the registration — they will not appear in the CRM. The agents that
  appear in the CRM are the ones I put. And once I put them Won, I have
  to create for them a user and a password — they will not apply, I will
  create for them a user and a password. And the partners as it is.
  We're just adding the agents." Clarified the same day: "the fields of
  adding an agent is the fields when he applies by himself."
  Until now the §7.2 board carried exactly one thing — a partner company
  on its way into the directory. Agents arrived only through the public
  signup form and the Registrations queue, so an agent the founder was
  courting had nowhere to live: no card, no follow-ups, no meetings, no
  cold-call recording, no pipeline at all.
- Decision: ONE board, TWO kinds of card, and the pipeline itself does
  not change. `PartnerProspect.kind` is "partner" | "agent" (default
  "partner", so every existing row keeps its meaning and its data).
  1. FIELDS ARE KIND-CONDITIONAL, IN ZOD, NOT IN THE DATABASE.
     companyName and businessActivity became NULLABLE and `address` +
     `speciality` were added, because one table now holds two shapes.
     Requiredness lives in `createProspectSchema`'s superRefine and in
     one shared `kindIssues()` helper the edit path re-runs, and the two
     kinds are DELIBERATELY ASYMMETRIC:
     · partner ⇒ companyName + businessActivity, exactly as before
       ("and the partners as it is" — not relaxed);
     · agent ⇒ NOTHING beyond the base name + number. Founder: "the CV
       should be optional. Everything is optional other than the name
       and the number... just to not confuse this one." The number, as
       one of the two mandatory fields, is held to the signup form's
       `isValidPhone` rule.
     Only the columns belonging to the card's kind are ever written; the
     other set stays null whatever the payload says. A future reader
     should not "fix" the asymmetry into symmetry — it is the founder's.
  2. THE AGENT FIELD SET IS THE SIGNUP FORM'S, not a set we designed —
     first name, last name, phone, email, address, speciality, CV —
     reusing dict/auth's `fields` and `signup` Msgs so the CRM form and
     the public form cannot drift apart. The same field SET, a laxer
     rule about which are required: the admin is usually opening the
     card mid-phone-call. Minus the password: at signup the applicant
     sets their own; here the ADMIN sets it at the Won gate, which is
     the founder's whole point.
     THE STRICTNESS MOVES TO THE GATE, which is what this pipeline's
     gates are for (PP-4 already blocks until the partner record is
     complete). `wonAgentSchema` requires firstName, lastName, address,
     speciality, email, password and phone — prefilled from the card
     where it has them, typed in at the gate where it does not. That is
     not merely tidy: `PortalRep.address` and `.speciality` are NOT NULL
     columns, so the gate is the last honest place to insist. Every
     message names its own field (and uses Zod's `error` option, not
     just `min`, so a MISSING field reads the same as an empty one
     instead of "expected string, received undefined").
  3. THE KIND IS CHOSEN ONCE AND IS IMMUTABLE. `updateProspectSchema`
     does not contain `kind` at all, and `updateProspect` re-validates
     against the STORED kind and writes only that kind's columns. The
     Won gate's behaviour hangs off the kind, so a card that could
     switch mid-pipeline could convert into the wrong thing.
  4. THE ENGINE IS PARAMETERIZED, NOT FORKED. `partnersConfigFor(kind)`
     returns the one partners config with the Won gate swapped:
     `won_partner`/`create_partner` or `won_agent`/`create_agent`.
     Stages, next actions, drag rules, same-stage records, PP-1/PP-2's
     numbers flow and every stage form are literally the same code, so
     an agent card follows up, misses calls, returns to Lead on a new
     number, meets, is lost — all of it — exactly like a partner card.
  5. PP-4a, THE AGENT WON GATE, MINTS THE WHOLE ACCOUNT IN ONE
     TRANSACTION: User (email + normalized phone, hashed password AND
     the `passwordPlain` admin-visibility copy, `active: true`,
     `registrationStatus: "approved"`), the `bsystems_agent` UserRole,
     and the PortalRep profile — the same three writes `signupRep`
     makes, minus the waiting. Approved from birth is the founder's rule
     stated positively: the admin created them, so there is nothing to
     approve. Duplicate email or phone is refused with the signup path's
     own message and nothing is written.
  6. THE CV SURVIVES THE JOURNEY. The card owns it as an Attachment of
     kind "cv" (the prospect's attachment relation is filtered by kind
     everywhere, so it never appears in the cold-call recordings
     player), optional at creation and addable later. At the gate it is
     RE-PARENTED onto the created PortalRep — moved, not copied — so the
     file is neither duplicated nor orphaned and the agent's profile
     shows exactly what a self-applied agent's would. It is optional
     EVERYWHERE — card and gate alike: an agent converted without one
     simply has no CV yet and can upload it from their own profile.
     Neither dropzone marks its input `required`, because the design
     system stars any required dropzone in accent and a star on
     "optional" copy contradicts itself.
  7. REGISTRATIONS AND THE BOARD STAY DISJOINT. No code path links a
     signup to a prospect; a signup still creates a pending user visible
     only in Registrations, and a test asserts it creates no card.
  8. THE SECTION IS RENAMED "Partners & Agents" / "الشركاء والوكلاء" —
     nav, eyebrow, h1, page titles, edit-modal eyebrow, the add button
     ("Add partner or agent"), the save button ("Save card") and the two
     To-Do row labels. This is a founder-directed English rename, so it
     is the ONE sanctioned exception to the byte-identical-EN rule
     (ADR-037); every e2e assertion that read the old wording was
     updated in the same commit. The ROUTE /b-systems/partners-pipeline
     is deliberately unchanged: no dead links, no redirects to maintain.
- Alternatives considered: a SECOND board/table for agents — rejected,
  it is the exact opposite of "they all appear as cards in the CRM so I
  can follow up with the partners and the agents at the same time", and
  it would have duplicated the whole pipeline. Making the agent columns
  NOT NULL with a discriminator per table (table-per-kind) — rejected:
  the shared pipeline is the feature, and every child record
  (FollowUp/Meeting/LostInfo/Attachment) already points at
  PartnerProspect. Enforcing requiredness in the DB with CHECK
  constraints — rejected: Prisma cannot express it and the error would
  reach the user as a constraint violation instead of a field message.
  Letting the kind be edited — rejected, see (3). Creating the agent
  account at CARD creation instead of at Won — rejected: it would put a
  live login in the world for someone who is still a prospect, and the
  founder tied the account explicitly to "once I put them Won".
  Auto-generating the agent's password — rejected: the founder says "I
  will create for them a user and a password", and the partner gate
  already works that way (ADR-034's supersession of the V2 §8 auto
  password). Splitting the card's single `name` into firstName/lastName
  COLUMNS — rejected as two columns earning nothing: the gate prefills
  from a first-space split and the admin confirms or corrects it before
  the profile is written.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: `PartnerProspect.agentUserId` is a new optional FK to
  User with ON DELETE SET NULL, so an agent whose account is hard-
  deleted (ADR-049) leaves the card converted with no account — the same
  policy Partner.userId already has. `deleteProspect` deletes an
  unconverted agent card's CV file with it, but a CONVERTED agent's CV
  has already moved to their profile and is untouched, which is right:
  the account outlives the card. The partners board has no FilterPanel
  today, so there is no Kind filter — the chip on every card plus the
  `data-kind` attribute carry the distinction; adding a filter later is
  the CRM board's existing searchParams pattern. `listAgentsDetailed()`
  is an unfiltered PortalRep query, so a converted agent appears in the
  Agents section with no change at all — and, since no Partner row is
  created, never in the Partners directory.
  brand-auditor on the diff returned FAIL and every finding was fixed
  before the commit. Two were real defects: the CV dropzone marked its
  input `required` while its own copy said "optional", firing the design
  system's accent required-star on a contradiction; and an agent card's
  subtitle is a PHONE NUMBER while the converted-agent line ends in an
  EMAIL — both Latin runs inside RTL prose with no isolation, the defect
  ADR-048 found on the call sheet. The fix generalises that one: a
  `.u-ltr { direction: ltr; unicode-bidi: isolate }` utility now carries
  every number and address on these pages (including the "·"-joined
  number lists, isolated per item rather than as one block), and
  `pProspect.agentAccountCreated` deliberately ENDS before the email
  instead of interpolating it — `formatMsg` is a plain substitution and
  cannot isolate what it inserts. The rest were reuse corrections: the
  kind chip now uses the board's own `.bcard-chips` + `.bcard-tag` (10px,
  in scale with every other chip on a card) instead of a hand-rolled
  flex row and the 12px table chip; the edit modal and the detail h1 use
  `badge badge--entity`, already the "what kind of record is this" badge
  in Registrations and Users; and `pCommon.address` / `pCommon.email` /
  `pPanel.password` — byte-identical clones of dict/auth's own labels,
  which this work put side by side in a single file — were deleted in
  favour of the auth dict. `nav.partnersAndAgents` now REFERENCES
  `pPipeline.title` rather than restating it, so the nav item and the
  page heading cannot disagree.
- Status: Accepted

## ADR-051 — 2026-08-17 — The data-entry role: two create permissions, no ownership

- Context: the founder — "I want to add a type of user called data entry.
  This user is just able to add leads or partners or agents. They can add
  in the CRMs — either the CRM of the partners or the CRM of the leads.
  They are just adding, and they will not be the owner of what they add.
  It will be with no owner until the admin decides which owner is these
  leads. But they are just adding leads." Every existing role owns
  something: admins own the company's pipeline, sales own the internal
  bucket, agents and partners own their own leads. This one owns nothing
  by design, which is a shape the system had no room for.
- Decision: `bsystems_data_entry`, a least-privilege role enforced
  SERVER-SIDE, never by a hidden button.
  1. THE PERMISSION SET IS TWO CREATE ACTIONS. `POST
     /api/b-systems/leads` and `POST /api/b-systems/partners-pipeline`
     (plus that card's CV upload, because the CV is part of adding an
     agent). Nothing else. The wall is built by CONSTRUCTION rather than
     by enumeration: every other B-Systems endpoint already names the
     roles it accepts, and none of them names this one, so a new
     endpoint written tomorrow refuses it by default. Only two guards
     mention it — `requireProspectCreator` (admin or data entry) and the
     lead-create route's list — and both are named for the ACT, not the
     role.
  2. OWNERSHIP USES THE STATE THAT ALREADY MEANT THIS. `bucketFor`
     returns `{ ownerType: "internal", owned: false }` and the route
     also strips any `salesRepId`, so the lead lands exactly where A-6's
     "unassigned" has always lived: internal bucket, no rep, no owner
     account. No new state, no new column, no new enum value. The admin
     hands it on with ADR-047's "Assign owner", which is the pair.
     A data-entry account is never itself assignable — `ownerTypeForRole`
     returns null for it and `listAssignableOwners` does not select it.
  3. THE QUEUE IS FINDABLE. A lead nobody owns is invisible in a
     board built around owner buckets, so the Leads sidebar (and the CRM
     board's matching control) gains an "Unassigned" owner choice —
     `{ ownerType: "internal", salesRepId: null, ownerUserId: null }`,
     special-cased in `listBsLeads` because it is the ABSENCE of an
     owner inside a bucket, not a bucket. And every entered lead
     broadcasts a `needs_owner` notification to the admins ("New lead
     added by X — needs an owner"), deep-linked through the existing
     `Notification.leadId`, exactly like the ready-to-close flag.
  4. WHO TYPED IT IN IS NOT WHO OWNS IT. `Lead.createdByUserId` and
     `PartnerProspect.createdByUserId` are new nullable FKs (SET NULL),
     stamped by `createLead`/`createProspect` on EVERY path — it is
     useful audit data whoever entered the record, and making it
     universal means the data-entry view is a query, not a special case.
     They are declared as real RELATIONS, not bare String ids, because
     IMPLEMENTATION.md's ADR-049 lesson is that a `userId` column
     without a relation is invisible to cascade planning.
  5. THEIR OWN PAGE, AND ONLY IT. `/b-systems/entry`: the two Add
     buttons and a read-only list of what THEY entered, with each row's
     state named from their point of view ("Waiting for an owner" /
     "Picked up"). Their nav has exactly one item, which is the honest
     picture of the permission set.
  6. THEY MAY CORRECT WHAT THEY TYPED, BRIEFLY. Fixing a typo a minute
     later is the same act as typing it; editing after someone has
     picked the record up is not. So `assertCanCorrect` allows a PATCH
     only when the row was created by this user AND is structurally
     untouched — a lead still in `new` with no owner, no rep and not
     archived; a card still in `lead` and not converted. Defined
     structurally, never by a clock. NEEDS FOUNDER CONFIRMATION.
  7. THE ONE-STEP UNDO STAYS, AND IS ALREADY BOUNDED. ADR-045's undo is
     personal (only its author may apply it) and `lead_create` only ever
     deletes a lead that still has NO child records — so a data-entry
     user can retract a lead they just typed by mistake, and can do
     nothing else with it. That is deliberately not the same permission
     as DELETE, which they are refused: undo retracts your own last
     keystroke, deletion removes the company's record. `createProspect`
     records no undo entry at all, so cards are not retractable this way.
  8. SIGNED-IN USERS NO LONGER BOUNCE TO THE SIGN-IN FORM.
     `requirePageRole` used to redirect any failure to `/login`. With a
     role that has one page, every other B-Systems URL would have looked
     like an expired session, so it now sends an AUTHENTICATED user to
     their own landing (`landingFor`, lifted out of the sign-in action
     into `lib/auth/landing.ts` so guards can share it) and keeps
     `/login` for genuinely unauthenticated requests.
- Alternatives considered: a new owner bucket or a "pending assignment"
  flag — rejected, A-6's unassigned state already means exactly this and
  a second way to say it would have to be taught to every filter, badge
  and metric. Giving them `bsystems_sales` with a narrower UI — rejected
  outright: that is hidden-button security, and sales own the internal
  bucket. Letting them see the boards read-only — rejected: the founder
  said "just adding", and read access to other people's leads is the
  thing least-privilege exists to prevent. Making the correction window
  time-based (e.g. ten minutes, like undo) — rejected: a clock says
  nothing about whether a colleague has started working the lead, while
  "still in intake, still unowned" says exactly that. Auto-assigning
  entered leads round-robin — rejected: "the admin decides which owner
  is these leads" is the requirement.
- Resolves: — (founder directive; no SPEC §11 A-#)
- Consequences: the role is scoped to B-SYSTEMS only, because the
  founder named "the CRM of the partners or the CRM of the leads", both
  of which are B-Systems; whether data entry should also add ByteForce
  leads NEEDS FOUNDER CONFIRMATION (`staffRolesForBrand` deliberately
  does not include it, so today the ByteForce API refuses it). A
  data-entry user has no notifications of their own and no access to the
  notifications endpoint, so the shell's bell is not rendered for them.
  Deleting a data-entry account leaves every lead and card they entered
  intact with `createdByUserId` nulled — the record is the company's,
  the same principle ADR-049 applied to owned leads.
  brand-auditor on the diff returned FAIL and every finding was fixed
  before the commit. The sharpest one was a permission that existed on
  the server and nowhere in the UI: `assertCanCorrect` grants the
  correction right to CARDS as well as leads, and `CorrectEntryButtons`
  already had the branch, but the cards table never rendered the button
  — a live capability sitting behind dead UI. It renders now (and the
  modal drops the company field for an agent card, which has none). It
  also caught a `card card-pad` wrapper around a form that renders its
  own card (both Add actions now sit in `.page-actions`, as they do on
  every other page), three column labels re-declared byte-for-byte
  instead of reusing dict/crm's `common` — including in the modal that
  edits those very cells — an Arabic drift between the nav item and the
  page heading (`nav.dataEntry` now REFERENCES `entryPage.title`, the
  same fix ADR-050 made for Partners & Agents), an unused string, a
  one-word CTA, and the phone/email INPUTS lacking the `dir="ltr"` their
  read-only cells already had.
- Status: Accepted

## ADR-052 — 2026-08-17 — Accounting module: rebuild-on-top architecture

- Context: the founder approved docs/INTEGRATION-PLAN.md with decisions
  §7.1–§7.8 — build BOTH satellite apps natively on the CRM stack, port
  nothing; admin-only; fresh start with a one-time upload of the old
  accounting app's own JSON export (no code ever reads Cloudflare KV);
  B-Systems keeps hiding Media Buying; client linking deferred to a new
  Phase 7; the CRM's current design system is the model. The reference
  SPA (D:\CRM\Accounting\public\index.html, gitignored) is the complete
  spec: its pure functions ARE the business rules and its migrate()
  function is an executable schema.
- Decision: eleven `Acct*` Prisma models (AcctIncome, AcctExpense,
  AcctRosterMember, AcctRosterSegment, AcctPayrollPayment,
  AcctTreasuryMove, AcctLoan, AcctLoanPayment, AcctMediaEntry,
  AcctTarget, AcctSettings), every row tagged `company`
  ("byteforce" | "bsystems", the existing Brand union — company is a
  FILTER on one admin screen set, not a tenant), registered in backup
  MODELS + resetDb() in the same commit as the migration. A pure,
  framework-free engine (src/lib/accounting/engine.ts) re-implements the
  SPA's arithmetic at Int piaster scale with "now" as an explicit
  parameter; src/lib/accounting/books.ts is the single DB→engine bridge;
  src/lib/accounting/import.ts accepts the SPA's own export (single
  company or the two-company "Export ALL" wrapper) behind admin-only
  POST /api/b-systems/accounting/import. The judgement calls, each
  mirroring the SPA rather than inventing:
  1. MONTHS AND DATES ARE STRINGS ("YYYY-MM", "YYYY-MM-DD"), not
     DateTime. The whole engine is lexicographic month arithmetic over
     calendar facts; instants would re-introduce timezone day-shift for
     zero gain. The wall clock enters only via cairoMonth()/cairoToday()
     (Africa/Cairo, SPEC §2).
  2. PAYROLL IS DERIVED, NEVER MATERIALISED. Only roster segments and
     approval marks (AcctPayrollPayment = the SPA's payrollPaid map as
     rows) persist; the engine re-derives salary rows every read, so the
     importer cannot under-count (the plan's ETL trap §5.3). A manual
     payroll expense LINKED via rosterId replaces that person's derived
     row for its month; unlinked rows add on top.
  3. MONEY IS INT PIASTERS (×100 on import — lossless; ADR-018), with
     the 50-piaster loan-settlement epsilon (the SPA's 0.5 EGP).
  4. THE IMPORTER MIRRORS migrate()'s TOLERANCE in Zod: collections
     coerced to arrays, pre-approval expenses become Paid, no-`since`
     members start this month, one target per period. Old uid() ids are
     re-minted as cuids with rosterId / payrollPaid-key / mediaRef
     REMAPPED through an id table; orphan references are dropped
     (arithmetically neutral in the SPA — nothing resolves them).
     Import REPLACES one company's books in ONE transaction
     (re-import = idempotent), writes an acct_books/import ActivityLog
     row, and consumes pending undo entries (money is never undoable,
     ADR-045). It returns the engine's derived reconciliation numbers
     (treasury now, month net, A/R, A/P, committed salary) for the
     founder's side-by-side check against the old dashboard.
  5. SPA-REVEALED FIELDS KEPT: expense `deduction`/`bonus` (read by
     expenseAmount(): payroll net = amount − deduction + bonus) exist in
     legacy data though the current form never writes them — carried as
     nullable columns. income.mediaRef → AcctIncome.mediaEntryId, a real
     relation (SET NULL), per the ADR-049 lesson on bare-id columns; so
     is AcctExpense.rosterId.
  6. UNKNOWN type strings survive import unvalidated (the SPA displays
     `MAP[t] || t`); the unions in src/lib/accounting/constants.ts
     constrain NEW rows (Zod at the routes), not history.
  7. LOG VOCABULARY extended add-only: acct_* entity types plus
     delete / approve / unapprove / import actions.
  8. tsconfig.json now EXCLUDES the two gitignored reference folders
     ("Data Managment System", "Accounting") — they are archives to
     rebuild from (§7.1), and sweeping them broke `tsc --noEmit` with
     ~484 alien errors from a different stack.
- Alternatives considered: DateTime columns (rejected — day-shift risk,
  see 1); materialising payroll rows on import (rejected — the plan
  names it the canonical ETL trap); per-company schemas or a tenant
  column set (rejected — founder folded both companies into one admin
  screen with a filter); Decimal money (rejected — ADR-018 piasters);
  validating type enums strictly on import (rejected — the export is
  history, not input).
- Resolves: INTEGRATION-PLAN Phases 1–2; founder decisions §7.1, §7.3,
  §7.4, §7.5, §7.8 cited above.
- Consequences: Phase 2 builds the eleven screens over this engine;
  Phase 3 (cutover) is a founder-run import + reconciliation; Phase 7
  will link client names to CRM Client records (kept free-text now).
  B-Systems media hiding is enforced in the UI/nav and route validation;
  imported B-Systems media rows (should any exist) still compute.
- Status: Accepted

## ADR-053 — 2026-08-18 — Data Vault module: rebuild-on-top architecture

- Context: INTEGRATION-PLAN Phases 4–5 under the founder's §7 decisions —
  rebuild the Vault app natively on the CRM stack, port NOTHING (the old
  codebase at "Data Managment System/" is reference/spec only); no S3
  anywhere — files ride the CRM storage abstraction + Attachment rows;
  ADMIN-ONLY (employees are assignee cards, never logins); start fresh;
  no reminder emails; the CRM design system is the model. The reference
  app's SPEC.md, schema.prisma and server modules (forms, sheets,
  documents, tasks/complete/lateness, archive, search, files) define the
  business rules re-implemented here.
- Decision: five `Vault*` Prisma models (VaultEmployee, VaultForm,
  VaultSheet, VaultDocument, VaultTask) + three vault FK columns on the
  shared Attachment model, registered in backup MODELS and resetDb() in
  the same commit as the migration. Services in src/lib/services/vault/*
  (constants, common, lateness, row-count, archive, employees, forms,
  sheets, documents, tasks, search), every mutation writing ActivityLog
  inside its own transaction. The judgement calls, each mirroring the
  reference or an existing house ADR rather than inventing:
  1. CALENDAR FACTS ARE "YYYY-MM-DD" STRINGS (deadline, sheet
     dateCreated, count as-of) — the ADR-052 §1 precedent. The reference
     used @db.Date columns for the same reason; strings keep the
     lateness rule pure day arithmetic on Cairo calendar dates with no
     timezone day-shift class of bug. computeLateness mirrors the
     reference lateness.ts exactly (late = completed after 23:59:59
     Cairo on the deadline date; deadline-day completion is ON TIME —
     the generous reading, since this is a performance record).
  2. EMPLOYEES ARE CARDS: name/title/company/active only. The reference
     Employee's email was its login + invitation identity — auth-adjacent
     — so it is DELETED with the rest of the auth layer, not carried.
     Cards deactivate (reference BR-13), never delete; deactivated cards
     take no new tasks but keep their history and frozen lateness.
  3. FILES: REPLACE = APPEND. The reference kept a StoredFile version
     chain (version int + replacesId). Here the vault FKs on Attachment
     are deliberately NON-unique: replacing a sheet/document file
     appends a new Attachment row, newest = current, predecessors stay
     servable through /api/files (which already refuses non-admins for
     unknown kinds by its default branch). Version history for free,
     and never-delete now covers the files themselves.
  4. TASK RESULT LINKS are a JSON-array column (resultLinks, house
     precedent: nonAnsweringNumbers/mentions) instead of a second
     attachment table; result FILES are Attachment rows (vault_attachment).
     The RESULT GATE re-checks inside the completion transaction: text
     OR ≥1 file OR ≥1 link, else 422 and nothing commits. completeVaultTask
     is the only path that sets status "completed"; lateness is computed
     there once and FROZEN (no recompute call exists anywhere — deadline
     edits never touch it). Reopen clears the trio, keeps the result, and
     logs the erased values in the trigger (provenance).
  5. SNIFFING UPGRADE, PLATFORM-WIDE: the reference's stronger content
     inspection is ported into storage sniffOk — OOXML ZIP discrimination
     ([Content_Types].xml + word//xl//ppt/ prefix, read uncompressed —
     no bomb surface), full 8-byte CFB signature for xls/doc, and a
     CSV/TXT text sniff (no NUL, no control soup, consistent delimiter).
     This CLOSED the pre-existing hole where any ZIP renamed .docx
     passed the cv rule on a bare "PK" check; the existing fixture test
     was updated to prove both directions.
  6. ROW COUNTING: CSV is auto-counted (the reference's RFC-4180 parse +
     header heuristic A-1 ported verbatim, pure code); XLSX/XLS are
     stored but NOT auto-counted — the reference used exceljs, and a new
     spreadsheet dependency is not worth an ADR-gated stack deviation
     for a nice-to-have. Those sheets keep the manual count with a
     REQUIRED as-of date (reference BR-03) — the exact path the
     reference itself used for legacy .xls (its DV-05). Revisit if the
     founder wants auto-counted XLSX.
  7. UNDO: one new kind, vault_archive — archive/restore of the four
     entity kinds are the vault's SAFE mutations and are undoable
     (snapshot-inverse {archived, archivedAt}; UndoEntry.entityType
     widened to the vault types; performUndo grew a generic vault
     branch with the same fingerprint discipline). Every OTHER vault
     mutation invalidates pending undo entries; task COMPLETION is
     explicitly NOT undoable — it freezes a lateness record, and reopen
     is the audited way back.
  8. LOG VOCABULARY extended add-only: vault_* entity types + archive /
     restore / complete / reopen / replace_file actions (archive verbs
     become first-class; leads keep their historical update+trigger
     encoding untouched).
  9. DUPLICATE-URL HANDSHAKE (reference FR-F08 "warn, never block") is
     an HTTP 409 naming the clashing form; the client re-submits with
     acknowledgeDuplicate=true to file it anyway. Archived forms do not
     clash.
  10. XOR (reference BR-02): sheet link-vs-file is a Zod discriminated
     union at the boundary AND a service assertion against the FINAL row
     state (422). Uploading a file to a linked sheet flips it to file
     mode and clears the url, keeping the invariant.
  11. NO PAGINATION on the vault lists this phase (fresh start, founder
     re-enters data; the reference paginated at 50/page for its 2,000-row
     NFR) — filters + DB-side search only. Flagged for revisit when
     tables grow.
  12. BACKUP: the five models joined MODELS (before attachment, FK-safe)
     and resetDb(); the pre-existing undoEntry OMISSION from MODELS —
     the exact silent-failure INTEGRATION-PLAN §5.5 warns about — was
     fixed in the same commit.
- Alternatives considered: porting the reference services (rejected —
  founder §7.1 binds to rebuild); a StoredFile-style version table
  (rejected — append-only Attachment rows give the same history with no
  new model); exceljs for XLSX counts (rejected this phase, see 6);
  DateTime deadline (rejected — day-shift, see 1); making completion
  undoable (rejected — it would silently erase a frozen performance
  record; reopen exists and is logged); per-entity createdBy columns
  (rejected — admin-only module, ActivityLog already carries the actor
  on every mutation).
- Resolves: INTEGRATION-PLAN Phases 4–5 (Phase 4 this commit; Phase 5
  the next); founder decisions §7.1–§7.4, §7.7, §7.8.
- Consequences: Phase 5 builds the vault screens over these services;
  employee self-service (if ever wanted) is a new role touching
  proxy.ts/landing/NAV per the plan's §6.1 warning; Phase 6 decommission
  of the port-3001 app happens founder-side (fresh start = no data
  migration).
- Status: Accepted

## ADR-054 — 2026-08-18 — Accounting & Vault as switcher modules, per-company brand, module import/export

- Context: four founder directives amending the ADR-052/053 integration:
  (A) "The data vault or the accounting are not pages — they should be
  treated as MODULES: like when we switch from B-Systems CRM to
  ByteForce's CRM, we can switch to Accounting (which includes both
  companies' accounting) and we can switch to Data Vault." (B) each
  module gets its own IMPORT and EXPORT button; (C) exports must match
  the ORIGINAL apps' behaviour — accounting emits the reference SPA's
  exact JSON shapes so files round-trip between old and new systems in
  both directions; (D) "ByteForce accounting with ByteForce branding,
  and B-Systems accounting with its branding as well." Plus one design
  amendment (founder, with a screenshot of the SPA's dashboard): "I
  like this dashboard design, so keep it from the original" — the
  accounting DASHBOARD keeps the original app's design language; the
  rest of the module stays on the CRM design system (§7.8 amended for
  that one screen). Delivered as three local commits.
- Decision:
  1. MODULES AT THE SWITCHER (commit 1). Two new top-level route groups
     — src/app/(accounting)/accounting/** and src/app/(vault)/vault/**
     — each with its own <html> root layout (both brands' font stacks;
     vault also loads the neutral scope) and its own app shell built
     from the SAME chrome components (app-header, ShellNav via the new
     AcctModuleNav / VaultModuleNav client wrappers, LanguageToggle,
     user cluster, logout, UndoControl; deliberately no notifications
     bell — the bell belongs to the CRM pipelines). EntitySwitch is now
     the four-segment MODULE switcher — BYTEFORCE | B-SYSTEMS |
     ACCOUNTING | VAULT — with the module segments rendered ONLY for
     bsystems_admin; every non-admin sees exactly what it saw before
     (a lone segment still renders nothing). proxy.ts gates /accounting
     and /vault to bsystems_admin (matcher extended); requireBsAdminPage
     in each shell + every page stays the real wall. APIs moved to
     /api/accounting/** and /api/vault/** (requireBsAdmin unchanged).
     The two items left the bsystems_admin NAV. The in-page tab strips
     (AcctNav/VaultNav) were RETIRED — the module's sections live in
     its shell header like every other app's; AcctModuleNav carries the
     ?company=&month= view on every link (client component — layouts
     cannot read searchParams) and still hides Media Buying under
     company=bsystems (founder decision §7.5). ShellNav learned to
     match active state on the PATH of a query-carrying href (not a
     fork — five lines in place).
  2. PER-COMPANY BRAND INSIDE THE MODULES (commit 2, directive D). The
     token scopes changed from `:root[data-brand=…]` to `[data-brand=…]`
     (branding/*/tokens.css, src/themes/neutral.css): custom properties
     re-resolve per element, so the NEAREST [data-brand] ancestor wins
     and a nested div can re-brand a subtree. The new ModuleBrandScope
     client component reads ?company= and stamps the brand on a div
     wrapping the ENTIRE shell (header + main + undo), re-applying the
     surface/ink/body-font utilities body normally carries. Accounting:
     byteforce (default — the SPA's default tenant) | bsystems. Vault:
     the company FILTER byteforce | bsystems dresses the module in that
     company's full brand; no filter ("all") wears the NEUTRAL scope —
     no single company may claim the all-companies view. ModuleLogo
     renders the active company's REAL mark (neutral: the platform's
     two-mark home lockup) beside the module wordmark. VaultModuleNav
     preserves ?company= across sections so the brand survives
     navigation.
  3. THE DASHBOARD DESIGN EXCEPTION (commit 2). One screen — the
     accounting dashboard — keeps the reference SPA's design: the
     full-width gradient hero (treasury balance · now, the corner
     geometry as an inline currentColor SVG) and the KPI cards with a
     3px inline-start accent edge, uppercase labels and COLORED figures
     (.acct-hero / .acct-kpi* in design-system.css, token-driven, so
     the company switch restyles it; logical properties — the accent
     edge flips under RTL). Token consequences, in-palette and minimal:
     · ByteForce --gradient-hero is no longer `none` — the founder's
       screenshot sanctions the SPA's orange→violet banner
       (100deg, --bf-orange → --bf-grad-mid #A24966 → --bf-violet) as
       ByteForce's hero-moments gradient. Its only consumers under the
       byteforce scope today are the accounting hero and the target
       meter's under-goal fill (the SPA's own progressfill behaviour).
     · --color-warning #B8860B joined BOTH brand files + neutral — a
       FUNCTIONAL amber, uniform across brands exactly like the
       ADR-014 danger red (the SPA used this same amber in both
       tenants). ADR-019 token parity holds (test green).
     · The KPI label keeps the SPA's sans (700 uppercase --font-body), a
       documented deviation from the mono .tile-label precedent — it is part
       of the kept design. The brand-colored page eyebrow (SPA style) renders
       Signal Pink under the B-Systems company — a multi-word pink run the
       B-Systems rules normally forbid; kept because the SPA's own bsystems
       tenant did exactly this, FLAGGED for founder confirmation in PROGRESS.
     · Figure tones map the SPA's semantics onto tokens, not hexes:
       income/owed-to-us → success (violet/indigo — the no-green
       rulings stand), expenses/A-P/negative-net → danger, on-hold/
       A-R/salary/clients-owe → warning, positive net → --color-link
       (which IS the brands' violet #53449B / indigo #1D267D pair, the
       SPA's C.violet per tenant), zero balances → muted.
  4. MODULE IMPORT/EXPORT (commit 3, directives B + C).
     · ACCOUNTING EXPORT (src/lib/accounting/export.ts + GET
       /api/accounting/export): emits the SPA's EXACT shapes — the
       single-company migrate() state document and the two-company
       "Export ALL" wrapper — with money as EGP numbers (piasters ÷100,
       lossless), optional fields omitted-when-null exactly as the
       SPA's own rows carry them, explicit nulls kept on collectedDate/
       paidMonth/paidDate, roster members carrying the legacy top-level
       salary/active pair (earliest segment — creation-time semantics),
       payrollPaid keyed "YYYY-MM:memberId" against ids in the same
       file, and the SPA's own filenames ({company}-accounting-
       {YYYY-MM-DD}.json / all-companies-{YYYY-MM-DD}.json, Cairo
       today). Ids are our cuids — the SPA treats ids as opaque
       strings, and every in-file reference resolves. Round-trip proof
       in vitest (export.integration.test.ts): old-file → import →
       export gives IDENTICAL engine dashboards for every month in
       scope (the parser mirroring migrate() is the referee), the
       orphan payrollPaid key being the one legitimate count delta;
       export → import → export is a fixpoint; and the founder's real
       all-companies file (backups/, gitignored) runs the same proof
       when present. The Export controls sit beside Import on the
       import screen (tab now "Import / Export").
     · VAULT EXPORT/IMPORT (src/lib/services/vault/backup.ts + GET
       /api/vault/export + POST /api/vault/import): the global backup
       pattern, module-scoped — the five Vault* tables, the Attachment
       rows whose vault FKs are set, and those files as base64; its own
       app marker ("…-vault") so global and vault files refuse each
       other. Import REPLACES the vault (rows in one transaction, ids
       preserved so relations and frozen lateness survive; blobs after
       commit), and the UI (a Data section on the overview) requires a
       ticked confirm box before the destructive import. Round-trip
       integration test included.
     · Both modules' import/export are admin-only, logged to
       ActivityLog (LOG_ACTIONS grew "export"; LOG_ENTITY_TYPES grew
       "vault_backup"; acct export logs on acct_books), and the
       destructive imports invalidate pending undo entries (ADR-045).
- Alternatives considered: keeping the modules under /b-systems with nav
  items (rejected — directive A names them switcher peers); stamping the
  brand via <html> mutation from a client effect (rejected — flash of
  wrong brand and fights the server render; the div scope is pure CSS);
  a new module-specific gradient token for ByteForce (rejected — the
  founder's screenshot IS a sanctioning of the brand's hero gradient;
  one token, hero moments only); per-brand distinct warning hues
  (rejected — warning is FUNCTIONAL like the danger red, and the SPA
  itself used one amber in both tenants); exporting piasters or new
  field names (rejected — directive C binds to the SPA's shape);
  comparing round-trip documents byte-for-byte (rejected — ids are
  re-minted by design; engine-derived equality is the meaningful
  contract); making the vault export SPA-shaped (not applicable — the
  vault's reference app had no export; the global backup pattern is the
  house precedent).
- Resolves: founder directives A–D (2026-08-18) and the dashboard design
  amendment; amends ADR-052 §Phase-2 placement, ADR-053 Phase 5
  placement, and §7.8 for the one dashboard screen.
- Status: Accepted

### ADR-054 — Addendum (2026-08-21, founder) — the accounting green, written down, and extended to the row ✓
Amends ADR-054's brand section; it stays Accepted. No new ADR: see "Why no new
ADR" below.
- The exception itself, recorded late. Commit 8fe9e05 ("accounting status chips
  wear the original app's colors", founder by screenshot) introduced
  `--color-acct-positive` #1B7A44 / `--color-acct-positive-tint` #E6F4EC across
  the three brand files (byteforce, b-systems, neutral) and spent them on ONE
  consumer, `.acct-chip--good` (Collected / Paid / Settled / Active / Deposit).
  **Correction (2026-08-21, reviewer finding).** In `branding/b-systems/tokens.css`
  that pair did not land in the `[data-brand="bsystems"]` block at all — it sat
  in the `.bs-mesh` rule further down the file. So the B-Systems SCOPE never
  declared it, and both consumers spend it through a bare `var()` with no
  fallback: under a genuine B-Systems root the background, border and ink are
  invalid-at-computed-value-time and NO green paints. It looked right only by
  inheritance — the accounting root layout stamps `data-brand="byteforce"` on
  `<html>` and `ModuleBrandScope` re-stamps only an inner `<div>`, so the
  byteforce value flowed through the B-Systems subtree. Moved into the brand
  scope here. Every guard was blind to it because every guard scanned the FILE:
  `brand-tokens.test.ts` now reads tokens out of the SCOPE (a brace-matching
  `scopeBody()`), for both the ADR-019 two-brand parity check and a new
  ADR-057-style three-scope check over `--color-acct-*`. That is a
  deliberate, accounting-only exception to the ADR-031-Resolution R4 ruling
  ("no green anywhere" in the B-brand, `--color-success` is in-palette) — the
  founder's own reference SPA coloured these pills green in BOTH tenants and he
  asked for that coloring back by screenshot. It shipped with a code comment
  (AcctHead.tsx) and a CHANGELOG line but no ADR; this addendum is its home.
  The fence has always been: the accounting module only, status-of-a-money-row
  only, those two tokens only, identical in both brands.
- The extension (this session). Founder, screenshotting the row action buttons:
  *"when I click on the right sign it becomes green"* — chosen behaviour: the
  ✓ BUTTON itself turns green while the row is settled, and clicking a green ✓
  returns it to the normal colour and puts the row back On hold. Decision: one
  new class `.row-toggle--acct-settled` in the accounting section of
  design-system.css, consuming the SAME two tokens (tint background, positive
  ink, border a color-mix of the positive ink like `.acct-chip--off` already
  does with warning). It replaces `.row-toggle--restore` on the settled state
  only, changes nothing but colour — so the button keeps its size, shape and
  place and the action column never reflows on a flip.
  · One shared `SettleToggle` (accounting/forms.tsx) now renders BOTH check
    toggles — income (`row.collected`) and expenses (`row.paid`, manual AND the
    derived AUTO payroll row, which is the row kind in the screenshot). State
    comes from the row truth the chip already reads, so button and chip can
    never disagree.
  · NOT BY COLOUR ALONE (this is the condition the exception is granted under):
    the toggle carries `aria-pressed`, and the two channels are split so they
    cannot contradict each other. The accessible NAME is the state the button
    represents and never moves — `Collected` on income, `Paid` on expenses — so
    `aria-pressed` is what says on/off; the flipping ACTION wording lives in
    `title` only, a hint for the sighted mouse user (and the accessible
    description, announced after the name). This is the WAI-ARIA APG rule for
    toggle buttons: a name that flips with the state announces "Mark pending,
    pressed" on a COLLECTED row, which reads as though pending is what is on.
    (First cut of this change did exactly that; reviewer finding, corrected
    before push.) The `markCollected` / `markPending` pair (EN + AR) still ships
    and is still exercised — it is the income title now, matching the
    `approveMarkPaid` ⇄ `markOnHold` pair expenses already had.
    `toggleCollected` is retired from use but KEPT in the dictionary — shipped
    English strings are never edited or removed (ADR-037).
  · The ✓ is `disabled` while its own request is in flight (a double click used
    to fire the reverse toggle behind the first one and land back where it
    started), and a failed toggle now says so: a `.row-error` beside the row's
    buttons, where before the failure was silent and the un-moved colour was the
    only — and misleading — feedback.
- Why no new ADR: the exception does not widen. Same two tokens, no new hue, no
  new token, no new scope, no new brand surface — one more consumer inside the
  same accounting fence, on the same money-row-status semantics the chip
  already carries. A new ADR would imply a new rule; there isn't one. What WAS
  missing is the written record of the original exception, which is why this
  addendum states it in full rather than only the delta. If a future request
  wants this green OUTSIDE accounting, that is the widening — and that needs its
  own ADR against R4.
- Contrast: #1B7A44 on #E6F4EC = 4.73:1, AA for normal text, and the pair is
  byte-identical in both brand files, so ByteForce and B-Systems accounting read
  the same (the module stamps `data-brand` per company, ADR-054 directive D).
- Two boundaries recorded on purpose, both raised in review:
  · **Un-settling an income row can move it out of the month you are looking
    at, and that is correct.** Income is cash-basis: a collected row lists under
    its issue month AND under the month its cash landed in. Clearing the
    collection clears `collectedDate` / `paidMonth`, so a row that was in the
    view ONLY on the cash basis leaves it and is pending again under its own
    month. Rejected the alternative (hold the row in the view): it would park an
    uncollected amount — and its Pending receivable — in a month it does not
    belong to, which is the one thing the cash basis exists to prevent. Covered
    now by an e2e leg that does the round trip from the cash month, not just
    from the issue month.
  · **The roster's ⇄ "Active from this month" is deliberately NOT a
    `SettleToggle`.** It flips the green `Active` chip, so it is inside the same
    green fence, but it is not a money-row settlement: it moves an effective-dated
    segment rather than approving a payment, its glyph is different, and it is
    the one accounting row action whose meaning is a date, not a state. It keeps
    its static title and no `aria-pressed`. If the founder asks for the buttons
    column to carry state everywhere, that is the row to revisit first.
- Alternatives considered: a green ring/dot beside an unchanged button (rejected
  — the founder was shown the choices and picked the button itself); tinting the
  whole table row (rejected — it fights the status chip and the row-hover); a
  new `--color-acct-settled` token pair (rejected — it would be the same two
  values under a second name, and every token must be maintained in three files);
  leaving the tooltip static (rejected — colour-only state); keeping the
  action-phrased accessible name and dropping `aria-pressed` (rejected — the
  pressed state is the non-colour cue the exception is granted under, so it is
  the half that must stay).
- Resolves: founder request 2026-08-21. Status: Accepted

## ADR-055 — 2026-08-19 — Assigning a To-Do = reassigning its LEAD; "take it myself" = the admin bucket
- Context: founder, looking at /b-systems/todo — "I can assign these to do
  as an admin or just take it myself." The To-Do page (ADR-041) is a
  read-only projection over records that already carry dates: lead
  follow-ups and meetings, partner/agent follow-ups and meetings, expected
  statements, due milestones.
- Decision: a to-do row is not a thing that can be owned — it is a VIEW of
  a lead's latest dated record. So "assigning the to-do" is defined as
  reassigning THAT LEAD's ownership, through the machinery ADR-047 already
  built. No task entity, no assignee column, no new endpoint.
  · todoFor() now carries leadId / ownerUserId / ownerName / ownerType on
    the two LEAD-backed kinds (follow_up, meeting) only. Partner-prospect,
    statement and milestone rows are admin-owned subsystems — there is
    nobody to hand them to — so their fields stay unset, and that absence
    is exactly what hides the controls on those rows.
  · TodoBody grows ONE optional prop (`assign`). It is passed only by the
    B-Systems page and only for role bsystems_admin; every other role and
    the ByteForce page render byte-identically to before. The wall is the
    server (the page decides) plus requireBsAdmin on the endpoint — the
    hidden button is cosmetics, not security.
  · The row reuses the lead detail's AssignLeadButton (same modal, same
    assignLead.* strings, same POST /api/b-systems/leads/{id}/assign) and
    adds one small ghost button, "Take it".
  · "TAKE IT MYSELF" = assignLeadOwner with the admin as target, which now
    resolves ownerType "admin". That is not a new state: bucketFor() gives
    an admin-CREATED lead exactly ownerType "admin" + ownerUserId = the
    admin, and OWNER_TYPES has carried "admin" since V2 §1. The fallback
    lives INSIDE assignLeadOwner, not in ownerTypeForRole(), so the
    derivation used elsewhere is untouched.
  · The assignable ROSTER still excludes admins (ADR-047: the admin bucket
    is where an unassigned lead sits, not a person's workload).
    Consequence: "Take it" is the only path into an admin's hands, which
    is precisely the founder's two options — hand it to someone, or take
    it yourself.
  · SELF-ASSIGN SENDS NO NOTIFICATION. Notification is "visible in his
    system" for someone ELSE; pinging your own bell about your own click
    is noise. The ActivityLog row ("assigned") and the ADR-045 undo entry
    ("lead_assign") are still written — history and reversal must not
    depend on who the target was.
  · B-SYSTEMS ONLY. The ByteForce To-Do gets no controls: ByteForce leads
    have no account ownership at all (salesRepId points at a SalesRep
    nameplate, not a login), so there is no "his system" to move work to.
    Flagged for founder confirmation in PROGRESS.
- Alternatives considered: a Task/Assignment table with its own assignee —
  rejected, it would invent a second, divergent answer to "whose work is
  this" beside Lead.ownerUserId, and the founder's sentence is about the
  lead's work, not about a note. Adding "admin" to ownerTypeForRole()
  itself — rejected: that function also expresses "who may be OFFERED a
  lead", and widening it would quietly put admins in the roster. Letting
  the roster include admins instead of a Take-it button — rejected: it
  reads as workload distribution and buries the founder's one-click
  intent. Notifying on self-assign for a uniform code path — rejected as
  self-noise. Assign controls on prospect/statement/milestone rows —
  rejected: those subsystems are admin-only by ADR-050/§4, so there is no
  one to assign them to.
- Resolves: — (founder directive, 2026-08-19; no SPEC §11 A-#)
- Consequences: assignLeadOwner accepts a bsystems_admin target, so the
  guard test that used to prove "admins are refused" now proves
  "data-entry and ByteForce logins are refused" — the roster test remains
  the proof that admins are never OFFERED. A lead taken by an admin leaves
  its previous owner's board and lists immediately (ownerUserId moves),
  and one undo puts it straight back.
- Review round (2026-08-19, same commit — three corrections to the above):
  · THE ROW WEARS THE APP'S OWNER CHIP, not a bare account name. The first
    cut rendered `ownerName ?? "Unassigned"` off Lead.owner alone, so a
    lead that IS assigned read as unassigned on the one screen whose job
    is deciding whom to hand work to: an internal lead with a salesRep
    (a card, not a login), a partner-sourced lead whose partner company
    converted without an email (Partner.userId null), or a lead whose
    owner account was deleted (user-delete parks it as ownerType "admin",
    ownerUserId null). todoFor now selects salesRep.name and
    partner.companyName and resolves ownerName in the app's established
    order (owner ?? salesRep ?? partner company); the label is
    `ownerTypeLabel(ownerType) · name`, exactly like the board, the Leads
    table and the lead detail. ADR-051's "Unassigned" wording is reserved
    for the state ADR-051 defines — internal bucket, no rep, no account.
  · TODOBODY STAYS BRAND-NEUTRAL. The `assign` prop made components/shared
    import the B-Systems `"use client"` lead-actions module, pulling that
    chunk (and the CRM dictionary) into the ByteForce To-Do route's client
    graph for a branch that can never render there. The controls moved to
    components/bsystems/TodoRowActions.tsx and TodoBody now takes a
    `rowActions?: (item) => ReactNode` render prop, supplied only by the
    B-Systems page. Same server-side wall, same rendering; the shared list
    no longer depends on a brand. The dead `selfName` field went with it.
  · "TAKE IT" RESOLVES THE ADMIN BUCKET FIRST. ownerTypeForRole() answers
    agent/partner/internal before it ever returns null, so an account
    holding bsystems_admin AND a second B-Systems role (the Users editor
    is a checkbox per role) was landing in the INTERNAL bucket — pushing
    the admin's own task onto every internal-sales board and To-Do.
    assignLeadOwner now checks bsystems_admin first, mirroring the
    precedence bsRoleOf/bucketFor already use everywhere else.
    ownerTypeForRole itself is still untouched, so the roster still
    excludes admins.
- Status: Accepted

## ADR-056 — 2026-08-19 — Drag by a handle on touch; layout arithmetic leaves viewport units behind
- Context: two founder reports on the same day, both about the SAME class of
  mistake — a layout rule written against a quantity that is not the one the
  browser actually uses.
  (A) On his phone: "the scroller of the columns and the CRM is not working —
  when I try to scroll using the cards it drags the card. I should have a
  button to drag the card, otherwise I'm just scrolling even if I'm touching
  the card... I cannot reach the leads under the column because I cannot
  scroll."
  (B) On his desktop: "when I zoom in and out the UI gets so scattered."
  (A) traced to `touch-action: none`, which dnd-kit requires on a drag
  activator, sitting on the CARD — and cards cover the whole board, so the
  column's inner scroll, the board's horizontal scroll and page-scroll chaining
  all died on the same rule. (B) traced to `.board`'s full-bleed breakout being
  written in `vw`: `100vw` INCLUDES the classic scrollbar, the space the page
  can actually use does not, and Chromium keeps that scrollbar at a fixed
  PHYSICAL thickness — 15/zoom CSS px. The `+8px` fudge cancelled it at exactly
  100% zoom and nowhere else.
- Decision, part A — DRAG BY A HANDLE ON TOUCH; A MOUSE STILL DRAGS THE CARD.
  · Every board card gains `<CardGrip>` (src/components/shared/CardGrip.tsx):
    a real `<button type="button">`, **26 x 44px centred on the card's inline
    end**, labelled by a NEW i18n key `common.dragHandle` ("Drag to move this
    card" / Arabic). It is the ONLY element in the app's own CSS allowed
    `touch-action: none`, and it is therefore BOUNDED IN BOTH AXES. It first
    shipped as a full-card-height rail; review round (below) showed that
    stacked cards turn a full-height rail into one unbroken 26px-wide
    no-scroll strip running the entire length of the column — on a 390px phone
    it begins at the horizontal centre of the screen and runs down the
    right-thumb zone, so a thumb landing in it still cannot scroll (the
    founder's own bug, at 12% of the width) and past the sensor's 6px it
    becomes an unasked-for stage move. 26 x 44 clears WCAG 2.5.8's 24px
    minimum on both axes, hits the 44px thumb target, and cuts the dead area
    by about three quarters.
  · The card is an ordinary surface again: `touch-action: manipulation`, which
    permits BOTH pans and pinch-zoom and only drops the double-tap-zoom delay
    on the card's tap-to-open. NOT `pan-y` — measured to kill the board's
    horizontal pan — and NOT `pan-x pan-y`, which would forbid the pinch-zoom
    the app's default viewport otherwise allows.
  · The card shell keeps dnd-kit's listeners but GATED TO A MOUSE
    (`useMouseOnlyListeners`): `pointerType !== "mouse"` returns before the
    sensor ever sees the event. Desktop behaviour is unchanged — whole-card
    drag, whole-card click-to-open, and the post-drop click suppression.
    PEN falls on the touch side of that gate deliberately: a pen obeys
    `touch-action` exactly like a finger, so letting it drag the whole card
    would re-create the founder's bug on a stylus tablet.
  · The grip lives inside each board's CardBody, not in the draggable shell, so
    the DragOverlay clone is pixel-identical to the card it replaces and nothing
    reflows under the finger at pick-up. The clone passes no `drag` prop: its
    grip is inert and `tabIndex={-1}`, so the `aria-hidden` clone adds no second
    button to the accessibility tree.
  · The card div no longer spreads dnd-kit's `attributes`, so it loses
    `role="button"` / `tabIndex=0`. That is a net a11y gain — a role=button div
    full of links and buttons was invalid, and the card had no key handler
    anyway; the `.bcard-name` link remains the keyboard path.
- Decision, part B — NO VIEWPORT UNITS IN LAYOUT ARITHMETIC THAT MUST AGREE
  WITH THE SCROLLABLE CONTENT AREA. Use container query units.
  · The four app shells wrap `<main class="page">` in `<div class="shell-body">`,
    which is `container-type: inline-size`. `.board`'s breakout becomes
    `margin-inline: calc(50% - 50cqw)` and
    `padding-inline: max(var(--page-pad), calc(50cqw - 640px + var(--page-pad)))`.
    `cqw` resolves against the container's CONTENT box, which EXCLUDES the
    scrollbar — the quantity `vw` cannot express. The ±8px fudge is deleted. The
    old vw pair stays ABOVE the cqw pair as a legacy fallback: an engine without
    container query units keeps today's behaviour instead of breaking.
  · MEASURED in real Chromium with real scrollbars (Playwright launched with
    `ignoreDefaultArgs: ['--hide-scrollbars']`), 1440 device px, before and
    after, at zoom 25/50/67/80/90/100/125/150/200/300%:
      page overflow  BEFORE +22 / +7 / +3 / +2 / +1 / 0 / 0 / 0 / 0 / +48
                     AFTER    0 at every step
      board.left     BEFORE −22 / −7 / −3 / −1.5 / −0.5 / +0.5 / +2 / +3 / +4 / +5.5
                     AFTER    0.00 at every step
      first column − page title
                     BEFORE 0 on the wide branch, −6 / −5 / −4 / −2.5 at 125-300%
                     AFTER    0.00 at every step
      and the board slid 15.0px sideways at 50% zoom (7.5 at 100%, 5.0 at 150%)
      purely because the page grew long enough to scroll. AFTER: 0.
  · Both visual intents survive: the board still fills the viewport, and its
    columns still start at the centered content edge.
- Decision, part C — THE COLUMN CAP IS DERIVED FROM THE CARD, NOT FROM vh
  ALONE. `.col-cards` was `max-height: min(62vh, 510px)` — the founder's "about
  five cards" written in viewport units against a fixed-px card. MEASURED, it
  showed 2.54 cards at 100% zoom, 1.26 at 200% and 0.83 at 300%: at high zoom a
  column could not display ONE whole card. It is now
  `clamp(2 tall cards + gap + padding, 62vh, 5 reference cards + 4 gaps +
  padding)` — a **429px floor and a 928px ceiling** with today's values. It is
  still a hard cap, so the endless column he asked us to kill cannot return.
  · THE TWO ENDS ARE SIZED FROM DIFFERENT CARDS, on purpose, because their
    directions of safety are opposite. Measured in Chromium on the shipped CSS
    at a 218px column, on the richest card in the app (B-Systems: name +
    company + owner chip + Call + WhatsApp + the meta row's two buttons):
    **186.3px** as it renders with a one-line name, **190.4px** with the name
    at its 2-line clamp, **202.4px** with a long key datum on top.
    `--bcard-h: 176px` sizes the CEILING and is deliberately SHORTER than any
    of those: a ceiling written against the tallest card would let the box
    grow to nearly six ordinary cards, i.e. weaker capping. `--bcard-h-max:
    204px` sizes the FLOOR, for the mirror reason — a floor written against a
    short card shows a sliver LESS than two whole cards the moment a name
    wraps, which is the common case. The first cut used one constant (176px)
    for both and called it "the richest card"; it was not — the seeded
    B-Systems card already measured 186.3px, so the floor delivered 1.94 cards,
    not two. Caught in review, measured, split.
    NOT a mathematical guarantee: `.bcard-meta` carries no line clamp, so a
    freakishly long key datum can still beat 204px.
  · THE MIDDLE IS "UNCHANGED" ONLY INSIDE A BAND — 62vh rules while the
    viewport is 692px to 1497px tall. The founder's 1440x760 monitor at 100%
    is inside it (62vh = 471px), which is the whole of the "nothing moves at
    your usual zoom" claim: it is about HIS zoom, not every screen. Outside the
    band an end takes over — the floor from roughly 1.1x zoom in, the ceiling
    only above ~1500 CSS px of viewport height, where the column IS taller than
    the old flat 510px ceiling (558px at 1440x900, 893px at 2560x1440). That is
    the fix and not a regression: 510px was 2.9 cards and he asked for five.
  · THE FLOOR IS A FLOOR ON THE COLUMN BOX, NOT ON WHAT FITS THE SCREEN. Past
    about 2x zoom the viewport is itself shorter than two cards (380px at 200%,
    253px at 300% on his monitor), so the second card is reached by scrolling
    the PAGE. Rejected in review: capping the floor to the viewport
    (`min(429px, 100vh − chrome)`). At 300% that resolves to well under one
    card and hands straight back the 0.83-of-a-card column this rule exists to
    delete — a strictly worse answer than the one it "fixes".
- Alternatives considered:
  · A LONG-PRESS to start a touch drag (dnd-kit TouchSensor + delay) instead of
    a handle — rejected: the founder asked for a button in words, a hidden
    250ms gesture is undiscoverable, and it still needs `touch-action: none` on
    the card, which is the actual bug.
  · Padding-relative bleed (`margin-inline: calc(-1 * var(--page-pad))`) —
    measured exact at every zoom and needs no wrapper div, but it caps the board
    at the 1280px content column: board.left 0.5 → 80 and width 1424 → 1280 on a
    1440 monitor, roughly 1280px of scroll rail lost on a 2560 monitor. Rejected
    — the founder explicitly asked for the opposite ("the board fills the whole
    page, not the centered column").
  · `container-type` on `body` in globals.css (zero layout edits, also measured
    correct) — rejected in favour of an explicit wrapper: an implicit
    whole-document query container is invisible to the next engineer.
  · `scrollbar-gutter: stable both-edges` on `html`, which would also remove the
    residual sideways shift of the CENTERED column (not just the board) when a
    page starts or stops scrolling — NOT SHIPPED. It permanently reserves
    15/zoom px on BOTH sides of every page at every width (a 30px dead strip at
    100% on a 1440 monitor) and is far too founder-visible to adopt unasked.
    Flagged for confirmation in PROGRESS.
  · DELIBERATELY LEFT, from the ranked zoom-fragility list, with reasons:
    (1) `.login-pane { padding: 56px clamp(32px, 6vw, 84px) }` in neutral.css —
    the sign-in gutter widens as the CSS viewport widens, which is the same
    responsive behaviour as the breakpoint ladder, on one screen, with no
    overflow and nothing to line up against. (2) `.nav-sheet` / its backdrop
    pinned at `top: 54px` with `max-height: calc(100vh - 54px)` — correct
    against the <=820px header height, but the ImpersonationBar sits ABOVE the
    header, so while impersonating the sheet covers the header instead of
    hanging off it. Real, not zoom-related, and unpicking the constant means
    threading a header-height custom property through all four shells; it would
    have put the burger sheet and the mobile-menu tests at risk inside a commit
    about zoom. (3) `.modal { max-height: 90vh }` — expected to clip its head or
    foot at high zoom, MEASURED at 100/150/200/250/300%: clippedTop 0 and
    clippedBottom 0 every time. Not a bug; do not "fix" it.
  · "Fixing" the responsive breakpoint ladder so zooming to 176% does not turn
    the desktop nav into a burger — DELIBERATELY NOT DONE. Browser zoom shrinks
    the CSS viewport, so crossing a breakpoint is the responsive system working
    exactly as designed, and suppressing it would break the founder's own rule
    that every feature stays reachable at any width.
- Resolves: — (two founder directives, 2026-08-19; no SPEC §11 A-#)
- Consequences:
  · A card is 22px narrower inside (a 34px inline-end gutter for the rail, and
    only on cards that HAVE a rail — `.bcard:has(> .bcard-grip)`, so the
    read-only mini board on the Agents page keeps its full width). Names and
    subtitles are already 2-line clamped and the chips row already wraps, so
    nothing overflows, but rich cards run one line taller.
  · The three existing mouse drag helpers that grab `card.width - 10` now land
    INSIDE the 26px rail, so they exercise the handle path; journey3 and the
    whole-card open tests grab `.bcard-rep` and exercise the mouse path. The new
    spec pins the rail's width so shrinking it cannot silently drop that
    coverage.
  · A missing `.shell-body` wrapper does not error — `50cqw` falls back to the
    viewport size, i.e. straight back to the old bug. e2e/zoom.spec.ts asserts
    the container per route (A10) precisely because that failure is silent.
  · Columns are TALLER than before at ≥110% zoom (a 429px floor against 236px at
    200%), so board pages that used to fit the window at high zoom now scroll
    vertically. That is the right trade: two readable cards beat one clipped one.
    They are also taller on a screen over ~1500 CSS px tall, where the ceiling
    (928px) sits above the old flat 510px one — see part C.
  · TESTS MAY NOT PIN THE CAP TO A LITERAL. `min(62vh, 510px)` made
    `clientHeight <= 520` true at every viewport height; `clamp(429px, 62vh,
    928px)` does not (62vh alone passes 520 above an 839px-tall viewport, and
    the suite already runs specs at 900px). e2e/byteforce-board.spec.ts derives
    the clamp from the `--bcard-h` / `--bcard-h-max` / `--bcard-gap` /
    `--col-cards-pad-b` custom properties the CSS itself declares, so it is
    viewport-independent; e2e/zoom.spec.ts A6 measures a LIVE `.bcard` and now
    seeds names that WRAP to the 2-line clamp, so its live oracle and the frozen
    px constant cannot drift apart in silence again.
  · The module switcher now leaves the header at ≤600px instead of ≤400px. It is
    a rigid 307px strip inside a `flex: none` cluster, so between roughly 400px
    and 555px the HEADER pushed the whole page sideways (+48px at a 480px
    viewport = 300% zoom on a 1440 monitor). qa-sweep samples 560 and 390 and
    stepped straight over that band. It rides into the sheet with Log out.
  · The nav slider's overflow test is measured off the items' fractional rects
    instead of integer `scrollWidth - clientWidth`, so a label clipped by under
    1px at a fractional zoom no longer hides the chevron.
- Status: Accepted

## ADR-057 — 2026-08-20 — The agent pipeline: its own stage vocabulary on the one shared engine
- Context: the founder, answering a question we had been holding open about the
  Partners & Agents board: *"agents stages : lead , contacted , didn't answer ,
  meeting settting , qualified , lost , when he is in qualified he becomes an
  agent and we create a user for hiim and fill in the data of him and I can
  assing leads for agents also"*.
  Until now BOTH kinds of card on `/b-systems/partners-pipeline` ran the partner
  stage set (ADR-050), whose point 4 promised the two kinds were "literally the
  same code" apart from the Won gate. That clause is superseded here.
- Decision 1 — THE AGENT STAGE SET, IN THE FOUNDER'S ORDER.
  `AGENT_STAGES = ["lead", "contacted", "didnt_answer", "meeting_setting",
  "qualified", "lost"]` (snake_case, the existing convention). The ARRAY IS THE
  BOARD'S COLUMN ORDER — Lead, Contacted, Didn't Answer, Meeting Setting,
  Qualified, Lost — exactly as dictated, and a unit test pins the order because
  it is a normative fact, not an implementation detail.
- Decision 2 — ROLE SLOTS, NOT A SECOND PIPELINE (CLAUDE.md rule 5).
  `contacted` plays the `followUpStage` role (it is the stage that carries a
  dated follow-up, and inherits T-1's context-per-origin rule verbatim);
  `qualified` plays the `wonStage` role; `terminalStages = [qualified, lost]`.
  Intake, meeting, didn't-answer and lost slots are unchanged and shared.
  `transition.ts` needed NO stage edits at all — the core was already fully
  slot-driven. What DID change is `configs/partners.ts`: `ACTIVE_ACTIONS`,
  `sameStageExtras`, the terminal guard and `attendedDestinations` were literal
  stage keys and are now derived from the config's own slots, so
  `partnersConfigFor(kind)` is a genuine parameterization rather than a fork.
  `SAME_STAGE_FORM_TARGET` (a flat literal map) is superseded by
  `SAME_STAGE_FORM_SLOT`, which names the SLOT — otherwise "log another
  follow-up" on an agent card would open the form of a stage he does not have.
  REVIEW ROUND: two literal comparisons survived the sweep in the very files it
  converted — `prospect.stage === "didnt_answer"` in `pages.tsx` and
  `stage === "meeting_setting"` in `ProspectEventPanel.tsx`. Harmless only
  because both kinds happen to share those two keys, which is exactly the
  accident this decision exists to stop relying on. Both now read
  `config.didntAnswerStage` / `config.meetingStage`.
- Decision 3 — QUALIFIED IS THE ACCOUNT GATE. The `won_agent` required group and
  the `create_agent` side effect move to `qualified` UNCHANGED. Nothing about
  what the gate collects, validates or creates is different: first/last name,
  phone, email, the admin-set password, speciality, address → User (active,
  `registrationStatus: approved`) + `bsystems_agent` role + PortalRep + the
  card's CV re-parented, all in one transaction. Only the column it hangs on
  moved. §7.2a in SPEC records the gate's field table.
- Decision 4 — THE PARTNER PIPELINE IS UNTOUCHED. Lead / Didn't Answer /
  Following Up / Meeting Setting / Won / Lost, the `won_partner` gate and
  `create_partner`. A dedicated describe block asserts its stage array, terminal
  set, `nextActions` for every stage and `attendedDestinations` are the EXACT
  arrays they were before the slot refactor, and that the agent vocabulary is
  rejected on a partner card (and vice versa).
- Decision 5 — §10.2a AND ITS OWN ROW IDS. SPEC gains §10.2a with PA-1…PA-5,
  each with a test named for it. The ids are parameterized onto the config
  (`PipelineConfig.triggers`, defaulted to the historic PP-* so nothing else
  moves), because a normative table whose rows are numbered identically to
  another table's rows cannot be asserted against. `portal_rep`'s create log
  keeps its `PP-4a` trigger — it names the ACCOUNT-CREATION row, is asserted in
  the integration suite and is quoted throughout ADR-050.
  ALTERNATIVE NOT TAKEN: reuse PP-1…PP-4 on agent cards. Zero new ids and one
  vocabulary in the ActivityLog, but the §10.2a rows would then have no distinct
  trigger to test, which weakens "every row implemented and tested".
- Decision 6 — THE BOARD RENDERS THE PIPELINE THAT MATCHES THE FILTER.
  Kind = Partners → the partner columns. Kind = Agents → the agent columns.
  Kind = All (the default) → BOTH boards STACKED on one page, a Partners section
  then an Agents section, each with its own columns, its own config and its own
  drag rules. A single kanban cannot honestly show two different stage sets, and
  dropping the All view would remove an affordance the founder uses.
  Mechanically: `PartnersBoard` became a dispatcher over `<ProspectPipeline>`;
  every piece of drag state (pending move, overlay, busy, error, click
  suppression) lives INSIDE each pipeline, each gets its own `DndContext` id,
  and droppables are namespaced `${kind}:${stage}` — four of the six stage ids
  are common to both sets, so a shared registry would drop cards onto the wrong
  board. A cross-board drop reports no `over` at all and is therefore a no-op
  (e2e asserts it). `.board` carries `data-pipeline`, which is also what keeps
  Playwright's strict mode honest now that `[data-stage="lead"]` appears twice.
  ALTERNATIVES FOR THE FOUNDER TO PICK INSTEAD, if he prefers:
  (a) DROP THE ALL VIEW — make Kind a required choice defaulting to Partners.
      One board, one scroll, no stacking; costs him the single glance at both.
  (b) TABS instead of stacking — Partners | Agents tabs above one board area.
      Same one-board-at-a-time honesty with a cheaper switch than the filter,
      but only one pipeline is ever visible, and tab state is another thing to
      remember per visit.
  (c) ONE SUPERSET BOARD of seven columns (Following Up AND Contacted, Won AND
      Qualified) with the irrelevant ones greyed per card. Rejected outright: it
      invents columns neither kind has and makes every drag rule conditional.
- Decision 7 — THE DATA MIGRATION (`20260819180000_agent_stages`). Production
  holds agent cards in partner columns, so a rename without a migration strands
  them: the board filters by stage, the engine rejects an unknown stage, and the
  card exists only in the database. The migration rewrites rows with
  `kind = 'agent'` ONLY — `following_up -> contacted`, `won -> qualified` — and
  is idempotent: every WHERE names the OLD value, which cannot exist after a
  successful run. REVIEW ROUND: that claim was true of statements 1 and 2 and
  FALSE of statement 3, whose only predicates (`consumedAt IS NULL`,
  `kind = 'agent'`) keep matching forever — a manual re-run days later would
  have eaten undo entries written since. Statement 3 now names the OLD stage in
  the undo SNAPSHOT (`payload->>'stage' IN ('following_up','won')`), which no
  post-migration entry can carry, so the header's claim holds for the whole
  file. The proof was strengthened to match: the suite now creates a pending
  entry BETWEEN the two runs and asserts it survives — a back-to-back re-run
  with nothing in between could never have caught this. `stage` is plain TEXT with no enum and no CHECK, and the only
  stage index is a self-maintaining btree, so this is a pure data statement; a
  converted agent keeps `converted`, `agentUserId`, its User, its UserRole, its
  PortalRep, its re-parented CV and every child record.
  It also rewrites `ActivityLog.fromStage`/`toStage` for those cards, so an
  agent's own History stops speaking the partner vocabulary. ActivityLog is
  append-only by policy and this is a deliberate exception, recorded here; the
  alternative was to leave it and accept that pre-change moves read "Following
  Up" / "Won" on a board that has neither.
- Decision 8 — THE TWO STRANDING VECTORS, CLOSED IN BOTH DIRECTIONS.
  (a) UNDO. Prisma's `@updatedAt` is CLIENT-side, so a raw-SQL migration does
      not bump it and undo's fingerprint check would still MATCH a snapshot
      written minutes earlier holding `stage: "following_up"`. The migration
      therefore retires (consumes, never deletes) those pending entries, AND
      `undoProspectEvent` now refuses outright to write back a stage that is not
      in the card's own `config.stages`. Belt and braces, because either alone
      leaves a hole.
      REVIEW ROUND — IT MUST RETIRE THE OWNER'S WHOLE PENDING SET, not just the
      offending row. `pendingUndoFor` / `performUndo` take the user's NEWEST
      unconsumed entry, and `recordUndo` does not retire the one beneath it, so
      a user can hold several. Consuming only the agent entry PROMOTED the entry
      under it — a lead move made a minute earlier — to the head of the queue,
      and the button then offered to revert something that was not the last
      thing the admin did, with a fingerprint that still matched. That is
      precisely ADR-045's `honesty` guard, which `invalidateUndo` enforces
      everywhere else. The statement now selects the affected users and retires
      their whole pending set; a second admin's entries are untouched.
  (b) BACKUP RESTORE. `importBackup` is `deleteMany` + `createMany` with ids
      preserved and no transformation, so restoring a pre-change export would
      re-insert `following_up` / `won` agent rows onto a migrated database. The
      import now runs the same normalisation inside its transaction.
      REVIEW ROUND — it ran only the two CARD rewrites, so a restored agent's
      History kept printing "Following Up" and "Won" (columns his board does not
      have) and his restored pending undos kept being offered though they could
      only ever fail. `importBackup` now calls one named
      `normaliseAgentStages(tx)` (exported from `services/backup.ts`) that
      mirrors the SQL statement for statement — cards, ActivityLog
      `fromStage`/`toStage`, and the undo retirement — and a test runs the
      SHIPPED SQL and the helper against identical fixtures and diffs the entire
      resulting world, so the twin cannot drift from the file.
- Decision 9 — THE TO-DO PROJECTION. `todo.ts` filtered prospects to
  `stage in (following_up, meeting_setting)`. An agent's follow-up now lives in
  `contacted`, so without widening that list every agent follow-up would vanish
  from the admin's To-Do with no error, no log and no empty state. The query is
  the UNION of both configs' follow-up slots plus the shared meeting slot, and
  the per-row branch reads `partnersConfigFor(prospect.kind).followUpStage`.
- Decision 10 — TWO NEW STAGE TOKEN FAMILIES, IN ALL THREE SCOPES.
  `--color-stage-contacted-*` and `--color-stage-qualified-*` are declared in
  `branding/byteforce/tokens.css`, `branding/b-systems/tokens.css` AND
  `src/themes/neutral.css`, bridged in `globals.css`'s `@theme inline` and bound
  in `design-system.css`'s `[data-stage-key="…"]` block. Contacted sits beside
  Following Up on each brand's ramp; Qualified is the agent's win, deliberately
  one step short of the loudest Won cue so Won stays the single strongest signal
  on the page.
  The ALTERNATIVE was to alias the two new stages onto the existing `following`
  and `won` design keys — zero new tokens and structurally impossible to break.
  It was rejected because the founder asked for the tokens and because the real
  hazard is now TESTED rather than avoided: `brand-tokens.test.ts` gained a
  three-way parity assertion (the previous test compared only the two BRAND
  files — neutral.css was never read, which is exactly the shape of the incident
  that reached production), a Tailwind-bridge assertion, and a coverage test
  that walks every stage of every pipeline and fails if `stageKey()` falls
  through to its `lost` default or if the returned key has no
  `[data-stage-key]` rule. Qualified painting as Lost is now a red test, not a
  screenshot someone has to notice.
- Decision 11 — COPY. `stageMsgs` gains `contacted` / `qualified` with real
  Arabic, which alone corrects the column titles, the next-action dropdown, the
  stage chips, the drag modal's eyebrow, the history from→to, the undo label and
  the terminal-card sentence (all of them interpolate `stageLabel`). No existing
  English string was edited: `terminalToastAgent`, `qualifiedAgentHint`,
  `cvOptionalHintQualified`, `kindLockedPipelines`, `sectionPartners`,
  `sectionAgents`, `noPartnerCards` and `noAgentCards` are NEW sibling keys, and
  the superseded ones stay in the file marked `@deprecated`.
  REVIEW ROUND — `stageLabel` was not the whole vocabulary. `HistoryPanel`'s
  `TRIGGER_PHRASES` mapped the LITERAL `"PP-2"` to §10.2's prescribed sentence
  "Returned to Lead — new number added", so the moment Decision 5 gave agent
  cards `PA-2` the pill vanished from every agent auto-return — and vanished
  INCONSISTENTLY, because the migration rewrote `fromStage`/`toStage` but not
  `trigger`, leaving pre-deploy rows still showing it on the same card. §10.2a
  row PA-2 makes the wording normative, so this was a miss, not a choice. The
  map moved to `src/components/internal/historyPhrases.ts` and is now BUILT from
  the pipelines' own `triggers.numberAdded` slots, so a future config cannot
  declare a row id and silently drop the prescribed wording; a test asserts the
  row id the ENGINE actually stamps resolves to the phrase.
- Decision 12 — "I CAN ASSIGN LEADS FOR AGENTS ALSO" was already true and was
  NOT rebuilt. `listAssignableOwners` filters on active + approved + one of the
  three roles, and the gate mints exactly that, so the new agent is in the
  roster on the next query. What was missing was PROOF for a gate-minted
  account: both an integration test (gate → roster → assign → his board → his
  To-Do → his notification, with no manual User insert anywhere) and an e2e that
  does the same through the UI and signs in as him.
- Consequences: agent and partner cards can never be dropped onto each other's
  board (by construction, not by validation). The Kind = All page is roughly
  twice as tall — the Agents section starts below the fold on a 760px monitor —
  so the seed now ships one agent card per agent stage and each section has its
  own empty state.
  REVIEW ROUND, three consequences of the stacked page that the first pass got
  wrong and are now fixed:
  (i)   THE SEED SHIPPED FIVE OF SIX. `qualified` — the founder's headline
        column and the gate itself — had no card, so a fresh install opened on
        an empty slab and never showed the Converted badge, the "Agent account
        created" link or the terminal panel. The seed now creates the agent
        analogue of `wonProspect`: a card at `qualified`, `converted: true`,
        wired to a real seeded User + `bsystems_agent` role + PortalRep, with a
        `PA-4` ActivityLog row — the state PA-4 actually produces.
  (ii)  TWO BOARDS, ONE TOAST SLOT. `.toast-wrap` is `position: fixed` at one
        coordinate and each pipeline owned its own `message`, so the partner
        board's "Won and Lost cards can no longer be moved." stayed on screen
        UNDER the agent board's "Qualified and Lost…" — two alerts in the same
        place, the older one lying. `message` moved up to the dispatcher; the
        newer message replaces the older. An e2e drags both seeded Lost cards
        and asserts one toast, carrying the agent sentence and NOT the partner
        one.
  (iii) AN EMPTY SECTION MUST SAY WHY. A search matching only agents left the
        Partners section reading "No partner cards yet." while partner cards
        existed — the page's own `activeCount` already knew a filter was on.
        `PartnersBoard` takes `filtered` and shows `noMatches` for a section
        emptied by the filter, keeping the "yet" copy for the genuinely empty
        case (the pattern `/b-systems/leads` already uses).
  And one consequence OUTSIDE the board: `/api/health` could not see this
  migration at all. `schemaProbe` selected one column added by migration 2 of
  12, so a DATA-ONLY migration that never applied left agent cards stranded
  behind `ok: true` — with `scripts/start.mjs` booting anyway after three failed
  `migrate deploy` attempts. The probe now diffs the committed migration folders
  against `_prisma_migrations` and drives the existing self-heal off that, so it
  is correct for every future migration with nothing to keep in sync; the
  response carries `pendingMigrations` and `e2e/health.spec.ts` asserts it is
  empty. `PP-4a` remains the portal_rep row id while the CARD's move
  is logged `PA-4`; that asymmetry is intentional and documented here.

## ADR-058 — 2026-08-21 — One month of a person's pay: a LINKED MANUAL EXPENSE that replaces the derived row, never a roster edit
- Context: the founder, on the accounting expenses screen: *"when I edit an
  expense of the type of payroll and it is being edited it doesn't automatically
  edit in the actual payroll roster because it can be because of a deduction or
  something"*. He wants to move ONE MONTH of one person's pay — a deduction for
  days missed, a bonus — and he had noticed the two do not connect.
  They must not connect. Editing the roster is the WRONG tool for this and the
  engine says so: `memberUpsert` writes an effective-dated segment and
  `memberAt` reads the latest segment whose `from ≤ month`, so a roster change
  made in March applies to March *and every month after it, permanently*. That
  is the right behaviour for a raise and the wrong behaviour for one month's
  deduction. The SPA's own Roster page already words it: *"A raise or removal
  applies from the month you set it — earlier months stay as they were."*
- Decision 1 — TWO PAYROLL PATHS, NAMED AS OPPOSITES, BOTH ON THE ROW.
  A derived salary row now carries both, side by side:
  · **"Edit in roster"** (unchanged text; the e2e asserts it byte-identically)
    — *"Changes the salary in the roster from this month FORWARD — this month
    and every month after it."* Only its `title` is new; a link takes its
    accessible name from its text, so nothing the suite reads moved.
  · **"Adjust this month only"** (new) — *"Add a deduction or a bonus for THIS
    MONTH ONLY. The roster salary, and every other month, stay exactly as they
    are."* It opens the expense modal PREFILLED to create the linked override:
    type payroll, that person, that month, the derived salary as the base,
    deduction and bonus empty, and the modal itself states, by name and month,
    which path he is in.
  **AND IN ARABIC TOO** (amended after review): the first cut opened both
  labels with the same word — «تعديل في كشف الرواتب» and «تعديل هذا الشهر
  فقط» — so in RTL the reader hit the identical verb first on each of two
  adjacent controls, while English separates them at word one. The override now
  leads with its distinguishing NOUN: «خصم أو مكافأة — هذا الشهر فقط». The
  English label is byte-identical to what shipped (an e2e reads it).
  The modal's two prefilled facts — the PERSON and the MONTH — are also the two
  the banner states by name, so they render LOCKED (`disabled`, with a hint
  saying why, and `.field-input:disabled` given a token-driven look in all three
  scopes). Leaving the month editable while the banner froze its value at open
  time let the banner describe the opposite of what the save did, and a Paid
  state carried over from the derived row would ride into a month nobody
  approved. Change the Type away from payroll and it stops being an override:
  the banner goes and both fields open up.
  This is not new vocabulary: the mechanism was already named by the original
  SPA, on the Person dropdown of this very form — *"Pick a person only if this
  should REPLACE their automatic salary for this month."* (index.html:1506,
  already in our dictionary as `acct.personHint` with real Arabic). The new
  button is a SHORTCUT to a concept the founder has already been shown, not a
  second concept. The original put both payroll paths on this row too
  (index.html:1443-1447), so the placement is the SPA's own.
- Decision 2 — DEDUCTION AND BONUS BECOME WRITABLE, FOR THE FIRST TIME IN
  EITHER APP. `AcctExpense.deduction` / `.bonus` have existed since the
  accounting migration and `expenseAmount()` has always netted them
  (`payroll net = base − deduction + bonus`), but NOTHING could write one: the
  form body carried ten keys and neither of these, so a deduction could only
  ever arrive by IMPORTING the old file. And the original had no field either —
  a full grep of `Accounting/` for /deduction|bonus/i returns four hits, two in
  the engine and two using the WORD "bonus" in prose. So this is NEW work, not
  parity work: there is no original layout to copy, and no migration to write
  (the columns predate this change; `migration.sql:35-36`).
- Decision 3 — THE ROW SHOWS ITS WORKING, IN THE ORIGINAL'S DENSITY.
  The SPA's amount cell printed the NET only, on every screen, with no
  breakdown anywhere; its one per-row annotation idiom is a small muted note
  beside the row. So the net stays the headline number and gains a muted
  second line — `Base EGP 5,000 − deduction EGP 200 + bonus EGP 50` — instead
  of a new multi-column layout. A salary line that disagrees with the salary
  must be able to say why. Flagged in PROGRESS as **needs founder
  confirmation**: the presentation is ours, because the original had none.
- Decision 4 — THE SINGLE-OWNER APPROVAL INVARIANT (the paid-state trap).
  A derived salary's approval lives in `AcctPayrollPayment` (the SPA's
  `payrollPaid` map, keyed `{month}:{memberId}`); a manual row's lives on the
  row. For any (person, month) the approval has **exactly one owner**: the mark
  while the salary is DERIVED, the covering linked expense's own `paid` while an
  override exists. The mark is therefore kept as a **shadow** of the covering
  expense for as long as one covers — written on create, on update, on the ✓
  toggle, and explicitly again on delete — so that the moment coverage ends the
  derived row that returns already carries the right approval **and its original
  approval date**, never today's. Ownership is transferred at every boundary,
  never dropped and never duplicated.
  **ONLY THE FOUNDER UN-APPROVES** (amended after review, same session): the
  shadow's delete branch fires on exactly two acts — the ✓ on the covering row,
  and its Status set back to On hold on a row that still covers the same
  person-month. Every other write ACQUIRES coverage (a create; a move onto a
  person-month) and must **park** whatever mark it finds, never delete it. The
  first cut deleted on acquire, and that was a money-losing regression: with
  "+ Add expense → Payroll → pick a person" shipping Status = On hold, one save
  destroyed that person-month's approval, and the delete could not rebuild it —
  a full salary left the month's paid spend and re-appeared as treasury cash
  (measured: paidExpenseIn 500,000 → 0, and 0 again after the delete). A parked
  mark is provably inert while covered (consequence v), so parking costs
  nothing and is the only state the release step can restore from.
  Consequences, each one tested:
  (i)   PAID auto → override: the modal prefills Status = Paid, so an approved
        salary cannot silently become On hold. The tile moves by the DEDUCTION,
        never by a whole salary.
  (ii)  Overriding a paid row *deliberately* as On hold un-approves the MONTH —
        the covering row owns the state and the month's paid spend drops on
        screen — but the mark is PARKED, not deleted: creating a row over a
        person-month is not an act of un-approval. Say it in as many words (the
        ✓, or Status → On hold on an existing covering row) and the mark goes,
        and stays gone through the delete.
  (iii) Deleting a PAID override returns the derived row PAID **with the date
        that person-month was approved on** — the parked mark's own date when
        one was already on record (the upsert re-asserts, it never re-dates),
        and the override's own `paidDate` only when the approval originated on
        the override. Deleting an UNPAID one returns whatever was parked, which
        is precisely the state the override interrupted.
  (iv)  Moving an override to another month, another person, or off payroll
        releases the old person-month carrying the state the override had, then
        shadows the new one — parking, never destroying, at the new end.
  (v)   NO DOUBLE COUNT is possible, and it is now ENFORCED rather than
        asserted. `autoPayroll`'s `covered` set drops the derived row entirely
        while an override exists, so a dormant mark contributes no row and no
        money (proven by comparing every total with and without the mark, to the
        piaster) — but `covered` is a Set of rosterIds and `monthExpenses`
        emits every STORED row, so TWO linked payroll rows for one person-month
        would each count a full salary (measured before the fix: 2 rows,
        paidExpenseIn 1,000,000 for one 5,000 EGP salary). `createExpense` and
        `updateExpense` now refuse the second one and name the row that already
        exists. The unlinked "extra payroll" row is untouched — it adds on top
        by design and claims nobody's salary.
  (vi)  NO ORPHAN MARK. The shadow writes only when the roster actually posts a
        salary for that person-month (`memberAt().active && salary > 0`). A paid
        override for a month the roster does not pay has no derived row to hand
        an approval to; a mark written there survives the delete and would make
        the salary materialise ALREADY APPROVED the day that person is made
        active over that month (measured: paidExpenseIn 0 → 500,000 with nobody
        having ticked anything).
  The SPA had **no transfer at all**: creating a linked row orphaned the mark,
  and deleting it resurrected the derived row from whatever the orphan last
  said, possibly months stale. This is a deliberate CORRECTION of the reference
  app, not a port of it.
- Decision 5 — A NEGATIVE NET IS REFUSED SERVER-SIDE, **ON BOTH PATHS**.
  `expenseAmount` has no floor, so a deduction larger than base + bonus makes
  the row's net negative: the month's paid spend goes DOWN, net profit UP, and
  the treasury GAINS cash from an expense — a typo would fabricate money.
  `expenseSchema` refuses it (*"A deduction cannot be larger than the salary
  plus the bonus."*), with a net of exactly zero allowed. The original had no
  guard here either.
  The IMPORT needed the same floor and did not have it (added after review):
  the import is the only path that has EVER populated these two columns, so it
  is the only path a negative net could ever have entered by — a file with
  `{amount: 5000, deduction: 9000}` imported cleanly and produced a paid
  expense of −400,000 piasters, i.e. one that ADDS EGP 4,000 to paid spend, net
  profit and the treasury. `zExpense` now refuses that line by name and month,
  **loudly and before the REPLACE transaction runs**, exactly as an
  out-of-range amount already is (`egpToPiasters`) — clamping would silently
  rewrite the founder's own historical totals, and the import's whole job is
  that its `verify` numbers reconcile against the old app. Individually
  negative components that still net ≥ 0 (`5000 − (−1000) + (−2000) = 4000`)
  import UNTOUCHED for the same reason: that is what the old app displayed.
- Decision 6 — CLEARING A FIELD STORES NULL, NOT 0. The exporter omits the key
  entirely when the value is null, and `export.integration.test.ts` asserts the
  key is never present-but-null. Writing 0 would start emitting
  `deduction: 0` on every payroll row and change the document shape the old app
  reads. The form reads optional money through `egpOrNull`, never `egp`, whose
  `|| "0"` fallback folds blank to zero. A typed 0 is still a real 0.
- Consequences:
  · `resolveExpenseData` now writes both keys on every create AND update, so an
    edit is AUTHORITATIVE. Until now a PATCH omitted them and Prisma left an
    imported deduction alone by accident. That makes the DTO and the modal
    prefill load-bearing: without them the first edit of an imported payroll row
    would silently zero its deduction and the month's cost would jump. Guarded
    by an integration test that imports the legacy row (deduction 100 /
    bonus 50) and PATCHes it with the exact body the modal sends unchanged.
  · The override prefill carries the derived row's `serviceLine`. It must:
    `departments()` buckets cost by that field, so an override created with a
    blank department would silently move a whole salary out of its department
    into shared Overhead and change every margin on the page. Tested by bucket,
    not just by total.
  · `dashboard().committedSalary` reads `memberAt()` off the ROSTER and
    deliberately does NOT move when an override exists. That is the proof the
    roster was not touched, not a bug to fix.
  · The prefill blanks the derived row's note ("Salary (from roster)") — that
    is exactly what the row stops being, and the blank is where the reason for
    the adjustment goes.
  · Non-payroll rows have both fields forced to null on write, so a stray value
    can never ride a rent row into the export.
  · The mark write is silent inside the expense's own transaction: the
    ActivityLog entry for the expense records the cause, and a second entry for
    a derived consequence would read as a second user action.
  · KNOWN, UNCHANGED: deleting a roster member cascades their marks
    (`AcctPayrollPayment.member onDelete: Cascade`) while `AcctExpense.rosterId`
    is `SetNull`, so an override survives as an unlinked extra payroll row and
    keeps counting. Existing behaviour, recorded here so it is a known answer.
  · DEFERRED: the SPA opened the roster form INLINE on the expenses page,
    pre-scoped to the viewed month (`asOf={month}`); our port links away to
    `/accounting/roster`. Closer to the original, but a separate change around
    the same code — logged, not bundled.

## ADR-059 — 2026-08-21 — ONE stage set for both prospect kinds, Waiting, and the login as its own action
- Context: the founder's written requirements list, section 1, plus his answers
  to three clarifying questions. Four sentences drive everything below:
  1.1 *"Add a new stage called Waiting. Order: Meeting Setting then Waiting then
  Qualified. Leads in Waiting must remain fully editable at any time."*
  1.2 *"Allow leads to be moved directly from Lead to Contacted. The system
  should not require any additional details or mandatory fields when moving a
  lead to Contacted. This applies to both Agents and Partners."*
  1.3 *"Allow leads to be moved directly to Qualified. Moving a lead to
  Qualified should not require creating or entering an email or password. This
  applies to both Agents and Partners."*
  2.1 *"Agents/Partners moved to Contacted should not automatically be treated
  as Follow Up tasks. Currently, Contacted leads are appearing in the To-Do List
  as Follow Up, which is incorrect. Contacted should only indicate that contact
  has been made unless an actual Follow Up task is required."*
  Asked whether partner cards and agent cards should keep the separate stage
  vocabularies ADR-057 gave them a day earlier, he chose **"Same stages for
  both."** This ADR therefore **REVERSES ADR-057's vocabulary split** while
  keeping the two card KINDS distinct. ADR-057's data migration is NOT reverted:
  agent rows already speak the shared keys, and partner rows now join them.
- Decision 1 — ONE STAGE ARRAY, IN THE FOUNDER'S BOARD ORDER.
  `PROSPECT_STAGES = ["lead", "contacted", "didnt_answer", "meeting_setting",
  "waiting", "qualified", "lost"]` replaces both `PARTNER_STAGES` and
  `AGENT_STAGES`, which are deleted rather than aliased (an alias is how the
  "one engine" rule rots). `contacted` stays BEFORE `didnt_answer` because that
  is the order he dictated for the agent columns and he chose that order for
  both kinds; `waiting` sits between `meeting_setting` and `qualified` exactly
  as 1.1 asks. A unit test pins the array and asserts
  `partnersConfig.stages === agentsConfig.stages` — the SAME array object, which
  is the cheapest possible proof that no fork exists.
- Decision 2 — THE TWO KINDS NOW DIFFER IN EXACTLY ONE THING: what Qualified
  does. `KindSlots` shrinks from seven slots to three
  (`wonRequiredGroup`, `wonSideEffect`, `wonTrigger`), and `stages`,
  `terminalStages: [qualified, lost]`, `wonStage: "qualified"` and
  `followUpStage: null` are hoisted into the shared body. A test walks every key
  of the two configs and asserts they are equal apart from those three.
  `nextActions` is now `stages.filter(s => s !== stage)` — the action set IS the
  column set, which is what makes "Waiting moves out in both directions" true by
  construction rather than by a hand-maintained list. One consequence, recorded
  because it is a real behaviour change: `lead` is now offered as a next action
  from the panel, not only reachable by drag or by PP-2's auto-return.
- Decision 3 — CONTACTED PLAYS NO ROLE AT ALL (founder 1.2 + 2.1).
  `followUpStage: null` on the prospect config, and `PipelineConfig.followUpStage`
  widens to `string | null`. `requiredGroupForTarget` guards the follow-up branch
  on the slot being non-null, so Contacted (and Waiting, and a drag back to Lead)
  fall through to `return null`: the move commits immediately, by action or by
  drag, for both kinds, with no Zod change anywhere. Two knock-ons had to be
  handled or the feature would have died silently:
  · `SAME_STAGE_FORM_SLOT.follow_up_again` resolves through `followUpStage`, so
    the "record a follow-up" form would have rendered EMPTY. The UI now asks the
    engine — `requiredGroupFor(config, fromStage, action)`, exported alongside
    `requiredGroupForTarget` — and both the board and the panel switch on the
    GROUP NAME rather than on a target stage. (Review round, Run 062:
    `SAME_STAGE_FORM_SLOT` is DELETED rather than left standing. It had no
    callers left, and a composer that resolves a now-nullable slot is a loaded
    gun for the next reader — its own doc comment still instructed them to use
    it. The two lead panels keep the literal `SAME_STAGE_FORM_TARGET`, which is
    correct for pipelines whose slots really do hold those keys, and its comment
    now points at `requiredGroupFor` as the general answer.) That is also what makes 1.2
    provable in the UI: `requiredGroupForTarget(config, "lead", "contacted")` is
    `null`, so the drag handler commits with no modal, and the rule is stated in
    ONE place instead of three.
  · the cancelled-meeting destinations were hardcoded in the core as
    `[followUpStage, lostStage]`, which with a null slot collapses to Lost alone
    — a cliff nobody asked for. `cancelledDestinations(role)` is now a config
    SLOT; the three lead pipelines return the identical pair they always did
    (asserted), and the prospect pipeline returns Contacted / Waiting / Lost.
- Decision 4 — HOW A FOLLOW-UP IS BORN NOW (founder 2.1). No stage implies one.
  The existing same-stage action `follow_up_again` is promoted: `sameStageExtras`
  offers it from EVERY active stage instead of only the follow-up slot. It
  already ran the whole persist/log/undo/To-Do pipeline, already had a form, an
  undo label and a group of `{follow_up, context: "initial"}`, so this is zero
  new engine concepts. The To-Do projection changes from "the card is in the
  follow-up stage" to "the card's newest child record is a FollowUp", over the
  active stages where a call is still meaningful — `lead, contacted,
  meeting_setting, waiting`. `didnt_answer` is excluded (its key datum is
  already "awaiting a new number") and so are both terminals, because otherwise
  a stale follow-up on a dead card would nag for ever. The card's "Next: {date}"
  datum moves to the same rule. The panel labels the action "Record a
  follow-up"; the SHARED `sameStageActionMsgs.follow_up_again` ("Log another
  follow-up") is left byte-identical for the two lead CRMs, where "another" is
  still correct.
- Decision 4a — WHERE THE FOLLOW-UP RULE ACTUALLY LANDED (amended in the review
  round, Run 062). Decision 4's first draft kept a COLUMN filter in the To-Do
  projection — `lead, contacted, meeting_setting, waiting` — while Decision 4
  itself offers `follow_up_again` from every ACTIVE stage. That left Didn't
  Answer offering the action and then swallowing the record, which contradicts
  SPEC §7.2c's normative sentence ("driven by the existence of the record, never
  by the column the card sits in") and PP-8's "puts the card on the To-Do".
  SPEC wins (CLAUDE.md): the projection is now every active stage, `didnt_answer`
  included, and only the two TERMINALS are excluded — a qualified or lost card
  owes nobody a call, and a stale follow-up there would nag for ever.
  The second half of the same reversal: because a follow-up can now be recorded
  from the meeting column, the two record kinds must stop competing. An arranged,
  unresolved meeting on a `meeting_setting` card emits its To-Do row on its own
  merits; the follow-up row stands BESIDE it instead of replacing it. (A meeting
  arranged AFTER a follow-up still supersedes that follow-up — the call became a
  meeting — but the reverse is not a supersession, it is two commitments.) The
  card carries one line, so there the meeting column keeps its own datum when a
  meeting is arranged and a recorded follow-up fills the line everywhere else.
- Decision 5 — QUALIFIED NEVER ASKS FOR CREDENTIALS (founder 1.3), so minting an
  account becomes its own explicit admin action (§7.2b, row PP-4a).
  · AGENT: `wonRequiredGroup` and `wonSideEffect` are both null, so the move is
    a pure stage change — no group, no side effect, nothing written. The
    `create_agent` side-effect kind is retired from the engine entirely.
  · PARTNER: `wonPartnerSchema` loses its `password` field and the
    `.refine(email ⇒ password)` that demanded one the moment an email was typed.
    Every OTHER completeness requirement is preserved verbatim. The directory
    Partner is still created by the move, now with `userId: null`.
  · The mint moves out of `applyProspectEvent`'s side-effect loop into
    `createAgentAccount(prospectId, input, actor)` and its partner mirror
    `createPartnerLogin`, behind `POST /api/b-systems/partners-pipeline/[id]/account`
    guarded by `requireBsAdmin()` — deliberately NOT `requireProspectCreator()`,
    which admits `bsystems_data_entry`, whose whole ADR-051 charter is two
    create actions and no ownership. Minting a login from a data-entry session
    would be a real privilege escalation, so it has its own e2e 403 row.
  · The writes are byte-for-byte what the transition used to perform, including
    the `PP-4a` trigger on the portal_rep log row, so historic account rows keep
    their meaning. Preconditions, all server-side: right kind, card already in
    Qualified, no account yet, email and phone free.
  · A QUALIFIED AGENT WITH NO LOGIN IS A LEGITIMATE STATE. `converted` stays
    false and `agentUserId` stays null, which is precisely what `converted` has
    always meant, so the UI shows the honest thing — "No login yet" on the card,
    "Qualified, no account yet" on the detail, and the Create-account button in
    the page actions. It cannot live in the action panel: that panel is replaced
    by the terminal sentence the moment a card is Qualified. The seed ships one
    agent in each shape so both are on screen at first login.
  · AMENDED IN THE REVIEW ROUND (Run 062): the same honesty is owed on the
    PARTNER half, and `converted` cannot carry it. PP-4 sets `converted` at
    qualification, long before an admin mints `Partner.userId`, so the board
    showed a converted partner with no way to tell whether a login was still
    owed. The "No login yet" chip is now computed for BOTH kinds from the same
    two conditions the detail's button uses (agent: no `agentUser`; partner: a
    directory row whose `userId` is null). SPEC §7.2b's "(card and detail)" is
    narrowed accordingly: the CARD carries the STATE, the DETAIL carries the
    ACTION. A form-opening button inside a card that is simultaneously a drag
    handle and a whole-card link would fight both.
  · ALSO AMENDED: the ONE board must judge each drop with the DRAGGED CARD's
    config. `PartnersBoard.onDragEnd` resolved `partnersConfigFor("partner")`
    once for the whole board — correct for `config.stages` (the same array
    object for either kind) but wrong for `requiredGroupForTarget`, which
    answers `{group:"won_partner"}` for a partner and `null` for an agent. An
    agent dragged into Qualified therefore opened a confirmation modal with no
    fields in it — the exact opposite of PP-6's pure move. The handler now asks
    `partnersConfigFor(card.kind)`, and the shared `config` is kept only for
    rendering the columns. An e2e row and a unit row pin both answers.
  · An agent's move to Qualified is now UNDOABLE — nothing irreversible happens
    any more — while the ACCOUNT action retires the actor's pending undo set
    itself (ADR-045). Without that, an agent could gain a live login while the
    Undo button still offered to walk his card back to Meeting Setting.
- Decision 6 — ONE BOARD AGAIN. With both kinds sharing one stage set, ADR-057's
  stacked two-board arrangement is redundant: it doubled the page height on a
  phone and duplicated the whole dnd-kit apparatus. `PartnersBoard` is one
  component again — one `DndContext`, one overlay, one modal, one toast slot —
  and the droppable ids are bare stage keys, because the namespacing existed
  only to keep two overlapping stage sets apart on one page. The Kind filter
  stays server-side and simply decides which CARDS arrive. Everything ADR-056
  fixed survives verbatim: the `PointerSensor` distance-6 constraint, the
  click-swallow ref, `useMouseOnlyListeners`, and `CardGrip` INSIDE `CardBody`
  so the drag overlay stays pixel-identical.
- Decision 7 — THE DATA MIGRATION, mirroring ADR-057's statement for statement
  with the predicate inverted (`prisma/migrations/20260821180000_unified_prospect_stages`).
  PARTNER rows walk the same two renames agent rows walked:
  `following_up → contacted`, `won → qualified`; their ActivityLog `fromStage`/
  `toStage` are rewritten (the deliberate exception to append-only that ADR-057
  established); pending UndoEntries whose SNAPSHOT names a dead stage retire the
  whole affected user's pending set. The predicate is `kind <> 'agent'`, the
  exact complement of `partnersConfigFor`, so a row carrying an unexpected kind
  is migrated rather than stranded in no column at all. `entityType =
  'partner_prospect'` on the log joins is load-bearing: internal LEADS still use
  `following_up` and `won` as LIVE stage names and must never be rewritten.
  The restore helper is generalised, not duplicated: `normaliseAgentStages` →
  `normaliseProspectStages`, kind-agnostic, because both keys are now dead for
  both kinds. The anti-drift test was EXTENDED, never bypassed — it executes
  BOTH shipped folders in committed order and diffs the SQL world against the
  TypeScript world on identical fixtures.
- Decision 8 — SPEC. §7.2 is rewritten as one seven-column section with the
  kind-conditional Lead field table, the Qualified gate table for PARTNER cards
  (Email "no", and no password row at all), plus new §7.2b (the account action
  and its own required-field table) and §7.2c (how a follow-up is created).
  §7.2a and §10.2a are superseded pointers. §10.2 becomes PP-1…PP-9 for the one
  pipeline; PA-1…PA-5 are retired and stored ActivityLog rows carrying them
  remain valid history. Trigger ids: PP-1/PP-2/PP-3 are shared by both kinds,
  PP-4 keeps its meaning (partner gate → directory Partner), and the agent's
  terminal row gets the NEW id PP-6 because PA-4's meaning changed completely —
  reusing it would have made old rows lie.
- Consequences:
  · `historyPhrases.ts` keys off the configs' `numberAdded` slot, which now
    yields ONE id, so `PA-2` is named explicitly as a LEGACY entry. Every agent
    card moved during ADR-057's two days carries it, and dropping the key would
    have silently removed their "Returned to Lead — new number added" pill.
  · `applyProspectEvent` now REFUSES a group payload on a move that requires
    none, instead of ignoring it. Silently accepting `won_agent` on a Qualified
    move would let a stale client believe it had minted an account.
  · Deprecated-but-kept dict entries (English values are never edited):
    `pPipeline.terminalToast`, `sectionPartners`, `sectionAgents`,
    `noPartnerCards`, `noAgentCards`, `pPanel.wonGateHint`, `qualifiedAgentHint`,
    `passwordHint`, `pDirectory.empty`, `pForms.kindLockedPipelines`,
    `cvOptionalHintQualified`. `terminalToastAgent` keeps its historical key name
    and is now the board's ONE terminal sentence.
  · The Waiting stage token family lands in all THREE scopes plus the Tailwind
    bridge and the `[data-stage-key]` binding, valued by
    DESIGN-APPLICATION-SPEC §1.3's stated DERIVED rule (the arithmetic RGB
    midpoint of meeting ↔ qualified, the Negotiation precedent). A guard test
    asserts `stageKey("waiting") === "waiting"` by name, because aliasing it
    onto an existing key satisfies every other assertion while painting the
    column with a borrowed ramp for ever.
  · NEEDS FOUNDER CONFIRMATION (SPEC §11 A-14): Qualified stays TERMINAL, as it
    always was. A card qualified by mistake can only be walked back inside
    Undo's 10-minute window, or deleted. That mattered less when qualifying
    minted an account; now that it is free, mis-qualifying is cheaper to do and
    just as hard to reverse.

## ADR-060 — 2026-08-22 — The roster locks from the expense row; campaigns become a real cost; B-Systems becomes a department; switching gets a phone bar; the saved app wears the real mark
- Context: the founder's written list, sections 3 and 4, five confirmed asks.
  (3.2) "Salary expenses should not be editable in the B-Roll Roster" — read
  and confirmed as: remove the "Edit in roster" shortcut from the expense row.
  (3.3) a "Media Buying / Campaigns" expense type that IS a real cost, in both
  companies. (3.4/3.5) "B Systems" as an option under Overhead and under
  Department. (4.1) switching between the modules must work properly on
  mobile. (4.2) the mobile app icon must be the official B-Systems logo.
- Decision, part A — THE ROSTER PATH IS LOCKED. The derived salary row on
  /accounting/expenses no longer links to the roster; a real salary change is
  made ONLY on the Payroll Roster page (module nav), from that month forward.
  The row keeps the approval toggle and the ADR-058 month-only override
  ("Adjust this month only"), and the `from roster` badge gains a hover hint
  (new dict key `fromRosterHint`, EN + real Arabic) saying where the salary
  lives — removing the link must not strand the user. The dict keys
  `editInRoster` / `editInRosterHint` were DELETED with the affordance the
  founder asked to remove; that is not a reword of a surviving string — every
  English string still on screen is byte-identical. (The original SPA's only
  non-approve control on that row was this same shortcut, and the SPA had no
  month-only path at all; we keep its rule that the roster is where a salary
  changes, drop its shortcut, and keep the override it never had.)
- Decision, part B — `media_campaign`, "Media Buying / Campaigns" /
  "شراء الإعلانات / الحملات": a NORMAL expense type, an ordinary cost that
  counts against profit, available under BOTH companies. It sits directly
  after "media" ("Media Spend (pass-through)") in the dropdown so the
  distinction is visible at the point of choice. `mediaHidden()` and both of
  its call-site gates stay STRICT EQUALITY on the literals "media" /
  "media_fee" — nothing hides the new type from anyone; a test pins this.
  DELIBERATE DIVERGENCE from the "unions mirror the SPA id sets exactly"
  invariant (constants.ts header, amended in the same edit): the old app does
  not know the id. Verified consequences: our export emits the id verbatim;
  the old app's import never validates type, adds the row up identically
  (its expenseAmount branches only on payroll), and renders the raw id as the
  label; its ONE hazard is the Type Select in its edit form, which renders
  unselected for an unknown id — an untouched Save keeps the value, but one
  stray click re-types the row (cost unchanged either way). Importing an OLD
  file is untouched — the importer has no enum on these columns. The
  founder's real books already contain two campaign expenses booked under the
  pass-through "media" LABEL (mediaLedger empty), which is exactly the gap
  this type closes; both are ordinary costs today, so a later re-type of
  those two rows would move no number.
- Decision, part C — `bsystems`, labeled "B-Systems" in BOTH languages (brand
  names stay untranslated — the dictionary's own precedent, acctCompanies):
  one new ACCT_DEPTS entry. The founder's 3.4 and 3.5 are ONE change: the
  "Overhead" he names is the expense modal's Department select, whose blank
  option reads "— Overhead —", and the "Department" is the roster modal's
  select — both (plus the income modal and the departments report) render
  from the same ACCT_DEPTS array. There is no separate Overhead control
  anywhere (verified: the only "Overhead" OPTION in src/ and in the SPA is
  that blank option). Money consequence, stated so it is not read as a bug:
  tagging a cost or a person to B-Systems moves it OUT of "Shared / overhead
  costs (untagged)" and into the B-Systems direct-cost line on the
  departments screen — net profit on the P&L does not move (pnl() never reads
  serviceLine). Old-app divergence: its departments report iterates its OWN
  dept list and counts overhead only for untagged rows, so a bsystems-tagged
  row would appear in NO line there (understated totalCost); recorded in
  IMPLEMENTATION as the one-way degradation.
- Decision, part C cleanup (same select, called out, not silent): the income
  modal used to render "Other" twice — DeptOptions skipped media_fee
  unconditionally in its map while the modal re-added media_fee and "other"
  by hand. DeptOptions now renders media_fee itself (income modal only, and
  never under a company that hides Media Buying) and the hand-added options
  are gone. Same values, same order rule ("Other" last), one fewer duplicate.
- Decision, part D — THE MODULE BAR. At 820px and below the rigid header
  switcher (~307px EN) leaves the header entirely (it measurably overflowed
  the 601–645px band by +44px — the ADR-054 four-segment strip moved
  BUG-010's band up, exactly between qa-sweep's sampled widths) and the four
  shells render EntitySwitch in a new "bar" variant directly under the
  header: a full-width strip of equal 1fr cells (mathematically unable to
  overflow any width or zoom), 44px-tall targets, one tap, current module
  inverted on the primary token. Single-entity users get no bar (the
  component still returns null below two segments). The header copy gets its
  own class (.switcher-entity) so the old 600px rule now governs only the
  LanguageToggle — the two share the .switcher class, which is why the hiding
  had to be untangled. The burger sheet keeps its own copy (every control
  reachable in the sheet), re-grounded on the light card: the indigo-header
  segment colors used to bleed into the sheet (it lives INSIDE the header
  element) and painted the sheet's switchers near-white-on-white — the same
  trap .nav-sheet-extras .nav-item had already fixed for Log out. The bar is
  deliberately NEUTRAL (surface-card ground in every brand) rather than
  indigo: the non-current segment ink token (--color-faint) is only
  guaranteed legible on light surfaces, and one look across all four shells
  beats a per-brand repaint. No new tokens; no new strings. qa-sweep now
  samples 601px permanently.
- Decision, part E — THE INSTALL IDENTITY. src/app/(home)/icon.svg (the login
  screen's and Add-to-Home-Screen's favicon) now embeds the OFFICIAL
  B-Systems mark (metadata-stripped, downscaled re-encode of
  public/brand/b-systems/logo-mark.png — about 9KB instead of the 82KB
  c2pa-laden original), replacing the generic gradient placeholder. New root
  metadata files: src/app/apple-icon.png (180×180, mark on a SOLID WHITE
  plate — iOS composites transparency onto black) and src/app/manifest.ts
  (name "B-Systems", theme #1D267D mirroring --bs-indigo, three PNG icons
  incl. a maskable 512 with the mark inside the safe zone). Root metadata
  conventions inject without a root layout (ADR-007's per-group html
  stamping untouched) — proven on the built app by e2e/app-icon.spec.ts.
  Every other route group's icon is untouched; accepted side effect: an iOS
  save made INSIDE the ByteForce CRM also carries the B-Systems mark (the
  root apple-icon is platform-wide; a ByteForce square mark does not exist —
  A-13).
- Alternatives considered: (A) keeping the roster link with a warning —
  rejected, the founder asked for the path to go. (B) reusing the existing
  "media" type with a new label — rejected, it would re-label pass-through
  client budget as own cost; a separate id keeps the two meanings apart.
  (B2) mapping the new id to "other" on export so the old app never sees it —
  rejected, it would silently re-bucket his P&L on every round trip.
  (C) a company-named department under ByteForce only — rejected, both
  companies may tag work to B-Systems. (D) un-hiding the rigid header strip
  on phones — rejected, that is the exact regression the CSS comment
  documents; also rejected: sheet-only switching (two taps plus a scroll on
  short phones, poor discoverability). (E) per-group apple-icons — kept as
  the fallback if root injection had failed on the built app; it did not.
- Resolves: —
- Status: Accepted
- Needs founder confirmation: (1) the DEPARTMENT named B-Systems sits beside
  the COMPANY filter named B-Systems — confirm he means a service line, not
  the company scope. (2) whether his two existing campaign expenses booked
  under "Media Spend (pass-through)" should be re-typed to the new
  "Media Buying / Campaigns" (no number moves either way). (3) the iOS save
  from inside ByteForce carrying the B-Systems mark (4.2 as written asks for
  exactly this; flag only if he objects).

## ADR-061 — 2026-08-23 — Follow-ups are date-only; a Today chip on the Following Up columns; the To-Do goes Today-only and drops partner tasks
- Context: three verbatim founder requests in one session. (1) "remove the
  time of the follow up just the date" — the agent light form already
  collected the day only (V2 §3), with `followUpDueAt` defaulting the slot to
  09:00 Cairo; every other role still asked for a time and every surface
  printed one. (2) "make a little filter in top of the follow up column
  called today when you can just see today's follow ups". (3) "remove all the
  overdue section in the to do section and also remove the partners tasks
  from the to do".
- Decision:
  - **Date-only follow-ups, no schema change.** `FollowUp.dueAt` stays ONE
    UTC instant; every follow-up form (ByteForce panel/board, B-Systems
    role forms, prospect panel, portal group forms) loses its time input and
    sends no `time`; the server-side `followUpSchema.time` stays OPTIONAL —
    never required — so API callers and old clients keep working, and the
    absent slot defaults to 09:00 Cairo in `followUpDueAt` (the V2 §3
    convention, now universal). Existing rows keep their stored instants and
    simply RENDER date-only: board key datums (Next/Response), stage records
    (GroupHistory, hence lead detail + call sheet), the prospect card line,
    and the To-Do rows (`withTime: false` on the two follow-up kinds).
    MEETINGS ARE NOT TOUCHED — a meeting genuinely has a time; every meeting
    and meeting-reschedule time input and display keeps it. Review
    hardening: `followUpDueAt` re-anchors one hour forward when the combined
    instant slips off the posted Cairo date (an API-posted 00:xx on Egypt's
    spring-forward day — the wall-clock does not exist and the solver lands
    on the eve), mirroring `startOfCairoDay`; a follow-up always stays on
    the date the caller posted.
  - **The Today chip.** A small toggle chip ("Today · N") in the Following Up
    column head of BOTH lead boards — B-Systems and ByteForce alike, per the
    ADR-042 parity rule. Client-side over the already-loaded cards (the board
    payload gains `followUpDueAt` on Following Up cards): no query knob, no
    URL state, default OFF, and it composes with the server-side FilterPanel
    by construction (it narrows whatever the server sent). "Today" is the
    CAIRO calendar day (utcToCairo day-strings — the `sameCairoDay`
    definition, never a local-timezone Date comparison), sampled after
    mount and re-sampled on every press rather than at render, so the
    SSR'd boards cannot hydration-mismatch or go stale across Cairo
    midnight (review; the shared `useTodayFilter` hook owns this). The
    chip is a real
    <button> with `aria-pressed`; colors ride the column's stage vars
    (tokens only — no new tokens, so the ADR-057 three-scope law is
    untouched). The droppable stays the whole column, so a filtered column
    still accepts drops, and the count pill shows what is actually rendered.
    A pressed chip with zero matches while cards are merely hidden says
    "No follow-ups due today" (new key, real Arabic), not the empty-column
    line (review).
    The PROSPECT board gets NO chip: since ADR-059 it has no follow-up
    column to put one on (follow-ups are records from any active stage).
  - **Today-only To-Do.** `todoFor` no longer computes or returns an
    `overdue` list, and no longer emits the `prospect_follow_up` /
    `prospect_meeting` kinds at all — removed at the SERVICE so the
    projection is honest, not hidden in the view. `cairoDayWindow` stays.
    TodoBody renders a single Today section. The MONEY kinds are not partner
    tasks and STAY: statements and milestones keep their due-before-end-of-
    today semantics (`expected < end` of today), so a payment expected
    YESTERDAY still shows under Today — money must not silently vanish.
    Consequence, deliberate and by the founder's instruction: an overdue
    follow-up or meeting no longer appears on the To-Do at all (the board
    cards still show it). This supersedes the earlier remain-visible-until-
    completed principle for overdue items (Entry 041/ADR-041 era) and is
    flagged under "Needs founder confirmation" in PROGRESS Entry 056.
- Alternatives considered: requiring a DB migration to a date column for
  follow-ups (rejected: the instant keeps sorting/windowing trivial and old
  data untouched); making `time` invalid server-side (rejected: breaks API
  callers for zero gain); a server-side `?due=today` query for the chip
  (rejected: the founder asked for a little toggle on loaded cards — a
  round-trip filter is heavier and fights the drag board); keeping overdue
  follow-ups in the Today list instead of dropping them (rejected: he said
  "remove all the overdue section", and the boards still show the date; the
  money exception is kept precisely because statements/milestones are not
  what he pointed at); hiding prospect rows in TodoBody only (rejected: the
  service must not emit rows no page may show).
- Resolves: —
- Status: Accepted

## ADR-062 — 2026-08-23 — To-Do completion: a projection plus one small table, keyed to the record, day-scoped
- Context: founder items 2.2/2.3 — "The To-Do List should be properly
  connected to CRM activity... The task can be completed in two ways:
  1. Automatically through CRM movement... 2. Manually: by marking the task
  as completed", with his example (a Follow Up completing when the lead
  reaches Meeting Setting) and "Add a checkbox next to every task... Completed
  tasks should be visually distinguished and removed from the active task
  list... move to a completed/done tasks section." The To-Do was already a
  pure projection (ADR-041) reshaped to Today-only (ADR-061): the AUTO half
  mostly happened — a resolved task simply left the list — but it vanished
  without a trace, and no manual completion existed at all.
- Decision:
  - **Auto stays derived; only MANUAL becomes state.** One new table,
    `TodoDone`: four nullable UNIQUE cascade FKs (followUpId / meetingId /
    statementId / milestoneId — the FollowUp dual-parent house pattern;
    exactly one set, service invariant), `dueAt` snapshot, `completedById`
    (SetNull) + `completedByLabel` (the label-survives-deletion convention),
    `completedAt`. A bare polymorphic (kind, recordId) pair was ruled out by
    the schema's own cascade-planning law — a column with no relation is
    invisible to cascade planning. All four FKs cascade, so `deleteLead`'s
    hand-deleted statements/milestones and the Lead→FollowUp/Meeting cascades
    retire marks at the database, with no service code knowing.
  - **The identity IS the record id.** The founder's complaint dissolves by
    construction: follow-ups are append-only, so a new follow-up on the same
    lead is a new row, a new id, and an unchecked checkbox — nothing is keyed
    to the lead or to a rendered string. The ONE record edited in place
    (Meeting on reschedule) is covered by the `dueAt` snapshot rule: the
    projection honours a mark only while the snapshot equals the record's
    current due instant, so a rescheduled meeting resets to unchecked with
    zero hooks in the reschedule path.
  - **A manual mark is valid for the Cairo day it was made.** The projection
    counts marks with `completedAt` in today's window only. For lead kinds
    this is free (yesterday's task is off the list anyway — ADR-061); for the
    MONEY kinds it is load-bearing: a checked-but-still-pending statement or
    milestone returns to Today unchecked tomorrow, preserving ADR-061's
    money-never-vanishes asymmetry. Checking again on a later day refreshes
    the stamp (upsert), so the hide is always a same-day decision.
  - **The Done section derives, today only.** Below Today, rendered only when
    nonempty (the ADR-041 Overdue precedent): the manual marks plus every
    record that carries TODAY's date but is no longer live — labelled with
    what completed it (moved to {stage} / superseded / meeting outcome /
    paid / milestone completed; money auto-dones window on paidAt/completedAt
    today so yesterday's payment does not resurface). AUTO WINS over a stale
    manual mark: the CRM reason is the truer one, and an auto row must not
    offer a restore that cannot restore. Manual rows uncheck back to Today
    (delete the mark); auto rows render the checkbox disabled — reversing the
    CRM is a CRM action, not a To-Do action.
  - **Walls re-derived from the RECORD, never trusted from input.** Two thin
    routes over one service (`/api/b-systems/todo/done`,
    `/api/byteforce/todo/done` — brand from the ROUTE): lead kinds resolve
    the record's leadId (a prospect-parented record 404s outright — ADR-061)
    and pass `requireLeadAccess`; the money kinds are `requireBsAdmin` and
    exist only on the B-Systems route. The service additionally refuses any
    record that is not a live task in today's window (wrong stage,
    superseded, archived, resolved, wrong brand), so `TodoDone` rows stay
    meaningful.
  - **Uncheck is the reversal — no UndoEntry.** The checkbox is its own
    two-way switch (the comments.ts precedent for a lightweight
    self-reversing action outside the undo system); money moves keep their
    existing invalidation semantics untouched because manual completion never
    mutates the underlying record. No ActivityLog either: a To-Do mark is a
    personal day-list gesture, not a CRM event — the completer's name lives
    on the mark itself.
  - **UI**: a native checkbox FIRST in each row (clear of the ADR-055 admin
    action cluster at the row end; RTL-correct by flex order), in a new
    string-free shared client component on the MilestoneCheckbox pattern;
    done rows are struck through + muted with a small reason label. Zero new
    tokens (the three-scope law is untouched); new i18n keys appended with
    real Arabic, every existing EN string byte-identical.
- Alternatives considered: materialising auto-completions as rows (rejected:
  double bookkeeping against ADR-041's projection philosophy — the CRM already
  knows); keying the mark to the lead or the rendered row (rejected: the
  founder's exact complaint — completion must be per-task); a (kind, recordId)
  string pair without relations (rejected: invisible to cascade planning,
  ADR-049); resetting rescheduled meetings via hooks in the reschedule path
  (rejected: the dueAt snapshot does it declaratively in one place);
  permanent manual marks on money tasks (rejected: overrides the deliberate
  money-never-vanishes rule for ever); making manual completion undoable via
  UndoEntry (rejected: the uncheck IS the undo, and consuming undo rows for a
  checkbox gesture would retire real pending reverts).
- Review hardening (folded in before shipping, same ADR — the shape did not
  change, four edges did):
  - **Auth before the lookup.** These are the one route shape that must read a
    record to find the lead it hangs off, so `leadIdOfTodoRecord` was running
    *before* the first guard — an anonymous POST got 404 for a made-up id and
    401 for a real one, a record-existence oracle with no session. Both routes
    now call `requireUser()` first and hand the caller down: `requireLeadAccess`
    takes an optional already-authenticated user, and `assertRole` (the role
    check split out of `requireRole`) does the money kinds' admin gate without
    a second session round-trip. Anonymous is 401 either way, with a
    byte-identical message.
  - **A DELAYED meeting is a MOVED task, not a completed one** (SPEC §5.8 now
    says so). T-7 nulls the outcome in the same transaction as the new
    datetime, so the row simply leaves today's window and returns to Today on
    its new date; delayed to later the SAME day it never leaves. The
    `doneMeetingDelayed` label is kept anyway, because the state is reachable
    on the undo path (BUG-013) and falling through to "Meeting attended" would
    be a lie.
  - **The Done section states its day scope on the page** (`doneScope` —
    "Completed today"), not only in this ADR: the founder is the one person
    guaranteed to tick a statement and meet it again tomorrow.
  - **The checkbox survives a dead network.** A rejected `fetch` (offline,
    server restart mid-request) is not a non-ok response; it was escaping the
    handler and leaving `busy` true, so the row's control died until a reload.
    try/catch/finally: the message shows, the control re-enables, the click
    can be repeated.
  - **§13's wall clause is now backed by tests.** `todo-done-routes.integration.test.ts`
    drives the REAL route handlers against the real Postgres with only the
    session stubbed (`vi.mock` on `@/lib/auth/index`) — sales/agent/partner/
    byteforce_staff/admin scope, uncheck under the same wall, brand both
    directions, the money kinds' admin gate, the ADR-061 prospect 404, a
    deactivated account, and the anonymous 401.
- Interpretations flagged — Needs founder confirmation (PROGRESS Entry 057):
  (a) a follow-up DUE today whose lead moved stage on an EARLIER day still
  lists under today's Done (windowing is on the task's due date; deriving
  "when the move happened" would need history scans) — it reads as honest, but
  it is an interpretation, not his sentence; (b) a manual tick on a money task
  hides it for TODAY only; (c) a meeting delayed to another day leaves Today
  with no Done row (above) — the alternative, giving it a "Meeting delayed"
  Done row, would need the pre-reschedule instant snapshotted, i.e. a schema
  column, so it is deferred until he says he wants it.
- Resolves: —
- Status: Accepted

## ADR-063 — 2026-08-25 — The follow-up time comes back OPTIONAL; one flag says whether it was chosen
- Context: founder, verbatim — "let's get the time back for the follow up but
  it's not mandtory". This REFINES ADR-061 (three days old), it does not
  revert it: ADR-061 removed the time input from all four follow-up forms,
  made every follow-up render date-only, and defaulted the stored slot to
  09:00 Cairo. The day-only default stays the norm; the time becomes an
  available extra. The server never stopped accepting it — `followUpSchema.time`
  has been `.optional()` throughout — so this is a client and a DISPLAY
  problem, plus the one thing the data cannot express.
- Decision:
  - **The display problem, stated.** `FollowUp.dueAt` is ONE UTC instant, so a
    blank submission (09:00 Cairo by ADR-061's default) and a deliberate 09:00
    are byte-identical. Simply turning the clock back on everywhere would print
    "9:00 AM" on every follow-up recorded during the date-only window — a time
    nobody chose. No formatting rule can fix that; the information is not in
    the row.
  - **One marker: `FollowUp.dueTimeSet Boolean @default(false)`.** Set TRUE
    only when a time actually arrived on the wire (`followUpDueTimeSet` in
    groups.ts — `input.time !== undefined`, next door to `followUpDueAt` so the
    slot rule and the marker rule cannot drift). A BOOLEAN, not a nullable
    "HH:mm" string: `dueAt` must stay the single source of the instant, and a
    second copy of the wall clock is a second thing to keep in sync (and to get
    wrong across DST). Migration `20260825093000_follow_up_due_time_set`.
  - **Backfill, honest and stated: 09:00 Cairo means date-only.** Existing rows
    are marked time-set exactly when their stored instant is NOT 09:00 on the
    CAIRO wall clock (`("dueAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')::time
    <> TIME '09:00'`) — those are the pre-ADR-061 rows, written when every form
    REQUIRED a time, so the user really picked it and their times come back.
    Rows at exactly 09:00 Cairo stay date-only: every row created during the
    date-only window, plus **the one accepted FALSE NEGATIVE — someone who
    deliberately typed 09:00 before ADR-061 loses that clock.** The rule errs
    toward showing LESS (a date the user certainly meant) rather than inventing
    a time, and the alternative — reading history to find which form was live
    when each row was written — is a scan with no better answer. Flagged for
    founder confirmation in PROGRESS Entry 058.
    The rule is re-runnable by construction (`WHERE "dueTimeSet" = false`, and
    every row left false is at 09:00), and `ADD COLUMN IF NOT EXISTS` keeps the
    DDL replayable at boot (scripts/start.mjs retries `migrate deploy`).
  - **`importBackup` carries the same rule.** A backup exported before the
    marker holds FollowUp rows with no `dueTimeSet`; `createMany` would restore
    them at the default and silently flatten every legacy chosen time. So
    `backfillFollowUpDueTimeSet` runs inside the restore transaction — the same
    twin arrangement ADR-057/ADR-059 use for `normaliseProspectStages`, and a
    parity test runs both against identical fixtures and diffs the result.
  - **…but ONLY for a pre-marker payload — the twin is GATED, and the stage
    twin is not.** (Review finding, fixed before push.) The two twins are not
    symmetric. A retired stage key can never be a legitimate value, so
    `normaliseProspectStages` is safe to run blind. `dueTimeSet = false` very
    much can be legitimate, and `exportBackup` calls `findMany()` with no
    `select`, so a POST-marker export states `"dueTimeSet": false` EXPLICITLY on
    every date-only row. Running the backfill over those would hand a follow-up
    a clock nobody chose — the exact failure this ADR exists to prevent, arriving
    through the restore door. A PRE-marker export has no such key at all, so the
    payload itself distinguishes the two eras: `predatesFollowUpDueTimeSet(rows)`
    (`rows.some(r => !("dueTimeSet" in r))`) decides, and only then does the
    backfill run. Rejected: bumping `BACKUP_VERSION` to gate on the number —
    the version has never tracked the schema in this repo (the vault, the
    accounting tables and ADR-062's TodoDone all landed at version 1), and
    raising it would make every older deployment reject a newer file it can in
    fact read. Proved with a round-trip test, red first: a `dueTimeSet = false`
    row at 10:00 Cairo came back `true` before the gate and `false` after.
  - **A seeded instant must state its intent.** (Same review.) The rule the
    backfill rests on — `dueTimeSet = false` ⇒ 09:00 Cairo — is an INVARIANT of
    every write path, and `prisma/seed.ts` was the one place breaking it: four
    demo follow-ups authored at 10:00 / 11:00 / 12:00 / 13:00 Cairo with no
    marker at all. Three now carry `dueTimeSet: true` (they read as chosen
    hours), and the partner-referred lead's moved to 09:00 Cairo and stays
    unmarked — so the demo database carries one honest example of EACH shape,
    and no write path in the repo produces a row the backfill would have to
    guess about.
  - **The spring-forward hour-shift becomes VISIBLE, and is accepted.** (Same
    review.) `followUpDueAt`'s re-anchor nudges a posted 00:00–00:59 forward an
    hour on Egypt's spring-forward day, because that wall clock does not exist:
    on 2026-04-24 a posted 00:30 is stored — and now PRINTED — as 01:30. Under
    ADR-061 no clock was printed, so the nudge was invisible; it is the same
    instant either way. No behaviour change: there is no instant that both keeps
    the posted DAY and shows 00:30, and the day is what a follow-up is about.
    Proved over every 2026 transition — 45 date×time cases, 45 keep their day,
    and those three are the only clocks that move. Noted beside the nudge in
    groups.ts.
  - **The field is optional and LOOKS optional.** The time input returns to all
    four follow-up forms (internal LeadEventPanel, bsystems roleForms — light
    variants included, partners ProspectEventPanel, portal groupForms) with NO
    `required` attribute, beside the date in the same two-column grid the
    meeting forms already use. The label reuses the house's optional idiom
    ("Department (optional)", "Label (optional)") as a SUFFIX —
    `optionalLabel(locale, followUpTime)` in labels.ts — so the four
    `followUpTime` keys ADR-061 left unreferenced are re-referenced verbatim,
    English byte-identical, rather than duplicated into four near-copies. One
    new Msg, `optionalSuffix` ("(optional)" / "(اختياري)").
  - **Every follow-up display becomes conditional; meetings do not.**
    `formatCairo(dueAt, dueTimeSet)` replaces the flat `formatCairoDate` on the
    B-Systems board key datum (Next AND the negotiation Response datum), the
    ByteForce board key datum, the prospect card line, and `GroupHistory` (one
    line that feeds the lead detail, the prospect detail AND the call sheet).
    `todo.ts` `withTime` is now PER ROW (`f.dueTimeSet`) on both the Today and
    the Done follow-up rows instead of the ADR-061 constant `false`. Meetings
    keep `withTime: true` and their required time inputs, untouched — a meeting
    genuinely has a time.
  - **The Cairo calendar day is untouched.** A time is a detail OF the day: the
    Today chip, `cairoDayWindow`, and the To-Do windows all still key on the
    Cairo day-string, and `followUpDueAt`'s spring-forward re-anchor still keeps
    a posted time on its posted date. Pinned at 23:30/23:45 and at 00:30 on
    Egypt's transition day, in both the integration and the e2e suites.
- Alternatives considered: a nullable `dueTime` "HH:mm" column (rejected: two
  sources for one wall clock — `dueAt` would still be the instant everything
  sorts and windows by, and the copy would drift across DST); inferring
  "chosen" from `dueAt` at RENDER time instead of storing a flag (rejected:
  that is the backfill's false negative made permanent — every future
  deliberate 09:00 would print as a date, for ever); making the time REQUIRED
  again (rejected: he said "not mandtory"); dropping the marker and printing
  the clock on everything (rejected: it invents a 9:00 AM on every historic
  row — the exact thing ADR-061 was asked to remove); a separate
  "date-only" checkbox in the form (rejected: an empty box already says it).
- Resolves: refines ADR-061 (display half); ADR-061's server default and DST
  re-anchor stand unchanged.
- Status: Accepted

## ADR-064 — 2026-08-25 — Meeting Setting is a diary: soonest first, with the Today chip; "didn't answer" becomes a tally
- Context: two founder requests, verbatim.
  1. "the column of meeting setting should be in time order always in order of
     these meetings taking place and also add the today filter on top"
  2. "make the didn't answer button a counter so we can know how many times we
     tried"
  Both are about a board card telling the truth at a glance: one column was
  ordered by the wrong clock, and one marker recorded THAT something happened
  without recording HOW OFTEN.
- Decision:
  - **The Meeting Setting column sorts by WHEN THE MEETING IS, always.** Every
    board column is `updatedAt desc` — right for a queue of work, wrong for a
    column of appointments. That one column now runs soonest-first, on all
    three boards (ByteForce, B-Systems, and the Partners & Agents board, whose
    unified pipeline has a `meeting_setting` stage since ADR-059). "Always"
    means it is a property of the column, not a toggle: there is no control to
    turn it off, because a diary out of order is not a feature.
  - **Where: server-side, in one pure function.** `orderMeetingColumn(cards,
    meetingStage)` in `src/lib/board-order.ts`, called by the three server
    components that BUILD the card lists, so a phone receives the board already
    ordered. It is deliberately NOT a second Prisma `orderBy`: the instant lives
    on a child row (`Meeting.datetime`, latest record wins) and only for cards
    in one stage, which no single relational sort expresses without re-ordering
    the other five columns. It sorts the meeting cards AMONG THEMSELVES and puts
    them back in the slots they already occupied, so every other column keeps
    its `updatedAt desc` byte for byte — pinned by a unit test that checks the
    untouched cards are still at their original indices.
  - **A card with no meeting datetime sorts LAST, and never vanishes.**
    "Meeting not arranged" is a real, common state of that column, and those
    cards are the ones still owing a decision — they belong under the diary, not
    scattered through it. Several of them keep their incoming order (the sort is
    stable, so the fallback is still `updatedAt desc`), and an unparseable
    instant is treated as "no datetime" rather than being allowed to poison the
    comparator with NaN (`Infinity - Infinity`; the comparator branches instead
    of subtracting).
  - **The sort key is the datum the card SHOWS.** `meetingAt` is computed by the
    same expression each board's `keyDatum` already uses — the latest meeting
    record's `datetime`, only while the card sits in that column — so the eye can
    verify the order against the line it reads. Neither the key datum nor the
    sort key consults `arranged` — both ask only whether a datetime is there —
    so a record with NO datetime sinks and every record WITH one is placed by
    its time. **Correction (review).** An earlier draft of this bullet said that
    rule "includes the `arranged = false` + datetime 'proposed slot' (V2 §3)".
    The shape is real in the schema and both expressions handle it, but no write
    path in the app can currently produce it: `persistGroup` stores
    `datetime: payload.data.arranged && date && time ? … : null`, so an
    unarranged meeting is always stored with a null datetime even when the agent
    typed a slot (the typed slot reaches the admin notification from the
    payload, never the row). Every card in the diary today is therefore an
    ARRANGED meeting, and unarranged ones sink. Persisting the proposed slot was
    considered and NOT done here: it would make the card print "Meeting: Oct 5,
    14:00" for a time nobody has agreed to and order the founder's diary by it,
    which is a pipeline behaviour change needing its own ADR and a founder
    answer, not a side effect of a sort.
  - **The Today chip is REUSED, not forked.** ADR-061's `TodayChip` +
    `useTodayFilter` (same component, same count, same `aria-pressed` button,
    same client-side Cairo-day sampling after mount, same "a filtered column
    still accepts drops") now rides five column heads instead of two. The hook
    was generalised by ONE parameter: it took `(leads, enabled)` and read
    `followUpDueAt` itself; it now takes `(items, at)`, where `at` is the
    instant accessor and `null` means "no chip on this column". Accessors are
    module-level consts on each board, because `at` is a memo dependency.
  - **The prospect board gains a chip for the first time.** ADR-061 wrote "the
    prospect board gets no chip: since ADR-059 it has no follow-up column to put
    one on" — an ABSENCE of a column, never a decision that the founder wanted
    less there. It has a meeting column, so it gets the meeting chip, with the
    same shared component and the shared `dict/crm` strings (the same precedent
    the drag-grip label already set: shared board strings are not duplicated
    into `dict/partners`).
  - **One new string, not a reused wrong one:** `noTodayMeetings` ("No meetings
    today" / "لا توجد اجتماعات اليوم"). The filtered empty state must not say
    "No follow-ups due today" in a column that holds no follow-ups.
  - **"Didn't answer" becomes a TALLY: `Lead.noAnswerCount Int @default(0)`.**
    Migration `20260825204500_lead_no_answer_count`, `ADD COLUMN IF NOT EXISTS`
    so it replays at boot (scripts/start.mjs retries `migrate deploy`). Backfill:
    an existing flagged lead starts at **1**, an unflagged one at 0 — once is all
    history can honestly claim, because the old column recorded that it happened,
    never how often. The backfill is guarded `WHERE "noAnswer" = true AND
    "noAnswerCount" = 0`, so a replay matches nothing and can never reset a lead
    that has since counted higher. Proved on a throwaway database: 2 flagged +
    1 unflagged in, 2 rows at count 1 + 1 row at count 0 out; a row manually set
    to 4 survived a second run of the same SQL unchanged.
  - **`noAnswer` is KEPT, and maintained as `noAnswerCount > 0`.** Dropping it
    was rejected outright: `exportBackup`/`importBackup` recreate rows verbatim,
    so removing a column breaks restoring every backup file taken before today —
    and the flag is read by the card badge, the detail headers, the call sheet,
    RBAC tests and any `where: { noAnswer: … }` query. The two fields are written
    together in every path, and that invariant is asserted on EVERY transition in
    the integration suite (a helper reads the row and fails unless `noAnswer ===
    count > 0`).
  - **…which means the RESTORE path needs the migration's twin, and this one is
    UN-GATED.** A backup exported before today holds Lead rows with no
    `noAnswerCount`; `createMany` gives them the column default while `noAnswer`
    is true, and a flagged card with a zero tally wears no marker at all — the
    founder's "we tried" would vanish on the way back in. So
    `backfillNoAnswerCount(tx)` runs inside `importBackup`'s transaction, the
    third such twin after ADR-057/059's stage normalisation and ADR-063's
    `dueTimeSet`. Unlike ADR-063's it needs no era gate: `flagged + 0` is not a
    state any write path can produce, so on a modern payload it matches nothing
    — the same reasoning that lets the stage normalisation run blind. Proved
    both ways: a pre-tally payload restores flagged-at-1, a post-tally payload
    carrying 5 restores at 5.
  - **Pressing "Didn't answer" is no longer idempotent — that IS the feature.**
    `setNoAnswer(brand, id, true, actor)` always increments; the early-return now
    guards only the clear-a-clear-marker case, which keeps ADR-039's "clearing an
    already-clear flag writes no third row". The wire is unchanged
    (`{ value: boolean }`, Zod-parsed server-side): `true` = one more attempt,
    `false` = the Answered press, which resets to 0.
  - **The board card now offers BOTH buttons.** It used to be ONE button that
    flipped its label, which made a second attempt unrecordable — the counter
    would have been unreachable past 1. "Didn't answer" is now always offered on
    an active card, and "Answered — clear flag" appears beside it once there is a
    tally to clear.
  - **ADR-039's auto-clear survives, and takes the tally with it.** Any stage
    move still clears the marker ("any move = contact made"); the count goes to 0
    with it, because the story moved on and the next attempt count starts fresh.
  - **Undo restores the PREVIOUS COUNT exactly, not merely the boolean.** The
    `lead_no_answer` payload carries `{ noAnswer, noAnswerCount }` as they were
    (never a value derived from the incoming `value`), read from INSIDE the
    write's transaction (see the review adjudication below), and
    `StageEventSnapshot`
    gains `noAnswerCount`, so undoing the 4th attempt leaves 3 and undoing an
    Answered press gives the number back. Entries written BEFORE this ADR carry
    only the boolean — the undo window is minutes, but a deploy can land inside
    one — so `noAnswerCountOf(count, noAnswer)` revives a missing or malformed
    count as the honest minimum (flagged means 1, clear means 0).
  - **The badge reads as attempts, and stays compact.** One `NoAnswerBadge`
    component for all five places the marker shows (both boards' cards, both lead
    details, the call sheet), so the number cannot disagree with itself. One
    attempt renders the same two words as always ("No answer" / "لم يرد") — a
    bare "· 1" is noise, and the badge being there IS the one attempt, which also
    keeps the existing English string byte-identical for the e2e that asserts it.
    From 2 up it renders "No answer · 3" in the Today chip's own `label · n`
    shape, already proved to read correctly right-to-left. The unambiguous
    sentence rides `title` + `aria-label`: "Tried once" / "Tried 3 times", and in
    Arabic "محاولة واحدة" / "عدد المحاولات: 3" — phrased count-agnostically on
    purpose, because "11 مرات" is not grammatical Arabic while "عدد المحاولات: 11"
    is. No new CSS: `.badge--noanswer` is unchanged, so nothing new to keep in
    three token scopes.
  - **Prospects get no equivalent.** `services/partners.ts` states that prospects
    carry no lead-style flag; the partnership pipeline has a `didnt_answer`
    STAGE, which is a different mechanism. This request is about leads.
- **Review adjudication (ship gate).** Seven findings were raised against these
  two commits; two pairs were the same defect twice, so five distinct ones. All
  five were verified against the code and schema and all five were FIXED — none
  needed refuting.
  - **(medium, ×2) The tally was a read-modify-write straddling the transaction
    boundary.** `setNoAnswer` read the row through `getLead` (outside the tx),
    computed `lead.noAnswerCount + 1`, then wrote that ABSOLUTE number inside
    the tx. Under READ COMMITTED two overlapping presses both read 2 and both
    wrote 3: two tries made, one recorded — precisely the number the founder
    asked the card to keep. The board's `busy` flag is per-component and
    serialises nothing across a second tab, a phone, or a second rep on a shared
    B-Systems board. Worse, the loser's undo entry snapshotted the count it had
    already lost while its `fingerprint` still matched the row it wrote, so the
    undo was ACCEPTED and rolled the tally further back than the press being
    undone. Fixed by making the write atomic — `noAnswerCount: value ?
    { increment: 1 } : 0`, i.e. `SET "noAnswerCount" = "noAnswerCount" + 1`, so
    the second press blocks on the row lock and counts from the committed value
    — and by taking the undo payload from inside the transaction: the counting
    press derives it from the row the update RETURNED (`fresh.noAnswerCount - 1`,
    with the flag following the number as everywhere else), and the Answered
    press, which resets to an absolute 0, from a read taken inside the tx before
    it. Two new integration cases press CONCURRENTLY against the real embedded
    Postgres: six racing presses must leave six attempts and six activity rows,
    and four racing presses must between them record priors 0/1/2/3 — asserted
    as a set, because the landing order is not deterministic but "every press
    names the number it truly replaced" is.
  - **(low) The ADR's own justification for the sort key cited a row no write
    path can produce.** Corrected in place above: `persistGroup` nulls the
    datetime whenever `arranged` is false, so the `arranged = false` + datetime
    "proposed slot" is real in the schema and handled by both the key datum and
    the sort key, but unreachable today. Persisting it was considered and NOT
    done — it would print a time nobody agreed to and order the founder's diary
    by it, which needs its own ADR and a founder answer.
  - **(low) `aria-label` on a bare `<span>` is prohibited by ARIA.** The badge's
    "Tried 3 times" sentence rode `title` + `aria-label` on an unroled `<span>`,
    which maps to `role=generic`, where ARIA 1.2 forbids a name — conforming
    assistive tech dropped it, so only the hover half of the documented contract
    worked. Fixed with `role="img"`, the standard role for a compound badge read
    as one thing; the e2e attribute assertions are unaffected.
  - **(low) A default drop into Meeting Setting vanished behind its own new
    Today chip.** The drop form defaults to "not arranged", an unarranged
    meeting stores no datetime, and the chip keeps only cards whose instant is
    today — so with the chip pressed the freshly dropped card rendered NOWHERE,
    and near-certainly, since it is the default rather than a choice. Fixed by
    releasing the filter when a card LANDS in that column: `useTodayFilter`
    takes a `landedHere` counter (0 = no drops, so boards that pass nothing keep
    the old behaviour) and each board bumps it for the destination stage on a
    successful commit. Applied to all three boards, which also retires ADR-061's
    latent version of the same papercut on Following Up.
  - **(low, ×2) The column height floor's measured constant went stale.** The
    comment sized `--bcard-h-max` against a card with "the meta row's two
    buttons"; a flagged card now carries three and a widened badge. RE-MEASURED
    in Chromium on the shipped CSS at the 218px six-column width: the richest
    unflagged card is 195.4px and the same card flagged is 235.5px — the badge
    wraps the chips row and the third button wraps the meta row, ~+40px, well
    beyond the ~16px a third button alone would cost. `--bcard-h-max` goes
    204px → **220px** (floor 429 → 461px), which covers every flagged card
    measured and is also the MOST the floor may take: 461px still sits under
    62vh on the founder's 1440x760 monitor (471px), so his column does not move
    — the whole point of the documented band. The four-way exotic stack (2-line
    name AND a company AND a tally AND a long meeting datum) still beats it,
    exactly as a freakishly long key datum always beat 204px; the comment says
    so with the real numbers. The e2e A6 fixture now FLAGS its last lead, so the
    live oracle is taken from the tallest card a rep can actually produce
    (measured 195.3px, two of which fit the new floor) instead of a card shape
    the board no longer shows.
- Alternatives considered: a client-side sort inside the board component
  (rejected: the card list is built server-side, and the client would then own an
  ordering rule the server contradicts); a `Lead.nextMeetingAt` denormalised
  column kept in sync by the meeting writes (rejected: a second source for a
  child row's field, for a sort over at most a screenful of cards); hiding
  datetime-less cards while the column is sorted (rejected: a card must never
  disappear from its own column); showing "· 1" on a single attempt (rejected:
  one attempt should not read as a clumsy 1); DROPPING `noAnswer` for the count
  alone (rejected: the backup/restore path recreates rows verbatim and every
  existing reader keys on the flag); incrementing on a dedicated
  `/no-answer/increment` route (rejected: the existing `{ value: boolean }` route
  already says "one more" vs "reset", and a new route would leave two ways to
  write one field); a separate Arabic plural form per count band (rejected: the
  count-agnostic phrasing is correct for every n, and plural rules belong in a
  real ICU layer, not in four hand-written keys).
- Resolves: extends ADR-061 (the chip, generalised) and ADR-039 (the marker,
  counted); ADR-039's auto-clear and idempotent-clear both stand.
- Status: Accepted

## ADR-065 — 2026-08-25 — An unread notification wears a POSITIVE mark; the installed app receives real web push, feature-flagged off until the host has keys
- Context: two founder requests, verbatim.
  1. "make a distict mark or a color for the un opened notifications"
  2. "also I want the website to sent actual notification so I installed the
     website as an app on my phone I want it to shoot me actual notifications"
  Both are about the bell finally being worth looking at: one about telling new
  from seen at a glance, one about not having to look at all. ADR-060 shipped
  the web manifest three days ago (`display: standalone`, the official
  B-Systems icons) and the founder has already saved the site to his home
  screen — which is the exact precondition iOS requires before it will deliver
  a web push at all.

### 1. The unread mark is a MARK, not the absence of a dimming
- **The defect, stated plainly.** `NotificationsBell` signalled read-ness with a
  single Tailwind `opacity-60` on READ rows. An absence only reads against a
  present neighbour: with every row unread — the common case for someone who
  has been away — the menu carried no signal at all, and the founder's own
  words ("make a distict mark") say he was reading it as one undifferentiated
  list.
- **Decision: four cues, none of which is colour alone.** An unread row now
  carries a tinted well (`--color-primary-tint`), a 3px bar down its LOGICAL
  inline start (`--color-accent`), a dot in that same accent, and a title at
  weight 700 instead of 500. Read rows keep the existing dimming, so the two
  states sit in one menu and are told apart without comparison.
- **The mark carries the WORD "Unread"** — `role="img"` + `aria-label` + `title`
  on the dot, the ADR-064 `NoAnswerBadge` precedent (a bare `<span>` maps to
  `role=generic`, where ARIA 1.2 prohibits a name, so conforming assistive tech
  drops it). Colour is never the only channel, and the e2e asserts the word
  rather than a computed colour.
- **NO NEW TOKEN, on purpose.** ADR-057's three-scope law has been broken twice
  in this repo's history, and the cheapest way not to break it a third time is
  not to need it. `--color-accent` is the SAME accent the bell's count badge
  already wears, so the "2" on the bell and the two marked rows beneath it read
  as one statement — ByteForce orange, B-Systems Signal Pink used exactly as
  the brand's 12% cue and never as a canvas. The hover state deepens the tint
  through `color-mix()` over two existing tokens rather than introducing a
  third: a plain `--color-surface` hover would have REMOVED the mark precisely
  while the pointer was on it.
- **The transparent bar is on every row.** `border-inline-start: 3px solid
  transparent` sits on read and unread alike, so marking a row costs no width
  and the text never shifts; `inline-start` puts the bar on the right in Arabic
  with no second rule, which the e2e asserts by reading the computed
  `border-right-width` under RTL.
- **`<p>` inside `<button>` became `<span>` while we were there** — phrasing
  content is what a button's content model allows, and the previous markup was
  invalid HTML. The visual result is byte-identical (`.bell-item-title` is
  `500 14px/20px`, which is exactly what `text-sm font-medium` was).

### 2. Real notifications = web push, a service worker, and VAPID
- **Decision: the standard web stack, nothing bespoke.** A `PushSubscription`
  table, a service worker at the origin root, VAPID keys held by the host, and
  a send hooked into the notification write. No third-party notification
  service, no native app, no polling daemon.
- **`web-push`, not hand-rolled crypto.** A web push is not an HTTP POST: the
  payload must be encrypted per RFC 8291 (ECDH on P-256 into HKDF into
  AES-128-GCM, `aes128gcm` content encoding) and the request signed per RFC
  8292 (an ES256 JWT). All of that is expressible with Node's WebCrypto — and
  all of it fails SILENTLY when subtly wrong: the push service returns 201 and
  the phone simply never buzzes. Nothing in CI can catch that, because CI has no
  push service and no phone. Hand-rolling was seriously considered and rejected
  on exactly that asymmetry. The dependency is imported DYNAMICALLY, from inside
  a configured send only, so it can never be traced into a client bundle and a
  missing module degrades to "no push" rather than a boot failure. Verified: the
  built client bundle contains zero occurrences of `web-push`, `vapidDetails`,
  `VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY`.
- **ONE central write, so no type can be missed.** There were THREE places a
  `Notification` row was created — `notifyAdmins`, `notifyUser`, and a
  `tx.notification.create` of its own inside `addLeadComment`'s mention loop.
  The brief assumed one; it was not one. All three now funnel through a private
  `writeNotification(client, input)` in `services/notifications.ts`, which is
  where `schedulePush` is called. `notifyUser` widened to carry `mention`, so
  the lead-chat path — which would otherwise have been the ONE type that never
  reached a phone — inherits the hook, and every FUTURE type gets it with no
  per-callsite work and nothing to remember. An integration test drives all six
  live types and asserts six rows and six pushes, each to the right device.
- **The push wall IS the bell's wall, by construction.** `pushRecipientsFor` is
  deliberately the same predicate `listNotifications` uses: an addressed row
  goes to that one account; a `userId: null` row is the admin broadcast and
  reaches B-Systems ADMINS only. Deactivated and unapproved accounts are
  excluded for the same reason `requireUser` refuses them — they cannot open the
  app, so they must not be told what is in it. A deleted account's devices
  cascade away with it.
- **THE PRIVACY RULE: a push carries the notification's own title and body and
  NOTHING else.** Those two strings are exactly what `listNotifications` already
  hands that same recipient. Nothing is looked up and added — no lead field, no
  money, no counterparty detail. The only computed value is a URL, which is a
  route and not data. A unit test asserts the payload has exactly four keys
  (`title`, `body`, `url`, `tag`) and that the recipient's user id never appears
  in the serialised payload.
- **Where a tap lands.** A `Notification` row does not record which APP it
  belongs to (the two bells solve that with a `leadPathBase` prop), so the brand
  comes from the LEAD when there is one. Without a lead the type is exact: a
  `mention` with a null `leadId` is a ByteForce lead BY CONSTRUCTION
  (`comments.ts` nulls the id only for that brand, precisely so a dual-role
  user's other bell cannot deep-link into the wrong app), `registration` is the
  Registrations screen, and anything else is a B-Systems broadcast whose lead
  has since been deleted — its app landing is the honest answer, never a link
  that will 404. `deepLinkFor` is pure and unit-tested, including the invariant
  that it only ever returns a relative in-app path.
- **One device, one row, keyed on the ENDPOINT.** The endpoint is the device's
  address at its push service and is unique across the world, so re-subscribing
  the same device refreshes its row rather than minting a second — and the
  unique constraint carries the ownership rule for free: a device that signs
  into a DIFFERENT account re-points to whoever is signed in now, so the
  previous account can never keep pushing to a phone it no longer holds. One
  person keeps as many devices as they sign in on; each is its own switch.
- **Pruning is on the push service's word, not a guess.** 404/410 is the only
  signal that a subscription is gone (uninstalled, wiped, expired), and only
  that raises `PushSubscriptionGone` and deletes the row. Every other failure —
  a 500, a timeout, a bad day at a push service — leaves the device registered,
  because a crash is not a goodbye. Both halves are integration-tested.
- **Nothing secret is in the database.** `p256dh` and `auth` are the BROWSER's
  public subscription material, useless without the endpoint they belong to. The
  server's VAPID private key is read from the environment on every send and is
  never written to a row, a log line or a backup.

### 3. The public key is read at RUNTIME. NEXT_PUBLIC was rejected outright
- **Why it had to be.** Production shape: the app is built INSIDE the container
  at deploy time, and the founder sets environment variables on the host. A
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is INLINED into the client bundle at build
  time — which happens before he can set anything — so it would be baked as the
  empty string for ever and only a fresh build could ever change it. The Next.js
  PWA guide itself uses `NEXT_PUBLIC_`; for this deployment shape that guide is
  wrong.
- **Decision: `GET /api/push/public-key`,** brand-agnostic and session-gated
  (the `/api/undo` precedent), `force-dynamic`, `Cache-Control: no-store`. The
  browser asks when the bell menu opens; the service worker asks again when it
  has to re-subscribe itself after a browser-side rotation. The founder sets two
  variables, restarts, and it is live — no rebuild.
- **`key: null` is the honest "not configured" answer,** and the control simply
  does not render. It is ALSO the answer while an admin is impersonating
  somebody (see below), because the correct UI outcome is identical.
- The value is public by definition — every subscribed browser holds it. The
  session gate is house style, not secrecy.

### 4. FEATURE-FLAGGED, and the inert path is what actually ships
- **The rule: with no VAPID keys configured, the app is byte for byte what it
  was before this feature existed.** That is not an optimisation; it is the
  property that makes this safe to deploy to a host where nobody has set
  anything yet, which is exactly what production is the moment this lands.
- `pushConfigured()` reads `process.env` at CALL TIME. `schedulePush` returns on
  its first line before it reads a row, opens a connection or creates a promise.
  `deliverNotificationPush` checks again for callers that reach it directly.
  `PushToggle` renders `null` and makes no further request.
- **The service worker is registered ONLY on the press of the enable button.**
  Not on page load, not on mount. With no keys there is no button, so no service
  worker is ever installed at all — the strongest available form of "unchanged",
  and the e2e asserts it by reading `navigator.serviceWorker.getRegistrations()`
  and requiring it to be empty after browsing both apps. Registering eagerly was
  considered and rejected: an always-installed worker is a permanent new failure
  surface for a feature nobody has switched on.
- **The service worker caches NOTHING and has no `fetch` handler,** by design
  and asserted by the e2e reading its source. This app deploys from `main`
  several times a day; a caching worker is how a deploy gets stranded behind a
  stale bundle. It handles `push`, `notificationclick` and
  `pushsubscriptionchange`, and that is the whole file.
- The `subscribe` route deliberately does NOT check the flag: it is a device
  registry, and a browser cannot produce a subscription at all without an
  `applicationServerKey`, which it only has when the keys ARE configured. One
  fewer branch to get wrong.

### 5. The permission flow respects the platform, and says only true things
- **Asking happens on a real user gesture,** and `Notification.requestPermission()`
  is the FIRST statement after the click — every `await` in that handler comes
  after it, because iOS refuses a request it cannot attribute to a gesture.
- **Where: the foot of the bell menu.** There is no per-account settings page
  for an admin (`/b-systems/profile` exists for agents and partners only), and
  the bell is the one place every role that HAS notifications can reach on a
  phone without navigating. It rides both bells, so ByteForce staff get it too.
  It is sticky at the foot of a scrolling list, and it renders only when the menu
  is open — a closed bell makes no request, so no screen gains a poll.
- **Three honest states, plus two platform truths.** Not enabled (a pressable
  offer) · enabled on this device (with a Turn off) · blocked by the browser
  (which no button can undo, so it names the settings instead of offering one) ·
  an iPhone that is NOT a home-screen install (iOS delivers web push only there
  and exposes no `PushManager` in a tab, so it names the one step that would fix
  it rather than offering a button that could only ever fail) · anything else
  unsupported (render nothing, like the unconfigured case). The first three are
  e2e-driven with the key stubbed at the network edge, since no CI browser can
  hold a real push subscription.
- **iOS, concretely, so nobody is surprised.** iOS/iPadOS 16.4+; the site must be
  added to the Home Screen and OPENED FROM THERE; the manifest must declare
  `display: standalone` (ADR-060 does); permission must be granted from inside
  that installed app, per device. Safari in a tab on iOS will never deliver one,
  and no code in this repo can change that.
- **IMPERSONATION IS REFUSED, server-side.** `requireUser()` returns the person
  being acted AS, so an admin who pressed the button while impersonating would
  have attached their own phone to that person's account and started receiving
  that person's notifications — the one real leak this feature could produce.
  The subscribe route throws 403 on `impersonatorId`, and the public-key route
  returns `null` so the offer is not even made.

### 5b. Review adjudication (self-review + brand audit, before the gate)
Six findings were raised against the two commits. All six were verified against
the code and the rendered page, and all six were FIXED — none needed refuting.
- **(medium) The unread tint pushed the row's BODY text under WCAG AA.** The
  brand audit measured `--color-muted` on the B-Systems tint at **4.17:1** —
  under the 4.5:1 bar for 12.5px text — and **3.30:1** once the hover deepens
  it; ByteForce was a marginal 4.56:1 / 3.62:1. The regression landed on exactly
  the rows the feature exists to draw the eye to. Fixed with
  `.bell-item[data-unread="true"] .feed-text { color: var(--color-ink-soft) }` —
  a token that exists in all three scopes, at a selector specificity of (0,3,0)
  that also settles the cascade against the `text-brand-muted` utility on the
  same element. Turned into a permanent guard rather than a one-off measurement:
  `e2e/notifications.spec.ts` now computes the WCAG ratio from the LIVE painted
  colours and requires ≥ 4.5:1 for the title and the body, in BOTH brands.
- **(medium, self-review) A rotated keypair would have produced a LYING UI.** A
  `PushSubscription` is welded to the `applicationServerKey` it was created
  with. Had the pair on the host ever been rotated, the old subscription would
  still look healthy to the browser, every send against it would be refused with
  a 403 (not the 404/410 that prunes), and the control would have cheerfully
  read "Phone notifications are on" while the phone stayed silent for ever —
  precisely the dishonest state §5 forbids. Fixed by comparing the stored
  subscription's key against the server's current one (`boundToKey`): a mismatch
  reads as OFF at mount, and pressing enable unsubscribes and re-subscribes. The
  comparison's failure mode is deliberately benign — if it cannot read the key
  it answers "no", and the caller then does exactly what a first-time enable
  does.
- **(low) `.bell-item:hover` was invisible in B-Systems.** It hovered to
  `--color-surface`, which is Paper `#FAFAFD` against the menu's `#FFFFFF` card
  — a 5/255 delta, visible in ByteForce and imperceptible in B-Systems. Fixed by
  deepening the card with the same `color-mix()` the unread hover uses, so both
  hovers actually read.
- **(low) The read-row dimming was carried forward at a legibility cost it no
  longer earns.** `opacity: .6` composited the muted body line to ≈2.4:1. The
  dimming used to BE the read/unread signal; four positive cues carry that now,
  so it only has to soften a row it no longer has to distinguish. Raised to
  `.75` — in the very rule this change was rewriting, which is the moment to do
  it or never.
- **(low) The bell-foot buttons forked the button primitives.** `.bell-foot-btn`
  and `--go` reproduced `.btn-ghost` and `.btn-primary` token for token, down to
  the identical hover `color-mix`, so a future change to the primitives would
  have missed the bell foot entirely. Replaced with `btn-primary btn--sm` /
  `btn-ghost btn--sm` and the duplicate rules deleted; the foot also inherits
  the shared transition and `:active` feedback for free.
- **(low, self-review) The `web-push` ESM interop was betting on one shape.**
  `(await import("web-push")).default` is right under Node's ESM interop —
  verified directly: `default.sendNotification` is a function while the
  namespace's is `undefined` — but some bundlers hand back the namespace
  instead, and this is the one path CI can never exercise (no push service, no
  phone). It now accepts BOTH shapes rather than betting on one.
- **And one gap the audit found in the GUARDS rather than the code.**
  `brand-tokens.test.ts` enforced the identical semantic set between the two
  BRAND files only; `neutral.css` was machine-checked for the stage tokens and
  the accounting pair and trusted for everything else — a latent third instance
  of the exact failure ADR-057 exists for. The three scopes are identical today
  (90 tokens each, verified); a new case now keeps them that way. Note for
  whoever writes the next one: `neutral.css` declares stage tokens several to a
  line, so the ADR-019 pair-check's `^\s*` anchor sees only the first of each —
  a probe written that way reported 33 phantom omissions before the anchor was
  dropped.

### 6. Accepted tradeoffs, named
- **A push is fired and forgotten, and two of the three write paths are inside a
  transaction.** Holding a transaction open across a network round-trip to a
  push service would put someone else's outage on this app's connection pool, so
  `schedulePush` is deliberately not awaited. The cost: if such a transaction
  later rolls back, a phone may buzz for something that did not happen, while
  the bell — the record — correctly shows nothing. A short deferral plus an
  existence check was considered and rejected: it converts a rare phantom into a
  routine LOST notification whenever a commit takes longer than the delay. Push
  is the courtesy; the row is the truth.
- **No restore twin, and that is a decision rather than an oversight.**
  `PushSubscription` is added to `backup.ts`'s `MODELS` (after `user`, its only
  parent, with deletes running reversed) and to `src/tests/db-reset.ts`. It needs
  none of ADR-057/063/064's backfill twins: it is a brand-new table with no
  legacy shape to repair, and a backup taken before today simply has no
  `pushSubscription` key, which the existing `?? []` missing-table rule already
  handles — the same path ADR-062's `todoDone` took. The round-trip is asserted
  in `backup.integration.test.ts`, because the failure this table CAN have is
  falling out of `MODELS` entirely, which is exactly what happened to `undoEntry`
  once (INTEGRATION-PLAN §3).
- **The migration is hand-written with `IF NOT EXISTS` guards** (and a
  `pg_constraint` lookup for the foreign key, which Postgres gives no
  `IF NOT EXISTS` for), the house rule since ADR-064: `scripts/start.mjs` retries
  `migrate deploy` at boot, so a half-applied deploy must be replayable. Proved
  on a THROWAWAY cluster: deploy from empty (17 migrations), then again (no
  pending), then the file replayed by hand twice more with the data intact; the
  unique endpoint refused a duplicate with SQLSTATE 23505 and deleting a user
  cascaded their device away.
- **One `next.config.ts` header, scoped to `/sw.js` alone:** `Cache-Control:
  no-cache, no-store, must-revalidate`. Cloudflare caches `.js` by extension
  unless the origin says otherwise, and a stale service worker at an edge
  outlives the deploy that fixed it. `updateViaCache: "none"` at registration
  covers the browser's own cache; this covers the proxy in front of it. No other
  route's headers change.
- **`src/proxy.ts` needed no change** — its matcher is `/byteforce`,
  `/b-systems`, `/portal`, `/accounting`, `/vault`, so neither `/sw.js` nor
  `/manifest.webmanifest` nor `/api/push/*` was ever gated behind a sign-in
  redirect. Verified rather than assumed.
- Alternatives considered and rejected: a bundler-emitted service worker under
  `/_next/static` (needs a `Service-Worker-Allowed` header to reach root scope —
  `public/sw.js` gets it for free); a `NEXT_PUBLIC_` public key (baked at build,
  before the founder can set anything); a dedicated settings page for the toggle
  (most roles have none, and a phone user should not have to find it); a per-lead
  notification `tag` so repeats collapse (rejected — every row is a distinct
  thing he asked to be told; the tag is the notification id, which buys
  redelivery-dedup instead); refusing `subscribe` when unconfigured (unreachable,
  and a branch that can only be wrong); a green "on" tick (the founder's R4
  no-green ruling stands — the tick is the brand accent).
- Resolves: extends V2 §10 (in-app notifications) and ADR-060 (the manifest,
  which is what makes an iOS install — and therefore iOS push — possible).
- Status: Accepted

## ADR-066 — 2026-08-26 — Accounting and the Data Vault become PER-ADMIN: two flags on the account, never two roles, and the live database row is the wall
- Context: one founder request, verbatim — *"I want to have the ability to block
  some admins from acsessing accounting or data vault."* Since ADR-054 the two
  modules have been switcher peers of the two CRMs, gated on exactly one thing:
  `bsystems_admin`. Hold the role, hold both modules. The founder now wants a
  second admin who runs the CRM without seeing the books, or without the
  registry, or without either — and he wants the two decisions independent of
  one another.

### 1. TWO BOOLEAN COLUMNS ON `User`, not two new roles
- **Decision.** `User.canAccessAccounting` and `User.canAccessVault`, both
  `Boolean @default(true)`. Nothing else in the data model moves.
- **Why not roles.** A capability role (`accounting_user`, `vault_user`) is the
  obvious shape and the wrong one *here*. This codebase ITERATES the role union
  in a dozen places that have nothing to do with modules: `bsRoleOf` (picks ONE
  role to render a shell for), `landingFor` / `LANDING_PRIORITY` (answers "where
  does this person live"), `bucketFor` and `ownerTypeForRole` (decide who OWNS a
  lead), `listAssignableOwners` (the roster a lead may be handed to), the To-Do
  scope, `staffRolesForBrand`, `EntitySwitch`'s `BS_ROLES`, and the edge proxy's
  `allowed()`. A role meaning "may open a module" would have to be excluded from
  every single one of them — and an omission would not fail loudly; it would put
  a phantom person in the owner dropdown, or land somebody on a landing page
  that is not theirs. That is precisely the class of cross-cutting change that
  has cost this repo before: ADR-051 records the same lesson from the other side,
  where the data-entry role had to be carved OUT of five places one at a time.
  A flag is inert. It decides anything in exactly three files (`roles.ts`,
  `guards.ts`, `page-guards.ts`) plus the switcher and the Users form. Nothing
  that walks roles can trip over it.
- **Why the default is `true`, and why that IS the backfill.** Every account in
  the table — admin or not — comes out of the migration with both flags true.
  For an admin that is bit-for-bit the access he had a second before the
  migration ran; for anybody else it means nothing at all (see §2). No backfill
  script exists because none is needed, and no `UPDATE` in the migration means
  no way for one to be wrong.
- Alternatives rejected: a single `blockedModules` string/JSON column
  (unindexed, unqueryable, and "which admins are blocked from the vault" becomes
  a table scan through text); a `UserModuleAccess` join table (a whole model, its
  own backup entry, its own reset ordering, and a MISSING row that has to be read
  as "allowed" — a default expressed in code instead of in the schema); an
  `AcctSettings`-style singleton listing the allowed admins (inverts the default,
  so a NEW admin would arrive blocked, which is not what "block some admins"
  means).

### 2. The flag NARROWS `bsystems_admin`. It can never GRANT
- **Decision, stated once, in one pure predicate** — `canUseModule` in
  `src/lib/auth/roles.ts`:
  ```
  if (!user.roles.includes("bsystems_admin")) return false;   // the floor
  return module === "accounting" ? user.canAccessAccounting : user.canAccessVault;
  ```
- **This is load-bearing, not decorative.** `true` is the column DEFAULT, so
  every sales rep, agent, partner, data-entry account and ByteForce staffer in
  the table already carries `canAccessVault = true`. If the flag were read before
  the role — or instead of it — the migration itself would have handed the whole
  company the books. The role is checked FIRST, and the ORDER is pinned by a
  test that asserts the 403 body a non-admin receives is the ROLE message ("You
  do not have access to this area"), not a module message: swap the two checks
  and that test goes red even though the status code would not change.
- `requireModule` applies `assertRole(..., "bsystems_admin")` before the
  predicate for the same reason, so the refusal a non-admin sees is byte-for-byte
  the one that existed before this ADR.

### 3. The SERVER is the wall, and it reads the LIVE ROW
- **Decision.** `requireModule("accounting" | "vault")` — surfaced as
  `requireAccounting` / `requireVault` — replaces `requireBsAdmin` in **all forty**
  route files under `src/app/api/accounting` (18) and `src/app/api/vault` (22).
  `requireModulePage` — surfaced as `requireAccountingPage` / `requireVaultPage` —
  replaces `requireBsAdminPage` in **all twenty-one** page and layout files under
  the `(accounting)` and `(vault)` route groups. There were no server actions and
  no other auth entry point in either group: grepped, not assumed.
- **The flags are NOT in the JWT.** `requireUser` already re-reads `active`,
  `registrationStatus` and the roles from the User row on every request
  (ADR-017); the two flags ride along in that same query and cost nothing extra.
  A token is minted at sign-in and lives for days, so authorization state inside
  one means a revoked admin keeps the module until he happens to sign out. The
  founder's request is an act of REMOVAL, and removal that waits is not removal.
  A test signs in once, calls the module, has the flag flipped underneath it, and
  calls again on the same session: 200, then 403, with no re-login.
- **The hole this feature could have shipped with is forty files deep**, so the
  directory itself is the assertion.
  `src/lib/services/module-access.integration.test.ts` READS both API
  directories, requires every `route.ts` to call the module guard and to contain
  no `requireBsAdmin`, and does the same sweep over every page/layout in the two
  route groups. A route added tomorrow cannot silently miss the wall. The module
  UI is not the security boundary and is not treated as one.

### 4. The EDGE PROXY stays coarse, deliberately
- **Decision.** `src/proxy.ts` still gates `/accounting` and `/vault` on
  `roles.includes("bsystems_admin")` and was NOT taught about the flags.
- **Why.** It runs on the edge runtime: no database connection, no Prisma. The
  only authorization material available to it is the JWT — and putting the flags
  in the JWT is exactly what §3 refuses. So the proxy lets a blocked admin
  through and the page guard refuses him a millisecond later against the live
  row. The edge check remains navigation hygiene (it keeps a portal role out of
  an internal URL without a database round-trip); the server is the wall. The
  reasoning is written at that line in `proxy.ts` so the next reader does not
  "fix" it.

### 5. The refusal is a PAGE that names the module — `/no-access`
- **Decision.** A blocked admin who types `/vault` is redirected to
  `/no-access?module=vault`: a brand-neutral page that names the module, says
  plainly that nothing else about his account changed, tells him an admin can
  switch it back on from Users, and links him to his own dashboard.
- **Why not an existing bounce.** `requireBsAdminPage` sends a non-admin to
  `/b-systems/crm`; `requirePageRole` sends a signed-in stranger to
  `landingFor(roles)`. For a blocked ADMIN both are dishonest — his landing IS
  `/b-systems`, so the bounce would read as the link simply not working, over and
  over, with nothing on screen explaining why. ADR-051 already made this argument
  once (a data-entry user dumped on `/login` as if his session had expired); this
  is the same mistake with a different subject.
- **No loop is reachable.** `/no-access` lives in the `(home)` route group —
  outside the proxy's matcher, outside both module route groups — so no module
  guard runs on it. It asks only that somebody be signed in (anonymous →
  `/login`), reads no flag and grants nothing: the decision was already made by
  the guard that redirected there.
- **No new CSS and no new token.** It reuses the sign-in page's neutral shell
  classes (`.login-shell`, `.login-pane`, `.login-title`, `.login-foot`), which
  already exist in `neutral.css`. ADR-057's three-scope law has been broken twice
  in this repo's history, and the cheapest way not to break it a third time is not
  to need a token. The new i18n keys carry real Arabic.

### 6. NO SELF-LOCKOUT
- **Decision.** `updateUser` refuses `canAccessAccounting: false` or
  `canAccessVault: false` when `actor.id === userId`. It is the exact twin of the
  rule immediately above it in the same function ("You cannot remove your own
  admin access") and exists for the same reason: whoever is standing at the Users
  page configuring this must always be able to walk back into what he is
  configuring. Another admin may take a module from him at any time, and give it
  back.
- **Revocation only.** Saving the edit modal on your own row posts both flags as
  `true` (the boxes are locked at their current value), and that must keep
  working — the rule refuses a `false`, never a no-op. A test pins that
  distinction, because "reject any self-edit of the flags" would have broken a
  save the UI performs every time.
- The UI disables the two boxes on your own row and writes the reason under them.
  That is the courtesy. The RULE lives in the service, so the API route and any
  future caller inherit it whether they remember to or not.
- **The pinned bootstrap admin is NOT exempt** (`admin@byteforce.com`).
  `ensureAdminExists` heals `active`, `registrationStatus`, the roles and the
  password; it deliberately does not touch the module flags, and neither does the
  seed's `upsertUser` update clause. If either did, "block some admins" would
  carry a silent exception — and worse, a block applied on Monday would be undone
  by the next deploy. The consequence, recorded honestly: if a SECOND admin
  blocks the founder's own account, the founder needs that second admin (or a
  database edit) to get it back. He cannot do it to himself, which is §6's whole
  point.

### 7. IMPERSONATION honours the IMPERSONATED user's flags
- **Decision, and it required no new code — only a proof.** `impersonate()` mints
  a token for the TARGET, so the resulting session carries the target as
  `session.user.id`; `impersonatorId` merely remembers who to snap back to.
  `requireUser` reads the row at `session.user.id`, so the flags in force while
  impersonating are the impersonated account's — in BOTH directions: a full admin
  acting as a blocked one is refused, and a blocked admin acting as a full one is
  allowed. That is the honest reading of "you are that person right now", and it
  matches how `active`, `registrationStatus` and the roles have always behaved
  under impersonation. Two tests pin both directions so a future refactor of the
  session shape cannot quietly invert it.

### 8. The switcher hides what the server would refuse
- `EntitySwitch` now takes the whole bearer (`roles` + the two flags) instead of
  `roles`, and calls the SAME `canUseModule` predicate the guards call. The prop
  is REQUIRED, never optional: a caller that forgets it fails to compile, which
  is the only way this can never drift back into offering a door that refuses.
  One component still renders all three shapes — the desktop header pill, the
  ADR-060 phone module bar, and the burger sheet (which receives the switcher
  through `extras`) — so the three can never disagree.
- If fewer than two segments remain the switcher returns `null`, exactly as it
  already did for a single-company account. An admin stripped of both modules is
  simply a single-destination user; ADR-060's "no new furniture" rule needed no
  special case.
- The Users table prints a muted "No Accounting" / "No Data Vault" badge on a
  blocked admin's row (the existing `.badge--archived`, no new token), so the
  founder reads who is blocked without opening anybody.
- `EntitySwitch`'s two module segments were the ONLY links into `/accounting`
  and `/vault` anywhere in the codebase — grepped, not assumed. Notifications
  deep-link to leads only, and ADR-054 removed both modules from the nav, so
  there is no dashboard tile and no nav item to hide.

### 9. Backup / restore needs NO twin backfill, and that is a decision
- `user` was already in `backup.ts` MODELS and in `db-reset.ts`; two new columns
  on an existing model add no entry to either.
- ADR-057/059, ADR-063 and ADR-064 each needed a TypeScript twin of their
  migration's backfill, because `importBackup` re-inserts a legacy payload
  verbatim onto an already-migrated database and the column DEFAULT was the wrong
  answer for those rows. Here the default IS the answer: a pre-ADR-066 export
  carries no such keys, `createMany` lands every restored account on `true`, and
  `true` is exactly the access that export was taken under. A post-ADR-066 export
  states both flags on every row, so a blocked admin restores blocked. Nothing to
  repair in either direction. Written at the `user` entry in `MODELS` so the next
  reader does not go hunting for a missing twin.
- Resolves: extends ADR-054 (the two modules as switcher peers, admin-only),
  ADR-017 (authorization re-read from the database on every request) and SPEC §3
  (permissions are server-side).
- Status: Accepted
## ADR-067 — ONE CRM: the two company apps merge into a single shell, and the company lives in the URL
- Context: one founder request, transcribed verbatim — *"So I have a big edit on
  the system. I need to completely merge the systems and byte force CRMs, and I
  want the switching to be inside the CRM. So the CRM page, I can switch between
  it. But every other page, we do… we don't have the entire page for byte force.
  The entire interface changes and all of that. I don't need that. I don't want
  it. I just want the b systems CRM. I can have a switch button between b systems
  and byte force, and the entire boards change accordingly. The same thing with
  the to do. When I go to the to do, I can switch this and this between byte force
  and b systems. So make sure that this is there, and there is no confusion in
  it."*
  Asked how far the switch reaches, he was explicit that **everything** switches —
  not only the board and the To-Do but the Leads list, Won Leads / Clients and the
  rest. Asked what a ByteForce-only teammate gets, he was equally explicit:
  **the same app, locked to ByteForce**, shown no switch, and *"nobody gains
  access they do not have today."*

  This ADR covers the shell, the routing, the nav and the access rules. Two
  further pieces of the same request — the twelve-hour clock everywhere, and the
  negotiation response date getting its own To-Do row — are separate workstreams
  and get their own ADR.

### 1. ONE SHELL. The B-Systems shell becomes THE shell
- **Decision.** The `(byteforce)` route group is deleted in full: its root layout,
  its favicon, its app layout, its context and its eight pages, plus
  `components/internal/AppNav.tsx`, the ByteForce header. Every ByteForce screen
  is re-mounted under `/b-systems` in the merged shell.
- **Why.** He asked for exactly this, twice in one paragraph: *"we don't have the
  entire page for byte force… I don't need that. I don't want it."* A second app
  shell is precisely the thing he said he does not want.
- **Nothing was lost.** The ByteForce bodies were already brand-parameterized
  server components (`components/internal/pages.tsx`), so the merge is a
  re-mount, not a rewrite: the dashboard, the board (drag, drop-opens-form, the
  didn't-answer tally, the Today chips, search + type), the rep DIRECTORY with
  its Unassigned bucket and its per-rep archive tab, the lead detail, the call
  sheet, Clients and the To-Do all moved intact. The rep directory and Clients
  were the two most likely casualties — B-Systems' Leads is a flat table, not a
  rep directory, and Clients and Won Leads are different tables over different
  concepts — so both are kept as ByteForce-EXCLUSIVE routes rather than aliased
  onto a B-Systems screen that has no data for them.

### 2. THE CHROME STAYS B-SYSTEMS IN BOTH MODES — and this contradicts SPEC
- **Decision.** Switching company changes the DATA and never the skin. Same
  header, same mark, same colours, same `data-brand="bsystems"` on `<html>`. The
  merged shell does NOT re-stamp the brand per company the way
  `ModuleBrandScope` does for the accounting module.
- **Why.** It is the literal reading of *"The entire interface changes and all of
  that. I don't need that."* A company switch that repainted the app would be the
  interface change he rejected, arriving through a smaller door.
- **The SPEC conflict, named rather than glossed.** SPEC §4 defines "branded" as
  *"Every page of App A reads unmistakably as ByteForce … switching between
  /byteforce and /b-systems demonstrates the theming layer with no brand bleed"*,
  and CLAUDE.md rule 6 restates App A as the ByteForce-branded app. That is no
  longer achievable as written, because App A no longer exists as an app. **This
  is flagged for founder confirmation in PROGRESS**, along with its two visible
  consequences: a ByteForce-only teammate now sees B-Systems chrome at a
  `/b-systems/...` address, and ByteForce work carries the B-Systems browser tab
  icon (the same accepted trade-off ADR-060 part E already recorded for the iOS
  home-screen icon).
- **The BRAND is not retired — one SHELL is.** `branding/byteforce/tokens.css`
  is untouched and still consumed by the accounting module's per-company scope
  (ADR-054), so ADR-057's three-scope token law is unaffected and
  `brand-tokens.test.ts` still reads the same file. The company switch itself
  introduces **no new token**: it reuses `.switcher` / `.switcher-seg` and four
  variables that already exist in all three scopes.

### 3. THE COMPANY LIVES IN THE URL — `?company=`, mirroring accounting
- **Decision.** The merged CRM keeps the unchanged `/b-systems` prefix and the
  company rides the query string: `?company=bsystems|byteforce`.
- **Why this shape.** It is the idiom this codebase already chose for exactly
  this question. The accounting module puts its company in `?company=`
  (`lib/accounting/params.ts`), re-emits it on every nav href through
  `acctQuery`, and reads it in a CLIENT nav component because a server layout
  cannot see searchParams. Copying that gives the app ONE company idiom instead
  of two, and moves zero existing B-Systems addresses.
- **Alternative rejected — a path segment** (`/b-systems/byteforce/crm`). It has
  one real advantage: the shell layout could then be the single server wall,
  because a layout can read the path. It was rejected because it relocates every
  existing `/b-systems/*` address — breaking push deep links already delivered,
  every To-Do href, the notifications bell's click-through and some thirty e2e
  specs — to buy a guard convenience that §7 solves another way.
- **Alternative rejected — a per-user "last company" cookie.** It is the smallest
  diff and the worst answer: the same URL would show different things to the same
  person depending on history, and a link he sends somebody would not carry what
  he was looking at.
- **Alternative rejected — a canonicalising redirect on every bare URL** (bounce
  `/b-systems/crm` to `/b-systems/crm?company=bsystems` so every rendered address
  is explicit). It buys shareability that is already there — the switch, the nav
  and the filter forms all write the company, so any URL reached by clicking is
  explicit — and it costs an extra round trip on every landing plus a redirect
  branch on every page. Determinism is guaranteed the honest way instead:
  `defaultCompanyFor` is a pure function of the ROLES, so two accounts with the
  same roles resolve a bare URL identically, forever.
- **A bare B-Systems URL is never ambiguous, by construction.** `companiesFor`
  lists bsystems first, so every account that can render a B-Systems screen has
  bsystems as its default. Bare `/b-systems/...` links inside the B-Systems half
  are therefore correct as they stand and were left alone.

### 4. EVERY RETIRED `/byteforce` ADDRESS REDIRECTS — permanently, not transitionally
- **Decision.** `src/lib/crm/legacy-routes.ts` maps the retired prefix; the proxy
  applies it as its FIRST branch, before the sign-in check, cloning the incoming
  URL so the query string is preserved and `company=byteforce` is MERGED into it
  rather than replacing it. Ten rules, specific first, catch-all last:
  `/byteforce` → `/b-systems`; `/byteforce/{todo,crm,clients,leads}` →
  the same section; `/byteforce/leads/rep/:repId` (including the literal
  `unassigned`, and `?view=archived`) ; `/byteforce/leads/lead/:leadId`;
  `…/call`; `/byteforce/login` → `/login` with no company (sign-in stays
  consolidated, ADR-028); and anything else → ByteForce's home, so **nothing
  under the prefix can 404**.
- **This map is permanent furniture.** It is not a courtesy to bookmarks that
  fades: web pushes ALREADY DELIVERED to the founder's phone carry
  `/byteforce/leads/lead/<id>` and `/byteforce` baked into their payload at send
  time, and the service worker opens whatever URL it was given. Nothing can go
  back and rewrite them. Its own e2e file proves every rule, including the two
  id-bearing ones against a real seeded lead.
- **Redirect BEFORE the auth check**, so an anonymous visitor following an old
  bookmark is sent to the merged address first and only then asked to sign in —
  he arrives where he was going instead of being bounced from an address that no
  longer exists.
- **307, not 308.** A permanent redirect is cached by browsers indefinitely. Until
  the founder has confirmed the shell retirement (§2), 308 would be a one-way
  door with no cheap rollback. Promote it after he confirms.
- **`/api/byteforce/**` is NOT redirected** and must never be: it is the wall
  (§7).

### 5. THE SWITCH IS UNMISSABLE, AND THE COMPANY IS LEGIBLE IN WORDS
- **Decision.** `CompanySwitch` renders in the SHELL — inside `.page`, above the
  screen's own content — so it appears on every switchable screen and no page can
  forget it. It carries a text label that NAMES the company you are on
  ("Company · ByteForce"), marks the active segment with `aria-current`, and is
  labelled `Switch company` as a group.
- **Never colour alone.** The founder asked that *"there is no confusion in it"*.
  The inverted fill on the current segment is a reinforcement; the sentence above
  it is the statement.
- **It is not rendered at all below two companies**, exactly as `EntitySwitch`
  has always behaved for a single-entity account (ADR-060's "no new furniture"
  rule). A ByteForce-locked teammate and a B-Systems-only rep see nothing new,
  and an e2e asserts that NEGATIVELY on every nav destination and inside the
  burger sheet — a hidden-but-present switch would be a failure.
- **The href carries ONLY the company.** `owner`, `stage`, `sort` and `view` are
  B-Systems-shaped and mean nothing to the ByteForce bodies; carrying them across
  a switch would leave a board that looks filtered but is not, which reads as
  data loss rather than as a nav bug. Company-exclusive and id-bearing addresses
  fall back to the target company's Home, because their equivalent either does
  not exist or is about a record belonging to the other company.

### 6. THE MODULE BAR AND THE COMPANY SWITCH ANSWER DIFFERENT QUESTIONS
- **Decision.** `EntitySwitch`'s two company segments (`BYTEFORCE`, `B-SYSTEMS`)
  collapse into ONE `CRM` segment whose href is `landingFor(roles)`. The bar now
  reads CRM / ACCOUNTING / VAULT — three modules, one axis — and the company gets
  its own differently-shaped, differently-placed, LABELLED control.
- **Why not both on the bar.** After the merge the two CRMs are not separate
  destinations, so a four-cell strip would have been asking "which module" and
  "which company" in the same row of identical-looking cells. On a phone that is
  the two-competing-switchers failure the founder specifically asked us to avoid.
- **Why not the company in the header pill.** Five segments walks straight back
  into the 601–645px overflow band ADR-060 had to close.
- **ADR-060's invariant improves rather than survives.** The bar goes from four
  equal `1fr` cells to three, so every cell gets WIDER and the 320px ellipsis case
  gets easier; the desktop pill sheds a segment instead of gaining one. The two
  controls are never mistaken for each other: the bar is full-bleed chrome under
  the header, the company switch sits on the light page ground, inside the page's
  own width, under a text label.
- **`shell.switchCompany` finally sits on the control it names.** It was the
  MODULE switcher's group label, which was never what that strip did; the modules
  got a new `switchModule` key and this moved. No existing English string
  changed; the new keys carry real Arabic.

### 7. ACCESS IS SERVER-SIDE AND NARROWING ONLY
- **One pure predicate, `src/lib/crm/company.ts`.** `companiesFor(roles)` reads
  the roles an account already holds and reports which company each of them lets
  it see. There is no branch in that file that can hand anybody a company a role
  does not already carry, and `resolveCompany` can only return a member of
  `companiesFor(roles)` — asserted directly, over all 64 role subsets, in
  `company.test.ts`. This is ADR-066's `canUseModule` lesson applied to the
  company: state the narrowing rule ONCE, in a file with no next-auth and no
  Prisma, so services, guards, the shell and the tests all read the same answer.
- **The matrix.** `byteforce_staff` only → `[byteforce]`, no switch. Any single
  B-Systems role (admin / sales / agent / partner / data entry) → `[bsystems]`,
  no switch. Both → `[bsystems, byteforce]`, default **bsystems** (his own words,
  *"I just want the b systems CRM"*, and the same precedence `LANDING_PRIORITY`
  already gives `bsystems_admin` over `byteforce_staff`). Neither → refused
  before this file is reached.
- **Three page guards.** `requireCompanyPage` for the four addresses both
  companies share; `requireCompanySection(only)` for the twenty-one that exist
  for one company only; `requireBsAdminCompanyPage` for the admin-only B-Systems
  sections. A REAL company you do not hold is REFUSED — redirected to the company
  you do hold — rather than silently swapped behind the label you asked for. This
  is the one place the accounting precedent is deliberately NOT copied: there,
  any admin may see either company's books, so a silent fallback is honest; here
  the companies are a permission. Junk still falls back rather than 400s, because
  a page is not an API.
- **A LAYOUT CANNOT BE THE WALL**, and that is the structural cost of §3: a Next
  server layout can read neither searchParams nor the pathname. The layout
  enforces only "this account holds SOME company"; the per-company refusal lives
  in every page. A page that forgot would be the hole, so
  `page-company-guards.test.ts` reads the whole route directory and fails naming
  any `page.tsx` that does not call a company-aware guard, that reaches for the
  company-blind `requirePageRole` / `requireBsAdminPage`, or that calls the
  THROWING `bsRoleOf` before its company is pinned. The directory is the
  assertion — ADR-066's pattern, made cheaper (no database needed).
- **`bsRoleOrNull`**, a total twin of `bsRoleOf`. `bsRoleOf` throws for an account
  with no B-Systems role, which was fine while the B-Systems layout guard bounced
  such accounts first. Admitting `byteforce_staff` made fifteen page call sites
  reachable overnight, and a throw in the LAYOUT would have 500'd the whole app
  for the teammate whose own CRM it was rendering. Pages use the null-returning
  one and redirect; API routes keep the throwing one, whose throw is a 403. Past
  `requireCompanySection("bsystems")` the original is total again — holding
  `bsystems` is exactly holding one of the five B-Systems roles — which is why
  the exclusive pages could keep it, and why the sweep test checks that ordering.
- **THE API NAMESPACES DID NOT MOVE, AND THAT IS THE POINT.**
  `/api/byteforce/**` still refuses a B-Systems-only caller and `/api/b-systems/**`
  still refuses a ByteForce-only one, from the ROUTE and never from a parameter
  (`internalCrmHandlers(brand)`, `requireBrandStaff`, `requireLeadAccess`). **No
  route handler learned about `company`** — accepting a company from a request
  would be the single way this merge could widen access, so there is no such
  parameter to accept. The merged pages simply call the base that matches the
  company they are rendering.
- **The edge proxy widened, deliberately and coarsely.** `/b-systems` now admits
  `byteforce_staff`, because that prefix IS the merged shell. That is safe for
  exactly the reason ADR-066 wrote at the same line for the module flags: it is
  navigation hygiene, and the page guards narrow per section and per company
  against the LIVE User row a millisecond later. The proxy deliberately does NOT
  check `?company=` either: the edge has only the JWT, which is minted at sign-in
  and can be stale, so refusing a company on a stale token would turn a role
  change into a lockout.
- **The bell follows the company, and gains nobody anything.** Notifications carry
  no brand column; the two feeds are separated by the ROUTE, and "am I an admin"
  is decided inside the B-Systems route from the role alone. A ByteForce view
  polls `/api/byteforce/notifications` (which passes `isAdmin: false`, as it
  always has), so a ByteForce-only teammate cannot start seeing B-Systems admin
  broadcasts, and the founder in ByteForce mode does not either.

### 8. The confusion bug this merge could have shipped
- Three filter forms are plain `method="get"` submissions, which REPLACE the whole
  query string with the form's own fields. Applying a filter on the ByteForce
  board would therefore have dropped `?company=byteforce` and bounced the founder
  back to B-Systems — and it would have looked like data loss, not like a nav
  bug. All three now carry a hidden `company` input, and an e2e applies a filter
  in each company and asserts the company is still on the URL afterwards. It is
  written up here rather than buried in a diff because it is the exact failure
  mode he asked us to prevent.

### 9. What deliberately did NOT change
- **The two BOARDS stay two components.** Each is statically bound at module level
  to its own stage set — `INTERNAL_STAGES` (six columns) against
  `BSYSTEMS_STAGES` (seven, with Negotiation) — and that binding is a SAFETY
  property: a ByteForce card cannot be rendered into a negotiation column because
  the column does not exist in its module. Parameterising one board by config at
  runtime is how a negotiation column appears on a ByteForce board. CLAUDE.md
  forbids forking the ENGINE — which is already the one shared module, selected
  by `configForBrand` — it does not ask us to merge the views.
- **Clients and Won Leads stay siblings**, not one aliased screen. They share only
  their origin: a `Client` carries service / estimated value / collected /
  to-be-collected / retainer / technical owner; a `WonDeal` carries a commission
  percentage in basis points, milestones with sequential locks, attachments and
  statements. No ByteForce lead ever gets a WonDeal and no B-Systems lead ever
  gets a Client.
- **The Today chips reset across a switch.** They are component state, not URL
  state (ADR-061), and a company switch is a navigation. That is correct and no
  data leaks; it is written down so nobody "fixes" it into the query string.
- **Undo still crosses companies**, by design and unchanged: it is per-USER and
  brand-agnostic, so after a switch the pill can still offer your own last action
  in the other company. It is your own action, not a leak — decided deliberately
  rather than discovered in QA.
- **No schema change and no migration.** Nothing in this ADR touches the database.
- Resolves: supersedes ADR-028's two-app shell arrangement for the CRM only
  (sign-in was already consolidated); extends ADR-054 (the switcher's peers),
  ADR-060 (the phone module bar), ADR-066 (the narrowing-predicate pattern and
  the coarse-edge / live-row-wall split); conflicts with SPEC §4's definition of
  App A, flagged for founder confirmation.
- Status: Accepted (shell / routing / nav / access). The twelve-hour clock and
  the negotiation To-Do row from the same request are separate workstreams.
