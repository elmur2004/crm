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
