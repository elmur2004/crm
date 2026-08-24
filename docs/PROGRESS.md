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

## Entry 048 — 2026-08-19 — WhatsApp everywhere, Partners/Agents filter + chips, nav slider, column cap

- Done: four founder requests, four commits, all verified and pushed
  (production deploys from main):
  (1) a857484 — "a WhatsApp (message on WhatsApp) button on every lead next
  to the call button": waHref in src/lib/phone-dial.ts (explicit +/00 kept;
  locally-typed Egyptian mobiles get 20 prefixed; other 0-leading numbers
  get NO link rather than a wrong one — unit-tested), and the button beside
  every Call control: both CRM board cards (guarded chips), both lead
  detail headers, and a second big outlined button on the call sheet. New
  tab, noopener, neutral link-ink (no WhatsApp green in the palette).
  (2) f83f6c6 — "the agents as cards are separated from their partners":
  the Partners & Agents board wears the boards' disclosure filter card with
  Kind (All | Partners | Agents) + the one-box search (name / company /
  number), query-param driven, narrowed server-side (prospectKindWhere /
  prospectSearchWhere, integration-tested); "also add call and whatsapp in
  agents and partners": chips on prospect cards, the pair on the prospect
  detail header, chips beside EACH alternative number, on the directory
  partner's number, and beside each agent's phone (shared NumberActions).
  (3) b5cf66b — the header nav is a real slider (founder screenshot:
  "Registrations" clipped): chevrons appear over the strip's ends only when
  it overflows, the clipped edge fades (masked, works on every header
  ground, RTL-flipped), a press pages max(70% of the strip, 160px), the
  active item auto-scrolls into view; all four shells compose ShellNav so
  it lands everywhere. Plus: the vault header logo is PINNED to the real
  B-Systems mark (founder: "add the bsystems logo for the vault").
  (4) column cap — "add a slider in the column itself when it passes five
  leads": .col-cards caps at min(62vh, 510px) ≈ five cards and scrolls
  inside with a VISIBLE thin stage-tinted scrollbar, on all three boards;
  drags now ride a DragOverlay (aria-hidden visual clone; source card
  ghosts at 35%) so a scrolled/clipped column can never swallow the dragged
  card — proven by a drag from a scrolled column in e2e.
- Verification (TESTING Run 051): tsc clean per commit; vitest 279/279;
  Playwright final gate 46 passed / 2 audit skips (baseline 43 + 3 new
  founder-behavior tests); brand audit PASS. Implementation traps written
  up in IMPLEMENTATION (2026-08-19): the third phone normalisation, board
  card test-geometry contract, DragOverlay + auto-scroll drop drift, the
  squeezed-strip 30px lesson.
- Needs founder confirmation:
  (i) HIS MESSAGE WAS CUT OFF — "so the stages of the agents are as
  following" arrived with no list. Agent cards currently run the SAME
  stages as partners on the Partners & Agents board (Lead → Didn't Answer →
  Following Up → Meeting Setting → Won / Lost). If agents need their OWN
  stage set, send the list — that is a pipeline-config change
  (partnersConfigFor) we will gate and test separately.
  (ii) wa.me country-code rule: Egyptian mobiles typed locally (01x…) are
  assumed +20; 0-leading numbers that are NOT Egyptian mobiles (landlines,
  foreign trunk formats) deliberately show no WhatsApp button. Flag if a
  different default is wanted.
  (iii) A prospect's NON-ANSWERING numbers list carries no call/WhatsApp
  chips on purpose (that pile did not answer); alternative numbers do.
  (iv) The column cap is ~5 cards (min(62vh, 510px)) — say the word to size
  it differently.
  Carried items from Entry 047 remain open.
- Next steps: founder tests on production: a board card's WhatsApp chip and
  the call sheet's big WhatsApp button; /b-systems/partners-pipeline →
  Filters → Kind = Agents; call/wa chips on a prospect page's numbers, a
  directory partner, and the Agents section; narrow the window until the
  header arrows appear and slide; stack 6+ leads in one column and watch it
  scroll inside itself — then drag one of the deep cards out.
- Blockers: none.

## Entry 049 — 2026-08-19 — To-Do: assign a task's lead, or take it yourself

- Done: founder request (verbatim, on /b-systems/todo) — "I can assign
  these to do as an admin or just take it myself." Implemented as ADR-055:
  a to-do row is a projection over a LEAD's latest dated record, so
  assigning the task IS reassigning that lead, through the admin-only
  endpoint ADR-047 already built. No task entity, no assignee column, no
  new route.
  · src/lib/services/todo.ts — the two LEAD-backed kinds (follow_up,
    meeting) now carry leadId / ownerUserId / ownerName / ownerType; the
    stagedLeads select gained ownerUserId, ownerType, owner.name,
    salesRep.name and partner.companyName (ownerName resolves in that
    order, as every other owner surface does).
    Partner-prospect / statement / milestone rows stay bare on purpose —
    admin-owned subsystems with nobody to hand over to.
  · src/lib/services/leads.ts — assignLeadOwner accepts a bsystems_admin
    target and resolves ownerType "admin" (the exact state bucketFor()
    already gives an admin-CREATED lead; OWNER_TYPES has carried it since
    V2 §1) — admin FIRST, the precedence bsRoleOf/bucketFor already use.
    The rule sits inside assignLeadOwner, NOT in ownerTypeForRole(), so
    the assignable roster keeps excluding admins.
    Self-assign (target === actor) skips notifyUser — no bell for your own
    click — while the ActivityLog row and the ADR-045 undo entry are still
    written.
  · src/components/shared/TodoBody.tsx — one optional `rowActions` render
    prop, so the shared list stays brand-neutral. Its rows call it and the
    B-Systems side renders the muted owner CHIP (bucket · owner / rep /
    partner company, the same label the board and the lead detail show),
    the lead detail's own AssignLeadButton (compact variant), and a new
    "Take it" button — hidden when the row is already the admin's.
  · src/components/bsystems/TodoRowActions.tsx — those row controls and
    the owner-chip composition, B-Systems-scoped: components/shared never
    imports the B-Systems lead-action client module, so the ByteForce
    To-Do route carries none of it.
  · src/components/bsystems/leadActions.tsx — TakeLeadButton (POSTs the
    same assign endpoint with the admin's own id, inline error, refresh)
    beside AssignLeadButton, which gained a `small` flag for the row.
  · src/app/(bsystems)/b-systems/(app)/todo/page.tsx — builds the
    rowActions render prop ONLY for bsystems_admin, with the lead-detail
    page's pre-translated role labels. Every other role and the ByteForce
    To-Do page render exactly as before; the real wall is requireBsAdmin
    on the endpoint.
  · src/lib/i18n/dict/todo.ts — one new key, takeIt (EN + AR). The modal
    reuses the existing assignLead.* keys; the owner chip reuses
    ownerTypeLabel + ownerFilters.unassigned. No existing English string
    touched.
- Review round (same commit — eight reviewer findings adjudicated against
  the code: four distinct defects, all real and all fixed; the other four
  were duplicate reports of the same two. ADR-055 carries the reasoning):
  · The owner label was a bare account name with "Unassigned" as its
    fallback, so a lead assigned to an internal REP, or owned by a partner
    company with no login, or left ownerless by a deleted account, read as
    unassigned on the screen used to hand work out. todoFor now selects
    salesRep.name + partner.companyName and falls back owner → rep →
    partner company; the row shows the app's owner chip (bucket · name)
    and keeps "Unassigned" for ADR-051's real state.
  · TodoBody's `assign` prop made components/shared import the B-Systems
    "use client" lead-actions module — dead code in the ByteForce route's
    client graph. Replaced by a `rowActions` render prop plus the new
    components/bsystems/TodoRowActions.tsx. The unread `selfName` field
    disappeared with it.
  · assignLeadOwner resolved the bucket through ownerTypeForRole FIRST, so
    an account holding bsystems_admin AND bsystems_sales landed in the
    INTERNAL bucket on "Take it" — the admin's own task would have
    surfaced on every internal-sales board and To-Do. Admin now wins
    first, matching bsRoleOf/bucketFor precedence everywhere else.
  · TodoAssign.selfName was declared and populated but never read — a
    required field on a public interface with zero read sites. Gone with
    the prop rewrite above.
  · Nothing was refuted: every finding reproduced against the code.
- Verification: tsc clean; vitest 284/284 — baseline 279, +3 for the
  feature (to-do rows carry lead ownership while prospect rows do not; an
  admin takes a lead: admin bucket, NO self-notification, undo restores
  the previous owner; a second admin target IS notified) and +2 for the
  review round (the owner name falls back rep → partner company while a
  bare internal lead keeps a null name; a multi-hat admin+sales account
  taking a lead lands in the ADMIN bucket and stays off the internal
  sales To-Do). New e2e/todo-assign.spec.ts, 3 passed
  (admin row shows owner + Assign + Take it while a partner-prospect row
  shows neither, assign-through-the-modal then take-it-back with the lead
  detail agreeing, the agent finds the task on THEIR To-Do with no
  controls, internal sales sees no controls). e2e/todo.spec.ts re-run
  green alongside; its assertions now pin the composed chip ("Admins ·
  Elmur", "Agents · Karim Adel", "Internal · Omar Farouk"). The existing
  assign guard test now proves data-entry and ByteForce logins are refused
  (admins are legal targets by design); the roster test still proves
  admins are never OFFERED. Full gate on the final tree: Playwright 49
  passed / 2 skipped (TESTING Run 052).
- Needs founder confirmation:
  (i) THE BYTEFORCE TO-DO GOT NO ASSIGN CONTROLS. ByteForce leads have no
  account ownership to move — salesRepId points at a SalesRep NAMEPLATE
  (a card on the reps board), not at a login, so there is no "his system"
  to hand the work to. If you want the equivalent there, say which: give
  ByteForce staff real logins that own leads, or make the To-Do row
  re-point the lead's sales-rep nameplate instead.
  (ii) Admins are still absent from the Assign dropdown (ADR-047: the
  admin bucket is where an UNASSIGNED lead sits). "Take it" is therefore
  the only way a lead lands with an admin — which matches your two
  options, but say the word if you want to hand a lead to a NAMED admin
  colleague from the list.
  (iii) Taking a lead yourself does not notify you (no bell for your own
  click); it is still in the activity log and still undoable.
  Carried items from Entries 047 and 048 remain open.
- Next steps: founder test on /b-systems/todo — an overdue row now shows
  who owns it plus "Assign owner" and (when it is not already yours)
  "Take it"; assign one to an agent and confirm it appears on his To-Do;
  take one back and check the lead page reads "Admins · <your name>";
  press Undo on the header afterwards.
- Blockers: none.

## Entry 050 — 2026-08-19 — Two founder fixes: a drag handle for touch, and a zoom-proof layout

- Done: two founder reports, one session, two commits (ADR-056).
  (A) "in the mobile interface, the scroller of the columns and the CRM is not
  working — when I try to scroll using the cards it drags the card. I should
  have a button to drag the card... I cannot reach the leads under the column
  because I cannot scroll."
  · NEW src/components/shared/CardGrip.tsx — `<CardGrip>` (a real
    `<button type="button">`, 26 x 44px centred on the card's inline end, six
    dots, aria-label from the new `common.dragHandle` key, EN + AR) and
    `useMouseOnlyListeners()`, which gates dnd-kit's `onPointerDown` to
    `pointerType === "mouse"`.
  · BsBoard / InternalBoard / PartnersBoard — the card body renders the grip
    (so the DragOverlay clone is identical to the card it replaces and nothing
    reflows at pick-up); the shell keeps the gated listeners and drops
    `{...attributes}` and `touch-none`. The clone passes no `drag` prop, so its
    grip is inert and `tabIndex={-1}` inside the existing `aria-hidden` wrapper.
  · design-system.css — `.bcard` gains `position: relative` and
    `touch-action: manipulation`; `.bcard:has(> .bcard-grip)` gains the 34px
    inline-end gutter (so the Agents page's read-only mini board is untouched);
    the new `.bcard-grip` rule is the ONE place in the app allowed
    `touch-action: none`; `.board` gains `overscroll-behavior-x: contain` so
    panning columns cannot trigger the OS edge-swipe back.
  (B) "when I zoom in and out the UI gets so scattered."
  · The four app shells wrap `<main class="page">` in `<div class="shell-body">`
    (`container-type: inline-size`), and `.board`'s full-bleed breakout is
    rewritten in `cqw` — the content width EXCLUDING the scrollbar, which is the
    quantity `vw` cannot express. The ±8px scrollbar fudge is deleted; the old
    vw pair stays above as a legacy fallback.
  · `.col-cards`'s cap becomes `clamp(2 TALL cards + gap + padding, 62vh,
    5 REFERENCE cards + 4 gaps + padding)` off `--bcard-h-max` / `--bcard-h` /
    `--bcard-gap` / `--col-cards-pad-b` (429px floor, 928px ceiling).
  · Swept from the ranked list: `.undo-fab`'s `100vw` (scrollbar-inclusive) →
    `100%`, which for a fixed element excludes it; `.acct-hero-value`'s
    `clamp(36px, 6vw, 60px)` → `6cqi` against the hero card itself, so the
    figure keeps its proportion to its own px-sized label across the zoom range.
  · Two defects the new spec FOUND: the header's module switcher pushed the page
    48-64px sideways between ~400px and ~555px (BUG-010 — it now leaves the
    header at ≤600px, riding into the sheet with Log out), and ShellNav's
    integer `scrollWidth - clientWidth` hid the slider chevron when a label was
    clipped by under 1px at a fractional zoom (BUG-011 — measured off the items'
    fractional rects now, with logical start/end from `direction`).
- Verification: tsc clean on both commits. vitest 284/284 (unchanged — neither
  commit touches a service). Playwright, three targeted runs, all
  `.last-run.json` `"status": "passed"`: commit 1's board set 15/15; commit 2's
  zoom + nav + board set 18/18; commit 2's blast-radius set (qa-sweep, the two
  portal journeys, accounting, vault, undo, impersonation) 23/23. BOTH new specs
  were seen RED first — e2e/board-touch.spec.ts measured scrollTop 0 with
  `touch-action: none` back on the card, and e2e/zoom.spec.ts failed at the 50%
  and 80% zoom models with +7px and +2px of real horizontal page overflow before
  the CSS change. Full numbers in TESTING Run 053.
- Review round + FULL GATE on the final tree (folded into both commits, no new
  ADR — ADR-056, IMPLEMENTATION and BUG-009 amended in place). Six findings
  adjudicated against the code; four fixed, two refuted:
  · FIXED — `--bcard-h: 176px` was documented as "the RICHEST card" and was not.
    Measured in the real app: the seeded B-Systems card is 186.3px, 190.4px with
    the name at its 2-line clamp, 202.4px with a long key datum too. Split into
    `--bcard-h` (176px, sizes the CEILING, deliberately short) and
    `--bcard-h-max` (204px, sizes the FLOOR) — floor 373px → **429px**. A6 now
    seeds names that WRAP, so its live-card oracle and the frozen constant
    cannot drift apart in silence again.
  · FIXED — the grip was a full-card-height rail, so stacked cards made one
    unbroken 26px `touch-action: none` strip down the whole column, starting at
    the horizontal centre of a 390px phone. 26 x 44px centred now; a new
    assertion caps its height at half a card, and a new gesture proves the
    gutter beside it scrolls.
  · FIXED — e2e/board-touch.spec.ts reset the column with `el.scrollTop = 0`
    between two touch gestures, which can swallow the next swipe that starts
    inside that scroller. Real `touchSwipe` resets, live geometry for every
    sample point.
  · FIXED — e2e/byteforce-board.spec.ts asserted `clientHeight <= 520`, true
    under the old flat 510px ceiling at any viewport and true today only because
    this file happens to run at 1280x720. It derives the clamp from the CSS's
    own custom properties now.
  · REFUTED — "the ceiling moving 510px → 928px is a regression". It is the fix:
    510px was 2.9 cards and the founder asked for about five. Comment and
    CHANGELOG now state the 692-1497px band inside which "the middle is
    unchanged" is true.
  · REFUTED — "cap the floor to the viewport so the column always fits the
    screen". At 300% that resolves to well under one card, i.e. exactly the
    0.83-of-a-card column BUG-009 exists to delete. The floor is a floor on the
    column BOX; past ~2x the screen is shorter than two cards and the page
    scrolls. Wording corrected instead.
  Gate on the final tree: `npx tsc --noEmit` clean · vitest **284/284**, 23
  files · FULL Playwright **59 passed / 2 skipped** (the audit opt-ins),
  `.last-run.json` `"status": "passed"`, `failedTests: []`, 9.1m. Brand audit
  PASS on the changed surfaces (no hex/font-family added, tokens only, logical
  properties throughout — `inset-inline-end` / `inset-block` / `margin-block`).
  TESTING Run 054.
- Needs founder confirmation:
  (i) THE CENTRED COLUMN STILL SHIFTS BY HALF A SCROLLBAR. The BOARD's jump is
  gone. What remains is that every page's centred content moves by SB/2 —
  7.5px at 100% zoom, 15px at 50% — when a page grows long enough to gain a
  vertical scrollbar (or short enough to lose one). One line fixes it,
  `html { scrollbar-gutter: stable both-edges }`, and the cost is a permanent
  reserved strip of 15/zoom px on BOTH sides of EVERY page at every width — a
  30px dead band at 100% on a 1440 monitor, taken out of content. We did not
  ship it unasked. Say the word and it is one line.
  (ii) THE COLUMN CAP'S SIZE. The floor and ceiling are now honest (never
  shorter than two whole cards, never more than about five). The MIDDLE is still
  62vh, which on a normal laptop window resolves to ~471px — about 2.5 of the
  richest cards, or 3.2 of the lighter ByteForce ones. So "about five cards" is
  what you get when you zoom OUT, not at your usual zoom. If you want five cards
  at normal zoom, that is one number: drop 62vh and let the ceiling
  (5 cards = 928px) rule. It will make a full column about twice as tall as it
  is today. Two consequences that ARE already live and worth knowing: on a
  screen taller than ~1500 points a full column is taller than it used to be
  (558px at 1440x900, 893px at 2560x1440, against the old flat 510px), and past
  about 200% zoom the column box is taller than the screen, so the second card
  is reached by scrolling the page.
  (iii) THE COMPANY SWITCHER LEAVES THE HEADER EARLIER. It used to stay in the
  header down to 400px; it now moves into the burger menu below 600px, because
  between roughly 400 and 555px it was pushing the whole page sideways. Nothing
  is lost — it is in the menu, same as Log out — but the header looks different
  on a narrow window and at 300% zoom.
  (iv) A STYLUS NOW NEEDS THE GRIP, like a finger. A pen obeys the same browser
  scrolling rules as a touch, so letting it drag the whole card would re-create
  exactly the bug you reported. A mouse is unchanged.
  (v) CARDS ARE 22px NARROWER INSIDE, to make room for the grip rail. Rich cards
  (long company name + Call + WhatsApp + the two meta buttons) may run one line
  taller — MEASURED since: the richest B-Systems card is 186.3px, 190.4px once
  the name wraps to its second line, 202.4px with a long key datum as well.
  Worth an eyes-on pass on all three boards, in English and Arabic.
  Carried items from Entries 047, 048 and 049 remain open.
- Next steps: founder test on the PHONE first — open /byteforce/crm with a long
  column, swipe with a finger starting ON a card (the column should scroll),
  swipe sideways (the board should slide), scroll past the bottom of a column
  (the page should keep going), then drag one card to the next stage by the grip
  on its edge. Then on the desktop: set the browser to 50%, 80% and 200% zoom on
  a board page and check nothing runs off the side and the board does not move
  when you filter it. Answer (i) and (ii) above and the rest is one line each.
- Blockers: none.

## Entry 051 — 2026-08-20 — The agents pipeline: its own six columns, and Qualified is the account gate
- Done: the founder's answer to the open question on the Partners & Agents
  board — *"agents stages : lead , contacted , didn't answer , meeting settting ,
  qualified , lost , when he is in qualified he becomes an agent and we create a
  user for hiim and fill in the data of him and I can assing leads for agents
  also"* — shipped in three commits (ADR-057).
  COMMIT 1, the engine:
  · `AGENT_STAGES` (the founder's column order, pinned by a test) + `contacted` /
    `qualified` in `STAGE_LABELS`.
  · `configs/partners.ts` rewritten so the shared body reads ROLE SLOTS
    (`activeActions`, `sameStageExtras`, the terminal guard,
    `attendedDestinations`) instead of literal stage keys; `agentsConfig` is the
    same builder with `followUpStage: "contacted"`, `wonStage: "qualified"`,
    `terminalStages: [qualified, lost]` and the `won_agent` / `create_agent`
    pair. `transition.ts` needed no stage edits — the core was already
    slot-driven — only `PipelineConfig.triggers` so §10.2a can carry PA-*.
  · `SAME_STAGE_FORM_TARGET` (a literal map) superseded by
    `SAME_STAGE_FORM_SLOT`, which names the slot.
  · SPEC §7.2a (the agent card + its Qualified gate table), §10.2a (PA-1…PA-5),
    §7.2's "six columns" line scoped to partner cards, A-5 amended, §13/§14
    updated. 43 engine tests: one per PA row, illegal moves both ways, and a
    describe block proving the PARTNER config's arrays are byte-identical.
  COMMIT 2, the data and the server:
  · `prisma/migrations/20260819180000_agent_stages` — agent rows only,
    `following_up -> contacted`, `won -> qualified`, plus the ActivityLog
    rewrite and the pending-undo retirement. Idempotent by construction.
  · `todo.ts` — the prospect query widened to the union of both configs'
    follow-up slots; the per-row branch reads the card's own config. Without it
    every agent follow-up would have vanished from the admin To-Do silently.
  · `undo.ts` — refuses to write back a stage the card's board does not have.
  · `backup.ts` — a pre-change export is normalised on import.
  · `partners.ts` — `addAlternativeNumbers` uses the card's config (it was
    calling `transition` with the PARTNER config on agent cards; it worked only
    because both kinds share `didnt_answer`), and PP-2/PA-2's trigger now comes
    from the engine result instead of a literal.
  · A dedicated migration integration test that executes the SHIPPED SQL, twice.
  COMMIT 3, the board and the words:
  · `PartnersBoard` split into `<ProspectPipeline>` (one kind, its own columns,
    its own drag state, its own DndContext, `${kind}:${stage}` droppables,
    `data-pipeline` on `.board`) and a dispatcher; Kind = All stacks a Partners
    section then an Agents section.
  · `ProspectEventPanel` and `pages.tsx` `keyDatum` now resolve through
    `partnersConfigFor(kind)` — the panel was consulting the PARTNER config on
    every card, which would have offered an agent the partner columns and had
    every one rejected by the server.
  · Two new stage token families in ALL THREE scopes + the Tailwind bridge + the
    `[data-stage-key]` bindings; `stageColors.ts` gained both keys (its default
    is `lost`, so Qualified would have painted as a loss).
  · `brand-tokens.test.ts` gained the three-way parity guard neutral.css never
    had, plus a stage-key coverage test over every pipeline.
  · i18n: `contacted` / `qualified` in `stageMsgs` with real Arabic, and eight
    NEW sibling keys. No existing English string edited.
  · Seed ships one agent card per agent stage; e2e gained `agent-pipeline.spec`
    (stacked view, both column sets in order, a drag in each board, the
    cross-board no-op, an Arabic pass, and the gate→assign→his-board→his-To-Do
    loop) and journey 3's column locators are scoped to `[data-pipeline]`.
  REVIEW ROUND (same day, folded into these three commits before pushing).
  Every reviewer finding was checked against the code and the schema; all were
  real and all are fixed:
  · THE MIGRATION'S UNDO GUARD retired only the agent-card entry, which promoted
    the OLDER entry beneath it to the head of `pendingUndoFor` — the button then
    offered to revert something that was not the admin's last action, with a
    fingerprint that still matched (ADR-045's `honesty` guard). It now retires
    the affected user's WHOLE pending set, scoped by the OLD stage in the undo
    SNAPSHOT — which also makes statement 3 genuinely idempotent, so the file's
    header claim is now true of every statement.
  · `HistoryPanel` mapped the literal `"PP-2"` to §10.2's prescribed wording, so
    PA-2 lost the "Returned to Lead — new number added" pill the day agent cards
    got their own row ids — inconsistently, since pre-deploy rows kept it. The
    map moved to `historyPhrases.ts` and is BUILT from the configs'
    `triggers.numberAdded` slots.
  · `importBackup` normalised only the cards, so a restored agent's History kept
    speaking the partner vocabulary. One `normaliseAgentStages(tx)` helper now
    mirrors the SQL statement for statement, with a test that runs BOTH against
    identical fixtures and diffs the whole world.
  · `/api/health` probed one column from migration 2 of 12, so a DATA-ONLY
    migration that never applied hid behind `ok: true`. It now diffs the
    committed migration folders against `_prisma_migrations`.
  · The seed shipped five of the six agent columns — `qualified`, the gate
    itself, was empty. It now ships the agent analogue of `wonProspect`.
  · Two literal stage comparisons survived the slot sweep (`pages.tsx`,
    `ProspectEventPanel.tsx`); both read their config's slot now.
  · Two stacked boards each owned a `message`, so a stale partner toast sat
    under the agent one at the same fixed coordinate; and a filtered-out section
    claimed "No partner cards yet." while partner cards existed. One toast slot
    on the dispatcher, and `filtered` picks `noMatches`.
- Verification: `npx tsc --noEmit` clean on all three commits and on the final
  tree. vitest **311 passed / 0 failed**, 25 files (307/24 before the review
  round). Playwright, FULL SUITE on a copied config at port 3111 (3100 was held
  by another project's `next start`, 3000 by the founder's dev server — nothing
  was killed): **64 passed / 0 failed / 2 skipped**,
  `test-results/.last-run.json` → `{"status":"passed","failedTests":[]}`, read
  directly. Migration RE-PROVED after it changed, on a throwaway Postgres with a
  REAL `prisma migrate deploy` (folder parked so the ledger built like
  production's): 11 migrations, then exactly 1, then 0 — 21/21 assertions pass,
  and the old statement 3 was pasted back to confirm the new guards go RED.
  Numbers in TESTING Run 056. Brand audit by hand: PASS.
- Founder-facing: CHANGELOG entry "Agents get their own columns".
- Next: nothing blocking. The ADR carries three alternative arrangements for the
  Kind = All view (drop it, tabs, or one superset board) for the founder to pick
  if the stacked page reads too tall on his monitor — **needs founder
  confirmation**, but the shipped arrangement is the one the lead engineer
  specified and is fully tested.

## Entry 052 — 2026-08-21 — The accounting row ✓ goes green while the row is settled
- Done: the founder screenshotted the accounting row action buttons and said
  *"when I click on the right sign it becomes green"*. Offered the choices, he
  picked the button itself: **the ✓ turns green on settled rows — "so the
  buttons column shows at a glance which rows are approved. Clicking it again
  returns it to the normal colour and puts the row back On hold."** Shipped in
  one commit.
  · One shared `SettleToggle` in `src/components/accounting/forms.tsx` now
    renders BOTH check toggles, which until now were byte-identical in every
    state: income (`row.collected`, PATCH `toggleCollected`) and expenses
    (`row.paid` — the manual PATCH and the AUTO payroll row's POST
    `/api/accounting/payroll-paid`, which is the row kind in the screenshot and
    needed no separate work once the component was shared). State is read from
    the same row truth the status chip reads, so button and chip cannot
    disagree, and the round trip is the API's existing toggle in both
    directions.
  · `.row-toggle--acct-settled` (design-system.css, in the `.acct-chip` block —
    the same accounting fence) swaps in for `.row-toggle--restore` on the
    settled state: `--color-acct-positive-tint` background,
    `--color-acct-positive` ink, border a `color-mix` of the same ink exactly as
    `.acct-chip--off` does with warning. Colour only — no size, no padding, no
    radius — so the action column never reflows on a flip. No new token, no hex
    anywhere. **Correction after review:** the pair did NOT already exist in all
    three brand scopes. In `branding/b-systems/tokens.css` it had been sitting
    inside the `.bs-mesh` rule since the day it landed, below the
    `[data-brand="bsystems"]` block — so the B-Systems scope declared nothing,
    and a bare `var()` with no fallback means no green at all there. It painted
    only because the accounting root layout stamps `data-brand="byteforce"` on
    `<html>` and `ModuleBrandScope` re-stamps just an inner `<div>`, so the
    byteforce value inherited through. Moved into the brand scope, and
    `brand-tokens.test.ts` now reads tokens per SCOPE (brace-matched) instead of
    per file — which is why every guard had been blind to it — with a new
    three-scope check over `--color-acct-*` beside the ADR-057 stage one.
  · NOT BY COLOUR ALONE: `aria-pressed` on both toggles, with the accessible
    NAME fixed to the state it represents — `Collected` on income, `Paid` on
    expenses — and the flipping action wording in `title` only. **Corrected
    after review:** the first cut put the action wording in `aria-label` too, so
    a collected row announced "Mark pending, pressed" — name describing the next
    action while `pressed` described the current state, the WAI-ARIA APG
    anti-pattern, and it made the title a duplicate of the name into the
    bargain. Income still gains `markCollected` / `markPending` with real Arabic
    (تعليم كمحصّل / إعادة إلى المعلّق) — they are its titles now, matching the
    `approveMarkPaid` ⇄ `markOnHold` pair expenses already had.
    `toggleCollected` is retired from use but KEPT in the dictionary with a
    comment — shipped English strings are never edited or removed.
  · Also after review: the ✓ is `disabled` while its own request is in flight
    (two fast clicks used to fire the reverse toggle behind the first and land
    back on the original state), and a failed toggle renders a `.row-error`
    beside the row's buttons instead of failing silently — which mattered more
    once the button's colour became the row's primary state cue.
  · Boundary recorded, not changed: un-settling an income row that is in the
    view only because its CASH landed there takes it out of that month — cash
    cleared, so the row goes back to its own month, pending. Holding it would
    park an uncollected amount in a month it does not belong to. The e2e now
    walks that leg too, not just the issue-month one.
  · Both brands: the module stamps `data-brand` per company (ADR-054 directive
    D) and the accounting green pair is byte-identical in `byteforce`,
    `b-systems` and `neutral`, so the ByteForce and B-Systems books read the
    same. #1B7A44 on #E6F4EC = 4.73:1, AA for normal text.
- Decision record: **no new ADR.** The accounting green is an existing,
  deliberate exception to the R4 "no green anywhere" ruling (ADR-031
  Resolution), created by commit 8fe9e05 for `.acct-chip--good` — and it turned
  out that exception had a code comment and a CHANGELOG line but **no ADR at
  all**. It is written down now as **ADR-054 — Addendum (2026-08-21)**, which
  states the original exception in full and then records this extension. The
  exception does not widen: same two tokens, no new hue, no new scope, one more
  consumer inside the same accounting fence on the same money-row-status
  semantics. The addendum says explicitly that taking this green OUTSIDE
  accounting WOULD be a widening and would need its own ADR against R4.
- Verification (final, after the review fixes): `npx tsc --noEmit` clean.
  vitest **312 passed / 0 failed**, 25 files — the 311 baseline plus the new
  accounting three-scope token test. Playwright **FULL SUITE**:
  **65 passed / 0 failed / 2 skipped** (the two standing `e2e/audit.spec.ts`
  opt-ins), `test-results/.last-run.json` → `{"status":"passed"}` with an empty
  `failedTests`, read from the file rather than inferred from a piped summary.
  `e2e/accounting.spec.ts` holds 5 tests: the four pre-existing ones untouched,
  assertions included, plus the new one. It asserts `aria-pressed`, the state
  CLASS and the flipping `title` on all three row kinds in BOTH directions, and
  samples the resolved background exactly once — under the B-Systems brand,
  against the ByteForce one — because a class flips from the same React branch
  under either brand and proves nothing about tokens. Rows are booked into
  `2099-01`; the one honest caveat, now written into the spec's own comment, is
  that the ✓ stamps TODAY's date, so an income row's cash sits in the current
  month between a click and its un-click (which is exactly what the cash-month
  leg exercises). Numbers in TESTING Run 058. Brand audit by hand: PASS. Port
  note: 3000 and 3100 were both free this session, so the stock config ran on
  3100 and no process was touched.
- Founder-facing: CHANGELOG entry "The ✓ on an accounting row goes green when
  the row is settled".
- Next: nothing blocking. One thing worth the founder's eye when he tests: the
  green ✓ is now the SECOND cue for a settled row, beside the Collected/Paid
  pill in the Status column — if he'd rather the pill went away now that the
  button carries it, that is a one-line change, but nothing was removed without
  him asking.

## Entry 053 — 2026-08-21 — One month of someone's pay, without touching their salary
- Done: the founder, on the expenses screen: *"when I edit an expense of the
  type of payroll and it is being edited it doesn't automatically edit in the
  actual payroll roster because it can be because of a deduction or something"*.
  Answered in the opposite direction to the words — it must NOT edit the roster,
  because `memberAt()` effective dating would apply that change from the month
  FORWARD, permanently — and shipped in two commits (ADR-058).
  · COMMIT 1, deduction and bonus become writable. `AcctExpense.deduction` /
    `.bonus` have existed since the accounting migration and `expenseAmount()`
    has always netted them, but nothing in either app could WRITE one: the form
    body carried ten keys and neither of these, and the ORIGINAL SPA had no
    field either (a full grep of `Accounting/` for /deduction|bonus/i returns
    four hits, two of them the word "bonus" in prose). A deduction could only
    ever arrive by importing the old file — the gap he hit. Now: two optional
    EGP fields on the expense modal, shown only for type payroll; both on
    `ExpenseRowDto`, both in `expenseSchema` (so POST and PATCH validate them
    server-side for free), both written by `resolveExpenseData`. NO MIGRATION —
    the columns predate this work (`migration.sql:35-36`).
  · COMMIT 2, the month-only override. A derived salary row now offers BOTH
    payroll paths side by side, worded as opposites: **"Edit in roster"**
    (*"…from this month FORWARD"*) and the new **"Adjust this month only"**
    (*"…THIS MONTH ONLY. The roster salary, and every other month, stay exactly
    as they are."*), which opens the modal prefilled to CREATE the linked
    override — person, month, department, the derived salary as the base,
    adjustments empty — and the modal names the person and the month so it says
    which path he is in. The engine already made a linked manual payroll row
    replace the derived one for its month; only the UI could not reach it. The
    mechanism was already named by the original on this very form ("Pick a
    person only if this should REPLACE their automatic salary for this month",
    already in our dictionary with real Arabic), so this is a shortcut to a
    concept he has been shown, not a new one.
  · THE PAID-STATE TRAP, settled as the SINGLE-OWNER APPROVAL INVARIANT: for any
    (person, month) the approval has exactly one owner — the `AcctPayrollPayment`
    mark while the salary is derived, the covering expense's own `paid` while an
    override exists — and the mark is kept as a SHADOW of the covering row so
    the approval, and its ORIGINAL date, transfer at every boundary instead of
    being dropped or duplicated. Approve an auto row, override it: it stays
    Paid, and the tile moves by the deduction, never by a whole salary. Delete
    the override: the derived row returns with the approval it was carrying.
    The SPA had no transfer at all (it orphaned the mark and resurrected the row
    from a possibly months-stale value) — a deliberate correction, not a port.
  · Two money guards the original also lacked: a deduction larger than
    base + bonus is REFUSED server-side (a negative net turns an expense into
    income and hands the treasury cash), and clearing a field stores NULL rather
    than 0 so the exported document keeps the shape the old app reads.
  · REVIEW ROUND, folded into these same two commits — five real defects, each
    reproduced against the real database before and after the fix:
    (1) HIGH, money. The shadow deleted the approval mark on ACQUIRE, so
        "+ Add expense → Payroll → pick a person" (which ships Status = On hold)
        destroyed that person-month's approval, and deleting the row could not
        rebuild it: 500,000 piasters of approved spend left March and never came
        back. Acquire now PARKS; only the ✓ and Status → On hold un-approve.
    (2) HIGH, money. Two linked payroll rows for one person-month both counted a
        full salary (1,000,000 piasters for one 5,000 EGP salary) — `covered` is
        a Set, `monthExpenses` is not. Refused now on create and on update, with
        the existing row named in the 400.
    (3) MEDIUM, money. The negative-net floor existed only on the form; the
        IMPORT is the only path that has ever populated these columns and let
        `{amount: 5000, deduction: 9000}` through as a −400,000 expense that
        ADDS cash. Refused by name, before the REPLACE transaction.
    (4) LOW, audit. The mark's `paidDate` was rewritten with the day the
        override was typed. The upsert re-asserts (`update: {}`); the test that
        should have caught it now seeds a distinct earlier date.
    (5) LOW, money. A paid override for a month the roster does not pay left an
        orphan mark; reactivating that person later materialised an
        ALREADY-APPROVED salary. The shadow now writes only where the roster
        actually posts one.
    Plus two presentation fixes: the Arabic labels of the two payroll paths
    opened with the same word (they now differ at word one, as English does),
    and the override modal's month/person are LOCKED so its banner can never
    describe a save that lands elsewhere.
    Seven distinct findings, all reproduced, all fixed — none refuted. Each has
    a permanent regression test; ADR-058 decisions 1, 4 and 5 were amended in
    place so the record and the code say the same thing.
  · REQUIREMENT 7 AUDITED, NOTHING TO FIX: every surface — dashboard, P&L,
    treasury, departments, accounts payable, the expenses page and its section
    totals — already sums through `expenseAmount()`. The only raw `.amount`
    reads for a payroll row are the two that must be the BASE (the modal's edit
    field and the new sub-line). Proven by test rather than changed.
- Tests: 74 accounting unit + integration (engine 39, new
  `accounting.integration.test.ts` 22, import/export integration unchanged and
  green), `e2e/accounting.spec.ts` 7/7. Two new e2e journeys: the fields with
  the row maths and the server refusal, and the founder's full override journey
  including both paid directions and the revert. TESTING Run 059.
  After the review round, the FULL gate on the final tree (TESTING Run 060):
  `npx tsc --noEmit` clean · `npx vitest run` **347 passed / 26 files** (+8, all
  regression guards for this round) · `npx playwright test` **67 passed / 2
  skipped**, `test-results/.last-run.json` `{"status":"passed","failedTests":[]}`
  read from the file · brand audit **PASS** (one finding fixed: the newly
  reachable `.field-input:disabled` had no token-driven look) · and a MONEY
  PROOF measured end to end — a 200 EGP deduction and a 300 EGP bonus over two
  roster salaries move the month total, the P&L, accounts payable and the
  treasury by exactly themselves and nothing else, with two people counted
  twice in neither the rows nor the money and `committedSalary` fixed at
  1,200,000 piasters throughout.
- Found and fixed on the way: BUG-012 — `e2e/accounting.spec.ts` was ALREADY RED
  on a clean tree. Its cross-brand paint comparison sampled a settled ✓'s green
  the instant the class landed, and `.row-toggle` transitions `background-color`
  over .15s, so it read a different alpha every run. Verified pre-existing by
  stashing this work and re-running. Now polls until the paint stops moving.
- In progress: nothing mid-flight; tree clean, both commits amended with the
  review round and PUSHED to `origin/main` (production redeploys from it).
- Next steps: the four founder-confirmation items below. `/phase-gate` still
  owns the phase's Definition of Done, but the FULL vitest and Playwright
  suites are green on this tree as of Run 060, so it starts from a known-green
  baseline rather than an unknown one.
- Blockers: none.
- Needs founder confirmation:
  (1) THE ROW'S MATH LINE. `Base EGP 5,000 − deduction EGP 200 + bonus EGP 50`,
      muted, under the net. The original app showed the NET ONLY on every screen
      and had no breakdown anywhere, so there was nothing to mirror — this
      presentation is ours, deliberately kept to the original's density. Anything
      richer (a column per part, a tooltip) is a design decision he should make.
  (2) THE WORDING OF THE TWO PATHS — "Edit in roster" (from this month forward)
      vs "Adjust this month only". Both hints are new EN + AR strings; the AR is
      hand-written to read as a genuine contrast
      («من هذا الشهر فصاعدًا» vs «هذا الشهر فقط»).
  (3) DELETING A PAID OVERRIDE returns the derived salary APPROVED, dated the
      day that person-month was actually approved (the parked mark's own date;
      the override's own date only when the approval originated there). The
      alternative — returning it On hold so he re-approves consciously — is
      defensible; we chose not to lose an approval silently, because that
      direction costs a full salary in the month's cash.
  (4) A SECOND payroll row for the same person and month is now REFUSED with
      *"{name} already has a payroll row for {month} — edit that row instead of
      adding a second one."* Refusing is the safe answer (two rows pay him
      twice), but he may prefer the modal to warn him BEFORE he types, or to
      offer "open the existing row" instead of an error after Save.

## Entry 054 — 2026-08-21 — One pipeline for partners and agents, a Waiting column, and the login as its own step
- Done: the founder's requirements list, section 1 (plus his answer to the scope
  question — *"Same stages for both"*), shipped in four commits, each
  type-checking clean with its own tests.
  (1) THE ENGINE (ADR-059): `PARTNER_STAGES` and `AGENT_STAGES` collapse into one
      `PROSPECT_STAGES = lead · contacted · didnt_answer · meeting_setting ·
      waiting · qualified · lost`, in his dictated order. The two kinds now
      differ in exactly three slots — what Qualified requires, what it creates,
      and its row id — asserted key by key. Contacted and Waiting open no field
      group at all (items 1.2 / 1.1), Qualified never asks for credentials
      (1.3), and `followUpStage` is null so no stage implies a follow-up (2.1).
      `requiredGroupFor` / `requiredGroupForTarget` are exported so the board
      and the panel ASK the engine whether a move opens a form instead of
      restating the rule; `cancelledDestinations` becomes a config slot. SPEC
      §7.2 and §10.2 rewritten normatively (PP-1…PP-9), §7.2a/§10.2a superseded.
      The Waiting token family lands in all three brand scopes at once, because
      the guard test fails the moment a new stage exists without one.
  (2) THE DATA + THE SERVER: the migration walks partner rows
      `following_up → contacted` and `won → qualified` with the ActivityLog
      rewrite and the pending-undo retirement, mirroring ADR-057 statement for
      statement with the predicate inverted; the restore helper is generalised
      to `normaliseProspectStages` and the anti-drift test EXTENDED to execute
      both shipped folders and diff SQL against TypeScript. Account creation is
      lifted out of the stage move into `createAgentAccount` /
      `createPartnerLogin` behind an admin-only route. The To-Do is driven by
      the follow-up RECORD, never by the column.
  (3) THE BOARD + THE WORDS: one board again (one DndContext, one overlay, one
      toast), the Kind filter filtering cards rather than boards, every
      partner-facing "Won" now "Qualified", the account button, and the honest
      "Qualified, no account yet" state. New EN+AR keys throughout; every
      existing English value left byte-identical and marked `@deprecated`.
  (4) DOCS: ADR-059, this entry, the changelog in his voice, IMPLEMENTATION
      notes on the four traps, TESTING Run 061.
  (5) THE REVIEW ROUND (folded back into the four commits above, not a fifth):
      fourteen reviewer findings adjudicated against the code and the schema.
      Six real ones fixed: the ONE board judged every drop with the PARTNER
      config, so an agent dragged into Qualified opened a modal with no fields
      in it (PP-6 says a pure move); the To-Do filtered Didn't Answer out by
      COLUMN while the engine offers "Record a follow-up" there, so the record
      went nowhere (SPEC §7.2c wins); a follow-up recorded on a meeting card
      took the MEETING off the To-Do and off the card; `importBackup`'s
      TypeScript twin bumped `@updatedAt` where the SQL does not, which would
      strand a restored card's pending undo on a 409 for ever and re-sort the
      board; a qualified PARTNER with no login was indistinguishable from one
      with an account; and the stage-token guard scanned the FILE rather than
      the `[data-brand]` scope — the exact blind spot the accounting-green guard
      beside it was rewritten to close. Two dead/stale artefacts removed
      (`SAME_STAGE_FORM_SLOT`, four schema and service comments naming the
      deleted `won_agent` gate). One refuted: widening the migration's stranding
      guard to every card the statements moved would destroy its documented
      idempotence. Five new regression tests, and two of the fixes were
      mutation-proved (narrow the migration predicate → the new fixture fails;
      restore the Prisma `updateMany` → the parity test fails on
      `fingerprintValid`).
- Verification: tsc clean; vitest 361/361; Playwright 71 passed / 2 skipped /
  0 failed with `.last-run.json` green; brand audit PASS (no hardcoded colours
  or fonts, no new class or string, 44 stage tokens IN SCOPE in all three of
  byteforce + b-systems + neutral, Waiting among them, plus the Tailwind bridge
  and the `[data-stage-key]` binding). The migration was PROVED TWICE on a
  throwaway database — once for Run 061 and again for the review round: schema
  deployed WITHOUT the new folder, production-shaped rows written in the retired
  vocabulary, then the real `prisma migrate deploy`, then a second deploy and a
  raw re-execution for idempotence (Run 062 has the before/after counts).
- In progress: nothing mid-flight; tree clean, four commits LOCAL and unpushed.
- Next steps: `/phase-gate` on a known-green baseline, then push.
- Blockers: none.
- Needs founder confirmation:
  (1) QUALIFIED IS STILL TERMINAL (SPEC §11 A-14). A card qualified by mistake
      can only be walked back inside Undo's 10-minute window, or deleted. That
      mattered less when qualifying minted an account; now that it costs
      nothing, mis-qualifying is cheaper to do and just as hard to undo.
  (2) THE WAITING COLOUR is DERIVED, not chosen: the arithmetic RGB midpoint of
      Meeting Setting and Qualified in each brand, per the rule
      DESIGN-APPLICATION-SPEC §1.3 already applies to Negotiation. On the
      B-Systems ramp that lands it close to the Sending Proposals hue — a
      different board, never the same page, but his eye should confirm it.
  (3) `lead` IS NOW OFFERED AS A NEXT ACTION in the panel, not only reachable by
      dragging a card back. It falls out of "the action set is the column set",
      which is what makes Waiting leave in both directions by construction.
  (4) A PARTNER'S LOGIN moved to the same explicit button as the agent's, because
      the Qualified gate no longer carries a password. A partner who converts
      today therefore has no account until someone presses it — deliberate, and
      the state is labelled on the card, but it is a change in what "converted"
      hands him.

## Entry 055 — 2026-08-22 — Five founder asks: roster lock, campaigns cost line, B-Systems dept, the phone module bar, the real app icon
- Done:
  - ADR-060 (all five asks in one decision — they share one constants file
    and one design). Four commits, each type-checked and tested on its own:
  - (3.2) The expense row's "Edit in roster" shortcut is REMOVED — a salary
    can never be edited from the expenses screen. The Payroll Roster page
    (module nav) is the only place a salary changes; the row keeps the ✓
    approval, the ADR-058 "Adjust this month only" override, and the
    `from roster` badge now carries a hint (new key `fromRosterHint`, EN +
    real Arabic) saying where the salary lives — delivered twice after
    review: as the badge's title (hover, desktop) AND as visible text
    appended to the adjust modal's banner, because a title tooltip never
    shows on touch. Dead keys `editInRoster` / `editInRosterHint` deleted
    WITH the affordance — not a reword; every surviving English string is
    byte-identical (e2e-asserted; `adjustBanner` itself untouched — the
    pointer is a separate appended sentence).
  - (3.3) New expense type `media_campaign` — "Media Buying / Campaigns" /
    "شراء الإعلانات / الحملات": an ordinary cost against profit, BOTH
    companies (the strict-equality media gates were left untouched and are
    now pinned by tests). Constants-only: engine, dropdowns, P&L, Zod and
    reports all pick it up. Round trip over the founder's REAL books passes
    unedited — no historical number moved.
  - (3.4/3.5) `bsystems` department — "B-Systems" both languages (brand
    names stay untranslated). ONE change serving both of his items: the
    expense modal's "— Overhead —" select, the roster's Department select,
    the income modal and the departments report all render from ACCT_DEPTS.
    Bonus fix (called out in the ADR): the income modal no longer lists
    "Other" twice.
  - (4.1) The module bar: ≤820px the rigid header switcher leaves the header
    and a full-width 1fr-cell bar renders under it in all four shells — one
    tap, ≥44px targets, current module inverted, cannot overflow any width
    (the strip was overflowing +44px at 601px — BUG-010's band moved when
    ADR-054 added the fourth segment). Sheet switchers re-grounded (they
    inherited the indigo header's white ink onto the white sheet) and
    tap-sized — after review, ≥44px in BOTH axes (the EN toggle segment was
    ~35px wide), and both e2e tap-size loops pin width as well as height.
    Also after review: below ~340px the longest bar labels outgrow a 1fr
    cell — the cut is now a visible ellipsis (the label rides in its own
    span because text-overflow never applies to a grid container), asserted
    by a new 320px module-bar test. qa-sweep permanently samples 601px.
    Desktop untouched; single-entity users get no bar.
  - (4.2) The install identity: (home)/icon.svg now embeds the OFFICIAL
    B-Systems mark (placeholder gone), plus root apple-icon.png and
    manifest.ts ("B-Systems", real-mark PNGs incl. maskable). Proven on the
    built app (e2e/app-icon.spec.ts) that root metadata injects without a
    root layout. All other group icons untouched.
  - Review fold (same session, before push): three reviewer findings — all
    low, all real — fixed inside these same commits: (1) bar labels ellipsize
    below ~340px instead of clipping silently, (2) sheet switcher segments
    are ≥44px in both axes and the tests pin width too, (3) the roster
    pointer is visible text in the adjust modal, not only a hover title.
  - Gate discovery (Run 064): the full suite exposed a latent AIM bug in
    board-touch's grip-drag test — dnd-kit's edge auto-scroll slides the
    board under a held finger, so a PRE-drag drop coordinate landed one
    stage too far once accounting.spec (heavier this batch) warmed the run.
    Product correct; test re-aims at the LIVE column and pins the modal
    eyebrow's stage (IMPLEMENTATION has the full mechanism).
  - Docs: ADR-060, TESTING Runs 063–064, IMPLEMENTATION (seven traps + the
    auto-scroll aim note), CHANGELOG.
- In progress: nothing — the tree is clean; the four commits (review fold
  included) pushed to origin/main after the Run 064 full-tree gate.
- Next steps: founder to see the confirmation items below; consider
  re-typing his two real campaign expenses (his call).
- Blockers: none. (Port note: another workstream held 3100 mid-session; the
  app-icon e2e ran on a deleted COPY of the config at 3200 — no process was
  killed.)
- Needs founder confirmation: (1) the B-Systems DEPARTMENT sits beside the
  B-Systems COMPANY filter — confirm he means a service line, not the
  company scope. (2) whether to re-type his two existing campaign expenses
  from "Media Spend (pass-through)" to "Media Buying / Campaigns" (no number
  moves either way). (3) iOS saves made inside ByteForce also carry the
  B-Systems mark (4.2 as written; flag only if he objects). (4) old-app
  exports are one-way once the new ids are in use: identical totals there,
  but raw-id labels and no departments-report line for bsystems-tagged rows.

## Entry 056 — 2026-08-23 — Three founder asks: date-only follow-ups, the Today chip, the Today-only To-Do
- Done:
  - (1) "remove the time of the follow up just the date" — every follow-up
    form lost its time input (ByteForce LeadEventPanel + board modal,
    B-Systems roleForms for all four roles, the prospect panel, the portal
    group forms), and every surface that printed a follow-up due date with a
    clock is date-only now: both boards' key datums (Next/Response), the
    stage records (GroupHistory → lead details + call sheet), the prospect
    card line, and the To-Do rows. NO schema change: dueAt stays a UTC
    instant, absent time defaults to 09:00 Cairo server-side (the V2 §3
    agent convention, now universal; `followUpSchema.time` stays optional so
    the API keeps accepting it). Meetings untouched — every meeting/
    reschedule time input and display keeps its time. Four `followUpTime`
    dict keys are now unreferenced and KEPT with comments (house convention;
    EN strings byte-identical).
  - (2) The Today chip — "a little filter in top of the follow up column":
    both lead boards' Following Up column heads carry a token-styled
    aria-pressed toggle ("Today · N", real Arabic "اليوم"), counting the
    cards whose latest follow-up falls on today's CAIRO day (new pure
    `sameCairoDay` helper; never local-time parts). Client-side over loaded
    cards, default OFF, plays with column scroll, drag-drop (the droppable
    is still the whole column) and the FilterPanel. Prospect board: no chip
    (no follow-up column since ADR-059). e2e: toggle on/off, count
    agreement, overdue card disappears/reappears, Arabic RTL pass.
  - (3) shipped in the following commit this same session: the To-Do goes
    Today-only (no Overdue section) and drops the partner/agent pipeline
    rows at the SERVICE (`prospect_follow_up` / `prospect_meeting` gone);
    statements and milestones stay with due-before-end-of-today semantics —
    a payment expected yesterday still shows TODAY.
  - Docs: ADR-061, this entry, CHANGELOG, IMPLEMENTATION (the follow-up-vs-
    meeting time-input distinction), TESTING Runs 065–066.
- In progress: nothing — three commits, tree clean, not pushed (founder
  pushes after his own look, as agreed).
- Next steps: founder to review the confirmation items below.
- Blockers: none.
- Needs founder confirmation: (1) **Overdue items are now INVISIBLE on the
  To-Do** — by his instruction ("remove all the overdue section"), an
  overdue follow-up/meeting no longer appears there at all (it still shows
  on the board cards); this supersedes the earlier remain-visible-until-
  completed principle for overdue items. Statements/milestones expected
  before today still show under Today so money never vanishes — confirm
  both halves. Same reading on the board: while the Today chip is PRESSED,
  the Following Up column hides overdue follow-ups too (the label means
  literally today; default-off keeps them visible) — confirm this reading,
  or the chip grows to include overdue. Carried from Entry 055: (2) the B-Systems DEPARTMENT sits
  beside the B-Systems COMPANY filter — confirm he means a service line,
  not the company scope. (3) whether to re-type his two existing campaign
  expenses from "Media Spend (pass-through)" to "Media Buying / Campaigns"
  (no number moves either way). (4) iOS saves made inside ByteForce also
  carry the B-Systems mark (4.2 as written; flag only if he objects).
  (5) old-app exports are one-way once the new ids are in use: identical
  totals there, but raw-id labels and no departments-report line for
  bsystems-tagged rows.

## Entry 057 — 2026-08-23 — Founder 2.2/2.3: the To-Do learns to be checked off
- Done:
  - Founder items 2.2 (link CRM stages with To-Do tasks) and 2.3 (manual
    task completion), on top of the Today-only shape ADR-061 just shipped.
    Three commits, local only (not pushed):
  - (1) `8c894e9` — the STATE: `TodoDone` (one row per manually-checked
    task, keyed to the UNDERLYING record via four unique cascade FKs, dueAt
    snapshot, completer id + label), a real migration
    `20260823071649_todo_done` proved on a throwaway Postgres (from-scratch
    deploy + idempotent re-deploy), the `setTodoDone` service (liveness
    walls: only a live task in today's Cairo window is checkable; uncheck
    deletes — the checkbox is its own undo), two brand-partitioned routes
    re-deriving access from the record (`requireLeadAccess` / admin-only
    money kinds; prospect-parented records 404 per ADR-061), backup MODELS +
    db-reset registration, 17 new integration cases.
  - (2) `01dbf41` — the PROJECTION + UI: `todoFor` items carry `recordId`;
    manual marks subtract from Today (valid for the Cairo day they were
    made — a checked-but-pending statement/milestone RETURNS tomorrow,
    money never vanishes); a derived Done section (moved / superseded /
    meeting outcome / paid / milestone completed; auto beats manual and is
    not restorable; manual unchecks back to Today); the checkbox first in
    every row for every role in both apps (native input, string-free client
    component, pre-translated aria); 13 new i18n keys with real Arabic,
    existing EN byte-identical; e2e todo-done.spec (check, uncheck,
    auto-done via the board's drag event, agent role + 403 walls).
  - (3) docs: ADR-062, SPEC §5.8 + §13 clause, CHANGELOG in the founder's
    voice, IMPLEMENTATION note on the identity trap, TESTING Runs 068–070
    (070 is the ship gate: tsc clean, 408 vitest, 85 e2e + 2 skips with
    `.last-run.json` "passed", the migration re-proved 14/14 from scratch and
    idempotent on a throwaway Postgres, brand audit PASS).
  - Review round folded into the same three commits (no new ADR — the shape
    held, four edges did not): **auth before the record lookup** on both done
    routes (an anonymous POST was getting 404 vs 401 and could tell a real
    record id from a made-up one — `requireUser` now runs first, with
    `requireLeadAccess(leadId, user)` and a new `assertRole` so the money
    branch keeps one session round-trip); **the checkbox survives a dead
    network** (a rejected fetch was leaving the row's control disabled with no
    message — try/catch/finally); **the Done section says "Completed today"**
    on the page instead of only in the ADR; **a delayed meeting is documented
    as a MOVED task, not a completed one** (SPEC §5.8); and **§13's scope-wall
    clause is now backed by real tests** — a new
    `todo-done-routes.integration.test.ts` drives the actual route handlers
    with only the session stubbed. Found on the way and filed, not fixed:
    BUG-013 (undoing a T-7 delayed reschedule leaves `outcome: "delayed"` —
    pre-existing, lives in the undo snapshot's ref ordering).
- In progress: nothing — tree clean, three commits, pushed after the gate.
- Next steps: founder to review the confirmation items; BUG-013 when the undo
  system is next opened.
- Blockers: none.
- Needs founder confirmation: (1) NEW — a follow-up DUE TODAY whose lead
  moved stage on an EARLIER day lists under today's Done as "Moved to
  {stage}" (the Done window keys on the task's due date; the alternative —
  filtering by when the move happened — needs history scans). Confirm this
  reading. (2) NEW — meaning of the checkbox on MONEY rows: checking a
  statement/milestone hides it for TODAY ONLY and it returns tomorrow while
  still pending (deliberate — money never vanishes; the real completion is
  Mark paid / the milestone check). Confirm that is the wanted behaviour.
  (3) NEW — a meeting DELAYED to another day leaves today's To-Do with NO
  Done row (it is a moved task; it comes back to Today on its new date).
  Giving it a "Meeting delayed" Done row would mean snapshotting the
  pre-reschedule instant — a schema column — so it waits on his word.
  Carried from Entry 056: (4) overdue items invisible on the To-Do +
  the pressed Today chip hiding overdue follow-ups — confirm both readings.
  Carried from Entry 055: (5) the B-Systems DEPARTMENT beside the B-Systems
  COMPANY filter — confirm he means a service line. (6) re-typing the two
  campaign expenses to "Media Buying / Campaigns" (no number moves).
  (7) iOS saves inside ByteForce carry the B-Systems mark. (8) old-app
  exports one-way once the new accounting ids are in use.

## Entry 058 — 2026-08-25 — The follow-up time comes back, optional — and the app learns to tell chosen from default
- Done:
  - One founder request, verbatim: *"let's get the time back for the follow
    up but it's not mandtory"*. A REFINEMENT of ADR-061 (three days old),
    not a revert: the day-only default stays the norm, the time becomes an
    available extra. Two commits, both carrying the review fixes of (4) below:
  - (1) `8ed1119` — the MARKER and the SERVER: `FollowUp.dueTimeSet Boolean
    @default(false)` (a boolean, not a second copy of the wall clock —
    `dueAt` stays the single source of the instant), written from the wire by
    `followUpDueTimeSet` in groups.ts and stamped in `persistGroup`; the real
    migration `20260825093000_follow_up_due_time_set` with its backfill,
    proved on a THROWAWAY Postgres over real legacy rows (rewound to the
    pre-migration state, 5 rows planted across both sides of Egypt's DST →
    3 marked chosen / 2 left as days; re-run twice unchanged; `migrate diff`
    "No difference detected"); the same rule twinned into `importBackup`
    (`backfillFollowUpDueTimeSet`) so restoring a pre-marker backup cannot
    flatten legacy times, with a parity test that runs the shipped migration
    SQL and the twin against identical fixtures; 9 new integration cases + 3
    unit cases.
  - (2) this entry's own commit — the FORMS and the DISPLAY: the optional time input back
    on all four follow-up forms (internal LeadEventPanel, bsystems roleForms
    including the light agent/partner variants, partners ProspectEventPanel,
    portal groupForms) — no `required`, beside the date in the meeting forms'
    two-column grid, labelled with the house's existing optional idiom via
    `optionalLabel(locale, followUpTime)` so ADR-061's four surviving
    `followUpTime` keys are RE-referenced (English byte-identical) instead of
    duplicated; one new Msg `optionalSuffix` ("(optional)" / "(اختياري)").
    Every payload builder omits the key when the box is blank. Every
    follow-up display went conditional — `todo.ts` `withTime` is per row on
    Today AND Done, plus `formatCairo(dueAt, dueTimeSet)` on the B-Systems
    board (Next + the negotiation Response datum), the ByteForce board, the
    prospect card and `GroupHistory` (the one line behind lead detail,
    prospect detail and the call sheet). Meetings untouched. New
    `e2e/follow-up-time.spec.ts` (blank ⇒ date / chosen ⇒ clock on records +
    board + To-Do; 23:45 still belongs to today; an Arabic pass), and the
    three ADR-061 "no time input" assertions flipped to "optional input
    present, not required".
  - (3) docs: ADR-063 (the marker, the backfill rule and its one false
    negative, the alternatives), CHANGELOG in the founder's voice,
    IMPLEMENTATION note on the omit-the-key-when-blank trap (met from the
    opposite direction to ADR-061's) and the Cairo-wall-clock SQL,
    TESTING Run 071 (tsc clean, 420 vitest, 88 e2e + 2 skips with
    `.last-run.json` "passed", the migration proof with before/after counts).
  - (4) REVIEW ROUND before the push — five findings adjudicated against the
    code and the schema, four fixed, one refuted-as-stated-but-documented, all
    folded into the two commits above (no third commit for the fixes):
    - **The restore could invent a clock (medium, FIXED).** `importBackup` ran
      the ADR-063 backfill unconditionally, so it also rewrote rows from a
      POST-marker export that legitimately carry `dueTimeSet = false`. Proved
      red first with a new round-trip test (a date-only row at 10:00 Cairo came
      back `true`), then gated on the payload's era —
      `predatesFollowUpDueTimeSet(rows)`, since a pre-marker export has no such
      key at all. Two new integration cases: the post-marker round-trip stays
      untouched, the pre-marker export is still backfilled.
    - **The seed broke the backfill's own invariant (low, FIXED).** Four demo
      follow-ups sat at 10:00–13:00 Cairo with no marker — the state the rule
      calls impossible, and the reachable population that made the bug above
      visible. Three now say `dueTimeSet: true`; the fourth moved to 09:00
      Cairo and stays unmarked, so the demo has one example of each shape.
    - **Four stale i18n comments (low, FIXED).** The `followUpTime` keys still
      read "UNREFERENCED since ADR-061"; ADR-063 re-references all four through
      `optionalLabel()`. Comments replaced in auth/crm/internal/partners dicts —
      strings untouched, English still byte-identical. (`todo.ts`'s two
      genuinely-unreferenced keys keep their notes.)
    - **The blind-twin doc comment (medium, same fix).** "Rows already marked
      are never touched, so this is safe to run on any database" was true only
      of rows marked TRUE. Corrected in place.
    - **The spring-forward hour-shift (low, REFUTED as a defect, DOCUMENTED).**
      A posted 00:30 on 2026-04-24 prints as 01:30 — but that wall clock does
      not exist that night, and no instant both keeps the posted DAY and shows
      00:30. Re-measured over every 2026 transition: 45 date×time cases, 45
      keep their day, 3 clocks move (all the non-existent midnight hour).
      Accepted as an ADR-063 consequence and noted beside the nudge in
      groups.ts; no behaviour change.
  - FINAL GATE on the shipped tree (TESTING Run 072): `npx tsc --noEmit`
    clean; `npx vitest run` **32 files / 422 passed** (+2 for the new backup
    round-trip cases); the FULL Playwright suite **88 passed + 2 skipped / 0
    failed** in 11.9m with `test-results/.last-run.json` read directly as
    `{"status":"passed","failedTests":[]}` (3100 was held by the
    `D:\Healthcare App` server again, so the config was copied to port 3111
    and the copy deleted); and a MIGRATION RE-PROOF on a throwaway Postgres —
    16 checks, 0 failures: 15/15 from empty, "No pending migrations" on the
    second deploy, then rewound and re-deployed over planted legacy rows so
    the backfill was watched classifying **14:30 → time-set and 09:00 →
    date-only in BOTH August (UTC+3) and January (UTC+2)**, idempotent on a
    hand-replay (`UPDATE` matched 0 rows).
  - Brand audit over the changed UI (roleForms, LeadEventPanel,
    ProspectEventPanel, portal groupForms, GroupHistory, internal/pages,
    partners/pages, b-systems crm page): **PASS** — no hex/`font-family`/`rgb()`
    in any added line, no new CSS custom property (so the all-three-scopes law
    is not triggered), inputs use the shared `field-input`/`field-label`
    classes, no physical left/right utilities added (RTL, A-12), no `data-brand`
    touched, zero emoji in 521 added lines.
- In progress: nothing — tree clean, two commits, pushed after the gate below.
- Next steps: founder to confirm the backfill reading below.
- Blockers: none.
- Needs founder confirmation: (1) NEW — THE BACKFILL'S ONE FALSE NEGATIVE.
  Old follow-ups get their times back by the rule "any stored instant that is
  not 09:00 on the Cairo clock was really chosen" — true for every row written
  while the form demanded a time. The cost: a follow-up where someone
  DELIBERATELY typed 09:00 before ADR-061 now shows as a date only, because
  09:00 is also the slot the system fills in when nobody chooses. It errs
  toward showing less rather than inventing a time; confirm that is the
  trade he wants (the alternative needs history scans and still guesses).
  Carried from Entry 057: (2) a follow-up DUE TODAY whose lead moved stage on
  an EARLIER day lists under today's Done as "Moved to {stage}". (3) the
  checkbox on MONEY rows hides for TODAY only. (4) a meeting DELAYED to
  another day leaves today's To-Do with NO Done row. Carried from Entry 056:
  (5) overdue items invisible on the To-Do + the pressed Today chip hiding
  overdue follow-ups. Carried from Entry 055: (6) the B-Systems DEPARTMENT
  beside the B-Systems COMPANY filter. (7) re-typing the two campaign
  expenses to "Media Buying / Campaigns". (8) iOS saves inside ByteForce
  carry the B-Systems mark. (9) old-app exports one-way once the new
  accounting ids are in use.
