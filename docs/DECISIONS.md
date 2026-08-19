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
