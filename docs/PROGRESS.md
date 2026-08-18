# Progress log — append-only session journal

Read the latest entry at every session start; append one at every session end
(`/session-start`, `/session-end`). Format: `project-logging` skill.

## Entry 000 — 2026-08-08
- Done: Project starter scaffolded — SPEC.md v1.1 (both official brand systems
  integrated), docs/ skeleton, branding tokens for ByteForce and B-Systems
  (`branding/*/tokens.css`), Claude Code config (settings, 4 subagents, 10 skills incl.
  workflow slash commands), CLAUDE.md + AGENTS.md, ADR-000/ADR-001 seeded.
- In progress: none — no application code exists yet.
- Next steps: `/session-start`, then Phase 0 per SPEC §14 (stack init, auth + roles,
  theming wired to both token files, pipeline-engine module + unit tests, seed
  scaffold), completing docs/ARCHITECTURE.md to v1.
- Blockers: none hard. Waiting on founder assets (see below) — Phase 0 can proceed with
  fallbacks.
- Needs founder confirmation: (1) logo files into `branding/byteforce/` and
  `branding/b-systems/` (READMEs list expected files); (2) Lama Sans font files into
  `branding/byteforce/fonts/` (A-13 fallback active until then); (3) SPEC §11 defaults
  A-1…A-13 stand unless overridden.

## Entry 001 — 2026-08-08
- Done: Kickoff session per SPEC §17. (1) Repo turned into a git repository (was not
  one) with the scaffold as baseline commit. (2) Founder's two root-dropped logo files
  classified and relocated into their `branding/` slots (ADR-006). (3) SPEC §2 stack
  initialized — Next.js 16.3 App Router + TS, Tailwind v4 on the token files, Prisma
  7.9 (SQLite dev), NextAuth 5 beta (pinned), Zod 4, dnd-kit, Vitest 4, Playwright —
  hand-scaffolded (create-next-app refuses non-empty dirs); build, typecheck, prisma
  generate, and tests verified green (TESTING Run 001). (4) ADR-002…009 logged for
  every stack decision and resolved architecture question. (5) docs/ARCHITECTURE.md
  completed to v1: route/module map, full physical schema, theming + auth design.
  (6) A 10-agent adversarial verification workflow checked ARCHITECTURE v1 + scaffold
  against SPEC and confirmed 21 findings; ALL fixed this session (root-layout
  restructure into route groups, semantic token contract completed in both brand
  files, money → Int piasters, DB-backed authorization, transition-config gaps closed)
  and recorded as ADR-010…019; suite re-verified green (TESTING Run 002).
- In progress: nothing mid-flight; working tree committed at session close.
- Next steps: Founder reviews the Phase 0 plan presented at session end (SPEC §17
  step 4). Then Phase 0 proper: prisma models from ARCHITECTURE §5 + migration + seed
  scaffold, auth (providers, guards per ADR-016/017), brand route groups + Tailwind
  @theme mapping + fonts.css (ADR-013), pipeline-engine module with every §10 row
  unit-tested, `/phase-gate` before Phase 1.
- Blockers: none hard. Founder assets still pending (see below) — Phase 0 proceeds
  with fallbacks.
- Needs founder confirmation: (1) remaining logo slots + Lama Sans font files into
  `branding/` (A-13 fallback active; ADR-006 maps what arrived); (2) SPEC §11 defaults
  A-1…A-13 stand unless overridden; (3) ADR-008 portal login = phone + password;
  (4) ADR-010 Partners attended-destinations exclude Sending Proposals; (5) ADR-011
  internal CRMs get a direct Won action (T-9); (6) ADR-014 functional danger red in
  App A; (7) ADR-016 admin provisioning via seed + email login on the portal form;
  (8) ADR-018 money as Int piasters with ~21.4M EGP per-value cap (confirm typical
  deal sizes fit).

## Entry 002 — 2026-08-08 — PHASE 0 GATE REPORT
Phase 0 — Foundation (SPEC §14). Verdict: **PASS**.

| DoD item | Verdict | Evidence |
|---|---|---|
| Repo + stack (§2) | PASS | package.json (exact versions in ARCHITECTURE §2); TESTING Runs 001–004 all green (build, typecheck, prisma generate/migrate/seed) |
| Auth + roles (§3) | PASS | NextAuth v5 two-provider split config, guards with per-request DB re-check (ADR-017), middleware registered as Next 16 Proxy; smoke: login round-trip renders seeded user, cross-brand session redirected (Run 003) |
| Theming wired to both token files (§4) | PASS | Route-group root layouts stamp data-brand; brand utilities resolve in built CSS; both themes demonstrable at /byteforce/login vs /b-systems/login vs /portal; brand-auditor PASS after 5 fixes (Run 004) |
| Pipeline-engine module + unit tests | PASS | src/lib/pipeline-engine/ pure core + 3 configs; every §10 row unit-tested (27 engine cases, Runs 003–004); spec-guardian PASS after 4 fixes (ADR-020/021) |
| Seed script scaffold | PASS | prisma/seed.ts idempotent; 4 accounts (incl. A-8 dual-role + ADR-016 seeded admin) + 4 rep cards; `prisma db seed` green |
| ARCHITECTURE.md v1 | PASS | Completed + adversarially verified in the kickoff session (Entry 001) |

- Done this session (so far): full Phase 0 as above; gate cross-checks by
  spec-guardian and brand-auditor subagents, all findings fixed same-session
  (ADR-020, ADR-021; brand fixes in globals.css/(home)/portal landing).
- Next steps: Phase 1 — App A ByteForce CRM (§6): services + brand-partitioned API,
  Leads/CRM/Clients/Dashboard UI, T-1…T-10 integration tests, journeys 1–2,
  /brand-audit, then the Phase 1 gate.
- Blockers: none.
- Needs founder confirmation (carried + new): items (1)–(8) of Entry 001, plus
  (9) ADR-020 — terminal stages win over P-1/P-6's literal "From: Any" (no un-win
  flow in v1).

## Entry 003 — 2026-08-09 — PHASE 1 GATE REPORT
Phase 1 — App A: ByteForce CRM (SPEC §14). Verdict: **PASS**.

| DoD item | Verdict | Evidence |
|---|---|---|
| Every §6 field persists | PASS | createLead/updateLead/group schemas exact per §6.1–§6.2 (spec-guardian verdict table all-match); integration tests persist and read back every group |
| All §10.1 rows tested | PASS | Engine unit tests (27) + service integration tests (10) + journeys — T-1…T-10 each named; TESTING Runs 005–006 |
| Dashboard formulas verified | PASS | metrics.ts vs §6.5 fixture test with known numbers (incl. ADR-012 no-double-count); journey 1 asserts live numbers |
| Journeys 1–2 pass | PASS | Playwright 2/2 against dedicated seeded e2e.db (Runs 005–006) |
| Branded per §4.2 | PASS | brand-auditor: checks 1/3/4 fully clean; its 4 findings fixed same-session (semantic contract gained on-success/on-danger/on-accent in both brands) |

- Done: full App A — services (single-write-path applyLeadEvent, atomic side
  effects + ActivityLog), brand-partitioned /api/byteforce, complete UI (dashboard,
  rep cards → leads table → lead detail with conditional groups + history, 5-column
  board, clients), integration tests, journeys 1–2. Gate cross-checks by
  spec-guardian + brand-auditor; all findings fixed (ADR-022/023/024; config-derived
  UI lists; concurrency stage guard).
- Next steps: Phase 2 — App B: /b-systems mount of the shared internal-CRM bodies +
  Partners Pipeline (§7.2 incl. uploads), Partners directory, attribution (PP-1…PP-5),
  journey 3, gate.
- Blockers: none.
- Needs founder confirmation: items (1)–(9) carried, plus (10) ADR-022 additive UI
  columns; (11) ADR-024 negative to-be-collected on overpayment.

## Entry 004 — 2026-08-09 — PHASE 2 GATE REPORT
Phase 2 — App B: B-Systems CRM + Partners (SPEC §14). Verdict: **PASS**.

| DoD item | Verdict | Evidence |
|---|---|---|
| Uploads validated & playable | PASS | Server-side extension+size+magic-byte validation (storage/index.ts); recordings play inline via authenticated /api/files with Range support; journey 3 uploads and plays an mp3; integration tests reject wrong type/content/size (Run 007) |
| Auto-return (PP-2) verified | PASS | Integration: auto-return, max-two, edit-no-refire, outside-stage-no-fire; journey 3 sees the return + the normative History phrase (Runs 007–008) |
| Conversion gate (PP-4) verified | PASS | Integration: incomplete gate blocks with nothing moved, complete gate converts atomically (Partner + date_joined + Converted badge); journey 3 exercises the block then converts |
| Attribution end-to-end (PP-5) | PASS | Integration + journey 3: partner lead → CRM at matching stage, permanent "Partner: {Company}" badge on rep table, detail and board, live stage in the partner's table, A-6 unassigned bucket |
| App B = App A clone on B-Systems data/theme (§7.1) | PASS | Shared bodies mounted on BSYSTEMS_CTX + brand-partitioned /api/b-systems; spec-guardian verdict table all-match |

- Done: B-Systems CRM mount, storage abstraction + upload validation, partners
  pipeline (services + 6-column board + prospect detail with recordings + gate) +
  directory + attribution, integration tests (8), journey 3. Gate cross-checks:
  spec-guardian (1 fix: PP-2 History wording now rendered; + updateProspect race
  guard) and brand-auditor (major find: lavender-on-Paper structural text in App B —
  fixed via new heading/link semantic tokens in both brand files per the ADR-019
  contract, plus §4.3 typography corrections). All findings closed, suite green
  (Runs 007–008).
- Next steps: Phase 3 — Portal rep layer (§8.1–§8.4): landing + signup with CV +
  login, rep CRM with dnd-kit drag & drop + server-enforced Won restriction,
  Won Deals read view with milestone locks, Profile; P-1…P-5; journey 4; gate.
- Blockers: none.
- Needs founder confirmation: items (1)–(11) carried.

## Entry 005 — 2026-08-09 — PHASE 3 GATE REPORT
Phase 3 — App C: Portal, rep layer (SPEC §14). Verdict: **PASS**.

| DoD item | Verdict | Evidence |
|---|---|---|
| Rep isolation enforced server-side + proven | PASS | requireDealAccess on deal routes; listing scoped to session portalRepId (hardened, Run 010); deal detail ownership check; integration test scopes won-deals per rep; journey 4 proves another rep's deal invisible |
| Won restriction enforced server-side + proven | PASS | Engine wonRoles=[portal_admin]; ALL FOUR rep vectors (drag, action, admin_won, attended-destination) rejected 403 at service layer with nothing moved (Runs 009–010); journey 4 asserts the UI block AND a raw API 403 (§13's API-level requirement) |
| §8.1–§8.4 complete | PASS | Landing (gradient+mesh hero) with Sign up/Log in; §8.1 sign-up exact incl. CV validation + auto sign-in (ADR-025); dnd-kit board with §5.4 drop-opens-group/cancel-reverts; Won Deals read view with server-REDACTED milestone locks + 5s polling (ADR-009); profile with CV download/replace + password change (A-10) |
| P-1…P-5 tested | PASS | Engine unit (Phase 0) + service integration (7 cases incl. P-4 auto-move, P-6 exactly-once, redaction progression) + journey 4 |
| Journey 4 passes | PASS | Playwright 4/4 (Runs 009–010) |

- Done: full portal rep layer — services, API, UI (signup w/ auto-login, dnd-kit
  board, milestone-locked Won Deals, profile), 8 integration tests, journey 4.
  Gate cross-checks: brand-auditor PASS-with-findings (3 fixed: btnAccent, modal
  arrow RTL, tagline color role); spec-guardian 4 low fixes closed (ADR-025/026,
  listDeals hardening, 4th P-2 vector). BUG-001 filed (vitest collection flake).
- Next steps: Phase 4 — admin layer (§8.5): dashboard, combined/per-rep CRM with
  admin Won, Won Deals management with milestone define/check, Sales Team table;
  P-6…P-8 integration; journey 5; gate.
- Blockers: none.
- Needs founder confirmation: items (1)–(11) carried, plus (12) ADR-026 implicit
  portal follow-up owner.

## Entry 006 — 2026-08-09 — PHASE 4 GATE REPORT
Phase 4 — App C: Admin layer (SPEC §14). Verdict: **PASS**.

| DoD item | Verdict | Evidence |
|---|---|---|
| Milestone lock/unlock verified LIVE across two sessions | PASS | Journey 5: admin + rep in separate browser contexts; the rep's open page unlocks Milestone 2 via the ≤5s poll with no reload after the admin checks Milestone 1 (Runs 011–012) |
| All admin formulas verified | PASS | §8.5.1 dashboard + §8.5.4 sales-team fixtures with known numbers (admin.integration.test.ts); journey 5 asserts live tiles as deltas + the exact team row |
| §8.5 complete (dashboard, combined/per-rep CRM, Won Deals mgmt, Sales Team) | PASS | All four sections built; spec-guardian verdict table all-match after 1 fix |
| P-6…P-8 tested | PASS | P-6 exactly-once + logged; P-7 generation/A-11 warning/redefinition rules; P-8 sequential check + logged uncheck (ADR-020) at unit + integration + E2E |

- Done: milestones + admin services (sequential P-8 order both directions),
  admin API (requirePortalAdmin throughout), admin UI (dashboard, combined/per-rep
  board with admin Won-drag, Won Deals manager, Sales Team), 4 integration tests,
  journey 5 (self-contained, two live sessions). Gate: brand-auditor clean PASS;
  spec-guardian 1 required fix applied — ownerPortalRepId now SERVER-stamped from
  the deal (had been client-supplied; ADR-026/§3).
- Next steps: Phase 5 — hardening & handover: full E2E suite green (already),
  rep-session 403 tests for admin routes (§15), seed data final (incl. won deal
  with milestones), README (setup/run/test/deploy), responsive/empty-state QA
  pass, final /brand-audit, docs final, Global DoD (§15) walk + gate.
- Blockers: none.
- Needs founder confirmation: items (1)–(12) carried.

## Entry 007 — 2026-08-09 — PHASE 5 GATE REPORT + GLOBAL DoD (§15) WALK
Phase 5 — Hardening & handover (SPEC §14). Verdict: **PASS**. Project verdict:
**GLOBAL DoD MET** (pending founder sign-offs listed below).

Phase 5 DoD: full E2E suite green (12/12 — journeys 1–5, security-rbac ×3,
qa-sweep ×4; Run 013); seed data final (§13 fixture list complete, idempotent);
README final (cold start / run / test / deploy + demo accounts); docs at final
state (ARCHITECTURE v2 corrected to shipped reality, CHANGELOG per phase,
ADR-000–027); final /brand-audit **PASS** (five Low/Info advisories, heading-token
polish applied); final spec-guardian review closed (its two "blocking" items were
this very entry + Run 013 landing mid-review; ARCHITECTURE drift, the stale landing
comment, and the ADR-013 mechanism note all fixed; .env.example confirmed tracked).

### Global DoD checklist (SPEC §15)
- [x] Every field/enum/screen/rule in §6–§10 implemented; no stubs/TODOs on shipped
      paths — per-phase spec-guardian verdict tables (Entries 002–006) + final
      review item 1 (grep clean; three random fields traced schema→service→UI).
- [x] All §10 transitions covered by automated tests; §13 journeys 1–5 pass —
      engine tests name every row; integration suites cover the §13 obligations;
      Runs 011/013.
- [x] Dashboard/table formulas proven against fixtures — §6.5 + §8.5.1 + §8.5.4
      fixture tests with known numbers (incl. ADR-012 no-double-count); journey
      delta assertions live.
- [x] RBAC server-side, proven per clause — foreign-rep 403 (deal untouched), rep
      Won 403 (all four vectors, incl. raw API), rep milestone 403 (all three admin
      endpoints), portal↔internal invisibility + brand partition (security-rbac).
- [x] Uploads validated/stored/retrievable; recordings play inline — magic-byte +
      size + extension server-side, authenticated Range serving; journey 3.
- [x] ActivityLog on every transition + privileged action; History panels on
      internal, partners, and portal details.
- [x] Theming §4.4 — zero hardcoded brand values; both official systems applied;
      final brand audit PASS ("zero brand bleed").
- [x] RTL-ready (A-12) — zero physical-direction utilities; mirrored glyphs.
- [x] docs/ complete and current — ARCHITECTURE v2, DECISIONS ADR-000–027 (every
      applied A-* has an ADR), TESTING Runs 001–013, BUGS (3: two fixed, BUG-001
      open-with-reason as a tooling flake), PROGRESS Entries 000–007, CHANGELOG.
- [x] Seed + README cold start — §13 fixture list complete; README verified against
      the shipped scripts; .env.example tracked.
- [x] Security basics — bcryptjs(12), JWT + per-request DB authorization (ADR-017),
      Zod on every mutation (re-parsed in services), upload sanitization, no
      secrets in repo (.env/uploads/dbs gitignored).
- [x] No console errors; responsive at 1440/1024/768/390; empty states — qa-sweep
      asserts all three per role on every major screen (Run 013).

- Done: final seed, security-rbac + qa-sweep suites, BUG-002/003 found+fixed,
  README, ARCHITECTURE v2 corrections, CHANGELOG, ADR-027, brand heading polish,
  B-Systems favicon.
- Next steps: founder review. Open founder items: the "Needs founder confirmation"
  thread (1)–(12) — chiefly the pending brand assets (remaining logo slots + Lama
  Sans files) and the ADR defaults; BUG-001 (vitest collection flake) may be closed
  as tooling noise or chased upstream; production deploy needs the ADR-002 Postgres
  switch + real AUTH_SECRET.
- Blockers: none.
- Needs founder confirmation: items (1)–(12) carried (see Entries 001–005).

## Entry 008 — 2026-08-09 — Consolidated sign-in + design-round handoff
- Done: (1) Diagnosed the founder's "wrong password": the portal-admin credentials
  were VALID — the role-partitioned login providers rejected valid accounts on the
  "wrong" app's page. (2) Built the consolidated sign-in (ADR-028): ONE /login for
  every account (email-or-phone + password), role-based landing, legacy login URLs
  redirect, portal sign-up auto-login flows through it; neutral design with both
  brand logos (styles in the sanctioned neutral.css). Fixed a real subtlety:
  auth() cannot see the just-set session cookie in the same request — landing roles
  are read from the DB. (3) TESTING: full suite green after the migration —
  vitest 61/0, Playwright 12/12; E2E now runs against a PRODUCTION server on :3100
  (Next 16 allows one dev server per project and the founder's is live).
  (4) Wrote docs/DESIGN-BRIEF.md — the complete self-contained system spec for the
  founder's design round (Claude Design): every screen, both brand systems, the
  §5 interaction rules, and the founder's new asks (consolidated sign-in polish,
  per-entity user management + company switcher, per-stage colored draggable
  boards). (5) ADR-028 (consolidated login) + ADR-029 (platform_admin + entity
  access — implementation deferred to the design round; role reserved in
  constants).
- In progress: none — awaiting the founder's design round output.
- Next steps: founder feeds DESIGN-BRIEF.md to Claude Design, tweaks, returns the
  approved design → implement it (boards' per-stage colors + internal drag & drop,
  user management UI, switcher, sign-in polish) under ADR-029/030 discipline.
- Blockers: awaiting founder's design deliverable.
- Needs founder confirmation: items (1)–(12) carried; (13) ADR-028 consolidated
  login replacing per-app pages (founder-directed — confirm the landing-priority
  order suits dual-role accounts).

## Entry 009 — 2026-08-09 — V2 restructure — UI + verification complete (V2-P4/P5)
- Done: (1) V2-P4 UI shipped — role-aware B-Systems shell replacing the portal
  (per-role navs: admin 10 sections; sales CRM + Won Leads; agents/partners
  CRM / Won Leads / Payments / Profile); NotificationsBell polling
  /api/b-systems/notifications; colored draggable board
  (src/components/bsystems/BsBoard.tsx) with per-stage token tints + role-aware
  drop forms (roleForms.tsx); BsEventPanel with the agent meeting Q&A → WhatsApp
  confirmation copy; unified lead detail at /b-systems/crm/lead/[leadId] (admin
  edit/copy/delete); and all V2 sections — Home (agent/partner counts + external
  pipeline chart), Leads (owner-bucket filter), Won Leads (+ admin detail with
  sequential milestone checks and proposal/contract uploads), Agents
  (Detailed/Pipeline), Registrations, Statements (Waiting → Generate → Create
  ST-#### → Mark paid with proof image), Users (create/deactivate/impersonate),
  Payments, Profile (agent full / partner read-only + password change); profile
  APIs re-homed to /api/b-systems/profile*. (2) Partner pages gated admin-only
  server-side (requireBsAdminPage); ByteForce untouched. (3) V2-P5 verification —
  tsc clean; production build green; stage tokens verified in the emitted CSS
  (utilities resolve against the brand scopes; Tailwind's @layer theme
  self-reference is inert because the unlayered brand token definitions win);
  vitest 60/60 incl. a new 12-test V2 integration suite
  (src/lib/services/bsystems.integration.test.ts); Playwright 12/12 after
  rewriting journeys 3/4/5 + security-rbac + qa-sweep for the unified
  /b-systems app (TESTING Run 014; V2 scope per ADR-030).
- In progress: none.
- Next steps: founder review of the [A]-marked V2 defaults in
  docs/REQUIREMENTS-V2.md.
- Blockers: none.
- Needs founder confirmation: items (1)–(13) carried (see Entries 001–008);
  (14) the [A]-marked defaults in docs/REQUIREMENTS-V2.md still stand.

## Entry 010 — 2026-08-09 — Claude Design handoff applied (calibrated V1→V2)
- Done: (1) Prototype extracted by a 6-reader workflow + synthesis into
  docs/DESIGN-APPLICATION-SPEC.md (token sheet, component specs §2, screen
  map §3, 25 resolved risks §4). (2) Token files rewritten to the prototype
  values (both brands + the new neutral scope; 4-value stage tables incl.
  derived Negotiation); @theme mappings extended; design-system.css component
  layer added; fonts (JetBrains Mono everywhere, Inter 600, Raleway 700/800
  on the home shell). (3) Chrome rebuilt: dark indigo B-Systems header (deep
  navy for agents/partners), light ByteForce header, notifications bell,
  ENTITY SWITCHER for dual-entity accounts (admin seeded with both entities).
  (4) Hub (/) and /login rebuilt to the prototype's hub + split-billboard
  screens; portal landing/signup restyled (marketing copy sections deferred,
  see ADR-031). (5) All screens swept to the design system by 5 parallel
  restyle agents (boards, tables, cards, detail templates, won-deal manager,
  statements modal, users table, profile) with all copy/aria/test-hooks
  frozen. (6) Verification: tsc + production build green; vitest 60/60 (the
  ADR-019 set-equality test caught a dropped --color-on-accent — fixed);
  Playwright 12/12 after two fixes (journey5 money-tile label/value split
  assertion; header .user flex:none for a 2-px 768px overflow);
  brand-auditor PASS (one RTL padding fixed). (ADR-031, TESTING Run 015.)
- In progress: none.
- Next steps: founder review of ADR-031's flagged items; marketing-copy pass
  for the deferred /portal landing sections (R23) once copy is approved.
- Blockers: none.
- Needs founder confirmation: items (1)–(14) carried (see Entries 001–009);
  (15) ADR-031's flagged items (success-green exemption, external chrome
  navy, Negotiation colors, Lama Sans cuts, portal marketing copy).

## Entry 011 — 2026-08-09 — Founder resolutions on ADR-031 flags
- Done: Recorded the founder's resolutions on ADR-031's flagged items
  (DECISIONS.md → "ADR-031 — Resolution (2026-08-09, founder)" addendum):
  (1) R4 success green REJECTED — "no green anywhere" stands; --color-success
  moved in-palette (B-Systems → Systems Indigo, ByteForce → Royal Violet,
  neutral → ink); token files updated and the change shipped/verified
  (vitest 60/60, build green). (2) R8 role-aware chrome (indigo staff /
  deep-navy agents+partners) CONFIRMED. (3) R12 derived Negotiation colors
  (ramp-midpoint, bar #D8468B) CONFIRMED. (4) R23 portal marketing sections:
  founder chose "draft copy for approval" — copy drafted, awaiting founder
  sign-off before the sections are built.
- In progress: R23 portal marketing copy draft — with the founder for
  sign-off.
- Next steps: on copy approval, build the deferred /portal landing sections
  (R23); obtain founder confirmation on Lama Sans intermediate cuts
  (R5/A-13).
- Blockers: none.
- Needs founder confirmation: (a) Lama Sans intermediate cuts (R5/A-13);
  (b) the portal marketing copy draft (pending approval, R23); (c) the
  standing REQUIREMENTS-V2 [A] defaults and the carried items thread —
  items (1)–(14), see Entries 001–009. The other ADR-031 flags
  (success green, external chrome navy, Negotiation colors) are RESOLVED
  by the ADR-031 Resolution addendum (2026-08-09).

## Entry 012 — 2026-08-09 — Admin identity unified across environments (founder directive)
- Done: THE admin is now admin@byteforce.com / password123, name "Elmur",
  holding both entities (bsystems_admin + byteforce_staff) — identical in
  local and production. prisma/seed.ts: renames the legacy
  admin@b-systems.example account in place (no duplicate admin, history
  intact); upsertUser now re-asserts name AND password on every run so
  seeded accounts are always in the documented state; demo
  accounts/fixtures are skipped when NODE_ENV=production (SEED_DEMO=1
  overrides) so demo passwords never reach a live system — the admin is
  the only account production seeds. Local dev.db re-seeded and verified:
  one admin (Elmur), legacy account gone; E2E specs/README/hub demo chips
  updated to the new credentials; tsc clean, Playwright 12/12.
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: on copy approval, build the deferred /portal landing
  sections (R23); obtain founder confirmation on Lama Sans intermediate
  cuts (R5/A-13); after first production login, change the admin password
  (see the new flag below).
- Blockers: none.
- Needs founder confirmation: (a) Lama Sans intermediate cuts (R5/A-13);
  (b) the portal marketing copy draft (pending approval, R23); (c) the
  standing REQUIREMENTS-V2 [A] defaults and the carried items thread —
  items (1)–(14), see Entries 001–009; (d) NEW — password123 is a weak
  production credential: recommend changing it after first production
  login. Caveat: the seed re-asserts this password on any future
  production seed run, so either change the seed value or avoid
  re-running seed in production once live.

## Entry 013 — 2026-08-09 — Root redirect, motion layer, full backup/restore
- Done: (1) Dev-server fix: Turbopack could not resolve design-system.css via
  a CSS @import placed after the tailwindcss import — theme CSS moved to
  module imports in the three root layouts (dev + prod verified).
  (2) Founder directive: the platform root `/` now redirects straight to
  /login — the hub page is removed from the flow. (3) Motion layer in
  design-system.css: staggered entry rise on page content, hover lifts on
  tiles/cards, pressed states on buttons/nav, focus border transitions,
  timeline stagger — all opacity/transform only, fully disabled under
  prefers-reduced-motion; board drag cards keep their tuned transition.
  (4) Full backup/restore per ADR-032: service (src/lib/services/backup.ts),
  admin API route (/api/b-systems/backup), Export/Import controls on the
  admin Home; integration test proves export → full wipe (db + files) →
  import restores rows, relations, ids, dates, uploads, and logs the import.
  (5) Verification: tsc clean, vitest 62/62 (2 new backup tests),
  Playwright 12/12 (TESTING Run 016).
- In progress: R23 portal marketing copy draft — still with the founder for
  sign-off (carried from Entry 011).
- Next steps: on copy approval, build the deferred /portal landing sections
  (R23); obtain founder confirmation on Lama Sans intermediate cuts
  (R5/A-13); founder to set a secure storage routine for backup exports
  (they contain password hashes — ADR-032); change the admin password after
  first production login (Entry 012 flag).
- Blockers: none.
- Needs founder confirmation: (a) Lama Sans intermediate cuts (R5/A-13);
  (b) the portal marketing copy draft (pending approval, R23); (c) the
  standing REQUIREMENTS-V2 [A] defaults and the carried items thread —
  items (1)–(14), see Entries 001–009; (d) password123 is a weak production
  credential — change it after first production login (see Entry 012's
  caveat on seed re-runs); (e) NEW — ADR-032 backup exports embed password
  hashes and every uploaded file: the file itself is a secret; store
  backups securely (restricted access, ideally encrypted at rest).

## Entry 014 — 2026-08-09 — PostgreSQL switch (ADR-033)
- Done: dev data exported via the ADR-032 backup BEFORE conversion and
  re-imported into the new dev Postgres (verified: 16 leads, admin Elmur
  intact); full conversion as per ADR-033 — datasource provider postgresql,
  @prisma/adapter-pg in db.ts/seed.ts, SQLite migration history retired for
  one fresh init migration (20260809000000_init_postgres), embedded
  PostgreSQL for local dev/tests (5433 dev persistent / 5434 vitest fresh /
  5435 Playwright fresh, .pgdata/ gitignored), DATABASE_URL now mandatory
  (db.ts throws a clear error when unset), `next build` database-free.
  Verification: tsc clean, vitest 62/62 (in 6 s vs ~42 s on SQLite),
  Playwright 12/12, and a simulated container build with an unreachable
  DATABASE_URL compiles green (TESTING Run 017).
- In progress: R23 portal marketing copy draft — still with the founder for
  sign-off (carried from Entry 011).
- Next steps: on copy approval, build the deferred /portal landing sections
  (R23); obtain founder confirmation on Lama Sans intermediate cuts
  (R5/A-13); founder to set a secure storage routine for backup exports
  (ADR-032); change the admin password after first production login
  (Entry 012 flag); production deploy per ADR-033 — see item (f) below.
- Blockers: none.
- Needs founder confirmation: (a) Lama Sans intermediate cuts (R5/A-13);
  (b) the portal marketing copy draft (pending approval, R23); (c) the
  standing REQUIREMENTS-V2 [A] defaults and the carried items thread —
  items (1)–(14), see Entries 001–009; (d) password123 is a weak production
  credential — change it after first production login (see Entry 012's
  caveat on seed re-runs); (e) ADR-032 backup exports embed password hashes
  and every uploaded file — the file itself is a secret; store backups
  securely; (f) NEW — production needs a DATABASE_URL (postgresql://…),
  `prisma migrate deploy` at boot, and a one-time seed for the admin
  account (ADR-033).

## Entry 015 — 2026-08-10 — Partner conversion credentials (founder directive)
- Done: Founder directive implemented — the Partnership CRM's Won gate now
  takes the partner's EMAIL + PASSWORD, and conversion auto-creates the
  partner's login with exactly those credentials (role bsystems_partner,
  linked to the Partner record). This supersedes the V2 §8 auto password
  "{CompanyName}@Bsystemspartnership". Rules: email without password is
  refused (nothing converts); no email at all still converts without a
  login (unchanged). Changes: wonPartnerSchema (+password, email⇒password
  refine), PP-4 provisioning uses the admin-set password, Won-gate form
  gained a Password field with the hint "Email + password create the
  partner's account automatically", README updated. Verified: tsc clean,
  vitest 64/64 (2 new tests: exact-credentials provisioning;
  email-without-password refusal leaves nothing converted),
  Playwright 12/12 (TESTING Run 018).
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: on copy approval, build the deferred /portal landing
  sections (R23); obtain founder confirmation on Lama Sans intermediate
  cuts (R5/A-13); founder to set a secure storage routine for backup
  exports (ADR-032); change the admin password after first production
  login (Entry 012 flag); production deploy per ADR-033 (Entry 014
  item (f)).
- Blockers: none.
- Needs founder confirmation: (a) Lama Sans intermediate cuts (R5/A-13);
  (b) the portal marketing copy draft (pending approval, R23); (c) the
  standing REQUIREMENTS-V2 [A] defaults and the carried items thread —
  items (1)–(14), see Entries 001–009 — except the V2 §8 auto-password
  default, superseded this entry by the founder's directive; (d)
  password123 is a weak production credential — change it after first
  production login (see Entry 012's caveat on seed re-runs); (e) ADR-032
  backup exports embed password hashes and every uploaded file — store
  backups securely; (f) production needs a DATABASE_URL (postgresql://…),
  `prisma migrate deploy` at boot, and a one-time seed for the admin
  account (ADR-033).

## Entry 016 — 2026-08-10 — Founder V3 batch + dashboard animation round
- Done: Founder V3 batch implemented (ADR-034, all founder-directed):
  (1) two-way impersonation — the JWT carries impersonatorId, a persistent
  bar offers one-click "Back to admin", endImpersonation re-verifies the
  admin server-side, return trigger impersonation_return logged;
  (2) agent signup registers BOTH identifiers (email now required
  alongside phone; either signs in) and is an approval REQUEST — new
  User.registrationStatus (pending/approved/rejected, migration
  20260810110642), pending/rejected users cannot sign in (provider +
  requireUser + explicit login-page messages), Registrations gained the
  Awaiting-approval queue with Approve/Reject (admin API
  /api/b-systems/registrations/[id]) plus an admin bell notification per
  request, no auto-login after signup; (3) won-deal math barriers
  server-enforced in wonDealSchema with live totals in the milestone tab —
  milestone values total the estimated value, milestone commissions total
  the commission % (±EGP 1), per-milestone end ≥ start, milestones
  strictly chronological; handleRoute now surfaces the first zod issue
  message to every form; (4) printable branded commission-statement
  document at /b-systems/statements/[id]/document (admin + the statement's
  closer), token-driven branding, print CSS strips chrome, linked from
  Statements and Payments codes; (5) lead detail shows every creation
  field always, Edit offered to the lead's OWNER (API access rules
  unchanged), modal-crop root cause fixed (fill-mode backwards releases
  Chromium containing blocks), required controls show an automatic star,
  boards render full-bleed (scrollbar-safe breakout), owner buckets are
  color-coded chips (internal indigo / agent magenta / partner pink /
  admin navy). Dashboard enhanced: count-up KPI numbers via AnimatedValue,
  growing chart meters with stagger, stage-strip bar reveals, varied KPI
  accent dots, live date line, pulsing bell badge — all disabled under
  prefers-reduced-motion. Test infra hardened: embedded-Postgres test/e2e
  instances now use UNIQUE per-run data dirs + per-run pid-derived ports
  (crashed runs left Windows zombie sockets/shared-memory on fixed ports).
  Verified: tsc clean, vitest 71/71 (+7: snap-back tokens, approval cycle
  service, won-deal math), Playwright 13/13 (journey4 reworked to
  request→approve→email-then-phone sign-in; security-rbac approves via
  API; NEW impersonation journey; journey1's KPI reads wait for the
  count-up to settle) — TESTING Run 019.
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: on copy approval, build the deferred /portal landing
  sections (R23); obtain founder confirmation on Lama Sans intermediate
  cuts (R5/A-13); founder to set a secure storage routine for backup
  exports (ADR-032); change the admin password after first production
  login (Entry 012 flag); production deploy per ADR-033 (Entry 014
  item (f)).
- Blockers: none.
- Needs founder confirmation: (a) Lama Sans intermediate cuts (R5/A-13);
  (b) the portal marketing copy draft (pending approval, R23); (c) the
  standing REQUIREMENTS-V2 [A] defaults and the carried items thread —
  items (1)–(14), see Entries 001–009 — except the V2 §8 auto-password
  default (superseded by the founder directive in Entry 015); (d)
  password123 is a weak production credential — change it after first
  production login (see Entry 012's caveat on seed re-runs); (e) ADR-032
  backup exports embed password hashes and every uploaded file — store
  backups securely; (f) production needs a DATABASE_URL (postgresql://…),
  `prisma migrate deploy` at boot, and a one-time seed for the admin
  account (ADR-033).

## Entry 017 — 2026-08-11 — Founder V4 batch: Partnership CRM drag board, admin edit/delete, board alignment
- Done: Founder V4 batch on the Partnership CRM (all founder-directed).
  (1) The partners board is now draggable like the main CRM:
  `dragEnabled: true` in src/lib/pipeline-engine/configs/partners.ts —
  the shared engine already treats a drag as the matching action (same
  trigger ids), so the PP gates apply unchanged; `prospectEventSchema`
  (src/lib/services/partners.ts) gained the `{type:"drag", to}` variant;
  NEW src/components/partners/PartnersBoard.tsx (dnd-kit) — a drop opens
  the target stage's form in a modal (numbers picker with pre-checked
  card numbers, follow-up, meeting, the PP-4 Won completeness gate, lost
  reason), cancel reverts, drop onto Lead commits directly (intake return
  needs no form), terminal cards toast "Won and Lost cards can no longer
  be moved"; ProspectEventPanel refactored to export
  `prospectGroupPayload` + `ProspectGroupFields` so the panel and the
  board share one source of stage-form truth; `PartnersPipelineBody`
  (src/components/partners/pages.tsx) now feeds the dnd board — the old
  static board removed. (2) Admin edit + delete for pipeline cards and
  directory partners: services `deleteProspect` (cascades stage records +
  recordings incl. stored files; a converted card also removes its
  directory Partner; attributed leads survive with attribution nulled),
  `updatePartnerSchema`/`updatePartner`, `deletePartner` (attribution
  nulled; the login account survives — removable in Users); DELETE added
  to /api/b-systems/partners-pipeline/[id]; NEW /api/b-systems/partners/[id]
  with PATCH + DELETE (requireBsAdmin); NEW
  src/components/partners/manage.tsx (EditProspectButton,
  EditPartnerButton, DeleteEntityButton with inline confirm step) wired
  into both detail pages' page-heads. (3) Wide-screen layout fix ("all
  crammed on the right"): `.board` in src/themes/design-system.css now
  uses `padding-inline: calc(max(var(--page-pad, 26px), 50vw - 640px +
  var(--page-pad, 26px)) - 8px)` so full-bleed board columns start at the
  centered max-w-7xl content edge; both detail pages moved to the
  standard page-head + page-actions layout. Verified: tsc clean,
  vitest 83/83, next build clean, Playwright 16 passed / 2 audit-opt-in
  skipped (TESTING Run 020). No new ADR — behavior follows existing
  SPEC/engine semantics and founder directives already logged.
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: on copy approval, build the deferred /portal landing
  sections (R23); obtain founder confirmation on Lama Sans intermediate
  cuts (R5/A-13); founder to set a secure storage routine for backup
  exports (ADR-032); change the admin password after first production
  login (Entry 012 flag); production deploy per ADR-033 (Entry 014
  item (f)).
- Blockers: none.
- Needs founder confirmation: (a) Lama Sans intermediate cuts (R5/A-13);
  (b) the portal marketing copy draft (pending approval, R23); (c) the
  standing REQUIREMENTS-V2 [A] defaults and the carried items thread —
  items (1)–(14), see Entries 001–009 — except the V2 §8 auto-password
  default (superseded by the founder directive in Entry 015); (d)
  password123 is a weak production credential — change it after first
  production login (see Entry 012's caveat on seed re-runs); (e) ADR-032
  backup exports embed password hashes and every uploaded file — store
  backups securely; (f) production needs a DATABASE_URL (postgresql://…),
  `prisma migrate deploy` at boot, and a one-time seed for the admin
  account (ADR-033).

## Entry 018 — 2026-08-11 — PRODUCTION INCIDENT: uploaded files lost on redeploy (code fixed; founder host action required)
- Done: production incident fixed — founder clicked a statement's proof
  link and got {"error":"File missing from storage"} (BUG-004, ADR-035).
  Root cause: uploads lived in `<cwd>/uploads` INSIDE the app container;
  the host rebuilds the container on every deploy, wiping all uploaded
  files (payment proofs, CVs, recordings, proposal/contract PDFs), while
  the external Postgres kept the attachment rows — the UI kept linking
  blobs that no longer existed. Shipped: (1) src/lib/storage/index.ts —
  storage root honors the UPLOADS_DIR env (default `<cwd>/uploads`
  unchanged); exported uploadsDir()/uploadsDirConfigured(); the DURABLE
  fix needs the founder host action below. (2)
  src/lib/services/statements.ts — NEW replaceStatementProof() (paid
  statements only; swaps the proof attachment; deletes old files after
  commit; deletes the NEW file if the transaction fails so nothing
  orphans; activity trigger "proof_replaced"); listStatements(),
  paymentsFor(), statementDocument() now probe storage per proof and
  return a fileOk flag. (3) PUT /api/b-systems/statements/[id]/paid =
  replace proof (admin only). (4) Missing-file UI states: admin
  Statements shows "proof file missing" + a Re-upload proof control
  (plus a Replace proof control when the file is fine) — ReplaceProofForm
  in src/components/bsystems/statements.tsx; the closer Payments page
  shows "proof file missing — ask the admin to re-upload it" instead of
  a dead link; the printable statement document omits its "Payment proof
  on file" line when the blob is gone; partner prospect detail shows
  "Recording file missing" instead of a dead audio/video player (probe
  added in getProspectDetail). (5) src/app/api/files/[id]/route.ts —
  browser navigations to a missing file get a styled standalone HTML
  explanation page (what happened, how to fix); API/media requests keep
  the JSON 404. (6) /api/health gained an `uploads` diagnostic section:
  dir path, persistentDirConfigured, writable probe, scan of up to 500
  attachments counting files missing from storage (sample shows opaque
  storage keys only, never filenames — the endpoint is public), hints
  instructing the persistent-volume setup; `ok` now also requires
  uploads writable (missing files alone do not flip it). Verified: tsc
  clean, vitest 84/84, next build clean, Playwright 16 passed / 2
  audit-opt-in skipped — TESTING Run 021 — including an 18-agent
  adversarial review (3 lenses × verify) whose confirmed findings were
  all fixed in-round (health filename leak → opaque keys; orphaned file
  on failed replace tx → cleanup catch; silent broken recording players
  → fileOk badge; dead proof link on closer Payments → badge; printable
  document overclaiming a proof → line omitted) and one deliberately
  ACCEPTED pre-existing tradeoff: the public /api/health disclosure
  (noted in IMPLEMENTATION.md).
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: FIRST — the founder host action in item (g) below (attach
  the persistent volume, set UPLOADS_DIR, redeploy, re-upload lost
  proofs). Then the carried items: on copy approval, build the deferred
  /portal landing sections (R23); obtain founder confirmation on Lama
  Sans intermediate cuts (R5/A-13); founder to set a secure storage
  routine for backup exports (ADR-032); change the admin password after
  first production login (Entry 012 flag); production deploy per ADR-033
  (Entry 014 item (f)).
- Blockers: durable uploads are blocked on the founder host action —
  until the persistent volume is mounted and UPLOADS_DIR set, EVERY
  redeploy wipes uploads again (the code side is complete; nothing
  further to build).
- Needs founder confirmation: (g) NEW — URGENT ACTION (production
  incident 2026-08-11, ADR-035/BUG-004): in the hosting panel attach
  persistent storage (e.g. mount at /data/uploads), set env
  UPLOADS_DIR=/data/uploads, redeploy, then re-upload the lost proof(s)
  via Statements → Re-upload proof — check /api/health
  `uploads.missingFiles` to see how many are gone. Carried: (a) Lama
  Sans intermediate cuts (R5/A-13); (b) the portal marketing copy draft
  (pending approval, R23); (c) the standing REQUIREMENTS-V2 [A] defaults
  and the carried items thread — items (1)–(14), see Entries 001–009 —
  except the V2 §8 auto-password default (superseded by the founder
  directive in Entry 015); (d) password123 is a weak production
  credential — change it after first production login (see Entry 012's
  caveat on seed re-runs); (e) ADR-032 backup exports embed password
  hashes and every uploaded file — store backups securely; (f)
  production needs a DATABASE_URL (postgresql://…), `prisma migrate
  deploy` at boot, and a one-time seed for the admin account (ADR-033).

## Entry 019 — 2026-08-12 — Founder logo fixes: real B-Systems mark on statement document, header logos link to app home
- Done: two founder-directed UI fixes shipped. (1) The printable
  statement document
  (src/app/(bsystems)/b-systems/(app)/statements/[id]/document/page.tsx)
  now renders the real B-Systems logo mark via
  `<BrandLogo brand="bsystems" variant="mark" height={40} />` instead of
  the placeholder "S" gradient square (founder: "use the actual logo of
  bsystems" — same correction as the app header earlier). (2) Header
  logos now link to the CURRENT app's landing, never the platform root
  (founder: "when I click on the logo it takes me to home"): the
  B-Systems header logo+wordmark links to the role's first nav item
  (/b-systems for admin, /b-systems/crm for others) in
  src/app/(bsystems)/b-systems/(app)/layout.tsx; the ByteForce header
  logo links to basePath (/byteforce) in
  src/components/internal/AppNav.tsx. Both links carry aria-labels. No
  ADR — pure UI following the existing brand rules (ADR-006). Verified:
  tsc clean, vitest 84/84, next build clean, Playwright 16 passed / 2
  audit-opt-in skipped — TESTING Run 022.
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: (carried from Entry 018) FIRST — the founder host action
  in item (g) below (attach the persistent volume, set UPLOADS_DIR,
  redeploy, re-upload lost proofs). Then: on copy approval, build the
  deferred /portal landing sections (R23); obtain founder confirmation
  on Lama Sans intermediate cuts (R5/A-13); founder to set a secure
  storage routine for backup exports (ADR-032); change the admin
  password after first production login (Entry 012 flag); production
  deploy per ADR-033 (Entry 014 item (f)).
- Blockers: durable uploads remain blocked on the founder host action
  (Entry 018 item (g)) — until the persistent volume is mounted and
  UPLOADS_DIR set, every redeploy wipes uploads again (the code side is
  complete).
- Needs founder confirmation: (g) URGENT ACTION, carried from Entry 018
  (production incident 2026-08-11, ADR-035/BUG-004): in the hosting
  panel attach persistent storage (e.g. mount at /data/uploads), set env
  UPLOADS_DIR=/data/uploads, redeploy, then re-upload the lost proof(s)
  via Statements → Re-upload proof — check /api/health
  `uploads.missingFiles` to see how many are gone. Carried: (a) Lama
  Sans intermediate cuts (R5/A-13); (b) the portal marketing copy draft
  (pending approval, R23); (c) the standing REQUIREMENTS-V2 [A] defaults
  and the carried items thread — items (1)–(14), see Entries 001–009 —
  except the V2 §8 auto-password default (superseded by the founder
  directive in Entry 015); (d) password123 is a weak production
  credential — change it after first production login (see Entry 012's
  caveat on seed re-runs); (e) ADR-032 backup exports embed password
  hashes and every uploaded file — store backups securely; (f)
  production needs a DATABASE_URL (postgresql://…), `prisma migrate
  deploy` at boot, and a one-time seed for the admin account (ADR-033).

## Entry 020 — 2026-08-12 — Per-lead team chat with @mentions (founder V5)
- Done: founder V5 feature shipped — a mini chat inside every lead
  (founder: "a mini chat inside every lead so that we can ask questions
  and mention each other... so that when we talk to the lead, we have
  the full picture") — ADR-036. (1) Schema: new LeadComment model
  (leadId FK cascade; authorUserId FK set-null + persisted authorLabel
  so threads survive account deletion; body ≤2000; mentions JSON) —
  migration 20260812113153_lead_comments; synced into the backup MODELS
  (src/lib/services/backup.ts) and src/tests/db-reset.ts;
  Notification.type comment updated (meeting_request | ready_to_close |
  registration | mention). (2) Service src/lib/services/comments.ts:
  mentionableUsersFor(leadId) = exactly who passes requireLeadAccess
  (ByteForce staff / B-Systems admins + internal-sales on
  internal-bucket leads + the owner ONLY while holding an
  agent/partner/admin role — role changes stop the leak), active +
  approved only; resolveMentions server-side, word-boundaried (no "@Ali"
  inside "@Alina" or emails), longest-name-first with span masking;
  addLeadComment writes the comment, per-mention bell notifications
  (type "mention", self-mentions skipped), and an activity-log row (new
  LOG_ACTIONS action "comment", trigger "lead_chat"). (3) Routes:
  POST /api/b-systems/leads/[id]/comments and
  /api/byteforce/leads/[id]/comments via shared makeCommentsPost(brand)
  (src/lib/api/leadComments.ts) — requireLeadAccess + route brand must
  match the lead's brand. Impersonation transparency: an acting-as
  message is labeled "Name (via AdminName)" in the thread, the mention
  notification title, and the activity log (CurrentUser now carries
  impersonatorId from the session). (4) UI
  src/components/shared/LeadChat.tsx on BOTH lead detail pages
  (B-Systems unified + ByteForce): thread with mention chips,
  auto-scroll to the newest message, caret-aware @ autocomplete composer
  (emails never trigger it; ↑/↓ + Enter/Tab keyboard pick; Escape
  dismisses; Enter sends when no suggestions are open), suggestions
  render in-flow (never clipped by card overflow); token-driven
  `.chat-*` CSS block in design-system.css. (5) Notifications hardening:
  markNotificationRead is now ownership-checked (own rows; admins also
  admin-broadcast rows — closes a pre-existing IDOR where any B-Systems
  role could mark any notification read); NEW ByteForce bell
  (NotificationsBell parameterized with apiBase/leadPathBase, mounted in
  the ByteForce header) reading new /api/byteforce/notifications routes
  — ByteForce mentions are now deliverable; ByteForce mention rows carry
  NO lead deep-link by design (ADR-036) — the body names the lead
  instead. Verified: tsc clean, vitest 92/92, next build clean,
  Playwright 16 passed / 2 audit-opt-in skipped — TESTING Run 023 —
  including a 26-agent adversarial review workflow (security /
  correctness-UX / consistency lenses) that confirmed 17 findings (incl.
  two HIGH UI bugs: suggestion popup clipped by card overflow:hidden,
  newest message scrolled out of view); ALL fixed pre-ship except one
  deliberately ACCEPTED behavior — an unresolved @mention (typo /
  non-mentionable name) fails silently server-side and renders as plain
  text without a chip (IMPLEMENTATION.md note).
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: (carried from Entry 018) FIRST — the founder host action
  in item (g) below (attach the persistent volume, set UPLOADS_DIR,
  redeploy, re-upload lost proofs). Then: on copy approval, build the
  deferred /portal landing sections (R23); obtain founder confirmation
  on Lama Sans intermediate cuts (R5/A-13); founder to set a secure
  storage routine for backup exports (ADR-032); change the admin
  password after first production login (Entry 012 flag); production
  deploy per ADR-033 (Entry 014 item (f)).
- Blockers: durable uploads remain blocked on the founder host action
  (Entry 018 item (g)) — until the persistent volume is mounted and
  UPLOADS_DIR set, every redeploy wipes uploads again (the code side is
  complete).
- Needs founder confirmation: (g) URGENT ACTION, carried from Entry 018
  (production incident 2026-08-11, ADR-035/BUG-004): in the hosting
  panel attach persistent storage (e.g. mount at /data/uploads), set env
  UPLOADS_DIR=/data/uploads, redeploy, then re-upload the lost proof(s)
  via Statements → Re-upload proof — check /api/health
  `uploads.missingFiles` to see how many are gone. Carried: (a) Lama
  Sans intermediate cuts (R5/A-13); (b) the portal marketing copy draft
  (pending approval, R23); (c) the standing REQUIREMENTS-V2 [A] defaults
  and the carried items thread — items (1)–(14), see Entries 001–009 —
  except the V2 §8 auto-password default (superseded by the founder
  directive in Entry 015); (d) password123 is a weak production
  credential — change it after first production login (see Entry 012's
  caveat on seed re-runs); (e) ADR-032 backup exports embed password
  hashes and every uploaded file — store backups securely; (f)
  production needs a DATABASE_URL (postgresql://…), `prisma migrate
  deploy` at boot, and a one-time seed for the admin account (ADR-033).

## Entry 021 — 2026-08-12 — SSL "Not secure" audit: code side clean, logout http-downgrade fixed (founder Cloudflare action required)
- Done: founder reported production shows "Not secure" (SSL) and is
  checking Cloudflare; asked us to rule out code-side causes. A 3-agent
  audit workflow (absolute-URLs lens, redirect-downgrade lens incl.
  reading the installed Next 16.3 / next-auth 5 beta sources,
  badge-causes/hardening lens) concluded the app is scheme-clean: zero
  external scripts/fonts/CDN/analytics (mixed content impossible), every
  browser-loaded resource same-origin relative, no absolute-URL
  construction, empty next.config, middleware redirects relativized by
  Next itself. ONE real code-reachable downgrade path found and FIXED
  (BUG-005): logout() used signOut({redirectTo}), which absolutizes
  "/login" against the proxy-reported x-forwarded-proto — behind a
  misreporting proxy, clicking Log out emitted
  Location: http://<domain>/login. Fixed in src/lib/auth/actions.ts
  (signOut({redirect: false}) + relative redirect()); verified vitest
  92/92, Playwright 16 passed / 2 audit-opt-in skipped (TESTING Run
  024); pushed as ce5ff36. No ADR — the fix follows the existing
  proxy-trust semantics. HSTS and any http→https 308 redirect
  deliberately NOT shipped (IMPLEMENTATION.md note: under Cloudflare
  "Flexible" SSL an app-level redirect recreates the historical "too
  many redirects" loop; ship only after /api/health `proxy.proto` reads
  "https").
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: FIRST — the founder actions in items (g) and (h) below
  (persistent volume + UPLOADS_DIR; Cloudflare SSL = Full (strict) +
  AUTH_URL env). Once (h) is confirmed via /api/health
  `proxy.proto` === "https", ship the deferred hardening (HSTS with a
  short max-age first, then the http→https redirect). Then the carried
  items: on copy approval, build the deferred /portal landing sections
  (R23); obtain founder confirmation on Lama Sans intermediate cuts
  (R5/A-13); founder to set a secure storage routine for backup exports
  (ADR-032); change the admin password after first production login
  (Entry 012 flag); production deploy per ADR-033 (Entry 014 item (f)).
- Blockers: the "Not secure" badge itself is host/Cloudflare TLS
  configuration — nothing further is fixable code-side (item (h));
  durable uploads remain blocked on the founder host action (Entry 018
  item (g)).
- Needs founder confirmation: (h) NEW ACTION (SSL, this entry): in
  Cloudflare set SSL/TLS mode = Full (strict) — NOT Flexible or Off —
  and check the DNS record is proxied (orange cloud), the certificate
  covers the exact hostname (Universal SSL covers only ONE subdomain
  level), and the zone is not paused; on the host set env
  AUTH_URL=https://<domain> (also fixes NextAuth secure-cookie selection
  when the proxy misreports proto). Diagnostic: GET /api/health —
  `proxy.proto` must read "https". (g) URGENT ACTION, carried from
  Entry 018 (production incident 2026-08-11, ADR-035/BUG-004): in the
  hosting panel attach persistent storage (e.g. mount at /data/uploads),
  set env UPLOADS_DIR=/data/uploads, redeploy, then re-upload the lost
  proof(s) via Statements → Re-upload proof — check /api/health
  `uploads.missingFiles` to see how many are gone. Carried: (a) Lama
  Sans intermediate cuts (R5/A-13); (b) the portal marketing copy draft
  (pending approval, R23); (c) the standing REQUIREMENTS-V2 [A] defaults
  and the carried items thread — items (1)–(14), see Entries 001–009 —
  except the V2 §8 auto-password default (superseded by the founder
  directive in Entry 015); (d) password123 is a weak production
  credential — change it after first production login (see Entry 012's
  caveat on seed re-runs); (e) ADR-032 backup exports embed password
  hashes and every uploaded file — store backups securely; (f)
  production needs a DATABASE_URL (postgresql://…), `prisma migrate
  deploy` at boot, and a one-time seed for the admin account (ADR-033).

## Entry 022 — 2026-08-13 — Full Arabic ⇄ English translation (founder directive)
- Done: founder directive shipped — "translate the whole system... a
  translation button between arabic and english for every single content
  in the entire app" — ADR-037. (1) Hand-rolled i18n, no library:
  src/lib/i18n/ core.ts (Locale en|ar, Msg {en,ar}, tFor, dirFor, cookie
  name), server.ts (getLocale from cookie, default en), actions.ts
  (setLocale server action); LocaleProvider context for client
  components; LanguageToggle (EN | عربي switcher chip) mounted in both
  app headers (desktop .user cluster + mobile nav sheet) and on /login;
  all three root layouts stamp <html lang dir> and mount the provider —
  Arabic renders full RTL (the design system was already
  logical-properties-based). (2) Dictionary modules under
  src/lib/i18n/dict/: labels.ts (stage/lead-type/owner-type helpers —
  engine constants stay English in code, DB, and API payloads;
  translation happens at render), auth.ts, internal.ts, crm.ts,
  admin.ts, partners.ts, chat.ts. Six parallel agents externalized EVERY
  user-visible string across: login+portal+signup, the ByteForce app,
  B-Systems shell/nav/dashboard/CRM/lead detail, won-leads/statements
  (incl. the printable document — bilingual)/payments/users/
  registrations/agents/profile/bell, partners pipeline+directory,
  LeadChat+StageBadge. Browser-tab titles localize via generateMetadata.
  (3) New e2e spec e2e/i18n.spec.ts: toggle → dir=rtl lang=ar + Arabic
  heading → Arabic login flow → back to EN from the app header.
  Verified: tsc clean, vitest 92/92, next build clean, Playwright 17
  passed / 2 audit-opt-in skipped (TESTING Run 025) — EN output stayed
  byte-identical, so the whole existing suite passed unchanged. Known
  limits this round: server-side error strings (zod/service ApiError
  messages surfaced in forms) remain English (translating them needs
  error codes); ByteForce thin-page metadata titles partly English; two
  Arabic terminology choices flagged for founder review — see items
  (i)/(j) below.
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: FIRST — the founder actions in items (g) and (h) below
  (persistent volume + UPLOADS_DIR; Cloudflare SSL = Full (strict) +
  AUTH_URL env). Once (h) is confirmed via /api/health `proxy.proto`
  === "https", ship the deferred hardening (HSTS with a short max-age
  first, then the http→https redirect). i18n follow-ups: design an
  error-code scheme so server-side error strings can localize (item
  (i)); finish the remaining ByteForce thin-page metadata titles; apply
  the founder's verdict on the terminology pair (item (j)). Then the
  carried items: on copy approval, build the deferred /portal landing
  sections (R23); obtain founder confirmation on Lama Sans intermediate
  cuts (R5/A-13); founder to set a secure storage routine for backup
  exports (ADR-032); change the admin password after first production
  login (Entry 012 flag); production deploy per ADR-033 (Entry 014 item
  (f)).
- Blockers: durable uploads remain blocked on the founder host action
  (Entry 018 item (g)); the "Not secure" badge remains host/Cloudflare
  TLS configuration (Entry 021 item (h)). Nothing blocked the i18n work
  itself.
- Needs founder confirmation: (i) NEW (this entry, ADR-037): server-side
  error strings (zod/service ApiError messages surfaced in forms) remain
  English this round — translating them needs an error-code scheme;
  confirm whether/when to prioritize it. (j) NEW (this entry): two
  Arabic terminology choices need review — "CRM" is rendered as
  "المبيعات" and "Retainer" as "عقد دوري"; confirm or supply preferred
  terms. (h) carried from Entry 021 (SSL): in Cloudflare set SSL/TLS
  mode = Full (strict) — NOT Flexible or Off — and check the DNS record
  is proxied (orange cloud), the certificate covers the exact hostname
  (Universal SSL covers only ONE subdomain level), and the zone is not
  paused; on the host set env AUTH_URL=https://<domain> (also fixes
  NextAuth secure-cookie selection when the proxy misreports proto).
  Diagnostic: GET /api/health — `proxy.proto` must read "https". (g)
  URGENT ACTION, carried from Entry 018 (production incident 2026-08-11,
  ADR-035/BUG-004): in the hosting panel attach persistent storage
  (e.g. mount at /data/uploads), set env UPLOADS_DIR=/data/uploads,
  redeploy, then re-upload the lost proof(s) via Statements → Re-upload
  proof — check /api/health `uploads.missingFiles` to see how many are
  gone. Carried: (a) Lama Sans intermediate cuts (R5/A-13); (b) the
  portal marketing copy draft (pending approval, R23); (c) the standing
  REQUIREMENTS-V2 [A] defaults and the carried items thread — items
  (1)–(14), see Entries 001–009 — except the V2 §8 auto-password default
  (superseded by the founder directive in Entry 015); (d) password123 is
  a weak production credential — change it after first production login
  (see Entry 012's caveat on seed re-runs); (e) ADR-032 backup exports
  embed password hashes and every uploaded file — store backups
  securely; (f) production needs a DATABASE_URL (postgresql://…),
  `prisma migrate deploy` at boot, and a one-time seed for the admin
  account (ADR-033).

## Entry 023 — 2026-08-13 — Founder board-UX fixes: card text overflow, whole-card open, drag layering
- Done: three founder-reported bugs on the CRM board cards fixed on BOTH
  boards (B-Systems CRM BsBoard + Partnership PartnersBoard share the
  .bcard system). (1) Text overflow: a long company/lead name clipped
  past the card edge — the name row's flex children now shrink
  (min-width: 0), wrap anywhere, and clamp at two lines
  (design-system.css .bcard-name / .bcard-rep / .bcard-meta; CSS only,
  no markup text changes). (2) The whole card now opens the lead
  (BsBoard → /b-systems/crm/lead/[id]; PartnersBoard →
  /b-systems/partners-pipeline/[id]): container onClick + cursor:
  pointer; a suppressClickRef set in onDragEnd (cleared 150ms later)
  swallows the click the browser fires on drop, so a completed drag
  never navigates; the inner name <Link> kept untouched (e2e hooks).
  (3) The dragged card no longer disappears behind neighboring columns:
  .col's overflow:hidden was clipping it — the column hosting the
  active drag now carries data-drag-origin (overflow: visible +
  position: relative + z-index above its z-auto siblings), the lifted
  card raises its own z-index, and .col-bar carries its own top radius
  so the corners stay rounded. EN rendered output stayed
  byte-identical. Verified: tsc clean, vitest 92/92, Playwright
  journey3/4/5 + qa-sweep + i18n 10/10, full suite 17 passed / 2
  audit-opt-in skipped (TESTING Run 026).
- In progress: R23 portal marketing copy draft — still with the founder
  for sign-off (carried from Entry 011).
- Next steps: unchanged from Entry 022 — FIRST the founder actions in
  items (g) and (h) below (persistent volume + UPLOADS_DIR; Cloudflare
  SSL = Full (strict) + AUTH_URL env), then the deferred hardening
  (HSTS short max-age first, then the http→https redirect); the i18n
  follow-ups (error-code scheme for item (i), remaining ByteForce
  thin-page metadata titles, founder's terminology verdict for item
  (j)); then the carried items (R23 landing sections on copy approval,
  Lama Sans intermediate cuts R5/A-13, ADR-032 secure backup routine,
  admin password change after first production login, production deploy
  per ADR-033).
- Blockers: durable uploads remain blocked on the founder host action
  (Entry 018 item (g)); the "Not secure" badge remains host/Cloudflare
  TLS configuration (Entry 021 item (h)). Nothing blocked the board
  fixes themselves.
- Needs founder confirmation: (i) carried from Entry 022 (ADR-037):
  server-side error strings (zod/service ApiError messages surfaced in
  forms) remain English this round — translating them needs an
  error-code scheme; confirm whether/when to prioritize it. (j) carried
  from Entry 022: two Arabic terminology choices need review — "CRM" is
  rendered as "المبيعات" and "Retainer" as "عقد دوري"; confirm or
  supply preferred terms. (h) carried from Entry 021 (SSL): in
  Cloudflare set SSL/TLS mode = Full (strict) — NOT Flexible or Off —
  and check the DNS record is proxied (orange cloud), the certificate
  covers the exact hostname (Universal SSL covers only ONE subdomain
  level), and the zone is not paused; on the host set env
  AUTH_URL=https://<domain> (also fixes NextAuth secure-cookie
  selection when the proxy misreports proto). Diagnostic: GET
  /api/health — `proxy.proto` must read "https". (g) URGENT ACTION,
  carried from Entry 018 (production incident 2026-08-11,
  ADR-035/BUG-004): in the hosting panel attach persistent storage
  (e.g. mount at /data/uploads), set env UPLOADS_DIR=/data/uploads,
  redeploy, then re-upload the lost proof(s) via Statements → Re-upload
  proof — check /api/health `uploads.missingFiles` to see how many are
  gone. Carried: (a) Lama Sans intermediate cuts (R5/A-13); (b) the
  portal marketing copy draft (pending approval, R23); (c) the standing
  REQUIREMENTS-V2 [A] defaults and the carried items thread — items
  (1)–(14), see Entries 001–009 — except the V2 §8 auto-password default
  (superseded by the founder directive in Entry 015); (d) password123 is
  a weak production credential — change it after first production login
  (see Entry 012's caveat on seed re-runs); (e) ADR-032 backup exports
  embed password hashes and every uploaded file — store backups
  securely; (f) production needs a DATABASE_URL (postgresql://…),
  `prisma migrate deploy` at boot, and a one-time seed for the admin
  account (ADR-033).

## Entry 024 — 2026-08-13 — Founder board-UX round, part 2: the board's Owner select was empty (ADR-038)
- Done: root-caused the founder's "the owner in the lead is still
  missing". The reps prop threading (CRM board page → BsBoard →
  GroupFieldsV2, and the mirrored PartnersBoard path) was already
  correct — the real cause was the DATA source: listReps("bsystems")
  reads SalesRep cards, and bsystems cards exist only via the demo
  seed (skipped in production by design) — no B-Systems screen calls
  POST /api/b-systems/reps (§6.1 Sales Reps is ByteForce-only). On a
  live system the Owner select therefore rendered only "—" in EVERY
  admin/sales stage form (board drag modal, lead detail panel,
  partners pipeline forms). Fix (ADR-038): new listBsOwnerReps() in
  src/lib/services/sales-reps.ts auto-provisions a bsystems SalesRep
  card for every ACTIVE bsystems_sales account (exact-name match,
  idempotent) and returns the card list; all five bsystems Owner call
  sites switched to it. No schema change, no migration — production
  self-heals on the first page view. EN rendered output byte-identical.
  Verified: tsc clean, vitest 92/92, Playwright full 17 passed / 2
  audit-opt-in skipped (TESTING Run 027). Ships in one commit with
  Entry 023's board card fixes.
- In progress: unchanged from Entry 023.
- Next steps: unchanged from Entry 023.
- Blockers: none for this fix; the founder host actions in Entry 023
  items (g)/(h) still stand.
- Needs founder confirmation: the Owner list is now the ACTIVE
  B-Systems sales accounts (role bsystems_sales) — an admin appears
  only when that account also holds the sales role (A-8 allows one
  account carrying both). Confirm this roster; if admins should always
  be selectable as follow-up owners, the list will include them.
  Carried items unchanged — see Entry 023.

## Entry 025 — 2026-08-14 — Founder feature: "didn't answer" marker on the main CRM board (ADR-039)
- Done: built end-to-end per the founder directive ("a button that
  indicates that this lead didn't answer, and it appears on the card
  in the actual CRM... just so we know"), mirroring the ready-to-close
  pattern: Lead.noAnswer + migration (20260813205545_lead_no_answer);
  setNoAnswer service (activity-logged triggers no_answer /
  no_answer_cleared, no stage change, no notification); POST
  /api/b-systems/leads/[id]/no-answer behind requireLeadAccess (any
  role with lead access); board-card toggle ("Didn't answer" /
  "Answered — clear flag") with the same drag/navigation click guards
  as the RTC button; "No answer" chip on the card and the lead detail
  header (.badge--noanswer, danger tokens, token-driven); three new
  Msg {en, ar} strings, existing EN byte-identical. B-Systems only —
  the partnership pipeline keeps its separate Didn't Answer STAGE.
  Tests: +1 vitest integration (93/93), +1 e2e spec plus a
  security-rbac 403 line (full suite 18 passed / 2 audit-opt-in
  skipped), tsc clean (TESTING Run 028).
- In progress: unchanged from Entry 024.
- Next steps: unchanged from Entry 024.
- Blockers: none new; Entry 023 founder host actions (g)/(h) stand.
- Needs founder confirmation: carried from Entry 024 (Owner-list
  roster = active sales accounts) and the Entry 023 thread. Nothing
  new — the flag follows the directive directly.

## Entry 026 — 2026-08-14 — Founder bug: ByteForce CRM board hid intake leads (ADR-040)
- Done: root-caused "the CRM in ByteForce is not responding to the
  leads — I added a lead and it's still very empty": CrmBoardBody
  implemented SPEC §6.3 literally — five columns, intake excluded from
  BOTH the query and the columns — so a newly added lead (stage "new")
  never appeared on /byteforce/crm until its first stage move. NOT an
  assignment bug: the board query never filtered by rep, and unassigned
  leads already render the "Unassigned" label. Fix (ADR-040): the board
  uses the full engine stage set — a leading New column like the
  B-Systems board; intake cards show their creation datetime (data
  only, no new strings, EN byte-identical). journey1 extended: the
  fresh lead must be visible in the New column before any transition.
  Verified: tsc clean, vitest 93/93, Playwright full 18 passed / 2
  audit-opt-in skipped (TESTING Run 029).
- In progress: unchanged from Entry 025.
- Next steps: unchanged from Entry 025.
- Blockers: none new; Entry 023 founder host actions (g)/(h) stand.
- Needs founder confirmation: none new — the change implements the
  founder's report directly (§6.3 override logged in ADR-040). Carried:
  see Entries 023–025.

## Entry 027 — 2026-08-14 — Founder: the no-answer flag clears itself when the card moves (ADR-039 addendum)
- Done: per the founder ("make sure the no answer flag automatically
  disappears when the card moves — which indicates it has been answered
  and moved into the pipeline"): in applyLeadEvent, a successful
  transition that actually changes the stage now clears Lead.noAnswer
  in the SAME transaction/update, logging the existing
  "no_answer_cleared" trigger only when the flag was actually set (no
  noise rows). Direction is universal — ANY stage change clears it,
  including a move back to New: any move signals contact was made
  (ADR-039 addendum; DECISIONS stays append-only so the addendum lives
  here). Manual toggling from the card is unchanged. Verified: tsc
  clean, vitest 94/94 (+1 test in the ADR-039 describe), Playwright
  full 18 passed / 2 audit-opt-in skipped (TESTING Run 030).
- In progress: unchanged from Entry 026.
- Next steps: unchanged from Entry 026.
- Blockers: none new.
- Needs founder confirmation: none new — implements the directive
  directly. Carried: see Entries 023–025.

## Entry 028 — 2026-08-14 — Founder feature: the To-Do page (ADR-041)
- Done: /b-systems/todo (all four roles) and /byteforce/todo (staff),
  nav item "To-Do" in both apps, rendering a plain two-section list —
  Overdue (danger accent, only when nonempty) and Today — of everything
  dated in the system: live follow-ups and arranged meetings (scoped:
  admin all / sales internal bucket / agent+partner own leads /
  ByteForce staff all byteforce), plus admin-only rows for partnership
  prospects, pending statements (expectedDate), and open milestones
  (expectedEnd). Cairo calendar-day windowing (DST-safe), "no fancy
  stuff": time + kind chip + linked name per row, "Nothing due today."
  empty state. All new strings Msg {en, ar}
  (src/lib/i18n/dict/todo.ts); existing EN byte-identical. New service
  src/lib/services/todo.ts (read-only projection, ADR-041). Tests: +4
  vitest (98/98), +1 e2e spec (19 passed / 2 skipped), tsc clean
  (TESTING Run 031).
- In progress: unchanged from Entry 027.
- Next steps: founder batch queued — leads-page filters/ordering,
  ByteForce board full parity (drag + forms + flags), lead archiving.
- Blockers: none new.
- Needs founder confirmation: proposals carry no due date of their own
  — they surface via the follow-up every sent proposal auto-creates
  (T-5); say the word if dated proposal rows are wanted (schema
  addition). Carried: see Entries 023–025.

## Entry 029 — 2026-08-14 — Founder: leads-list filters (stage/type/owner) + ordering
- Done: /b-systems/leads gained a plain GET-form filter row — Stage,
  Type, and Owner-bucket selects (each with "Any") plus a Sort select:
  "Newest added" (createdAt desc), "Recently updated" (updatedAt desc —
  the founder's "last edited"), and "Pipeline priority"
  (closer-to-the-finish first via the stagePriority rank map in NEW
  src/lib/services/lead-sort.ts; won/lost close the list; ties break by
  recency). Owner keeps the existing owner-bucket keys (the chip nav
  became the owner select — no EN string changed, the chips' labels ARE
  the select options). Server component + searchParams only, no client
  state. New strings as Msg {en, ar} (leadsFilters group). ByteForce's
  /byteforce/leads is a rep-cards GRID, not a lead list — filters do
  not map onto it; DEFERRED unless the founder wants a flat ByteForce
  list too. Verified: tsc clean, vitest 100/100 (+2 unit), Playwright
  19 passed / 2 skipped (TESTING Run 032).
- In progress: founder batch continues — ByteForce board parity, lead
  archiving (extends this filter row with an Archived choice).
- Next steps / Blockers: unchanged otherwise.
- Needs founder confirmation: whether /byteforce/leads should also get
  a flat filterable list view (its current §6.1 shape is rep cards).
  Carried: see Entries 023–028.

## Entry 030 — 2026-08-14 — Founder: ByteForce board full parity with the B-Systems board (ADR-042)
- Done: dragEnabled flipped on the internal pipeline config (founder
  override of A-7; the transition test's drag-rejection case rewritten
  accordingly). NEW InternalBoard client component ports the whole
  BsBoard experience to /byteforce/crm: drag & drop where the drop
  opens the stage's INTERNAL form in the modal (field groups now
  exported from LeadEventPanel — one source), whole-card click with the
  post-drag click guard, drag layering, count pills, and the
  didn't-answer toggle + chip (NEW POST
  /api/byteforce/leads/[id]/no-answer, requireBrandStaff guard). The
  ByteForce lead detail header shows the "No answer" chip. All modal
  copy reuses existing Msgs — zero new strings, EN byte-identical.
  Verified: tsc clean, vitest 100/100, Playwright 20 passed / 2
  audit-opt-in skipped incl. the new byteforce-board spec (TESTING Run
  033).
- In progress: founder batch continues — lead archiving next.
- Next steps / Blockers: unchanged otherwise.
- Needs founder confirmation: none new. Carried: see Entries 023–029.

## Entry 031 — 2026-08-14 — Founder: lead archive (ADR-043)
- Done: Lead.archived + archivedAt (+migration), setArchived service
  (activity-logged archived/unarchived), archive routes for both brands
  (B-Systems behind requireLeadAccess, ByteForce behind
  requireBrandStaff), and the exclusion sweep: both boards, Leads
  default lists, rep-card + unassigned counts, all lead-based dashboard
  numbers, admin-home external pipeline, and the To-Do projection.
  Archive UI: Archive (inline confirm) / Unarchive on both lead detail
  pages + "Archived" badge in the headers (.badge--archived, tokens);
  the B-Systems Leads filter row gained an Active/Archived view select
  (Archived IS the archive); ByteForce rep-leads tables got a matching
  Active/Archived toggle. Money-trail surfaces (clients, won leads,
  statements, payments) deliberately keep archived leads' records. New
  strings as Msg {en, ar} (archiveMsgs). Verified: tsc clean, vitest
  101/101, Playwright 21 passed / 2 audit-opt-in skipped (TESTING Run
  034).
- In progress: —
- Next steps: founder review of the whole batch (Entries 027–031).
- Blockers: none new.
- Needs founder confirmation: agents/partners can archive their OWN
  leads but have no archive list of their own — restoring needs the
  lead URL or the admin's Archived view; say the word if agents should
  get an Archived toggle on their board/list too. Carried: see Entries
  023–029.

## Entry 032 — 2026-08-14 — Batch hardening round: eight adversarial-review fixes
- Done: (1) ARCHIVE WRITE-GUARD (ADR-043 addendum): applyLeadEvent,
  markReadyToClose, setNoAnswer, and updateLead now reject on archived
  leads (ApiError 400 "Unarchive this lead first" — English pending the
  error-code scheme, Entry 022 item (i)); chat comments and
  archive/unarchive stay allowed; both lead detail pages hide the event
  panel/edit form when archived and show the archivedNote Msg {en, ar}.
  (2) TO-DO LATEST-RECORD: todoFor now picks the TRUE latest record per
  lead/prospect first (across follow-ups, meetings, AND proposals — the
  B-6 groupless proposal-sent return case) and only then checks it is
  the matching live kind; stale follow-ups and stale arranged meetings
  can no longer resurface. (3) ADR-043 CLARIFICATION: the To-Do's
  admin money rows (pending statements, open milestones) now exclude
  ARCHIVED leads' records — tasks leave with the lead; the
  Statements/Won Leads PAGES still show the records (money-trail rule
  unchanged). (4) DST: Egypt's spring-forward happens AT midnight, so
  the transition day's 00:00 does not exist — cairoDayWindow now clamps
  to the first existing instant (post-jump 01:00); pinned tests on
  2026-04-23/24 and the fall-back day. (5) The ByteForce Unassigned
  card now renders when unassigned leads exist active OR archived
  (countUnassignedArchived) — the archive stays reachable. (6) ADR-042
  ADDENDUM: internal drag back to intake logs T-0 (the internal generic
  move id, mirroring B-1/PP-3's fallback role) instead of "?".
  (7) Formless drag-to-New failures now surface through the board toast
  on BOTH boards (InternalBoard and BsBoard) instead of a hidden modal
  error state. Verified: tsc clean, vitest 106/106 (+5), Playwright 21
  passed / 2 audit-opt-in skipped (TESTING Run 035).
- Review claims REFUTED as documented tradeoffs (re-asserted so future
  reviews don't re-litigate): (a) the admin's Agents/Partners detail
  tables keeping archived rows is INTENTIONAL — they are management
  views, per ADR-043's consequences; (b) money-trail surfaces (clients,
  won leads, statements, payments) keeping archived leads' records is
  INTENTIONAL per ADR-043 (the To-Do task rows were the inconsistency,
  fixed in (3)); (c) the non-admin archived-view gap (agents/partners
  have no archive list of their own) was already flagged for founder
  confirmation in Entry 031 — not a defect, an open product question.
- In progress: —
- Next steps: founder review of the batch (Entries 027–032).
- Blockers: none new.
- Needs founder confirmation: carried — see Entries 023–031 (incl. the
  Entry 031 agent archive-list question).

## Entry 033 — 2026-08-14 — Founder: Leads filter sidebar + universal search (ADR-044)
- Done: FILTER SIDEBAR — the cramped top strip on /b-systems/leads is
  gone; every control (Search, Owner, Stage, Type, Sort, View) now sits
  in a labelled start-side card beside the table (grid, logical
  properties, tokens only, new .filter-* block in
  src/themes/design-system.css). Under 900px the same card collapses
  behind a "Filters" disclosure (LeadsFilterPanel client component)
  carrying a chip that counts the non-default filters, so the table
  keeps the full width at 390px; the desktop media query re-opens the
  body regardless of the toggle state. Still a plain GET form with the
  SAME param names (owner/stage/type/sort/view — old links keep
  working), plus a "Clear filters" reset link shown only when something
  is active. The sidebar costs the table ~230px, so the leads table got
  .table--wrap (prose cells wrap; chips and the date stay on one line)
  — all seven columns fit again at 1440.
  UNIVERSAL SEARCH — new `q` param → listBsLeads({ search }) →
  leadSearchWhere: server-side, case-insensitive contains over lead
  name OR companyName OR number, plus a digits-only number match when
  the query looks like a phone number, so "010 123" finds 0101234567.
  Never client-filtered. A dead query gets its own empty state ("No
  leads match these filters.") instead of the bucket message. All new
  strings are Msg {en, ar} (Search/بحث, "Name, company or number"/
  "الاسم أو الشركة أو الرقم", Filters/التصفية, Clear filters/مسح
  التصفية, View/العرض); every existing English string is byte-identical.
  BUG-006 / ADR-044 — verifying the search in Arabic exposed a real
  defect underneath the feature: the local Postgres clusters were
  initialised WIN1252 (Windows locale), so ARABIC TEXT COULD NOT BE
  STORED OR SEARCHED AT ALL (22P05 → 500 on the leads page). Fixed at
  the source: initdb now runs `-E UTF8 --locale=C` for every cluster,
  and a pre-existing non-UTF8 data dir triggers a named warning on
  start. Verified: tsc clean, vitest 112/112 (+6), Playwright 22 passed
  / 2 audit-opt-in skipped (TESTING Run 036); screenshots reviewed at
  1440/1024/768/390 and in Arabic RTL. brand-auditor run on the diff:
  tokens, brand scope, pink/gradient rules and bilingual strings clean;
  it caught one real RTL defect — the disclosure caret is drawn with
  logical borders, so under dir="rtl" the fixed 45° rotation pointed it
  sideways — fixed with mirrored [dir="rtl"] rotations and re-shot in
  Arabic at 390px (down when closed, up when open).
- In progress: —
- Next steps: founder review of the sidebar (density, which control
  order he wants) and of the batch (Entries 027–033).
- Blockers: none new.
- Needs founder confirmation: (i) NEW — the founder's existing local
  database (.pgdata/dev) is still a WIN1252 cluster: it must be deleted
  and recreated (or carried across with an ADR-032 backup
  export/import) before Arabic lead names can be typed on that machine;
  say the word and it can be done with the data preserved. Carried: see
  Entries 023–032 (incl. the Entry 031 agent archive-list question).

## Entry 034 — 2026-08-14 — Founder: "organic" lead type
- Done: LEAD_TYPES gains a fifth member, "organic" (label "Organic",
  Arabic "عميل وارد" — an inbound lead that arrived on its own; chosen
  over the literal "تلقائي"/automatic, which reads as machine-made).
  Appended at the END of the array so no existing dropdown reshuffles.
  Everything downstream is derived, so it appears with no further
  edits: both brands' add/edit lead forms, the partner add-lead form,
  the Leads filter sidebar's Type select, the lead detail, the leads
  tables and board cards — every one maps over LEAD_TYPES and renders
  through leadTypeLabel(). Lead.type is a stored STRING (no DB enum),
  so there is NO migration; the only validation boundary is
  z.enum(LEAD_TYPES) in services/leads.ts, which now accepts it (and
  still refuses anything else). Swept for hardcoded type unions
  (grep campaign_lead / personal_connection): none outside the
  constants, the i18n dict, tests, and the seed. Verified: tsc clean,
  vitest 114/114 (+2), Playwright 22 passed / 2 audit-opt-in skipped
  (TESTING Run 037).
- In progress: CRM-board filters + search (founder request 2), undo
  (founder request 3).
- Next steps: as above.
- Blockers: none new.
- Needs founder confirmation: (i) the Arabic wording for Organic —
  "عميل وارد" (inbound) vs a literal "أورجانيك"; say the word and it
  changes in one line. Carried: see Entries 023–033 (incl. the WIN1252
  local-database recreation in Entry 033).

## Entry 035 — 2026-08-14 — Founder: search + filters on the CRM boards
- Done: the Leads sidebar's filter card now serves the BOARDS too.
  LeadsFilterPanel became the shared components/shared/FilterPanel with
  a `variant` prop: "side" (the Leads list — disclosure under 900px,
  pinned-open sidebar column above it) and "inline" (the boards — a
  disclosure at EVERY width, sitting above the board). Inline is
  deliberate: .board is a full-bleed breakout whose margin-inline math
  (50% − 50vw) is measured against its container, so a fixed side
  column would simply be painted over by the board; and the founder's
  earlier directive was that the board fills the whole page. The card
  keeps the same look, with .filter-card--inline flowing its labelled
  sections into a responsive control grid instead of a tall stack.
  Both panels now open BY THEMSELVES when a filter is active, so the
  applied state is never hidden behind a click.
  B-Systems board (/b-systems/crm): Search + Type for every role, Owner
  for the admin. No Stage (the columns ARE the stages), no Sort (a
  board is not a list), no Active/Archived (ADR-043 — archived leaves
  the board by definition). The admin's five owner-bucket nav links
  moved INTO the card as the Owner select: one place to filter instead
  of two competing controls — flagged below since it costs a one-click
  bucket switch.
  ByteForce board (/byteforce/crm): the same panel with Search + Type
  (ByteForce has no owner buckets; reps have their own pages) —
  CrmBoardBody now takes searchParams.
  Plumbing: leadSearchWhere moved out of bsystems-admin into the shared
  services/lead-search.ts and gained leadTypeWhere; listBsLeads takes
  `type`, listOwnLeads takes `search`+`type`, and the Leads list now
  narrows by type in SQL too (only its stage filter stays in JS). A
  filtered board with nothing left shows "No cards match these
  filters." instead of a wall of empty columns. Verified: tsc clean,
  vitest 116/116 (+2), Playwright 23 passed / 2 audit-opt-in skipped
  (TESTING Run 038); screenshots reviewed at 1440 and 390.
- In progress: undo (founder request 3).
- Next steps: as above.
- Blockers: none new.
- Needs founder confirmation: (i) the CRM board's quick owner tabs
  (Internal / Agents / Partners / Admins) are now the Owner select
  inside the Filters card — switching bucket costs a click more than
  before; say the word and the tabs come back beside the panel.
  Carried: see Entries 023–034.

## Entry 036 — 2026-08-14 — Founder: Undo the last action (ADR-045)
- Done: a real undo, designed conservatively (ADR-045). New UndoEntry
  table (migration 20260814131216_undo_entry): every undoable mutation
  writes ONE row inside its own transaction holding the INVERSE — the
  prior state plus the ids that write created — never a replay log.
  Allowlist: lead stage event (stage + auto-cleared no-answer flag back,
  the group record it created deleted, anything it mutated in place
  restored — proposal sent/sentAt, meeting outcome, meeting reschedule),
  no-answer, ready-to-close, archive/unarchive, lead edit (only the
  edited fields), lead create (deletes the lead), partner-prospect stage
  event (incl. the PP-1 dialed-numbers list). Guards: only the author
  may undo; only their latest unconsumed entry; only within 10 minutes;
  refused with "This changed since — undo is no longer safe" when the
  entity's fingerprinted updatedAt moved; claimed atomically so a
  double-click cannot apply twice; and every application writes an
  activity row (trigger "undo"). NOT undoable, by design: deletions
  (the data is gone) and anything financial — a Won transition, a
  partner conversion, a milestone check/uncheck, a statement created or
  paid. Those RETIRE the user's pending entries, so the button never
  offers to revert something older than the last thing that happened;
  and undo is one step, not a stack (applying it retires the rest).
  UI: a snackbar-style pill at the bottom start of every page in both
  apps, labelled with what it will revert ("Undo · Moved Acme Corp to
  Following Up"), EN/AR from a label snapshot stored at write time. It
  is NOT in the header: a chip there pushed nav links into the hidden
  overflow at 1440px (screenshots showed Agents/Registrations
  disappearing) — noted below in case the founder wants it up there
  anyway. One click, no confirmation, result via the shared toast.
  Verified: tsc clean, vitest 126/126 (+10, new undo.integration.test),
  Playwright 24 passed / 2 audit-opt-in skipped (TESTING Run 039);
  screenshots reviewed on both brands, in Arabic RTL, and at 390px.
  brand-auditor on the diff: tokens, scope, both brands' rules, the
  no-emoji rule and the bilingual Msg layer all clean; it caught one
  real RTL defect — the pill's asymmetric padding was a physical
  4-value shorthand, so the tight icon-side padding landed on the text
  in Arabic (now padding-block/padding-inline) — plus an invisible
  hover (a brightness filter on a near-black token, now a token
  color-mix) and one dead dict entry, both fixed. It also re-flagged
  the KNOWN gap that server-side ApiError strings are English-only
  (Entry 022 item (i)): the undo refusals ("This changed since — undo
  is no longer safe") inherit it, and translating them still waits on
  the error-code scheme.
- In progress: —
- Next steps: founder review of requests 1–3 (Entries 034–036).
- Blockers: none new.
- Needs founder confirmation: (i) undo is deliberately ONE step and
  10 minutes — say the word for a longer window or a multi-step stack;
  (ii) it deliberately refuses anything financial (wins, milestones,
  statements) and deletions — those need a correction flow, not an
  undo; (iii) the pill floats at the bottom start rather than sitting
  in the header (the header is full) — it can move up if the founder
  prefers, at the cost of nav links at 1440px. Carried: see Entries
  023–035 (incl. the WIN1252 local-database recreation, the board's
  owner tabs, and the Arabic wording for Organic).

## Entry 037 — 2026-08-17 — Founder: same-stage records (ADR-046)
- Done: three founder asks, one mechanism. SAME_STAGE_ACTIONS —
  follow_up_again, negotiation_follow_up, reschedule_meeting — are
  ordinary engine next actions whose transition resolves to the stage
  the card is ALREADY in, so persistGroup, the Zod completeness gates,
  the activity log, ADR-045's undo and ADR-041's To-Do all serve them
  with no new plumbing. Availability lives in the CONFIGS, not the UI:
  follow-up-again and reschedule on internal + bsystems + partners
  (all three own Following Up and Meeting Setting), the negotiation
  response date on bsystems only. Groups: another follow-up reuses the
  follow-up group; the negotiation one uses a NEW context
  "after_negotiation" ("Response due after negotiation") so the record
  reads as the promised response date; the reschedule writes a NEW
  meeting record (deliberately NOT T-7's in-place meeting_reschedule) —
  that is what makes the boards and the To-Do, both latest-record
  readers, swap to the new slot and stop counting the old one. Triggers
  are FU-AGAIN / NEG-DUE / MTG-RESCHEDULE, named like the other
  non-§10 rows (B-RTC, no_answer, archived); the log line reads
  "group added" with no from → to, because nothing moved, while every
  pre-existing same-stage case (T-7, re-selecting the current stage)
  keeps its wording byte-for-byte. Undo says "Recorded another
  follow-up on X" instead of "Moved X to …". To-Do gained the
  NEGOTIATION stage, and negotiation notes joined the latest-record
  race so a follow-up left behind by Following Up cannot resurface
  there. All three action panels (B-Systems, ByteForce, Partnership)
  filter the same-stage actions out of the "Next action" select and
  render them as BUTTONS above it, reusing that stage's own role-aware
  form; agents keep their V2 §3 day-only follow-up form; a reschedule
  always records an ARRANGED meeting (the "did you agree?" question is
  suppressed). The B-Systems board's negotiation card now shows
  "Response: <date>" while that follow-up is the newest record.
  Verified: tsc clean, vitest 138/138 (+12), Playwright 25 passed / 2
  audit-opt-in skipped (TESTING Run 040).
- In progress: founder requests 2–4 of this round (assign a lead to an
  agent/partner; the dial + call sheet; permanently delete a user).
- Next steps: as above.
- Blockers: none new.
- Needs founder confirmation: (i) "Log another follow-up" stores the
  record with the ordinary "Following up" title (the timestamps already
  separate a repeat from the first) — say the word and repeats get
  their own label; (ii) the reschedule button always records an
  ARRANGED meeting; if agents should be able to propose a slot instead,
  the "did you agree on a time?" question comes back. Carried: see
  Entries 023–036 (incl. the WIN1252 local-database recreation, the
  board's owner tabs, the Arabic wording for Organic, and undo's
  one-step/10-minute/no-financials rules).

## Entry 038 — 2026-08-17 — Founder: assign a lead to an agent or partner (ADR-047)
- Done: an admin-only "Assign owner" control on the B-Systems lead
  detail. It picks from active + approved bsystems_agent /
  bsystems_partner / bsystems_sales accounts and writes
  Lead.ownerUserId, deriving Lead.ownerType from the target's role — the
  two columns every "whose lead is this" surface already reads, so the
  lead appears on that person's board (listOwnLeads scopes by
  ownerUserId), in their To-Do, and counts as theirs on the
  owner-bucket, won-lead and commission surfaces with no per-surface
  change. The wall is requireBsAdmin, deliberately NOT requireLeadAccess:
  handing work to someone else is a management act, so an agent can
  neither push their own lead onto a colleague nor pull one to
  themselves (proved by a new rbac e2e line). Lead.partnerId is NOT
  touched and the code says why — it is the PP-5 referral ATTRIBUTION,
  permanent per SPEC §5.5, a different fact from ownership; the detail
  now shows both ("Agents · Karim" beside "Partner: Referrer LLC"). The
  new owner is notified inside the same transaction (Notification type
  "assigned", addressed to them, deep-linked via leadId — their bell
  already polls it), the assignment is activity-logged ("assigned"), and
  it is UNDOABLE via a new ADR-045 kind "lead_assign" whose inverse is
  exactly the two ownership columns. Archived leads are refused by the
  existing assertNotArchived guard. Verified: tsc clean, vitest 146/146
  (+8), Playwright 25 passed / 2 audit-opt-in skipped (TESTING Run 041).
- In progress: founder requests 3–4 of this round (the dial + call
  sheet; permanently delete a user).
- Next steps: as above.
- Blockers: none new.
- Needs founder confirmation: (i) only the ADMIN can reassign — if a
  team lead or the lead's current owner should be able to hand it on,
  say so and the guard widens; (ii) admins are not offered as assignees
  (the admin bucket is where an unassigned lead sits) — say the word to
  make "assign to me" possible. Carried: see Entries 023–037 (incl. the
  WIN1252 local-database recreation, the board's owner tabs, the Arabic
  wording for Organic, undo's one-step/10-minute/no-financials rules,
  and the same-stage record labels).

## Entry 039 — 2026-08-17 — Founder: dial the lead + the call sheet (ADR-048)
- Done: a real route per brand — /b-systems/crm/lead/[leadId]/call and
  /byteforce/leads/lead/[leadId]/call — both rendering the shared server
  component components/shared/CallSheet.tsx behind requireLeadAccess (an
  agent opening a colleague's call-sheet URL gets the not-found page,
  proved by e2e). PHONE-FIRST: a STICKY identity block (name, company,
  stage + flags, a 54px "Call now" button, the back-link) stays a thumb
  away however far you scroll; below it, in the order you need mid-call
  — other contacts (the email as a mailto:), the essentials grid
  (owner · type · industry · position · company · created · requirements
  · notes), the LATEST update, the chat, the negotiation notes, every
  stage record, and the full history. Everything under the sticky block
  REUSES the lead detail's own renderers (GroupHistory, LeadChat,
  HistoryPanel, StageBadge, .fields-grid) so the two pages cannot drift;
  "Latest update" is HistoryPanel over history.slice(0,1) rather than a
  second implementation of "what happened". The dialer is opened by a
  plain <a href="tel:…">, never a script — which is exactly why coming
  back from the call leaves the sheet on screen, as the founder
  described. lib/phone-dial.ts sanitises the href (leading + or 00→+,
  digits only) while the number is DISPLAYED as typed; it is
  deliberately separate from auth/phone.ts's normalizePhone, which
  produces login identifiers for stored accounts. Entry points: a Call
  button in both brands' lead-detail headers and a Call chip on every
  board card, stopping propagation on BOTH click and pointerdown so it
  neither drags the card nor triggers the whole-card navigation. New CSS
  is tokens + logical properties only, and the spec sweeps the page for
  horizontal overflow at 1440/1024/768/560/390 itself (qa-sweep's path
  list is id-free, so the check lives with the spec that owns a lead
  id). brand-auditor on the diff returned FAIL and every finding was
  fixed before the commit: the blocker was the board card's dial chip
  filled with --color-accent — the WON cue in BOTH brands (Signal Pink /
  ByteForce orange is literally --color-stage-won-accent) — which would
  have repainted every card in every column with it, at a size where
  white-on-accent measures 3.13:1 / 3.34:1 against AA's 4.5:1; it is now
  an outlined link-ink mono chip that reads as an action. It also caught
  a real RTL defect (the phone number had no bidi isolation, so "+20 100
  …" reorders in Arabic — now direction: ltr + unicode-bidi: isolate),
  a gratuitous opacity cut on the number, a hand-rolled .replace where
  formatMsg belongs, eleven dict strings duplicated from dict/crm's
  leadDetail (deleted — the call sheet reads the lead detail's own
  labels so they cannot drift), and three cleanups. Verified: tsc clean,
  vitest 150/150 (+4), Playwright 27 passed / 2 audit-opt-in skipped
  (TESTING Run 042).
- In progress: founder request 4 of this round (permanently delete a
  user).
- Next steps: as above.
- Blockers: none new.
- Needs founder confirmation: (i) a Lead carries exactly ONE number in
  the schema (alternative numbers exist only on partnership prospects),
  so the call sheet's "other contacts" is the email; several numbers per
  lead would be a small schema addition — say the word; (ii) the chat on
  the call sheet is the FULL chat with its composer, so a note taken
  during the call can be typed there and then — say so if it should be
  read-only. Carried: see Entries 023–038 (incl. the WIN1252 local-
  database recreation, the board's owner tabs, the Arabic wording for
  Organic, undo's one-step/10-minute/no-financials rules, the same-stage
  record labels, and admin-only reassignment).

## Entry 040 — 2026-08-17 — Founder: permanently delete a user (ADR-049)
- Done: a real hard delete in Users, beside — and deliberately unlike —
  the reversible Remove. The schema was AUDITED FIRST: every reference
  to User enumerated with its actual ON DELETE clause, then each one
  given an explicit fate in one transaction rather than left to the FK.
  KEPT: the person's leads (ownerUserId null + ownerType "admin", i.e.
  the admin bucket, one activity row each — the pipeline is the
  company's, and the new "Assign owner" control from Entry 038 is how it
  is redistributed); their lead comments (unlinked, authorLabel carries
  the name); every statement (closerUserId nulled, closerLabel intact —
  the money trail keeps the name); and the ActivityLog untouched, because
  actorLabel is denormalised history and deleting the actor must not
  rewrite what happened. DESTROYED: the login, its roles, the agent
  PortalRep profile AND its CV attachment row + the stored file, the
  notifications, and their pending UndoEntry rows. A partner company
  survives its login (Partner.userId nulled). Guards: never yourself,
  never the pinned bootstrap admin (bootstrap.ts recreates it anyway),
  404 on an unknown id — and the user.delete is the LAST statement in
  the transaction on purpose, so any reference the policy failed to
  release raises an FK error that aborts everything and refuses cleanly
  instead of half-deleting. NOT undoable (it retires the acting admin's
  pending entries) and activity-logged ("user_deleted"). UI: a two-step
  confirm that names the person, lists what is kept and what is
  destroyed, says it cannot be undone, and points at Remove for anyone
  who only wants to block access; hidden for yourself and the bootstrap
  admin, with the server enforcing both. Two schema surprises found
  during the audit are written up in IMPLEMENTATION.md: the CV
  attachment would have been orphaned (row AND file) because
  Attachment.portalRepId is SET NULL while PortalRep cascades, and
  Statement.closerUserId / UndoEntry.userId have NO foreign key at all
  (plain String columns), so nothing in the database would have stopped
  them pointing at a deleted account. Verified: tsc clean, vitest
  155/155 (+5), Playwright 27 passed / 2 audit-opt-in skipped (TESTING
  Run 043).
- In progress: —
- Next steps: founder review of this round's four commits (Entries
  037–040).
- Blockers: none new.
- Needs founder confirmation: (i) a deleted person's leads land in the
  ADMIN bucket rather than being handed to a named colleague — the
  admin redistributes them with "Assign owner"; say the word if a
  deletion should ask "give them to whom?" instead; (ii) statements keep
  paying out under a name with no account, which is deliberate (the
  obligation outlives the login). Carried: see Entries 023–039 (incl.
  the WIN1252 local-database recreation, the board's owner tabs, the
  Arabic wording for Organic, undo's one-step/10-minute/no-financials
  rules, the same-stage record labels, admin-only reassignment, and the
  call sheet's single-number/full-chat choices).

## Entry 041 — 2026-08-17 — Founder: Partners & Agents — agents live on the partnership board (ADR-050)
- Done: the section is now "Partners & Agents" and carries BOTH kinds of
  card, with the pipeline itself untouched. A prospect has a `kind`
  ("partner" | "agent", default partner — every existing row keeps its
  meaning and its data; companyName/businessActivity merely became
  nullable and `address`/`speciality`/`agentUserId` were added). The one
  Add button asks WHICH first and swaps the field set beneath it. The
  agent field set is the PUBLIC SIGNUP FORM's, field for field — first
  name, last name, phone, email, address, speciality, CV — reusing
  dict/auth's own Msgs so the CRM form and the public form cannot drift;
  the password is deliberately absent, because the founder is explicit
  that the ADMIN creates the credentials at Won. Requiredness is
  KIND-CONDITIONAL in Zod (one `kindIssues()` helper shared by create
  and edit), never in the database, and the kind is IMMUTABLE after
  creation — `updateProspectSchema` has no `kind` field and the service
  re-validates against the STORED kind and writes only that kind's
  columns. The engine is PARAMETERIZED, not forked: `partnersConfigFor
  (kind)` returns the same partners config with the Won gate swapped, so
  drag, next actions, same-stage records, PP-1's dialed-number picker
  and PP-2's auto-return work on an agent card because it is literally
  the same code path (the new e2e proves it by running an agent through
  didn't-answer → new number → follow-up → Won). PP-4a is the divergence:
  the agent gate mints the whole account in ONE transaction — User
  (email + normalized phone, hashed password AND the passwordPlain
  admin-visibility copy, active, `registrationStatus: "approved"` so
  they never sit in Registrations), the bsystems_agent role and the
  PortalRep profile — the same three writes signupRep makes, minus the
  waiting; duplicate email or phone is refused with the signup path's
  own message and nothing is written. The CV survives the journey: the
  card owns it as an Attachment of kind "cv" (every prospect query
  filters the attachment relation by kind, so it never reaches the
  cold-call player), optional at creation and addable later from the
  card, and at the gate it is RE-PARENTED onto the new PortalRep —
  moved, not copied, so nothing is duplicated or orphaned and the
  agent's profile shows exactly what a self-applied agent's would.
  Verified end to end that a converted agent appears in the Agents
  section and NEVER in the Partners directory, that a converted partner
  behaves exactly as before, and that a public signup still creates only
  a pending user and no card. The rename ("Partnership CRM" → "Partners
  & Agents" / "الشركاء والوكلاء") reaches the nav, eyebrow, h1, page
  titles, the edit modal, the add/save buttons and the two To-Do row
  labels; it is the one sanctioned exception to ADR-037's
  byte-identical-EN rule and every affected e2e assertion moved with it.
  The ROUTE /b-systems/partners-pipeline is unchanged on purpose — no
  dead links, no redirects to maintain.
  brand-auditor on the diff returned FAIL and every finding was fixed
  before the commit: the CV dropzone was marked `required` while its own
  copy said "optional" (which fires the design system's accent required-
  star on a contradiction), and TWO Latin runs sat unisolated inside RTL
  prose — the agent card's phone-number subtitle and the converted-agent
  line's email — the same defect ADR-048 found on the call sheet, now
  generalised into a `.u-ltr` utility that also fixed the pre-existing
  "·"-joined number lists. It also caught the kind chip using a table
  chip at board-card size (now the board's own `.bcard-chips` +
  `.bcard-tag`), the edit modal nesting a chip larger than its own
  caption (now `badge badge--entity`, the badge Registrations and Users
  already use for exactly this), and three byte-identical label clones
  this work had put side by side in one file (`pCommon.address` /
  `pCommon.email` / `pPanel.password`, deleted in favour of dict/auth).
  The nav item now REFERENCES the page title rather than restating it.
  Verified: tsc clean, vitest 164/164 (+9), Playwright 28 passed / 2
  audit-opt-in skipped (+1 new spec, TESTING Run 044).
- In progress: the data-entry role (a least-privilege user who may only
  ADD leads and cards, owning nothing).
- Next steps: as above.
- Blockers: none new.
- Needs founder confirmation: (i) PARTNER cards still require company
  name and business activity while AGENT cards require only name and
  number — that asymmetry is exactly as directed ("the partners as it
  is"), but say the word and partner cards loosen the same way; (ii) the
  partners board has no filter
  sidebar today, so there is NO Kind filter — the chip on every card
  carries the distinction; say the word and it gets the CRM board's
  filter panel (search + kind); (iii) an agent card stores ONE `name`,
  and the Won gate prefills first/last by splitting on the first space
  for the admin to confirm — say so if the card itself should collect
  the two names separately; (iv) the CV is OPTIONAL when the admin
  creates the card (they may be adding someone they met before any CV
  exists) and can be attached later — at signup it stays required; (v)
  a converted agent's account survives deleting their card, mirroring
  the partner rule, and a hard-deleted account leaves the card converted
  with no login. Carried: see Entries 023–040 (incl. the WIN1252 local-
  database recreation, the board's owner tabs, the Arabic wording for
  Organic, undo's one-step/10-minute/no-financials rules, the same-stage
  record labels, admin-only reassignment, the call sheet's single-
  number/full-chat choices, and deletion's admin-bucket landing).

## Entry 042 — 2026-08-17 — Founder: the data-entry role (ADR-051)
- Done: `bsystems_data_entry`, a genuine least-privilege account —
  "just able to add leads or partners or agents... they will not be the
  owner of what they add." Its whole permission set is TWO create
  actions (a B-Systems lead, and a Partners & Agents card of either
  kind, plus that card's CV because the CV is part of adding an agent).
  The wall is built by CONSTRUCTION, not by enumeration: every other
  B-Systems endpoint already names the roles it accepts and none of them
  names this one, so an endpoint written tomorrow refuses it by default;
  only two guards mention the role at all, and both are named for the
  ACT (`requireProspectCreator`) rather than the person. OWNERSHIP uses
  the state that already meant this rather than a new one: `bucketFor`
  returns internal-and-unowned and the route strips any rep, so an
  entered lead lands exactly in A-6's unassigned state (internal bucket,
  no rep, no owner) and the admin hands it on with ADR-047's "Assign
  owner" — a data-entry account is never itself assignable. Because a
  lead nobody owns is invisible on a board organised by owner buckets,
  the Leads sidebar and the CRM board both gained an "Unassigned" owner
  choice (special-cased in listBsLeads, since it is the ABSENCE of an
  owner inside a bucket, not a bucket), and every entered lead
  broadcasts a `needs_owner` notification to the admins, deep-linked
  through the existing Notification.leadId exactly like ready-to-close.
  New `createdByUserId` on Lead and PartnerProspect records who TYPED a
  record in — stamped on EVERY create path, because it is useful audit
  data whoever entered it and it makes the data-entry view a query
  rather than a special case; both are declared as real relations with
  ON DELETE SET NULL, per IMPLEMENTATION.md's ADR-049 lesson that a
  userId column without a relation is invisible to cascade planning.
  Their own page /b-systems/entry is the two Add buttons and a read-only
  record of what they entered, each row labelled from their point of
  view ("Waiting for an owner" / "Picked up"); their nav has exactly one
  item, which is the honest picture of the permission set. They may
  CORRECT an entry they made while it is structurally untouched (a lead
  still in New with no owner, no rep, not archived; a card still in Lead
  and not converted) — never by a clock, and re-checked server-side on
  every PATCH. One general fix fell out of the role: `requirePageRole`
  used to send every failure to /login, which for an account with one
  page made every other URL look like an expired session; a SIGNED-IN
  user now lands on their own home instead, and /login is kept for
  genuinely unauthenticated requests. Seeded as
  entry@b-systems.example / entry123 (demo environments only), and the
  page joins the qa-sweep so it is checked for console errors and
  horizontal overflow at every width like every other screen.
  brand-auditor on the diff returned FAIL and every finding was fixed
  before the commit — the sharpest being a permission that existed on
  the server and nowhere in the UI: the correction right covers CARDS
  too and the component already carried the branch, but the cards table
  never rendered the button. It does now (minus the company field on an
  agent card, which has none). It also caught a card wrapping a form
  that renders its own card, three column labels re-declared instead of
  reusing dict/crm's `common` — in the very modal that edits those
  cells — an Arabic drift between the nav item and the page heading (the
  nav now REFERENCES the page title, as ADR-050 did), an unused string,
  a one-word CTA, and phone/email INPUTS lacking the `dir="ltr"` their
  read-only cells already had.
  Verified: tsc clean, vitest 174/174 (+10), Playwright 30 passed / 2
  audit-opt-in skipped (+2 new specs, TESTING Run 045).
- In progress: —
- Next steps: founder review of this round's two commits (Entries
  041–042).
- Blockers: none new.
- Needs founder confirmation: (i) SCOPE — the role is B-SYSTEMS ONLY,
  because the request named "the CRM of the partners or the CRM of the
  leads", both of which are B-Systems; whether a data-entry user should
  also add BYTEFORCE leads is an open question and today the ByteForce
  API refuses them; (ii) the CORRECTION WINDOW — they may fix an entry
  they made until someone picks it up (still in intake, still unowned);
  say the word and it becomes strictly add-only, or gains a longer
  window; (iii) they may also UNDO their own just-added lead through the
  existing one-step undo, which deletes it only while it has no history
  — deliberately not the same thing as the DELETE they are refused; (iv)
  an entered lead notifies EVERY admin — say so if it should go to one
  named person instead. Carried: see Entries 023–041 (incl. the WIN1252
  local-database recreation, the board's owner tabs, the Arabic wording
  for Organic, undo's one-step/10-minute/no-financials rules, the
  same-stage record labels, admin-only reassignment, the call sheet's
  single-number/full-chat choices, deletion's admin-bucket landing, and
  the deliberate partner/agent asymmetry in card-creation strictness).

## Entry 043 — 2026-08-17 — Accounting module Phase 1: schema, piaster engine, import service (ADR-052)
- Done: the accounting rebuild-on-top began exactly where the approved
  plan pointed (INTEGRATION-PLAN Phases 1–2, founder decisions §7).
  One migration adds the eleven `Acct*` models — income, expenses,
  roster members + effective-dated salary segments, payroll approval
  marks, treasury moves, loans + payments, media ledger, targets,
  per-company settings — every row tagged company
  ("byteforce"|"bsystems", the Brand union: a filter, not a tenant),
  all registered in backup MODELS and resetDb() in the same commit.
  src/lib/accounting/ holds the pure engine (the SPA's functions
  re-implemented line-for-line at Int piaster scale, "now" always a
  parameter), the DB→engine books bridge, and the importer for the old
  app's own JSON export (single company or the "Export ALL" wrapper)
  behind admin-only POST /api/b-systems/accounting/import. Payroll is
  DERIVED at read time — the importer writes roster segments and
  approval marks, never salary rows, so it cannot under-count. Import
  replaces one company's books in one transaction, logs
  acct_books/import, consumes pending undo entries (money is never
  undoable, ADR-045) and returns the engine's reconciliation numbers
  for the founder's side-by-side check. 42 new tests encode the
  business rules (cash basis, approval-gates-cash, auto-payroll incl.
  the linked-row replacement, media pass-through, the 50-piaster loan
  epsilon, treasury carry-forward, client A/R, P&L, departments) and
  prove the import reproduces the old dashboard to the piaster.
  Verified: tsc clean, vitest 216/216 (+42), Playwright untouched 30
  passed / 2 audit skips (TESTING Run 046).
- In progress: Phase 2 — the eleven screens + import UI under
  /b-systems/accounting (next commit).
- Next steps: Phase 2 UI; then Phase 3 cutover is founder-run (export
  from the old app on freeze day, upload here, reconcile totals).
- Blockers: none. NOTE (per founder override this session): commits stay
  LOCAL — no push until the founder tests locally.
- Needs founder confirmation: (i) date/month columns are calendar
  STRINGS mirroring the SPA (ADR-052 §1) — instants would day-shift;
  flag if a DateTime audit trail per money row is wanted beyond
  createdAt/updatedAt. (ii) The SPA reads expense `deduction`/`bonus`
  fields its own form can no longer write — they are imported and
  honoured (payroll net = amount − deduction + bonus) but Phase 2's
  expense form, mirroring the SPA's, does not offer them; say the word
  if the fields should be editable. (iii) Orphan payrollPaid keys and
  dangling rosterId links in the export are dropped/nulled on import —
  arithmetically neutral, noted for transparency. (iv) tsconfig now
  excludes the two gitignored reference archives from typechecking
  (~484 alien errors from their own stacks); they remain untouched on
  disk. Carried: see Entries 023–042.

## Entry 044 — 2026-08-18 — Accounting module Phase 2: the eleven screens + import UI (ADR-052)
- Done: the accounting UI, composed ONLY from existing design-system
  classes and B-Systems tokens (founder decision 8 — the CRM's current
  design is the model). Twelve screens under /b-systems/accounting —
  dashboard (stat tiles, treasury hero, target meter), income (cash-basis
  rows with collect toggle), expenses (approval workflow with Paid /
  On-hold chips, derived payroll section with "from roster" badges and
  the linked-manual-row option), clients (derived A/R ledger + per-client
  statement with running balance; free-text names until Phase 7), payroll
  roster (effective-dated add/edit/toggle), media buying (received/sent
  with live fee split — HIDDEN entirely under company=bsystems: no tab,
  URL bounces), loans (+payments with optional treasury cash moves),
  treasury (month waterfall, system opening balance, movements),
  monthly P&L (by-type cards + 6-month trend meters), departments
  (profitability + overhead, month/all-time), targets, and the IMPORT
  screen (file upload → per-company row counts + piaster-exact derived
  totals for manual reconciliation against the old app). One new nav item
  "Accounting"/"الحسابات" in the bsystems_admin array only. Company is a
  FILTER (switcher + month picker write URL params; every view is
  linkable). 15 new admin-only API routes (21 endpoints incl. Phase 1's
  import) all through requireBsAdmin + a service layer that writes
  ActivityLog inside each transaction and calls invalidateUndo on every
  financial mutation (money is never undoable, ADR-045). New dict module
  src/lib/i18n/dict/accounting.ts (~300 Msg entries) with Arabic seeded
  from the SPA's own AR dictionary. brand-auditor on the new UI returned
  FAIL (narrow) and every finding was fixed before commit — the sharpest:
  the generic positive chip wore the WON/Signal-Pink tint on the majority
  states of the books (Collected/Paid/Active/Settled), diluting the Won
  cue exactly as the ADR-046 precedent warns; it is indigo now, and the
  accent KPI tone was removed from the tile API so it cannot return.
  Verified: tsc clean, vitest 216/216, Playwright 35 passed / 2 audit
  skips (+5 tests: the booking journey, the media-hiding proof, the
  import round-trip, the 63-refusal 403 matrix, the 13-path accounting
  qa-sweep at five widths) — TESTING Run 047.
- In progress: — (Phases 1–2 complete; both commits LOCAL ONLY per the
  founder's no-push override — production auto-deploys from main).
- Next steps: founder tests locally (npm run db:up + npm run dev →
  /b-systems/accounting as admin@byteforce.com; Import screen accepts the
  old app's JSON export). Then Phase 3 cutover: freeze day, final export,
  import, reconcile side-by-side, retire the Worker. Phase 7 later links
  client names to CRM Client records.
- Blockers: none. Commits are NOT pushed — awaiting founder's local test.
- Needs founder confirmation: (i) carried from Entry 043 — string
  calendar dates, imported deduction/bonus honoured but not editable,
  orphan-reference drops on import, tsconfig excludes the two reference
  archives; (ii) SCREEN CONSOLIDATION — none: all eleven SPA tabs map
  1:1 to screens (P&L kept as "Monthly P&L" at /report), Import is the
  twelfth; (iii) the SPA's "Reset everything" and Excel import/export
  menu items were deliberately NOT rebuilt (the CRM has full-system
  backup/restore; a one-click books wipe felt founder-hostile) — say the
  word if either is wanted; (iv) the loans screen keeps the SPA's
  delete-loan action (hard delete with cascade to its payments; treasury
  moves stay, as in the SPA) — confirm that is still the wanted shape.

## Entry 045 — 2026-08-18 — Data Vault Phase 4: schema, services, invariants (ADR-053)
- Done: the vault rebuild-on-top began per the approved plan
  (INTEGRATION-PLAN Phase 4, founder decisions §7.1–§7.4). One
  migration adds five `Vault*` models — employees as assignee CARDS
  (name/title/company/active; every auth column of the reference app
  deleted, not rebuilt), forms, sheets, documents, tasks — plus three
  vault FK columns on the shared Attachment model (files ride the
  storage abstraction + /api/files, founder §7.2: no S3 anywhere; a
  replaced file APPENDS a row, so predecessors stay servable). All
  registered in backup MODELS + resetDb() in the same commit — and the
  pre-existing undoEntry omission from backup MODELS (the silent
  failure INTEGRATION-PLAN §5.5 warns about) was fixed while there.
  src/lib/services/vault/* re-implements the reference rules natively:
  link-XOR-file (Zod union + 422 service assertion), the task RESULT
  GATE (422, nothing commits), lateness computed ONCE at completion
  then FROZEN (no recompute path exists; the pure math mirrors the
  reference lateness.ts over Cairo calendar dates), audited reopening
  (result survives, erased values logged), archive-not-delete on all
  four kinds with read-only-while-archived hardening (ADR-043
  pattern), the duplicate-URL 409 handshake, CSV auto-count with the
  ported header heuristic, grouped vault search. Undo: new
  vault_archive kind — archive/restore are undoable snapshot-inverses;
  every other vault mutation invalidates pending entries; completion
  is deliberately NOT undoable (it freezes a performance record —
  reopen is the audited way back). Platform-wide security upgrade
  ported from the reference: sniffOk now discriminates OOXML
  containers ([Content_Types].xml + word//xl//ppt/), checks the full
  CFB signature, and text-sniffs CSV/TXT — a bare ZIP renamed .docx no
  longer passes ANY upload rule (the old fixture proved the hole; the
  updated test proves the fix). Verified: tsc clean, vitest 266/266
  (+50), Playwright untouched-green (TESTING Run 048).
- In progress: Phase 5 — the six vault screens under /b-systems/vault
  (next commit).
- Next steps: Phase 5 UI (overview, forms, sheets, documents, tasks
  with the result panel, employees, archive) + nav item + vault e2e +
  rbac lines + qa-sweep; then Phase 6 decommission is founder-side
  (fresh start — no data migration, §7.4).
- Blockers: none. Commits stay LOCAL — no push until the founder tests
  (standing override; production auto-deploys from main).
- Needs founder confirmation: (i) XLSX/XLS sheets are stored but not
  auto-counted (CSV is) — counting OOXML needs a spreadsheet
  dependency the stack rules gate behind an ADR; those sheets use the
  manual count + required as-of date, exactly the reference's own
  legacy-.xls path. Say the word if auto-counted XLSX is worth the new
  dependency. (ii) Employee cards carry no email (it was the reference
  app's login/invitation identity — auth, therefore deleted); flag if
  a contact-info email column is wanted on the card. (iii) Vault lists
  ship unpaginated this phase (fresh start; filters + search are
  DB-side) — revisit when tables grow. Carried: see Entries 043–044.

## Entry 046 — 2026-08-18 — Data Vault Phase 5: the six screens (ADR-053)
- Done: the vault UI, composed ONLY from existing design-system classes
  (founder decision §7.8 — the CRM's current design is the model; the
  .dc.html bundle ignored). Seven screens under /b-systems/vault behind
  requireBsAdminPage: OVERVIEW (six stat tiles incl. overdue-highlight,
  vault-wide grouped search whose hits deep-link into pre-filtered
  lists, recent-activity table with Msg-mapped entity/action
  vocabulary), FORMS (table + modal with the duplicate-URL 409
  handshake surfaced as a "save anyway" acknowledgement checkbox),
  SHEETS (link-vs-file rows, CSV auto-count shown with its as-of date,
  Replace file appends a version — the count-pill shows the version
  count, predecessors stay servable), DOCUMENTS (typed files, replace =
  append), TASKS (assignee ecards with open/overdue/completed counts
  that filter the table; open-first deadline-ascending table with live
  Overdue badges, frozen Late verdicts, completed-on stamps; the RESULT
  PANEL opens from Complete — text/files/links, "Save result" vs "Save
  & complete", the server's 422 shown inline; Reopen on completed
  rows), EMPLOYEES (card management, deactivate/reactivate with
  history kept, show-deactivated toggle), ARCHIVE (four per-kind
  sections, one-click restore). ONE new nav item "Data Vault" /
  "خزنة البيانات" in the bsystems_admin NAV array only. Undo: archive/
  restore ride the header Undo (wired in Phase 4); completion instead
  invalidates pending entries — documented in ADR-053 §7. The shared
  ArchiveButton gained an optional confirmText so vault records stop
  borrowing the lead-specific confirm copy. Fixed mid-phase (own
  review, not the auditor): an empty result-panel textarea would have
  NULLed previously saved result text through the additive routes —
  empty now means "leave stored text alone", and the panel prefills
  the saved note. brand-auditor: FAIL (narrow) → all findings fixed
  pre-commit (see TESTING Run 049). Verified: tsc clean, vitest
  266/266, Playwright 40 passed / 2 audit skips (+4 vault e2e: the
  gate journey, CSV count, archive/restore round-trip, the 60-refusal
  403 matrix; +1 vault qa-sweep at five widths incl. the 390px menu) —
  TESTING Run 049.
- In progress: — (Phases 4–5 complete; both commits LOCAL ONLY per the
  founder's no-push override — production auto-deploys from main).
- Next steps: founder tests locally (npm run db:up + npm run dev →
  /b-systems/vault as admin@byteforce.com: add an employee card, a
  task, try completing without a result, upload a CSV sheet, archive/
  restore a document, watch the header Undo after an archive). Then
  Phase 6 founder-side: retire the port-3001 Vault app (fresh start —
  nothing migrated).
- Blockers: none. Commits are NOT pushed — awaiting founder's local
  test.
- Needs founder confirmation: carried from Entry 045 — (i) XLSX/XLS
  manual counts (CSV auto-counts), (ii) no email on employee cards,
  (iii) unpaginated lists this phase. New: (iv) task reassignment and
  result-link removal are edit-modal/log-visible only — links cannot be
  deleted once recorded (append-only reading of the result record);
  say the word if link removal is wanted. (v) The reference app's
  per-column sort controls were not rebuilt (default orders: forms/
  documents newest-first, sheets by user-entered date, tasks open-first
  by deadline) — flag if column sorting matters day-one.

## Entry 047 — 2026-08-18 — ADR-054: modules at the switcher, per-company brand, module import/export
- Done: four founder directives (A–D) plus one design amendment, delivered
  as three local commits (NO PUSH — the founder's standing local-test rule):
  (1) 61ad026 — Accounting and Data Vault became switcher-level MODULES:
  top-level route groups (accounting)/(vault) with their own <html> root
  layouts and app shells (same chrome components; no notifications bell by
  design), URLs now /accounting/* and /vault/*, APIs /api/accounting/** and
  /api/vault/**; EntitySwitch is the four-segment module switcher
  (BYTEFORCE | B-SYSTEMS | ACCOUNTING | VAULT, module segments admin-only,
  non-admins see exactly what they saw); proxy.ts gates both module paths to
  bsystems_admin; the two items left the B-Systems nav; the in-page tab
  strips retired in favour of the shells' header navs (AcctModuleNav keeps
  ?company=&month= on every link; VaultModuleNav keeps ?company=); ShellNav
  matches active state on the path of a query-carrying href. (2) 5501945 —
  directive D: token scopes went bare-[data-brand]; ModuleBrandScope
  re-stamps the company brand on a div around the whole shell (accounting
  byteforce-default|bsystems; vault byteforce|bsystems|neutral-on-All);
  ModuleLogo wears the active company's real mark (neutral: the home
  lockup); PLUS the founder's design amendment — the accounting DASHBOARD
  keeps the ORIGINAL SPA's design (gradient treasury hero with the corner
  geometry, KPI cards with inline-start accent edges and colored figures)
  as token-driven .acct-hero/.acct-kpi classes; ByteForce gained its
  sanctioned --gradient-hero (orange→violet, hero moments only), both
  brands + neutral gained the functional --color-warning amber; brand
  audit passed after documenting the meter-fill sanction. (3) this commit —
  directives B+C: accounting EXPORT beside Import emitting the ORIGINAL
  SPA's exact JSON shapes (single-company migrate() doc + the ALL-companies
  wrapper, EGP numbers, SPA filenames, omit-null optional fields) with
  vitest round-trip proofs — old-file→import→export identical engine
  dashboards for every month (also proven against the founder's REAL
  backups/all-companies-2026-08-17.json), export→import→export a fixpoint;
  the vault got module-scoped export/import (five Vault* tables + vault
  Attachment rows + base64 files, own app marker, REPLACE import behind a
  ticked confirm box); both admin-only, ActivityLog'd (new "export" action,
  "vault_backup" entity type), destructive imports invalidate undo.
  Verified per commit; final gate: vitest 274/274, Playwright 43 passed /
  2 audit skips (TESTING Run 050).
- In progress: — (all three commits LOCAL ONLY, awaiting the founder's
  local test).
- Next steps: founder tests locally — see "how to test": sign in as
  admin@byteforce.com, use the header switcher to move BYTEFORCE ⇄
  B-SYSTEMS ⇄ ACCOUNTING ⇄ VAULT; in /accounting flip the company switcher
  and watch the whole module re-brand (dashboard hero included); in /vault
  set the company filter (All = neutral look); import/export live on
  /accounting/import ("Import / Export" tab) and the Data section at the
  bottom of /vault.
- Blockers: none. Commits NOT pushed.
- Needs founder confirmation: carried from Entry 046 — (i) XLSX/XLS manual
  counts, (ii) no email on employee cards, (iii) unpaginated vault lists,
  (iv) result links not deletable once recorded, (v) no per-column sort.
  New: (vi) the kept-SPA dashboard eyebrow renders Signal Pink as a
  multi-word run under the B-Systems company (the SPA did exactly this;
  B-Systems brand rules normally cap pink at single words) — say the word
  if it should fall back to muted ink under bsystems. (vii) The module
  switcher labels read ACCOUNTING / VAULT (الحسابات / الخزنة) — flag if
  different wording is wanted.
