# Test log — append-only

Every test round is recorded here (format: `project-logging` skill; write via `/log-test`
or the `qa-runner` subagent). Coverage obligations: every SPEC §10 row (T-*/PP-*/P-*),
every dashboard formula, journeys 1-5 (SPEC §13).

## Run 001 — 2026-08-08 — Stack initialization smoke
- Suites/commands: `npm run build` (Next 16 production build) · `npm run typecheck`
  (tsc --noEmit) · `npx prisma generate` · `npm test` (vitest: `src/lib/brand-tokens.test.ts`)
- Cases: 4 passed / 0 failed / 0 skipped (plus build, typecheck, prisma generate all green)
- Failures: one transient — the ADR-001 guard initially flagged `#4B3B9C` inside the
  token file's own header *comment*; fixed in the same session by stripping CSS comments
  before asserting (test now checks values only). Not filed as a bug (test defect, never
  committed red).
- SPEC coverage touched: §4 token contract (palette presence, `[data-brand]` scoping,
  ADR-001 guard). No §10 rows yet — engine lands in Phase 0 proper.
- Verdict: PASS — stack boots, typechecks, generates, and the brand-token guard is green.

## Run 002 — 2026-08-08 — Post-verification fix round
- Suites/commands: `npm run build` (after root-layout restructure into route groups) ·
  `npm run typecheck` · `npm test` (vitest)
- Cases: 5 passed / 0 failed / 0 skipped — includes the new ADR-019 guard asserting
  both brand token files expose the identical semantic variable set
- Failures: none
- SPEC coverage touched: §4.1 (data-brand root-layout structure builds), §4 token
  contract. No §10 rows yet — engine lands in Phase 0 proper.
- Verdict: PASS — all 21 verification-workflow findings fixed with the suite green.

## Run 003 — 2026-08-08 — Phase 0 foundation suite + boot/auth smoke
- Suites/commands: `npm test` (vitest: engine transition suite + brand-token guard) ·
  `npm run typecheck` · `npm run build` · `npx prisma db seed` (after fixing a
  corrupted .env — see IMPLEMENTATION.md) · production-server smoke via curl.
- Cases: 32 passed / 0 failed / 0 skipped (27 engine + 5 token-guard). Smoke: all
  public routes 200; `data-brand` correct per route group; unauthenticated /byteforce
  → 307 to /byteforce/login; credentials login round-trip (CSRF → POST → session)
  renders the seeded user's name; a byteforce_staff session hitting /b-systems is
  redirected to /b-systems/login (role isolation).
- Failures: none.
- SPEC coverage touched: EVERY §10 row at engine level — T-1…T-10, PP-1…PP-4
  (+ PP-2 illegal case), P-1…P-6 (P-2 across drag/action/destination/admin_won paths);
  illegal moves (terminal stages, drag on internal per A-7, invalid destinations).
  PP-5 (attribution) and P-7/P-8 (milestones) are service-level — integration tests
  land with Phases 2 and 4 respectively. §3 role isolation smoke-verified.
- Verdict: PASS — Phase 0 foundation green.

## Run 004 — 2026-08-08 — Phase 0 gate fixes (brand audit + spec-guardian)
- Suites/commands: `npm test` · `npm run typecheck` · `npm run build` after fixing
  the brand-auditor's 5 findings (literal fallbacks out of globals.css; neutral shell
  styling moved to src/themes/neutral.css; mesh scoped off the landing tagline) and
  the spec-guardian's 4 (ADR-020 terminal-wins; ADR-021 trigger convention applied
  to partners/portal meeting outcomes; admin attended→Won now logs P-6; T-8
  cancelled→Lost and cancelled-without-destination branches added).
- Cases: 32 passed / 0 failed / 0 skipped (assertion count grew inside existing
  cases; both audit re-checks clean).
- Failures: none.
- SPEC coverage touched: T-8 full branch coverage; ADR-021 trigger ids asserted for
  partners (PP-3) and portal (P-3/P-5/P-6) outcomes.
- Verdict: PASS — both gate auditors' findings closed.

## Run 005 — 2026-08-09 — Phase 1 App A suite + E2E journeys 1–2
- Suites/commands: `npm run typecheck` · `npm run build` (all App A routes register) ·
  `npm test` (vitest: engine 27 + token guard 5 + service integration 10 = 42) ·
  `npx playwright test` (journeys 1–2 against a dedicated seeded e2e.db, serial).
- Cases: vitest 42 passed / 0 failed. Playwright 2 passed / 0 failed:
  journey 1 (add rep → add lead → T-1 follow-up → T-2 meeting → T-6 attended→proposal
  → T-5 sent→auto follow-up with "Following up after proposal" → T-9 Won with
  prefilled estimate → A-1 client card with mapped values → §6.5 dashboard numbers
  exact on fresh DB) and journey 2 (T-4 lost with required reason → dashboard deltas).
- Failures: one transient in journey 1 (an over-narrow Playwright locator on the
  clients page — fixed to page-level assertions; the product behavior was correct).
- SPEC coverage touched: §6.1–§6.5 end-to-end; §10.1 T-1…T-10 at unit + integration +
  E2E levels; §13 journeys 1 and 2 PASS.
- Verdict: PASS.

## Run 006 — 2026-08-09 — Phase 1 gate fixes (brand audit + spec-guardian)
- Suites/commands: `npm run typecheck` · `npx vitest run` · `npx playwright test`
  after fixing brand-audit findings (on-success/on-danger/on-accent added to the
  semantic contract in BOTH token files + @theme map; StageBadge/portal CTAs use
  them; font-brand-mono in HistoryPanel; RTL-safe back links and mirrored arrow) and
  spec-guardian findings (UI stage/action/destination lists now derived from
  internalCrmConfig; to-be-collected unclamped in both paths (ADR-024); in-transaction
  stage guard against racing submits; ADR-022/023 sanction the additive columns and
  the two-step Sent flow).
- Cases: vitest 42/0 · Playwright journeys 2/0.
- Failures: none.
- SPEC coverage touched: §4 contract (token set-equality test now covers the three
  new names automatically), §5.1 single-source stage sets, §6.4/A-1 formula.
- Verdict: PASS — both Phase 1 auditors' findings closed.

## Run 007 — 2026-08-09 — Phase 2 App B suite + E2E journey 3
- Suites/commands: `npm run typecheck` · `npm run build` (all /b-systems +
  /api/b-systems + /api/files routes register; middleware migrated to Next 16's
  proxy.ts convention) · `npx vitest run` (50: engine 27 + tokens 5 + leads
  integration 10 + partners integration 8) · `npx playwright test` (journeys 1–3).
- Cases: vitest 50 passed / 0 failed. Playwright 3 passed / 0 failed — journey 3
  covers: prospect with playable mp3 recording → PP-1 Didn't Answer → Number 2 saved
  → PP-2 auto-return (history [PP-2] visible) → meeting → attended→Won gate blocks
  on missing Key person role/Address → complete gate → Won + Converted badge (A-5) →
  Partner in directory with Date joined → partner lead added (PP-5) → next action →
  CRM card bears "Partner: Fawzy Logistics" → live stage in the partner's table.
- Failures: one flaky first-run timeout in journey 3 (dev-server first-compile of
  the new partners routes; passed on re-run and in the final serial suite).
- SPEC coverage touched: §7.2–§7.4 end-to-end; §10.2 PP-1…PP-5 at unit +
  integration + E2E; §15 upload rules (type/size/content-sniff, authenticated
  serving with Range support); §13 journey 3 PASS.
- Verdict: PASS.

## Run 008 — 2026-08-09 — Phase 2 gate fixes (brand audit + spec-guardian)
- Suites/commands: typecheck · `npx vitest run` · `npx playwright test` after:
  spec-guardian's fix (PP-2's normative History phrase "Returned to Lead — new
  number added" now rendered by the History panel via a trigger→phrase map; stale-
  stage 409 guard added to updateProspect) and brand-audit's fixes (NEW semantic
  tokens `--color-heading`/`--color-link` in both brand files — violet in ByteForce,
  Indigo in B-Systems — replacing the text-brand-secondary misuse that rendered
  lavender-on-Paper headings/nav/links across App B; StatCard label → meta layer,
  KPI value → body-bold per §4.3; hand-rolled caps → text-brand-meta; hover accent
  unified to primary; spec-reference leaks stripped from UI copy).
- Cases: vitest 50/0 · Playwright 3/0 (journeys 1–3).
- Failures: none.
- SPEC coverage touched: §4.3 typography/color mapping on shared components (both
  brands re-verified); §7.2 PP-2 user-visible wording; ADR-019 contract grew two
  names (set-equality test enforces both files).
- Verdict: PASS — both Phase 2 auditors' findings closed.

## Run 009 — 2026-08-09 — Phase 3 portal rep suite + E2E journey 4
- Suites/commands: `npm run build` (portal routes register) · `npx vitest run`
  (57: +7 portal integration) · `npx playwright test` (journeys 1–4, serial).
- Cases: vitest 57 passed / 0 failed. Playwright 4 passed / 0 failed — journey 4
  covers: seeded rep's fixture deal → sign up with CV (validated pdf) → phone
  login (ADR-008) → rep isolation (other rep's deal invisible) → create deal →
  P-1 drag with the stage form (confirm commits) → cancel reverts a drop → P-2
  drag-to-Won blocked with the clear message in UI → **P-2 at API level: raw POST
  of a Won drag returns 403** (§13 obligation) → deal detail shows accumulated
  groups + [P-1] history.
- Failures: one selector bug in journey 4's first run (drag grabbed the card's
  inner link → navigation; fixed with a card-container test hook).
- SPEC coverage touched: §8.1–§8.4 end-to-end; §10.3 P-1…P-6 at unit/integration
  (P-2 all three vectors 403 + nothing moves; P-4 auto-move; P-6 WonDeal
  exactly-once; milestone REDACTION asserts locked values are null in the
  serializer output — P-7 read side; won-deals rep scoping); §15 CV rules.
- Verdict: PASS.

## Run 010 — 2026-08-09 — Phase 3 gate fixes (brand audit + spec-guardian)
- Suites/commands: typecheck · `npx vitest run` (57) · `npx playwright test` (4)
  after: spec-guardian fixes — sign-up now auto-signs the rep in per §8.1
  (ADR-025; journey 4 verifies the landing AND the explicit login), implicit
  portal follow-up owner ADR'd (ADR-026), `listDeals` hardened to require a
  non-null repId (§3 isolation defense-in-depth), and the 4th P-2 vector
  (attended→won as rep) added at the service layer; brand-audit fixes — dedicated
  btnAccent (conflicting utilities removed), DealBoard modal arrow RTL-mirrored,
  landing tagline off lavender-as-text.
- Cases: vitest 57/0 · Playwright 4/0. (vitest's intermittent "no tests"
  collection flake filed as BUG-001.)
- Failures: none.
- SPEC coverage touched: §8.1 landing, §10.3 P-2 (4th vector), §3 isolation.
- Verdict: PASS — both Phase 3 auditors' findings closed (brand audit was already
  PASS-with-findings).

## Run 011 — 2026-08-09 — Phase 4 admin suite + E2E journey 5 (FULL journey suite green)
- Suites/commands: `npm run build` · `npx vitest run` (61: +4 admin integration) ·
  `npx playwright test` — ALL FIVE §13 journeys pass serially.
- Cases: vitest 61/0. Playwright 5/0 — journey 5 covers: admin email login through
  the portal identifier field (ADR-016) → dashboard baseline → rep signs up + creates
  a deal in a SECOND live browser session → combined CRM with rep-labeled cards +
  per-rep filter → admin drags the deal into Won (P-6) → Won Deals management: values
  + 3 generated milestones (P-7) → rep's open page shows Milestone 1's value only,
  2 & 3 locked with values ABSENT from the payload → admin checks Milestone 1 (P-8)
  → the rep's page unlocks Milestone 2 LIVE via the ≤5s poll without a reload (the
  Phase 4 DoD's two-session verification) → Sales Team row exact → dashboard deltas
  exact.
- Failures during development: three journey-5 iterations (suite-order data coupling
  → made self-contained; controlled-checkbox .check() → .click()+toBeChecked;
  baseline read after fixture creation → reordered). Final suite clean.
- SPEC coverage touched: §8.5.1–§8.5.4 formulas at integration + E2E; P-6/P-7/P-8
  (incl. A-11 non-blocking warning, sequential order, uncheck-as-correction logged
  per ADR-020); §13 journeys 1–5 ALL PASS.
- Verdict: PASS.

## Run 012 — 2026-08-09 — Phase 4 gate fix (spec-guardian)
- Suites/commands: typecheck · `npx vitest run` (61) · `npx playwright test` (5)
  after the one required fix: **ownerPortalRepId is now server-stamped from
  `deal.repId` in applyDealEvent** (ADR-026/§3 — it had been client-supplied,
  letting a rep post an arbitrary owner id and leaving admin-initiated follow-ups
  ownerless); the client no longer sends any owner id. Brand audit was already a
  clean PASS (one info note on table-header typography, no action).
- Cases: vitest 61/0 · Playwright 5/0.
- Failures: none.
- SPEC coverage touched: §6.2 Owner semantics under ADR-026, §3 server-side
  enforcement.
- Verdict: PASS — Phase 4 auditors closed. Carried to Phase 5: rep-session 403
  route tests for /api/portal/admin/** (§15 "reps cannot touch milestones" proven),
  seed finalization incl. a won deal with milestones.

## Run 013 — 2026-08-09 — Phase 5 hardening: FULL suite (unit + integration + 12 E2E)
- Suites/commands: `npm run typecheck` · `npm run build` · `npx vitest run` (61) ·
  `npx playwright test` — 12 tests: journeys 1–5 + security-rbac (3) + qa-sweep (4).
- Cases: vitest 61/0 · Playwright 12/0. New suites this phase:
  **security-rbac** — rep→admin-route 403s (milestone check, won-deal values,
  milestone define — the §15 "reps cannot touch milestones" clause proven at the
  raw API), rep→foreign-deal 403 (PATCH + event, deal untouched), portal↔internal
  invisibility (page redirects + API 403s), cross-brand API 403.
  **qa-sweep** — every major screen, all four §15 viewports (1440/1024/768/390):
  zero console errors, ≤1px horizontal overflow, per role.
- Failures during development, all fixed: BUG-002 (dnd-kit hydration mismatch →
  stable DndContext id), BUG-003 (header nav overflow at 390px → flex-wrap), and
  two seed-collision test repairs (journey 1 dashboard → deltas; journey 5 manager
  interactions scoped to its card via data-won-deal).
- SPEC coverage touched: §15 security + responsive + console clauses; §13 seed
  fixture list final (verified by the suite running against it).
- Verdict: PASS — full suite green against the final seed.

## Run 014 — 2026-08-09 — V2 restructure verification (V2-P5): full suite
- Suites/commands: `npm run typecheck` (tsc clean) · `npm run build` (production
  build green; stage tokens verified in the emitted CSS) · `npx vitest run`
  (60, 5 files) · `npx playwright test` (12).
- Cases: vitest 60 passed / 0 failed · Playwright 12 passed / 0 failed /
  0 skipped. New this round: **bsystems.integration.test.ts** (12 V2 cases) —
  B-9 confirm-win creates WonDeal + ordered milestones; agent Won forbidden;
  won-lead delete blocked; B-RTC flag + broadcast notification idempotent;
  agent day-only follow-up defaults 09:00 Cairo; agent meeting request notifies
  admins with details; B-4 form-free proposal return for agents; commission
  visibility matrix (closer sees / sales never / locked milestones redacted);
  statements end-to-end (waiting → ST-0001 → pending payment → paid with PNG
  proof; PDF proof rejected; duplicate statement 409); PP-4 account
  provisioning with auto password; impersonation token mint/verify/tamper/
  expiry + deactivated refusal. Playwright: journeys 1–5 (incl. rewritten
  agent + admin-win cycles), security-rbac V2 walls, qa-sweep across all
  roles/viewports.
- Failures: none.
- SPEC coverage touched: V2 rows per docs/REQUIREMENTS-V2.md — B-4, B-9, B-RTC,
  PP-4 (account provisioning), commission visibility, statements,
  impersonation; §13 journeys 1–5 (3/4/5 rewritten for the unified /b-systems
  app) + security-rbac + qa-sweep.
- Verdict: PASS — V2 full suite green.

## Run 015 — 2026-08-09 — Design-system restyle verification (Claude Design handoff)
- Suites/commands: `npx vitest run` (60) · `npx playwright test` (12 — full
  suite re-run after the restyle) · brand-auditor audit.
- Cases: vitest 60 passed / 0 failed · Playwright 12 passed / 0 failed /
  0 skipped · brand-auditor PASS (findings: 1 low RTL padding — fixed;
  sanctioned billboard literals documented).
- Failures: none in the final run. Failures during the round, all fixed
  pre-commit: missing --color-on-accent in the ByteForce token file (caught
  by brand-tokens.test.ts); journey5 combined-text assertion vs the split
  money-tile markup; /b-systems 768px 2-px horizontal overflow (header .user
  flex-shrink).
- SPEC coverage touched: journeys 1–5 + security-rbac + qa-sweep (full
  Playwright suite); §15 responsive/clean-console clauses (768px overflow
  fix); ADR-019 token-contract guard.
- Verdict: PASS — restyle verified green.

## Run 016 — 2026-08-09 — Backup/restore + motion layer + root-redirect round
- Suites/commands: `npm run typecheck` (tsc clean) · `npx vitest run` (62 —
  incl. the new backup.integration.test.ts) · `npx playwright test` (12 —
  full suite with the motion layer, root redirect, and backup UI live).
- Cases: vitest 62 passed / 0 failed / 0 skipped · Playwright 12 passed /
  0 failed / 0 skipped.
- Failures: none.
- SPEC coverage touched: ADR-032 backup round-trip — new
  backup.integration.test.ts proves export → full wipe (db + files) →
  import restores rows, relations, ids, dates, and uploads and writes the
  backup_import log row; invalid-file rejection with nothing deleted. §13
  journeys 1–5 + security-rbac + qa-sweep re-verified with the motion
  layer, the `/` → /login redirect, and the admin backup controls live.
- Verdict: PASS.

## Run 017 — 2026-08-09 — Full suite on embedded PostgreSQL (ADR-033 switch)
- Suites/commands: `npm run typecheck` (tsc clean) · `npx vitest run` (62 —
  embedded Postgres on 5434, fresh per run) · `npx playwright test` (12 —
  embedded Postgres on 5435) · simulated container build: `next build` with
  an unreachable DATABASE_URL (DB-less production build) — green.
- Cases: vitest 62 passed / 0 failed / 0 skipped · Playwright 12 passed /
  0 failed / 0 skipped.
- Failures: none.
- SPEC coverage touched: §13 journeys 1–5 + security-rbac + qa-sweep — the
  full suite re-verified on PostgreSQL (ADR-033); ADR-032 backup
  Export/Import exercised as the SQLite→Postgres data path (16 leads +
  users crossed losslessly); vitest wall time ~6 s vs ~42 s on
  SQLite-on-Windows.
- Verdict: PASS.

## Run 018 — 2026-08-10 — Partner conversion credentials (PP-4 provisioning change)
- Suites/commands: `npm run typecheck` (tsc clean) · `npx vitest run` (64) ·
  `npx playwright test` (12 — full suite).
- Cases: vitest 64 passed / 0 failed / 0 skipped · Playwright 12 passed /
  0 failed / 0 skipped.
- Failures: none.
- SPEC coverage touched: PP-4 account provisioning under the founder's
  credential directive (PROGRESS Entry 015) — 2 new integration cases:
  (1) conversion provisions the partner's login with exactly the
  admin-entered email + password (role bsystems_partner, linked to the
  Partner record); (2) email-without-password is refused with nothing
  converted. No-email conversion without a login re-verified unchanged.
  §13 journeys 1–5 + security-rbac + qa-sweep re-run green with the new
  Won-gate Password field live.
- Verdict: PASS.

## Run 019 — 2026-08-10 — Founder V3 batch + dashboard animation round
- Suites/commands: `npm run typecheck` (tsc clean) · `npx vitest run` (71) ·
  `npx playwright test` (13 — full suite).
- Cases: vitest 71 passed / 0 failed / 0 skipped · Playwright 13 passed /
  0 failed / 0 skipped.
- Failures: none.
- SPEC coverage touched: 7 new vitest cases for the ADR-034 flows —
  snap-back impersonation tokens, the registration approval cycle service,
  and the won-deal math barriers. E2E: journey 4 reworked to the approval
  flow (request → admin approve → email-then-phone sign-in); security-rbac
  now approves via API; NEW impersonation journey added (13th spec);
  journey 1's KPI reads wait for the AnimatedValue count-up to settle.
  Full suite green on the new per-run embedded-Postgres data dirs +
  pid-derived ports.
- Verdict: PASS.

## Run 020 — 2026-08-11 — Partnership CRM founder V4 batch (drag board, admin edit/delete, alignment)
- Suites/commands: `npm run typecheck` (tsc clean) · `npm run build`
  (production build clean) · `npx vitest run` (83) · `npx playwright test`
  (full suite). Local dev, embedded Postgres (per-run instances).
- Cases: vitest 83 passed / 0 failed / 0 skipped · Playwright 16 passed /
  0 failed / 2 skipped (the two skips are the audit opt-in specs, by
  design).
- Failures: none in the final run. One test-side fix during stabilization
  (test defect, no bug filed): the new journey-3 spec's modal Save locator
  collided under Playwright strict mode with the page's "Save numbers"
  button — locator scoped to the modal.
- SPEC coverage touched: §10.2 PP rows via the NEW drag path (same trigger
  ids as actions, so the PP gates apply unchanged). 4 new
  partners.integration.test.ts cases: drag enforces the target stage's
  group (intake return to Lead form-free); drag into Won runs the PP-4
  completeness gate; deleteProspect full cascade incl. file deletion and
  attributed-lead survival; updatePartner partial edit + deletePartner
  attribution-nulling with the prospect kept in Won as history. 1 new E2E
  (journey3): "founder V4: partners board drag opens the stage form; edit +
  delete from detail" — drag Lead→Didn't Answer with a pre-checked number,
  drag back to Lead with no form, edit company name via modal, delete with
  confirm, card gone from the board.
- Verdict: PASS.

## Run 021 — 2026-08-11 — Uploads-durability incident fix (UPLOADS_DIR, missing-file states, proof replace)
- Suites/commands: `npm run typecheck` (tsc clean) · `npm run build`
  (production build clean; new benign Turbopack "dynamic filesystem
  access" warnings from the env-dependent uploads path — see the
  IMPLEMENTATION.md note) · `npx vitest run` (84) · `npx playwright test`
  (full suite). Local dev, embedded Postgres (per-run instances). Plus an
  18-agent adversarial review workflow (3 lenses × verify) over the
  incident fix.
- Cases: vitest 84 passed / 0 failed / 0 skipped · Playwright 16 passed /
  0 failed / 2 skipped (the two skips are the audit opt-in specs, by
  design).
- Failures: none in the automated suites (incident under test: BUG-004).
- SPEC coverage touched: storage/attachment layer and statements services
  (no §10 pipeline rows). 1 new integration test: lost-proof fileOk flag
  + replaceStatementProof swap + the paid-only guard.
  Adversarial-review CONFIRMED findings, all fixed in-round:
  /api/health filename leak → sample shows opaque storage keys only;
  orphaned NEW file when the replace transaction fails → cleanup catch
  deletes it; silently-broken recording players → "Recording file
  missing" fileOk badge on prospect detail; dead proof link on the
  closer Payments page → missing-file badge; printable statement
  document overclaiming "Payment proof on file" → line omitted when the
  blob is gone. One confirmed pre-existing tradeoff deliberately
  ACCEPTED, not fixed: public /api/health disclosure (IMPLEMENTATION.md
  note, Entry 018).
- Verdict: PASS.

## Run 022 — 2026-08-12 — Logo fixes round (statement-document mark, header home links)
- Suites/commands: `npm run typecheck` (tsc clean) · `npm run build`
  (production build clean) · `npx vitest run` (84) · `npx playwright
  test` (full suite). Local dev, embedded Postgres (per-run instances).
- Cases: vitest 84 passed / 0 failed / 0 skipped · Playwright 16 passed /
  0 failed / 2 skipped (the two skips are the audit opt-in specs, by
  design).
- Failures: none.
- SPEC coverage touched: none (UI-only branding/navigation round — real
  B-Systems mark on the printable statement document, header logos link
  to the current app's landing; no §10 pipeline rows).
- Verdict: PASS.

## Run 023 — 2026-08-12 — Per-lead team chat with @mentions (founder V5)
- Suites/commands: `npm run typecheck` (tsc clean) · `npm run build`
  (production build clean) · `npx vitest run` (92) · `npx playwright
  test` (full suite). Local dev, embedded Postgres (per-run instances).
  Plus a 26-agent adversarial review workflow (security / correctness-UX
  / consistency lenses) over the feature.
- Cases: vitest 92 passed / 0 failed / 0 skipped · Playwright 16 passed /
  0 failed / 2 skipped (the two skips are the audit opt-in specs, by
  design).
- Failures: none in the automated suites.
- SPEC coverage touched: no §10 pipeline rows — new comments/notifications
  surface (ADR-036). 8 new comments integration tests (mentionable sets
  per bucket incl. role-change drop-out, mention word-boundary cases,
  notification routing, cascade delete, zod body limits); the backup
  roundtrip now exercises leadComment; security-rbac e2e extended
  (cross-agent comment → 403); journey3 e2e extended (admin posts a
  mention, chip renders). Adversarial review CONFIRMED 17 findings — all
  fixed pre-ship except one deliberately ACCEPTED behavior (an unresolved
  @mention fails silently server-side and renders as plain text without a
  chip — IMPLEMENTATION.md note). The two HIGH UI findings fixed
  pre-ship: mention-suggestion popup clipped by the card's
  overflow:hidden (suggestions now render in-flow) and the newest message
  scrolled out of view (thread now auto-scrolls to the newest message).
- Verdict: PASS.

## Run 024 — 2026-08-12 — SSL audit round (scheme cleanliness + logout downgrade fix)
- Suites/commands: `npx vitest run` (92) · `npx playwright test` (full
  suite) — re-run green after the logout fix. Local dev, embedded
  Postgres (per-run instances). Plus a 3-agent audit workflow over the
  founder's production "Not secure" report: absolute-URLs lens,
  redirect-downgrade lens (incl. reading the installed Next 16.3 and
  next-auth 5 beta sources), badge-causes/hardening lens.
- Cases: vitest 92 passed / 0 failed / 0 skipped · Playwright 16 passed /
  0 failed / 2 skipped (the two skips are the audit opt-in specs, by
  design).
- Failures: none in the automated suites. Audit finding fixed in-round:
  BUG-005 — logout's signOut({redirectTo}) absolutized "/login" against
  the proxy-reported x-forwarded-proto, emitting an http:// Location
  behind a misreporting proxy (fixed in src/lib/auth/actions.ts, commit
  ce5ff36).
- SPEC coverage touched: none (no §10 pipeline rows — transport/auth
  posture audit). Audit conclusion: the app is scheme-clean — zero
  external scripts/fonts/CDN/analytics (mixed content impossible),
  every browser-loaded resource same-origin relative, no absolute-URL
  construction, empty next.config, middleware redirects relativized by
  Next itself. HSTS + http→https redirect deliberately DEFERRED
  (IMPLEMENTATION.md note).
- Verdict: PASS (code side; the "Not secure" badge itself is
  host/Cloudflare TLS configuration — founder action, Entry 021 (h)).

## Run 025 — 2026-08-13 — Full Arabic ⇄ English translation round (ADR-037)
- Suites/commands: `npm run typecheck` (tsc clean) · `npm run build`
  (production build clean) · `npx vitest run` (92) · `npx playwright
  test` (full suite incl. NEW e2e/i18n.spec.ts). Local dev, embedded
  Postgres (per-run instances).
- Cases: vitest 92 passed / 0 failed / 0 skipped · Playwright 17 passed /
  0 failed / 2 skipped (the two skips are the audit opt-in specs, by
  design).
- Failures: none.
- SPEC coverage touched: no §10 pipeline rows — presentation layer only
  (engine constants stay English in code, DB, and API payloads;
  translation happens at render, ADR-037). Because the EN output stayed
  byte-identical, the WHOLE pre-existing suite (unit + integration + e2e
  journeys 1–5) passed UNCHANGED — itself the regression proof for the
  string externalization. New coverage: e2e/i18n.spec.ts — toggle →
  <html dir="rtl" lang="ar"> + Arabic heading → Arabic login flow → back
  to EN from the app header.
- Verdict: PASS. Known limits logged (Entry 022 items (i)/(j)):
  server-side error strings remain English pending an error-code scheme;
  ByteForce thin-page metadata titles partly English; two Arabic
  terminology choices awaiting founder review.

## Run 026 — 2026-08-13 — Founder board-UX fixes round (card overflow, whole-card open, drag layering)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (92) ·
  `npx playwright test journey3 journey4 journey5 qa-sweep i18n`
  (targeted drag flows + responsive sweep + i18n) · `npx playwright
  test` (full suite). Local dev, embedded Postgres (per-run instances).
- Cases: vitest 92 passed / 0 failed / 0 skipped · Playwright targeted
  10 passed / 0 failed · Playwright full 17 passed / 0 failed / 2
  skipped (the two skips are the audit opt-in specs, by design).
- Failures: none in the final runs. One transient full-suite vitest
  startup failure ("Vitest failed to find the runner" / describe
  context undefined, all 8 files, zero tests collected) cleared on
  rerun with no code change — environmental, not reproducible, no bug
  filed.
- SPEC coverage touched: none (no §10 pipeline rows — presentation-only
  board card fixes: .bcard text clamp, whole-card click-through with a
  post-drag click guard, drag-origin column layering). Drag/commit
  behavior unchanged; EN rendered output byte-identical, so journeys
  3–5 passing unchanged is the regression proof.
- Verdict: PASS.

## Run 027 — 2026-08-13 — Founder board-UX round, part 2: Owner select empty in the board's stage forms (ADR-038)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (92) ·
  `npx playwright test` (full suite). Local dev, embedded Postgres
  (per-run instances).
- Cases: vitest 92 passed / 0 failed / 0 skipped · Playwright full 17
  passed / 0 failed / 2 skipped (the two skips are the audit opt-in
  specs, by design). Full e2e wall time 3.9m.
- Failures: none in the final runs. Two environmental notes: (1) Run
  026's "transient" vitest startup failure (runner not found, 8 files,
  zero tests collected) is now root-caused — it reproduces
  deterministically when vitest is launched from a lowercase
  drive-letter cwd (`d:/CRM`) and clears from `D:/CRM`; environmental
  (Windows path-casing in module resolution), not a code bug, no
  in-repo fix. (2) One Playwright attempt hung in global-setup — the
  embedded e2e Postgres finished initdb but the postmaster never
  started (no log, no postmaster.pid) and pg.start() polled forever;
  killed the run tree and reran clean. Matches the zombie-instance
  caveats already documented in scripts/local-postgres.ts; no bug
  filed.
- SPEC coverage touched: no §10 pipeline rows changed — a data-source
  fix for the Owner select in the V2 §3 admin/sales stage forms
  (ADR-038): listBsOwnerReps() auto-provisions bsystems SalesRep cards
  from active bsystems_sales accounts; all five bsystems Owner call
  sites switched. EN rendered output stayed byte-identical (the new
  option labels are DB data, not literals), so journeys 3–5 passing
  unchanged is the regression proof for the board/detail/partners
  forms.
- Verdict: PASS.

## Run 028 — 2026-08-14 — "Didn't answer" flag feature round (ADR-039)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (93 —
  one NEW integration test) · `npx playwright test` (full suite incl.
  NEW e2e/no-answer.spec.ts). Local dev, embedded Postgres (per-run
  instances).
- Cases: vitest 93 passed / 0 failed / 0 skipped · Playwright full 18
  passed / 0 failed / 2 skipped (the two skips are the audit opt-in
  specs, by design). Full e2e wall time 4.7m.
- Failures: none.
- SPEC coverage touched: none of the §10 rows change — the flag is
  deliberately outside the transition tables (ADR-039, mirrors
  ready_to_close V2 §3). New coverage: (unit) toggle persists on/off,
  both moves activity-logged (no_answer / no_answer_cleared, stages
  null), no notification, idempotent re-clear; (e2e) admin flags a
  New-column card → "No answer" badge on the card AND the lead detail
  header → clears it → badge gone, card never leaves its column; (e2e)
  an agent cannot toggle another agent's lead (403 — security-rbac
  extension, same wall as /ready). Existing EN strings byte-identical;
  the three new strings shipped as Msg {en, ar}.
- Verdict: PASS.

## Run 029 — 2026-08-14 — ByteForce board intake-column fix round (ADR-040)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (93) ·
  `npx playwright test` (full suite; journey1 extended with the
  New-column assertion). Local dev, embedded Postgres (per-run
  instances).
- Cases: vitest 93 passed / 0 failed / 0 skipped · Playwright full 18
  passed / 0 failed / 2 skipped (the two skips are the audit opt-in
  specs, by design). Full e2e wall time 3.9m.
- Failures: none. (One tsc round during development: Prisma's `in`
  filter rejects the readonly INTERNAL_STAGES tuple — fixed by
  spreading into a mutable array before any run was recorded.)
- SPEC coverage touched: §6.3's board definition changes under founder
  override (ADR-040) — display only, no §10 transition rows. journey1
  now proves a freshly added lead renders on /byteforce/crm (New
  column) BEFORE its first transition; the rest of journey1 passing
  unchanged shows the five original columns behave identically.
- Verdict: PASS.

## Run 030 — 2026-08-14 — No-answer auto-clear round (ADR-039 addendum)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (94 —
  one NEW integration test) · `npx playwright test` (full suite). Local
  dev, embedded Postgres (per-run instances).
- Cases: vitest 94 passed / 0 failed / 0 skipped · Playwright full 18
  passed / 0 failed / 2 skipped (the two skips are the audit opt-in
  specs, by design). Full e2e wall time 4.4m.
- Failures: none.
- SPEC coverage touched: no §10 rows change — the clear rides inside
  applyLeadEvent's existing transition transaction (same update as the
  stage write). New coverage: flagged lead + successful stage move →
  noAnswer false + exactly one "no_answer_cleared" activity row;
  moving an unflagged lead adds no cleared row (no noise).
- Verdict: PASS.

## Run 031 — 2026-08-14 — To-Do page round (ADR-041)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (98 —
  NEW todo.integration.test.ts, 4 tests) · `npx playwright test` (full
  suite incl. NEW e2e/todo.spec.ts). Local dev, embedded Postgres
  (per-run instances).
- Cases: vitest 98 passed / 0 failed / 0 skipped · Playwright full 19
  passed / 0 failed / 2 skipped (the two skips are the audit opt-in
  specs, by design). Full e2e wall time 4.0m.
- Failures: none.
- SPEC coverage touched: none of the §10 rows — a read-only projection
  (ADR-041). New coverage: (unit) Cairo-day windowing across the
  midnight boundary (early-Cairo-morning instant counts as today,
  yesterday as overdue, tomorrow excluded); latest-record-only
  selection (superseded follow-ups never resurface; leads that left the
  stage drop off); role scoping (agent own / sales internal / admin
  all); admin extras (live meeting + pending statement + open milestone
  today, completed milestones excluded, extras hidden from sales).
  (e2e) admin creates a lead, moves it to Following Up dated today via
  the API, sees the row on /b-systems/todo, clicks through to the lead.
- Verdict: PASS.

## Run 032 — 2026-08-14 — Leads-list filters + ordering round
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (100 —
  NEW lead-sort.test.ts, 2 pure unit tests) · `npx playwright test`
  (full suite; qa-sweep re-covers /b-systems/leads with the new filter
  form at all five widths). Local dev, embedded Postgres (per-run
  instances).
- Cases: vitest 100 passed / 0 failed / 0 skipped · Playwright full 19
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.1m.
- Failures: none.
- SPEC coverage touched: none of the §10 rows — presentation-layer
  filtering/ordering over the existing V2 §2.2 list. New coverage:
  stagePriority ranking (negotiation > sending_proposal >
  meeting_setting > following_up > new, terminals last, unknowns
  bottom) and the three sort orders incl. input non-mutation.
- Verdict: PASS.

## Run 033 — 2026-08-14 — ByteForce board parity round (ADR-042)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (100 —
  the A-7 drag-rejection case REWRITTEN to assert the founder-approved
  drag behavior, count unchanged) · `npx playwright test` (full suite
  incl. NEW e2e/byteforce-board.spec.ts). Local dev, embedded Postgres
  (per-run instances).
- Cases: vitest 100 passed / 0 failed / 0 skipped · Playwright full 20
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.1m.
- Failures: none.
- SPEC coverage touched: A-7 overridden by founder directive (ADR-042)
  — the internal pipeline now accepts drag events; the engine's drag ==
  matching action (same group, same §10 trigger), asserted in the
  rewritten transition test (T-1 with follow_up/initial on drag
  new→following_up). New e2e: drag on /byteforce/crm opens the internal
  follow-up form, confirm moves the card; didn't-answer chip toggles on
  the board; whole-card click opens the lead. journey1 + qa-sweep
  passing unchanged over the new client board is the regression proof
  for the rewrite of CrmBoardBody.
- Verdict: PASS.

## Run 034 — 2026-08-14 — Lead archive round (ADR-043)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (101 —
  one NEW integration test) · `npx playwright test` (full suite incl.
  NEW e2e/archive.spec.ts + an /archive 403 line in security-rbac).
  Local dev, embedded Postgres (per-run instances).
- Cases: vitest 101 passed / 0 failed / 0 skipped · Playwright full 21
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.1m.
- Failures: none.
- SPEC coverage touched: no §10 rows — archive is orthogonal to the
  pipeline (the stage survives). New coverage: (unit) archiving hides
  the lead from listBsLeads default / internalDashboard.totalLeads /
  todoFor, appears under { archived: true }, unarchive restores with
  stage + archivedAt cleared, both moves activity-logged; (e2e) archive
  from the detail (inline confirm) → header badge → gone from board and
  default Leads view → present under ?view=archived → unarchive →
  back on the board; (e2e) a foreign agent gets 403 on /archive.
- Verdict: PASS.

## Run 035 — 2026-08-14 — Batch hardening round (adversarial review fixes)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (106 —
  five NEW tests) · `npx playwright test` (full suite). Local dev,
  embedded Postgres (per-run instances).
- Cases: vitest 106 passed / 0 failed / 0 skipped · Playwright full 21
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.1m.
- Failures: none.
- SPEC coverage touched: T-0 added as the internal pipeline's generic
  move id (drag back to intake — ADR-042 addendum; outside the §10.1
  rows, mirrors B-1/PP-3's fallback role), asserted in the transition
  test. New coverage: (unit) archived leads are read-only — stage
  events, ready-to-close, no-answer, and edits all reject with
  "Unarchive this lead first" and operability returns on unarchive;
  B-6 groupless proposal-sent return never resurfaces the stale
  follow-up (the proposal is the latest record); a stale arranged
  meeting never resurfaces past a newer unarranged one (control case
  included); Cairo spring-forward-at-midnight day (2026-04-24) starts
  at the first EXISTING instant with the eve keeping its last hour and
  windows contiguous; fall-back day contiguous. The unchanged e2e suite
  (21/2) is the regression proof for the board toast change, the
  detail-page archived gating, and the To-Do query restructure.
- Verdict: PASS.

## Run 036 — 2026-08-14 — Leads filter sidebar + universal search
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (112 —
  six NEW tests) · `npx playwright test` (full suite incl. NEW
  e2e/leads-filters.spec.ts). Local dev, embedded Postgres (per-run
  instances, now UTF8 — ADR-044).
- Cases: vitest 112 passed / 0 failed / 0 skipped · Playwright full 22
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 3.2m.
- Failures: three during the round, all fixed before the final run —
  (1) BUG-006: /b-systems/leads?q=<arabic> returned 500 (22P05,
  WIN1252 cluster) — fixed by ADR-044 and now covered both unit and
  e2e; (2) a self-inflicted 400 in the new spec (B-Systems lead
  creation requires companyName); (3) brand-auditor FAIL on the
  disclosure caret — logical borders with a fixed 45° rotation point
  sideways under dir="rtl" — fixed with mirrored [dir="rtl"] rotations
  and re-verified by screenshot in Arabic at 390px (the rest of the
  diff audited clean: tokens only, correct brand scope, no pink/
  gradient misuse, every new string a bilingual Msg).
- SPEC coverage touched: no §10 rows — filtering and search are read-side
  only. New coverage: (unit) listBsLeads search hits the NAME (partial,
  case-insensitive), the COMPANY, the NUMBER, one query hitting a name
  here and a company there, a spaced/punctuated digits query
  ("010 123" and "010-1234-567" → 0101234567), an ARABIC name and
  company, no-match, and composition with the owner bucket + the
  archived view; (e2e) admin searches a partial number with a space,
  sees exactly one row, gets the "No leads match these filters." empty
  state on a dead query, resets via Clear filters, round-trips an Arabic
  lead through the API and the search box, and at 390px finds the
  sidebar collapsed behind the Filters disclosure (opens it, the query
  is preserved). qa-sweep passing unchanged at 1440/1024/768/560/390 is
  the regression proof for the new grid layout.
- Verdict: PASS.

## Run 037 — 2026-08-14 — "Organic" lead type
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (114 —
  two NEW tests) · `npx playwright test` (full suite, unchanged set).
  Local dev, embedded Postgres (per-run instances).
- Cases: vitest 114 passed / 0 failed / 0 skipped · Playwright full 22
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 3.3m.
- Failures: none.
- SPEC coverage touched: §5 lead fields — the lead TYPE set grows from
  four to five (cold_call, event_data, personal_connection,
  campaign_lead, organic); no §10 rows (type never gates a transition).
  New coverage: (unit) the set is exactly those five in order, every
  member has an English label AND a distinct Arabic translation, and
  createLeadSchema accepts "organic" while still refusing an unknown
  type; the created lead stores and renders it. The unchanged e2e suite
  is the regression proof that every existing type dropdown (both
  brands' add/edit forms, the partner add-lead form, the leads filter
  sidebar) still renders and submits — they all map over LEAD_TYPES.
- Verdict: PASS.

## Run 038 — 2026-08-14 — Search + filters on the CRM boards
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (116 —
  two NEW tests) · `npx playwright test` (full suite incl. a NEW second
  test in e2e/leads-filters.spec.ts). Local dev, embedded Postgres
  (per-run instances).
- Cases: vitest 116 passed / 0 failed / 0 skipped · Playwright full 23
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.5m.
- Failures: one during the round, fixed before the final run — the
  390px leg of the Leads spec asserted the sidebar starts CLOSED on a
  URL that already carried ?q=; the panel now opens itself when a
  filter is active, so the spec was corrected to assert both halves of
  that behavior (closed with no filters, auto-open with one).
- SPEC coverage touched: no §10 rows — board filtering is read-side.
  New coverage: (unit) listBsLeads narrows by TYPE server-side and
  composes type+search; "any"/undefined mean no narrowing; listOwnLeads
  takes the same search/type narrowing while its ownership scope still
  holds (another owner's lead never leaks in, whatever the query says);
  (e2e) admin filters the B-Systems board by search — the matching card
  stays, the others go — the panel reopens showing the applied query,
  Clear filters restores the full board, a type with no cards shows the
  board's "No cards match these filters." state, and the ByteForce
  board filters and clears the same way. qa-sweep passing unchanged on
  /b-systems/crm and /byteforce/crm at 1440/1024/768/560/390 is the
  regression proof that the inline panel does not disturb the
  full-bleed board's alignment or introduce overflow.
- Verdict: PASS.

## Run 039 — 2026-08-14 — Undo (ADR-045)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (126 —
  ten NEW tests in the NEW src/lib/services/undo.integration.test.ts) ·
  `npx playwright test` (full suite incl. NEW e2e/undo.spec.ts). Local
  dev, embedded Postgres (per-run instances).
- Cases: vitest 126 passed / 0 failed / 0 skipped · Playwright full 24
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.3m.
- Failures: three during the round, all fixed before the final run —
  (1) two undo tests written against assumptions that did not hold (the
  stage label is "Following Up", and backdating only the NEWEST entry
  fakes a state expiry cannot produce); (2) a real design correction
  found while fixing them — undo now retires the user's other pending
  entries so it is ONE step, never a stack offering inverses its own
  application has invalidated; (3) after the undo pill landed,
  getByLabel("Search") in the filters spec matched the pill too (its
  accessible name reads "Undo: Added Sidebar Search Lead") — the spec's
  locators are exact now.
- SPEC coverage touched: no §10 rows change — undo REVERSES a row's
  effect, it never introduces a transition (every application writes an
  ActivityLog row with trigger "undo"). New coverage: (unit) each
  allowlisted kind restores its prior state — stage event (stage back,
  created follow-up gone, entry spent, second call refused), no-answer,
  ready-to-close, archive/unarchive, field edit (only edited fields
  restored), lead create (deletes the fresh lead; REFUSES once it has
  history), prospect stage event; and the guards — another user can
  neither see nor apply it, an expired entry is neither offered nor
  applied (and is retired), a fingerprint mismatch after a colleague's
  move refuses without touching anything, a Won transition is never
  undoable and silences the button, and money moves (milestone check)
  plus deletions retire pending entries. (e2e) admin moves a card on the
  board, the pill names that exact move, one click puts the card back in
  New and the pill disappears; deleting leaves it quiet.
- Verdict: PASS.

## Run 040 — 2026-08-17 — Same-stage records (ADR-046)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (138 —
  eight NEW tests in the NEW src/lib/services/same-stage.integration.test.ts
  plus four NEW engine cases in transition.test.ts) · `npx playwright
  test` (full suite incl. NEW e2e/same-stage.spec.ts). Local dev,
  embedded Postgres (per-run instances).
- Cases: vitest 138 passed / 0 failed / 0 skipped · Playwright full 25
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.4m.
- Failures: one during the round, fixed before the final run — the new
  e2e asserted the rendered follow-up date as "8 Sep 2026, 15:30", but
  en-GB abbreviates September as "Sept" on this ICU; the assertion is a
  regex tolerating both (the day/year/time carry the proof).
- SPEC coverage touched: no §10 row changes — the three new actions are
  founder rows OUTSIDE the tables (triggers FU-AGAIN, NEG-DUE,
  MTG-RESCHEDULE) that resolve to the card's current stage. New
  coverage: (engine) follow_up_again is offered from Following Up on
  internal/bsystems/partners and returns from===to with the follow-up
  group; negotiation_follow_up is bsystems-only and carries the new
  after_negotiation context; reschedule_meeting returns the MEETING
  group (not T-7's in-place meeting_reschedule) on all three; each is
  refused from a stage that does not own its record and terminal stages
  offer none. (integration) a second follow-up is created without the
  stage moving, logged as group_added with no from/to, and the To-Do
  swaps to the NEW date while the superseded one leaves Overdue; the
  agent light form (no time) defaults to 09:00 Cairo; undo names the
  record ("Recorded another follow-up on …") and removes exactly it;
  the partnership pipeline behaves identically; the negotiation
  response date reaches the To-Do while the stale Following-Up record
  never resurfaces in Negotiation; a rescheduled meeting supersedes the
  old one on the To-Do and the old one does not linger in Overdue.
  (e2e) the admin presses "Log another follow-up" on the lead detail,
  saves a new date, sees two follow-up records and the card still in
  the Following Up column.
- Verdict: PASS.

## Run 041 — 2026-08-17 — Assign a lead to an agent or partner (ADR-047)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (146 —
  eight NEW tests in the NEW src/lib/services/assign.integration.test.ts)
  · `npx playwright test` (full suite; e2e/security-rbac.spec.ts gained
  a NEW assertion). Local dev, embedded Postgres (per-run instances).
- Cases: vitest 146 passed / 0 failed / 0 skipped · Playwright full 25
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.3m.
- Failures: none.
- SPEC coverage touched: no §10 rows — assignment is ownership, not a
  transition. New coverage: (unit) an assignment moves the lead onto the
  target's board (listOwnLeads) and off the previous owner's; ownerType
  derives per role (agent / partner / internal) and the owner-bucket
  queries follow; partnerId AND source survive a handover on a
  PP-5-attributed lead; the new owner gets one "assigned" notification
  carrying the leadId; the assignment is activity-logged with the
  admin's label; the To-Do projection follows the new owner; undo
  restores the previous ownerUserId + ownerType; and the guards refuse
  admins, ByteForce staff, deactivated accounts, pending registrations,
  unknown users, archived leads and cross-brand leads. listAssignableOwners
  returns only live approved agents/partners/internal sales.
  (e2e) an agent POSTing /api/b-systems/leads/:id/assign gets 403 —
  the wall is requireBsAdmin, so an agent can neither push a lead onto
  a colleague nor pull one to themselves.
- Verdict: PASS.

## Run 042 — 2026-08-17 — Dial + the call sheet (ADR-048)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (150 —
  four NEW tests in the NEW src/lib/phone-dial.test.ts) · `npx
  playwright test` (full suite incl. the NEW e2e/call-sheet.spec.ts,
  two tests). Local dev, embedded Postgres (per-run instances).
- Cases: vitest 150 passed / 0 failed / 0 skipped · Playwright full 27
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.4m.
- Failures: none in the suites. The brand-auditor subagent on the diff
  returned FAIL and was fixed before the commit — see the coverage note.
- brand-auditor (pre-commit, on the diff): one BLOCKING finding and five
  more, all fixed. (1) BLOCKING — .card-dial filled solid --color-accent,
  which is the WON cue in both brands (B-Systems Signal Pink /
  ByteForce orange = --color-stage-won-accent) and would have repainted
  every card in every column with it, at a size where white-on-accent
  measures 3.13:1 / 3.34:1 against the 4.5:1 AA floor; it is now an
  outlined link-ink mono chip, AA-clean in both brands and legible as an
  ACTION rather than a status. (2) .call-cta-number carried a gratuitous
  opacity: .9 on the most important string on the page — removed.
  (3) the number had no bidi isolation, so a "+20 100 …" run reorders
  under dir="rtl" — now direction: ltr + unicode-bidi: isolate and
  dir="ltr" on the span (the first place in the repo this bites).
  (4) the aria-label used a hand-rolled .replace instead of the
  canonical formatMsg composer. (5) the dial chip used --font-body for
  an uppercase micro-chip where every sibling uses --font-mono.
  (6) eleven strings in the new dict/call.ts were byte-for-byte
  duplicates of dict/crm's leadDetail — deleted; the call sheet reads
  the lead detail's own labels, so the two can never drift. Plus three
  cleanups: hover transitions for the new controls, the handset glyph
  no longer hidden at ≤560px (the very device the page is for), and the
  lead-detail Call button moved from accent to primary so the page has
  one pink object (Ready to close), not two. Everything else passed:
  zero hardcoded colors/fonts/radii, logical properties throughout,
  every string a Msg, no emoji, correct brand scope both sides.
- SPEC coverage touched: no §10 rows — the call sheet is read-only.
  New coverage: (unit) tel: sanitising strips spaces / dashes / dots /
  brackets, keeps an international prefix, normalises a 00 prefix to +,
  and returns null for a number with no digits. (e2e) the Call chip on
  a board card navigates to the call sheet — proving it neither drags
  the card nor triggers the whole-card navigation; the dial button
  carries the accessible name "Call now — +20 100 123-4567" (the number
  as typed) while its href is the sanitised "tel:+201001234567"; the
  sheet shows the lead's company, industry, position and requirements,
  a mailto: link for the email, and the Details / Latest update / Stage
  records / History sections; the lead-detail header's Call button
  reaches the same page; the sheet has NO horizontal overflow at
  1440/1024/768/560/390 (the §15 sweep, run in this spec because the
  page needs a lead id and qa-sweep's list is id-free); and an agent
  opening another owner's call sheet URL gets the not-found page —
  requireLeadAccess holds on the new route.
- Verdict: PASS.

## Run 043 — 2026-08-17 — Permanent user deletion (ADR-049)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (155 —
  five NEW tests in the NEW
  src/lib/services/user-delete.integration.test.ts) · `npx playwright
  test` (full suite; e2e/security-rbac.spec.ts gained a NEW assertion).
  Local dev, embedded Postgres (per-run instances).
- Cases: vitest 155 passed / 0 failed / 0 skipped · Playwright full 27
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.4m.
- Failures: none.
- SPEC coverage touched: no §10 rows. New coverage: (unit) one fixture
  carrying EVERY reference a user can hold — agent profile + CV
  attachment, roles, a notification, an undo entry, two owned leads, a
  comment, a follow-up they owned, and a statement that paid them — is
  deleted and each reference asserted where ADR-049 says it lands: the
  account, roles, PortalRep, the CV attachment row, the notifications
  and the undo entries are GONE; both leads survive with ownerUserId
  null + ownerType "admin" and one "owner_deleted" activity row each;
  the comment survives unlinked with its authorLabel; the follow-up
  survives with ownerPortalRepId null; the statement survives with
  closerUserId null and closerLabel intact; their old activity rows keep
  their denormalised actor label and the deletion itself is logged
  ("user_deleted"). A partner COMPANY survives its login (Partner.userId
  nulled, the referred lead's partnerId untouched). Self-delete,
  bootstrap-admin delete and an unknown id are all refused with nothing
  destroyed. The delete retires the acting admin's pending undo entry
  (never undoable). And a control: deactivating leaves the lead with its
  owner, proving Remove and Delete are genuinely different.
  (e2e) an agent DELETEing /api/b-systems/users/:id gets 403.
- Verdict: PASS.

## Run 044 — 2026-08-17 — Partners & Agents: agent cards + PP-4a (ADR-050)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (164 —
  NINE new tests in src/lib/services/partners.integration.test.ts) ·
  `npx playwright test` (full suite; NEW spec
  e2e/partners-agents.spec.ts, and journey3 + qa-sweep + security-rbac
  updated for the founder-directed rename). Local dev, embedded
  Postgres (per-run instances).
- Cases: vitest 164 passed / 0 failed / 0 skipped · Playwright full 28
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 3.9m.
- Failures: none. One defect was caught by the new tests before the
  commit: `persistGroup` (leads.ts) had no arm for the `won_agent`
  group, so every agent Won threw "Group payload does not match
  required" from inside the transaction — the gate is consumed by the
  side effect, not written as a child record, exactly like won_partner.
- SPEC coverage touched: §7.2's Won gate now has a second form (PP-4a,
  a founder row outside the §10.2 table, named like the other non-§10
  rows). PP-1/PP-2/PP-3 are re-exercised on an AGENT card to prove the
  pipeline is genuinely shared, not copied.
  New coverage: (unit) kind-conditional validation both ways — a
  partner card without companyName or without businessActivity is
  rejected on those paths and an unlabelled payload still defaults to
  "partner", while an agent card parses AND SAVES with nothing but a
  name and a number (every other column null, stage lead), rejects a
  malformed number, and rejects a missing name; the strictness that left
  card creation is proved to live at the gate instead — a bare card is
  refused four times over, once per missing field, each with its own
  named message (address, then speciality, then the sign-in email, then
  the password, then the 8-character rule), with nothing created until
  the gate is complete and the resulting PortalRep carrying values that
  existed only in the gate; the kind is immutable (an edit naming
  companyName on an agent card leaves the column null and the kind
  unchanged) while a PARTNER card still refuses an emptied company name;
  a full agent journey — didn't answer → alternative number
  auto-returns to Lead (PP-2) → follow-up → Won — where the partner gate
  is REFUSED on an agent card, an 8-character-short password is
  refused with nothing created, and the complete gate produces a User
  (name, phone, active, registrationStatus "approved", a
  bcrypt-verifiable password, the passwordPlain copy), the
  bsystems_agent role, the PortalRep profile (first/last/address/
  speciality), the card's agentUserId, the PP-4a activity row — and NO
  directory Partner; a converted agent appears in listAgentsDetailed()
  and NOT in listPartners(), while a partner card converted alongside it
  still produces its directory Partner and no agent profile; duplicate
  email and duplicate phone are each refused with the signup path's
  message, both cards stay in Lead and nothing is written; the CV
  uploaded with the card is visible on the card, absent from the
  recordings list, and after conversion is the PortalRep's CV with the
  SAME storage key (moved, not copied) and the file still readable; and
  a public signup creates a pending user and NO PartnerProspect.
  (e2e) the new spec creates an agent card through the UI with ONLY a
  name, a number and a CV (kind picker → signup field set), asserts the
  kind chip and data-kind on the board and the CV on the card, follows
  up, opens the Won gate — where the name and number are prefilled, the
  speciality box is provably EMPTY, and the admin types address,
  speciality, email and password — converts, and then
  signs in AS THAT AGENT with the admin-set email + password, landing on
  /b-systems/crm — with the Agents section listing them, the Partners
  directory not, and the Registrations approval queue never mentioning
  them.
- Verdict: PASS.

## Run 045 — 2026-08-17 — The data-entry role (ADR-051)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (174 —
  TEN new tests in the NEW
  src/lib/services/data-entry.integration.test.ts) · `npx playwright
  test` (full suite; NEW spec e2e/data-entry.spec.ts). Local dev,
  embedded Postgres (per-run instances).
- Cases: vitest 174 passed / 0 failed / 0 skipped · Playwright full 30
  passed / 0 failed / 2 skipped (audit opt-in skips, by design). Full
  e2e wall time 4.9m.
- Failures: none in the end. Two were found and fixed during the round.
  (i) The new e2e's first draft asserted 403 against invented lead ids
  and got 404 — `requireLeadAccess` resolves the id BEFORE the role, so
  those assertions were proving "no such row", not "no such right". Every
  refusal now runs against a REAL id: the admin's own lead, and the
  data-entry user's own card. (ii) The new spec then broke journey 5 in
  the full run only: the suite shares one seeded database and journey 5
  drags a specific card by position, so the two leads and two cards this
  spec adds pushed "Fresh Deal" down the New column and the drag missed.
  The spec now deletes everything it created (via the admin) before it
  ends — worth remembering for any future spec that writes to the
  B-Systems board.
- SPEC coverage touched: no §10 rows (a role, not a transition).
  New coverage: (unit) a lead entered by a data-entry user lands
  ownerType "internal" with ownerUserId AND salesRepId null in stage
  "new" — A-6's unassigned state, not a new one — carries
  createdByUserId, and broadcasts a `needs_owner` notification to every
  admin (userId null) deep-linked by leadId; the admin finds exactly
  that lead under the new "Unassigned" owner filter and an OWNED lead is
  absent from it; assigning it (ADR-047) removes it from the queue while
  the creator stays on record; a data-entry account never appears in
  listAssignableOwners; a card they add carries the creator and sits in
  intake. The correction rule is proved from four directions: allowed
  while the lead is untouched, refused the moment it moves a stage,
  refused as soon as it has an owner even in intake, refused outright on
  someone else's entry, refused on a CONVERTED card but allowed on an
  intake one — and refused for anyone who is not a data-entry user at
  all (an admin holding the role too goes through the admin door). Their
  own view lists only their rows and flips each one to read-only once it
  moves.
  (e2e) the qa-sweep gained the new page — console-clean and free of
  horizontal overflow at 1440/1024/768/560/390, signed in as the seeded
  data-entry account. And a real data-entry session: signs in and lands on its ONE page,
  has no CRM/Users/Won-Leads nav, ADDS a lead and an agent card through
  the UI, sees the lead as "Waiting for an owner", creates a second card
  through the API (201) and CORRECTS it (200) — then is refused 403 on
  thirteen mutations against real ids, including a stage move on its own
  card, every mutation of an admin's lead (event, assign, archive,
  ready, no-answer, PATCH, comment), Users create/update, reps,
  registrations approval and milestones, plus DELETE of its own card;
  and every admin page URL bounces it back to its own landing rather
  than to a sign-in form. The admin then finds the entered lead waiting
  under ?owner=unassigned while their own owned lead is not there.
- Verdict: PASS.

## Run 046 — 2026-08-17 — Accounting Phase 1: schema + piaster engine + importer (ADR-052)
- Suites/commands: `npx tsc --noEmit` (clean — after excluding the two
  gitignored reference archives from the sweep, which contributed ~484
  pre-existing alien errors) · `npx vitest run` (216 = baseline 174 +
  42 new in src/lib/accounting/engine.test.ts and
  import.integration.test.ts) · `npx playwright test` (untouched
  baseline). Local dev, embedded Postgres (per-run instances).
- Cases: vitest 216 passed / 0 failed / 0 skipped · Playwright 30
  passed / 0 failed / 2 skipped (audit opt-in, by design), 4.9m wall.
- Failures: one during the round — the importer test first asserted 2
  stored targets after re-import, but the B-Systems fixture document
  deliberately has none (expectation fixed to 1, the ByteForce target).
- SPEC coverage touched: none (accounting is INTEGRATION-PLAN scope,
  not SPEC §10). New coverage encodes the SPA's business rules at
  piaster scale: cash basis (a late payment lands in its paidMonth, a
  pending item only in A/R); approval-gates-cash (on-hold expenses
  absent from spend/net/treasury, present in A/P); auto-payroll
  derivation (start month, effective-dated raise, deactivation-forward,
  payrollPaid approval marks, LINKED manual row replaces the auto row
  for its month while an UNLINKED one adds on top, memberUpsert
  same-month replacement with partial patches); media pass-through
  (only the fee in profit, budget washes through treasury, held ≠
  debt); loans (partial repayment, floor at zero, the 50-piaster
  settlement epsilon proved from both sides — 50 settles, 51 stays
  open, and totals still carry the 50); treasury running balance
  (opening + monthly nets + moves, liveTreasury at the newest active
  month incl. future months, derived payroll draining cash only once
  approved); the derived client A/R ledger (running statement lines,
  trimmed names, no-client rows excluded); monthly P&L by type with
  the 6-month trend; department profitability (tagged income vs cost,
  media_fee as pure income, untagged overhead, all-time scope); the
  dashboard reconciliation pass. The importer proves Phase 1's
  definition of done — a representative two-company export (on-hold
  expense, mid-year raise, member leaving this month, linked manual
  payroll, legacy no-`paid`-key row, deduction/bonus payroll row,
  partially-forwarded media budget, partial loan repayment, ε-settled
  lent loan, orphan payrollPaid key, a 1,999.5-EGP amount) reproduces
  the old dashboard EXACTLY in piasters: treasury 8,550.00 · month net
  3,000.00 · A/R 3,000.00 · A/P 12,300.00 · committed salary 8,000.00 —
  and the reported numbers equal a fresh engine pass over the stored
  rows; payroll never materialises as expense rows; old-id links
  (rosterId, payrollPaid keys, mediaRef) remap onto new cuids;
  re-import replaces idempotently; a single-company file demands its
  company; junk files 400.
- Verdict: PASS.

## Run 047 — 2026-08-18 — Accounting Phase 2: the eleven screens + import UI (ADR-052)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (216 —
  unchanged from Run 046; this commit is UI + routes over the tested
  engine) · `npx playwright test` (full suite; NEW e2e/accounting.spec.ts,
  4 tests, + a 13-path accounting sweep in qa-sweep.spec.ts). Local dev,
  embedded Postgres (per-run instances).
- Cases: vitest 216 passed / 0 failed · Playwright 35 passed / 0 failed /
  2 skipped (audit opt-in, by design), ~6.1m wall.
- Failures: two during the round. (i) The new qa-sweep test (13 paths ×
  5 widths plus dev-mode first-hit compilation of 12 new pages) blew the
  60s default test timeout — it now sets 240s for itself. (ii) None
  functional. Observed and triaged as benign: the dev webserver
  occasionally prints "The destination stream closed early" when a
  Playwright navigation abandons a page mid-render; browser consoles
  stayed clean (the sweep asserts on those).
- SPEC coverage touched: none (INTEGRATION-PLAN scope). New coverage:
  (e2e) an admin books a month through the UI — adds a collected income
  (4,321 EGP), an expense that stays ON HOLD (1,111 EGP), sees the
  dashboard carry income/on-hold but NOT spend, approves the expense from
  its row and watches month net land on exactly EGP 3,210 — the cash
  basis and the approval gate proved through real screens. Founder
  decision 5 proved three ways: Media Buying visible under the ByteForce
  filter, absent from the strip under company=bsystems, and its URL
  bounces to the dashboard. The import screen ingests a minimal
  single-company export end-to-end (file input → summary), reports the
  derived totals (EGP 600 = 100 opening + 500 collected) and the
  B-Systems dashboard then shows them. The 403 matrix fires all 21
  accounting endpoints (income/expenses/payroll-paid/roster/media/loans/
  loan-payments/treasury/settings/targets/import, every method) as
  internal sales, agent AND data-entry — 63 live refusals — and each
  role's page visit bounces to its own landing; partner accounts are
  provisioned mid-flow rather than seeded, and the identical
  requireBsAdmin role list refuses them by construction. The qa-sweep
  covers all twelve accounting screens (media under ByteForce; the
  dashboard also under the B-Systems filter) at 1440/1024/768/560/390 —
  console-clean, no horizontal overflow — and the 390px mobile menu now
  asserts the Accounting nav item.
- Brand audit: the brand-auditor agent on the new UI returned FAIL
  (narrow) and both findings were fixed before commit: the generic
  "positive" status chip had reused the WON (Signal Pink) tint for
  Collected/Paid/Active/Settled/Deposit — the majority states of mature
  books, which would have drowned the Won cue (the ADR-046 precedent) —
  now an indigo intake tint; and the "Ad budget held" KPI rendered its
  money value in accent ink — the accent tone is now removed from the
  tile API entirely so it cannot drift back. A third informational
  finding (an unlabelled switcher group) also fixed. Re-audit criteria:
  zero hardcoded colors/fonts, tokens/design-system classes only, RTL
  logical properties + dir="ltr" Latin runs, every string a Msg — PASS.
- Verdict: PASS.

## Run 048 — 2026-08-18 — Vault Phase 4: schema, services, invariants (ADR-053)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run`
  (266 = baseline 216 + 50 new across
  src/lib/services/vault/{lateness,row-count}.test.ts and
  vault.integration.test.ts) · `npx playwright test` (untouched
  baseline — the new migration deploys under it). Local dev, embedded
  Postgres (per-run instances).
- Cases: vitest 266 passed / 0 failed / 0 skipped · Playwright 35
  passed / 0 failed / 2 skipped (audit opt-in, by design).
- Failures: one during the round — a new CSV-count test expected the
  all-text file ("Name,Note" over prose cells) to lose a header row,
  but the ported A-1 heuristic DELIBERATELY reads an all-text row 1 as
  data so headerless lists are never undercounted (the reference app
  documents the same limitation); the expectation was fixed to assert
  the documented behaviour. Also updated (intentionally, same commit):
  the partners cv fixture that passed a bare "PK" zip as .docx — the
  ADR-053 sniffing upgrade now REJECTS that, and the test proves both
  the rejection and that a real OOXML container still passes.
- SPEC coverage touched: none (vault is INTEGRATION-PLAN scope). New
  coverage encodes the reference app's invariants natively: the sheet
  link-XOR-file rule (Zod union at the boundary + 422 service assertion
  against final state, both directions, no orphaned rows/blobs); the
  task RESULT GATE (422 with nothing committed, whitespace text
  refused, any ONE of text/file/link passes, saved-earlier results
  count, double completion refused); LATENESS computed once at
  completion and FROZEN (late-by-3 and on-the-day cases; deadline
  edited a month out after completion — wasLate/daysLate/completedAt
  untouched; live overdue flag distinct from the frozen record; the
  pure math unit-tested for the Cairo midnight boundary, the
  21:30-UTC-is-next-day-Cairo edge, and winter UTC+2); reopening
  (clears the trio, keeps result text/files/links, logs the erased
  values, refuses open tasks, refuses archived tasks); archive-not-
  delete on all four kinds (out of default lists and counts, read-only
  while archived, restorable, archived duplicates stop clashing);
  duplicate-URL 409 handshake (warn → acknowledge → both live);
  append-only activity (create/complete/archive/restore each leave
  their entry with actor label + open→completed stages); undo of the
  SAFE mutations only (archive offers a personal snapshot-inverse,
  fingerprint refuses a changed record, task completion INVALIDATES
  pending undo); employee cards (open/overdue/completed counts,
  archived tasks excluded, deactivated cards take no new tasks but keep
  frozen history); CSV auto-count with as-of=today plus version-append
  on file replacement (predecessor Attachment rows retained); the
  upgraded sniffing (bare zip renamed .xlsx refused, binary .csv
  refused, real OOXML accepted); vault global search across the four
  kinds (archived excluded, 2-character minimum).
- Verdict: PASS.

## Run 049 — 2026-08-18 — Vault Phase 5: the six screens + e2e (ADR-053)
- Suites/commands: `npx tsc --noEmit` (clean) · `npx vitest run` (266
  passed — unchanged from Run 048; Phase 5 is UI over the tested
  services) · `npx playwright test` (40 passed / 0 failed / 2 skipped
  (audit opt-in, by design), 7.3m wall — up from 35: four vault e2e
  tests + the vault qa-sweep). Local dev, embedded Postgres (per-run
  instances), production `next build` under the Playwright webServer.
- Cases: the vault journey — admin creates an employee CARD, assigns a
  task due today, clicks Complete: the RESULT PANEL opens (never a bare
  error), "Save & complete" with nothing recorded surfaces the server's
  422 message and the task stays Open with nothing committed; typing a
  result note and completing in the same step flips the row to
  Completed with the frozen "On time" verdict. A sheet created from an
  uploaded CSV shows the count read from the file itself (3 rows,
  header detected) with the file link served through /api/files. A
  document (PDF) archives — confirm-click, leaves the default list —
  appears on the Archive tab with its Archived badge, and restores in
  one click back into the documents list. The 403 matrix fires all 20
  vault endpoints (employees/forms/sheets/documents/tasks incl.
  result/complete/reopen/archive + search, every method) as internal
  sales, agent AND data-entry — 60 live refusals — and each role's
  /b-systems/vault page visit bounces to its own landing; partner
  accounts are provisioned mid-flow rather than seeded, and the
  identical requireBsAdmin role list refuses them by construction. The
  qa-sweep covers all seven vault screens at 1440/1024/768/560/390 —
  console-clean, no horizontal overflow — and the 390px mobile menu now
  asserts the Data Vault nav item.
- Brand audit: the brand-auditor agent on the new UI returned FAIL
  (narrow) and every finding was fixed before commit: dict CTA labels
  carried a hardcoded "+ " prefix (now JSX chrome per the accounting
  precedent, dict labels clean and reused as modal titles); the
  overview's activity table showed raw entityType/action tokens (now
  Msg-mapped closed vocabularies; the free-form trigger column stays
  deliberately technical mono/LTR — it embeds names and dates); ×
  close buttons were labelled "Cancel" (now "Close"); u-ltr scoping
  (deadline dates and filenames isolated, a translated link un-LTR'd);
  aria-pressed on a link swapped for aria-current. Also fixed in the
  same pass, found by hand: bare form controls missing the design
  system's .field-input class, and a .field/.check-row class conflict
  that would have stacked checkbox rows vertically. Re-audit criteria —
  zero hardcoded colors/fonts, tokens/design-system classes only,
  Signal Pink untouched (status chips reuse the accounting indigo
  intake/following tints), RTL logical properties, every string a
  Msg — PASS.
- Failures: none in the final runs. One mid-round hazard worth
  recording: an earlier Playwright run was started before the audit
  fixes landed and would have tested a stale build — it was killed and
  re-run clean rather than trusted (its zombie next-server on :3100
  needed a manual kill; the per-run DB ports made the rest safe).
- SPEC coverage touched: none (vault is INTEGRATION-PLAN scope).
- Verdict: PASS.

## Run 050 — 2026-08-18 — ADR-054: modules at the switcher, per-company brand, module import/export
- Suites/commands: `npm test` (vitest, embedded per-run Postgres) and
  `npx playwright test` (prod build + embedded e2e Postgres) — run at each of
  the three ADR-054 commits; the numbers below are the final (commit 3) gate.
  `npx tsc --noEmit` clean (src; .next validator noise is stale generated
  types the running dev server owns). brand-auditor subagent run after the
  commit-2 UI work.
- Cases: vitest 274 passed / 0 failed (266 baseline + 8 new: 5 accounting
  export round-trip incl. the founder's REAL all-companies file, 3 vault
  module backup round-trip). Playwright 43 passed / 0 failed / 2 skipped
  (the standing audit skips) — 40-test baseline + the four-shell switcher
  walk, the vault brand-follows-filter proof, and the vault export/import
  round-trip; the accounting spec additionally asserts the brand swap, the
  SPA-shaped export (filename + EGP figures + ALL-companies wrapper), and
  two GET export rows in its 403 matrix (now 23 routes × 3 non-admin roles).
- Failures: one mid-work Playwright failure at commit 1 (accounting qa-sweep,
  240s timeout): a Link prefetch canceled by the next navigation wedged
  Chromium's in-flight counter so `networkidle` never fired on a silent
  network (trace: zero pending requests, healthy 0.6s/load pace). Fixed in
  the sweep helper — the networkidle wait is now bounded at 10s and falls
  through (console errors still fail the test on their own); qa-sweep then
  9/9 green (accounting sweep 42s). Not filed as a BUG — a test-harness
  flake class, no product defect.
- Brand audit (commit 2): FAIL → resolved. Medium: the dashboard target
  meter's under-goal gradient fill sat outside the gradient sanction — the
  kept-SPA design includes it, so the ByteForce token comment + ADR-054 now
  name the meter fill explicitly. Low (flagged to founder in PROGRESS): the
  SPA's brand-colored dashboard eyebrow renders Signal Pink as a multi-word
  run under company=bsystems. Info items: KPI label keeps the SPA's sans
  (documented in ADR-054), asset-exemption comments added to the two module
  favicons, ARCHITECTURE + byteforce-brand skill updated to the bare
  [data-brand] scoping and the sanctioned ByteForce hero gradient.
- SPEC coverage touched: §15 sweep/security rows (qa-sweep, security-rbac
  module gating), the ADR-052/053 accounting + vault e2e journeys, ADR-019
  token parity, ADR-054 round-trip proofs (directive C).
- Verdict: PASS — all three ADR-054 commits green at their gates.

## Run 051 — 2026-08-19 — WhatsApp, Kind filter, nav slider, column cap (four founder requests)

- Suites/commands: `npx tsc --noEmit` clean at every commit; `npx vitest run`
  (embedded per-run Postgres) and `npx playwright test` (prod build + embedded
  e2e Postgres) per gate; brand-auditor subagent over the session's UI work.
- Cases: vitest 279 passed / 0 failed (274 baseline + 4 wa.me normalisation
  units in phone-dial.test.ts + 1 prospect kind/search server-side narrowing
  integration case). Playwright FINAL GATE 46 passed / 0 failed / 2 skipped
  (the standing audit skips) — 43-test baseline + three new: the Partners &
  Agents Kind-filter/chips smoke, the nav-slider walk, and the column-cap
  drag-from-scrolled-column proof. call-sheet.spec additionally asserts the
  wa.me hrefs (card chip + call-sheet button).
- Failure history across the mid-work runs (all spec-side, no product
  defects; every root cause is written up in IMPLEMENTATION 2026-08-19):
  (1) byteforce-board whole-card click hit the new WhatsApp chip at the
  card's geometric center → clicks the subtitle line now. (2) data-entry's
  cleanup derived a card id from "the card's only link" — three links live
  on a card now; the strict-mode abort left rows on the shared serial DB
  and journey5's drag missed on the shifted board → the cleanup names the
  link, journey5 recovered on the rerun. (3) The new nav-slider spec ran at
  900px, where the admin header leaves the strip ~43px — a press "moved
  only 30px" because 30px WAS 70% of the strip; slide() now pages by
  max(70%, 160px) and the spec runs at 1180px. (4) After the DragOverlay
  refactor, journey3 hit a strict-mode double (the aria-visible overlay
  clone during the drop animation) and journey4/5 drops drifted a column
  under load (board auto-scroll between measure and drop) → overlay clones
  are aria-hidden; all dragTo helpers re-measure the target column and land
  on its live box before mouse.up; the byteforce cap test cleans up by
  ARCHIVE (the ByteForce API deliberately has no lead delete).
- Brand audit: PASS — chips/nav/masks tokens-only, logical properties
  throughout, rtl: chevron flips, no WhatsApp green anywhere (deliberate),
  #000 mask-image literals judged alpha-only geometry inside the themes
  allowlist; vault logo pin keeps scope integrity.
- SPEC coverage touched: §15 sweep (all five widths on the changed screens),
  §10 drag rows re-proven under DragOverlay (journeys 1-5, same-stage,
  no-answer, undo all green), ADR-043 archive as test cleanup, ADR-051
  data-entry walls re-proven.
- Verdict: PASS — final gate green at the tip carrying all four commits.

## Run 052 — 2026-08-19 — To-Do assign/take: review round + full gate

- Suites/commands: `npx tsc --noEmit` · `npx vitest run` (embedded per-run
  Postgres) · `npx playwright test` (FULL suite: prod build + embedded e2e
  Postgres), all three on the final tree of the To-Do assign/take commit
  (ADR-055) after the review round's four fixes.
- Cases: tsc clean (0 errors). vitest **284 passed / 0 failed**, 23 files
  (Run 051 baseline 279 + 3 for the feature + 2 for the review round: the
  To-Do owner name falls back owner → sales rep → partner company while a
  bare internal lead keeps a null name; a multi-hat admin+sales account
  taking a lead lands in the ADMIN bucket and stays off the internal-sales
  To-Do). Playwright **49 passed / 0 failed / 2 skipped** (`test-results/
  .last-run.json` → `"status": "passed"`, `failedTests: []`) — Run 051's 46
  plus the three e2e/todo-assign.spec.ts journeys, the two standing skips
  being the audit opt-ins. Duration: vitest 82s, Playwright 8.0m.
- Failures: none. No re-runs were needed — the suites were green first try
  on the fixed tree (the earlier vitest attempt that reported "23 failed /
  no tests" was the known lowercase-cwd trap: launched from `d:/CRM` the
  runner cannot find its own runner module; relaunching from `D:/CRM` is
  the fix, not a code change).
- Review round covered by this gate (all four fixes are in the run above):
  the To-Do owner label is now the app's owner chip (bucket · owner / rep /
  partner company, "Unassigned" reserved for ADR-051's internal-no-rep-no-
  account state); components/shared/TodoBody is brand-neutral again (render
  prop; the B-Systems controls live in components/bsystems/TodoRowActions,
  so the ByteForce To-Do route carries no B-Systems client module); the
  dead `selfName` prop is gone; assignLeadOwner resolves the admin bucket
  FIRST so an admin who also holds a sales role does not park their own
  "Take it" in the shared internal bucket.
- SPEC coverage touched: ADR-041 To-Do projection (owner plumbing +
  Cairo-day/live-record cases re-proven), ADR-047 assign machinery and its
  ADR-045 undo entry, ADR-051 unassigned definition (label wording + the
  data-entry walls), ADR-043 archive guard on reassignment, §15 journeys
  1-5 / qa-sweep / security-rbac all re-run green under the changed shared
  component.
- Verdict: PASS — final gate green on the tree that was pushed.

## Run 053 — 2026-08-19 — Two founder fixes: the drag handle on touch, and zoom-proof layout

- Suites/commands: `npx tsc --noEmit` · `npm test` (vitest, embedded per-run
  Postgres, launched from `D:\CRM` — see the lowercase-cwd trap in Run 052) ·
  `npx playwright test` on two targeted sets, each a full prod build + embedded
  e2e Postgres on port 3100.
- Cases:
  · tsc clean (0 errors) on both commits.
  · vitest **284 passed / 0 failed**, 23 files — unchanged from Run 052's
    baseline. Neither commit touches a service, so no unit case was added; the
    behaviour under change is geometry and gestures, which only Playwright can
    see.
  · COMMIT 1 set — `board-touch` (4, new) + `byteforce-board` (2) + `journey3`
    (2) + `journey4` (1) + `journey5` (1) + `partners-agents` (2) + `no-answer`
    (1) + `same-stage` (1) + `i18n` (1): **15 passed / 0 failed**
    (`test-results/.last-run.json` → `"status": "passed"`, `failedTests: []`).
  · COMMIT 2 set A — `zoom` (5, new) + `nav-slider` (2, one new) +
    `board-touch` (4) + `byteforce-board` (2) + `journey3` (2) +
    `partners-agents` (2) + `i18n` (1): **18 passed / 0 failed**.
  · COMMIT 2 set B (the global-CSS/layout blast radius) — `qa-sweep` (9) +
    `journey4` (1) + `journey5` (1) + `accounting` (4) + `vault` (6) + `undo`
    (1) + `impersonation` (1): **23 passed / 0 failed**, `.last-run.json`
    `"status": "passed"`. Duration 6.4m.
- BOTH new specs were seen RED FIRST, on purpose — a suite that was never red
  proves nothing:
  · e2e/board-touch.spec.ts: with `touch-action: none` put back on `.bcard`,
    the column's scrollTop after a CDP touch swipe that starts on a card
    measured **0** against an expectation of `> 20`. Restored → green.
  · e2e/zoom.spec.ts: run against the pre-fix tree (source stashed, spec kept)
    it failed A1 with the full measured table —
    page overflow +22 / +7 / +3 / +2 / +1 / 0 / 0 / 0 / 0 / +48 and
    board.left −22 / −7 / −3 / −1.5 / −0.5 / +0.5 / +2 / +3 / +4 / +5.5 at zoom
    25 / 50 / 67 / 80 / 90 / 100 / 125 / 150 / 200 / 300%. **Red at the 50% and
    80% models specifically** (+7px and +2px of real horizontal page overflow),
    plus A5 red at 50% ("the board moved 15.0px sideways just because the page
    scrolls") and A6 red at 200% ("the column collapsed to 1.64 cards").
    After the fix: overflow 0, board.left 0.00, first-column-minus-title 0.00 at
    every one of the ten zooms; A5 0px; A6 ≥ 2.59 cards everywhere and still
    capping (scrollHeight 1157 vs clientHeight 373-928).
- NEW TEST INFRASTRUCTURE, and the reason it exists: headless Chromium launches
  with `--hide-scrollbars`, so `100vw === documentElement.clientWidth` in the
  suite and nowhere else — which is exactly why qa-sweep's and nav-slider's
  overflow assertions were green while real Chrome overflowed. e2e/zoom.spec.ts
  declares `test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })`,
  SCOPED TO THAT FILE (putting it in playwright.config.ts would shift geometry
  by 15px under the whole existing suite). Zoom is modelled with three knobs:
  viewport scaling for layout, a forced `html::-webkit-scrollbar` width injected
  via `context.addInitScript` for the scrollbar half (injecting after load does
  not relayout an existing scrollbar), and `documentElement.style.zoom` for
  fractional pixels. It also forces `html { overflow-y: scroll }`, because a
  zoomed-out viewport makes the page short and the scrollbar — and therefore the
  bug — disappears.
- Failures: none on either final tree. One genuine defect was DISCOVERED by the
  new spec at the 300% model and fixed in the same commit: the header's module
  switcher pushed the page 48-64px sideways at a 480px viewport (BUG-010).
- SPEC coverage touched: §2.7 board / column cap (ADR-056 A+B+C), the three
  boards' drag contract (ADR-042, ADR-050 unchanged in behaviour for a mouse),
  §15 "no horizontal overflow on every major screen" — now asserted along a
  ZOOM axis as well as a width axis, and for the first time with real
  scrollbars.
- Verdict: PASS for both commits. The full suite is the next gate's job; the
  sets above cover every spec that touches the changed CSS, the four shells, the
  three boards and the nav slider.

## Run 054 — 2026-08-19 — Review round + FULL gate on the drag-handle / zoom pair

- Suites/commands: `npx tsc --noEmit` · `npx vitest run` (embedded per-run
  Postgres, launched from `D:\CRM` — see the lowercase-cwd trap in Run 052) ·
  `npx playwright test`, the WHOLE suite, one full prod build + embedded e2e
  Postgres on a pid-derived port.
- Cases:
  · tsc clean (0 errors) on the final tree.
  · vitest **284 passed / 0 failed**, 23 files, 84.2s — unchanged from Run 053.
    Nothing under test here is a service: the changes are CSS geometry, a
    gesture surface and three e2e oracles.
  · Playwright, FULL SUITE: **59 passed / 0 failed / 2 skipped**, 61 total,
    9.1m. The 2 skips are the standing audit opt-ins (`e2e/audit.spec.ts`).
    `test-results/.last-run.json` → `{"status": "passed", "failedTests": []}`
    — read directly, not inferred from piped output.
    Against Run 053's baseline (46 + 2 skips before the To-Do work): +4
    board-touch, +5 zoom, +1 nav-slider A9, +3 todo-assign = 59.
  · MEASUREMENT RUN, before any code change, to settle finding 1 with numbers
    instead of arithmetic: a throwaway spec rendered all three boards in the
    real app, read every `.bcard` rect, then mutated the names to force the
    2-line clamp and the key datum to a long string and re-read. Result, at a
    218px column: B-Systems CRM 186.3 / 190.4 / **202.4px**, Partners pipeline
    160.1 / 160.1 / 176.2px, ByteForce CRM 147.2 / 162.2 / 178.3px. The shipped
    `--bcard-h: 176px` was documented as "the RICHEST card" and is beaten by the
    plain seeded B-Systems card. Spec deleted; the numbers are now in
    design-system.css, ADR-056 part C and BUG-009.
- What the round changed, and what each change is pinned by:
  · Cap floor 373px → **429px**, off a NEW `--bcard-h-max: 204px`; `--bcard-h`
    keeps sizing the ceiling. Pinned by zoom A6 (live card rect, and the seeded
    names now WRAP to the 2-line clamp so the live oracle and the frozen
    constant cannot drift apart unnoticed) and by byteforce-board, which derives
    the whole clamp from the CSS custom properties instead of the old literal
    `clientHeight <= 520` — that literal was viewport-independent only under the
    retired flat 510px ceiling.
  · Grip: full card height → **26 x 44px centred**. Pinned by two NEW
    assertions in board-touch: the grip's height is ≥24px (WCAG 2.5.8, both
    axes now) and ≤ half the card, and a NEW gesture (1b) swipes from the rail's
    own column BELOW the button and requires the column to scroll further.
  · board-touch's two `el.scrollTop = 0` / `el.scrollLeft = 0` resets replaced
    by real `touchSwipe` resets in a bounded loop, and the horizontal-pan check
    moved last so it needs no reset at all. Sample points come from live
    geometry (a `page.evaluate` that picks a card provably inside the list),
    because the fling decides how far the column travelled.
- Failures: none. No debris on the shared serial DB — every spec that seeds
  leads archives them (ADR-043), and the run's specs ran in file order with the
  drag-dependent journeys (3, 4, 5) green after board-touch and byteforce-board.
- Port note: 3100 was held for the whole session by an unrelated project's
  server (`D:\Healthcare App`, 404s on `/login`). Rather than kill another
  workstream's process, the full suite ran through a throwaway copy of
  playwright.config.ts with 3100 → 3105 and nothing else changed; the copy was
  deleted before commit. If this recurs, the config is one `process.env` read
  away from taking a port override.
- SPEC coverage touched: §2.7 board / column cap (ADR-056 part C, amended in
  place), the three boards' touch drag contract (ADR-056 part A, amended in
  place), §15 no-horizontal-overflow along the zoom axis (unchanged).
- Verdict: PASS. Brand audit PASS on the changed surfaces — no hex or
  `font-family` added anywhere in the diff, the new `.bcard-grip` rule uses
  `--color-hairline` / `--color-muted` / `--color-surface-tint` / `--color-ink`
  / `--color-primary` only (all three token files define each), and every new
  box property is logical (`inset-inline-end`, `inset-block`, `margin-block`,
  `margin-inline`), so the grip still flips to the card's left in Arabic — which
  board-touch asserts. The one repo-wide hex hit,
  `src/app/api/files/[id]/route.ts`, is the standalone missing-file HTML page
  served outside the app shell and outside the theming layer: pre-existing,
  documented, untouched here.

## Run 055 — 2026-08-20 — The agents pipeline (ADR-057): engine, migration, board — full gate
- Suites/commands: `npx tsc --noEmit` (after each of the three commits) ·
  `npx vitest run` (embedded per-run Postgres, launched from `D:\CRM` — the
  lowercase-cwd trap in Run 052 still applies) · `npx playwright test`, the
  WHOLE suite, on a COPIED config at port **3177** (`playwright.tmp3177.config.ts`,
  deleted after the run): 3100 was held by another workstream and 3000 by the
  founder's dev server, and no other workstream's process was touched.
- Cases:
  · tsc clean (0 errors) on commit 1, commit 2 and the final tree.
  · vitest **307 passed / 0 failed**, 24 files. Baseline before this work was
    304 in 23 files (Run 054's 284 plus the To-Do/undo work since). The delta:
    +13 engine cases (§10.2a's PA-1…PA-5, the config-shape test, illegal moves
    both directions, terminal refusals, the same-stage slot test, and the
    partner-unchanged regression block), +2 migration cases (NEW FILE
    `src/lib/services/agent-stages-migration.integration.test.ts`), +2 To-Do,
    +1 backup, +1 assign, +3 brand-tokens, minus the renames inside the existing
    partners suite. `src/lib/services/partners.integration.test.ts` 22/22 with
    the agent flow rewritten onto `contacted` / `qualified` and two NEW
    assertions that the agent card's move logs `PA-2` and `PA-4` while the
    portal_rep row keeps `PP-4a`.
  · Playwright, FULL SUITE: **62 passed / 0 failed / 2 skipped**, 9.3m. The 2
    skips are the standing audit opt-ins (`e2e/audit.spec.ts`).
    `test-results/.last-run.json` → `{"status": "passed", "failedTests": []}`,
    read from the file, not inferred from piped output.
    Against Run 054's 59 + 2 skips: +3 from the new `e2e/agent-pipeline.spec.ts`.
- THE MIGRATION, PROVED TWICE, TWO WAYS. This was the highest-risk part of the
  change and was not taken on trust:
  (1) An integration test that reads
      `prisma/migrations/20260819180000_agent_stages/migration.sql` off disk,
      strips comments, and executes the SHIPPED statements — so the test can
      never drift from the file that ships. Fixtures: an agent card at every one
      of the seven stages that could exist (lead, following_up, didnt_answer,
      meeting_setting, lost, won, and an already-migrated qualified), the `won`
      one carrying a REAL minted account (User + `bsystems_agent` role +
      PortalRep) plus a FollowUp and a Meeting; a partner at following_up; a
      converted partner with its directory Partner row; ActivityLog rows for
      both kinds; and an unconsumed UndoEntry for each kind.
      BEFORE: `{agent:lead 1, agent:following_up 1, agent:didnt_answer 1,
      agent:meeting_setting 1, agent:qualified 1, agent:won 1, agent:lost 1,
      partner:following_up 1, partner:won 1}` — 9 rows.
      AFTER:  `{agent:lead 1, agent:contacted 1, agent:didnt_answer 1,
      agent:meeting_setting 1, agent:qualified 2, agent:lost 1,
      partner:following_up 1, partner:won 1}` — 9 rows. Exactly two moved.
      The converted agent: `converted` still true, `agentUserId` unchanged, User
      still active + approved with its role, PortalRep the same row, FollowUp
      and Meeting both intact. Agent history reads `lead → contacted` and
      `contacted → qualified`; partner history still reads `lead → following_up`
      and `following_up → won`. The agent's pending UndoEntry is consumed; the
      partner's is untouched. Then RUN AGAIN: a full snapshot (prospects + logs)
      compares equal, and a second test runs it against an ALREADY-migrated
      database and asserts nothing moves.
  (2) A throwaway Postgres and the REAL `prisma migrate deploy`, not raw SQL:
      apply all migrations, delete the ADR-057 row from `_prisma_migrations` to
      rewind the ledger, insert live-shaped fixtures, then deploy. Prisma
      reported `Applying migration 20260819180000_agent_stages` and
      `All migrations have been successfully applied.`
      BEFORE `{agent:won 1, agent:following_up 1, agent:lead 1,
      agent:didnt_answer 1, agent:meeting_setting 1, agent:lost 1,
      partner:following_up 1, partner:won 1}`; converted card stage=won,
      converted=true, agentUserId intact, 1 followUp, 1 User, 1 PortalRep;
      agent log `following_up -> won`; partner log `following_up -> won`; agent
      undo consumed=false.
      AFTER `{agent:lead 1, agent:didnt_answer 1, agent:meeting_setting 1,
      agent:lost 1, partner:following_up 1, partner:won 1, agent:contacted 1,
      agent:qualified 1}`; converted card stage=qualified, converted=true,
      agentUserId intact, 1 followUp, 1 User, 1 PortalRep; agent log
      `contacted -> qualified`; PARTNER log still `following_up -> won`; agent
      undo consumedAt set.
      Ledger rewound and DEPLOYED A SECOND TIME: counts, the converted card, its
      relations and both logs identical — idempotent under the real deploy path,
      which is what `scripts/start.mjs` retries and what `/api/health`
      self-heals with. Probe script and its `.pgdata` directory deleted.
- What the e2e proves that nothing else can:
  · Kind = All renders exactly two `.board` elements; `[data-pipeline="partner"]`
    reads Lead / Didn't Answer / Following Up / Meeting Setting / Won / Lost and
    `[data-pipeline="agent"]` reads Lead / Contacted / Didn't Answer / Meeting
    Setting / Qualified / Lost, IN ORDER; neither carries the other's exclusive
    columns.
  · A drag in each board on the SAME page opens the right form and commits to
    the right column; dragging an agent card onto the partner board opens no
    modal and moves nothing (separate DndContexts — the drop never registers).
  · `?kind=partner` and `?kind=agent` each render exactly one board.
  · Arabic: both section headings translated, the agent columns read
    عميل محتمل / تم التواصل / لم يرد / تحديد اجتماع / مؤهَّل / خسارة, the first
    column sits to the RIGHT of the last (reading order preserved), and Partners
    still sits ABOVE Agents (stacking is block-axis).
  · The founder's second sentence, through the UI: create an agent card, drive
    it to Qualified through the gate, find the minted agent in the lead's
    "Responsible for this lead" roster, assign, then sign in as him in a second
    browser context and see the lead on his CRM board and his To-Do.
  · `e2e/partners-agents.spec.ts` rewritten onto the new vocabulary and now also
    asserts the partner "Won" option is NOT offered on an agent card, that the
    Qualified card is terminal (the sentence renders, no Next action select),
    and that the card lives in the Agents board and not the Partners one.
    Everything from the Converted badge through "Agent account created" to the
    agent signing in and landing on `/b-systems/crm` is unchanged — that is the
    proof the gate MOVED without changing what it collects.
- Failures found and fixed during the round (both in the new e2e, before any
  commit): the assign modal's `<option>` label is `"{name} — {role}"`, so
  selecting by a guessed label timed out — the test now reads the option's
  VALUE, which cannot drift with the formatting. And journey 3's column
  locators had to be scoped to `[data-pipeline="partner"]` or Playwright's
  strict mode fails on the DEFAULT view, where four stage ids appear twice.
- Not run: `/brand-audit` as a skill. The two new token families were instead
  pinned by three NEW assertions in `src/lib/brand-tokens.test.ts` (three-scope
  parity including `src/themes/neutral.css`, which that file never read before;
  the Tailwind `@theme inline` bridge; and a coverage walk over every stage of
  every pipeline that fails if `stageKey()` falls through to `lost` or returns a
  key with no `[data-stage-key]` rule). A grep over the changed `.ts`/`.tsx`
  files found zero hardcoded hexes or `rgb()`.

## Run 056 — 2026-08-20 — Agents pipeline: reviewer findings adjudicated, then the FULL gate again
- Suites/commands: `npx tsc --noEmit` · `npx vitest run` (embedded per-run
  Postgres, launched from `D:\CRM` — the lowercase-cwd trap of Run 052 still
  applies) · `npx playwright test`, the WHOLE suite, on a COPIED config at port
  **3111** (`playwright.alt.config.ts`, deleted after the run): 3100 was taken
  by another project's `next start` (`D:\Healthcare App`) and 3000 by the
  founder's dev server. Neither process was touched. · a standalone migration
  re-proof against a throwaway embedded Postgres on port 5449.
- Cases:
  · tsc **clean (0 errors)** on the final tree.
  · vitest **311 passed / 0 failed**, 25 files. Run 055 was 307 in 24 files;
    the +4 is the NEW `src/components/internal/historyPhrases.test.ts` (3 cases:
    PP-2 and PA-2 both carry §10.2/§10.2a's wording, every pipeline that can
    emit `number_added` is covered, and the row id the ENGINE stamps resolves to
    the phrase) plus a third case in the migration suite (SQL ↔ `importBackup`
    parity).
  · Playwright, FULL SUITE: **64 passed / 0 failed / 2 skipped**, 9.5m. The 2
    skips are the standing audit opt-ins (`e2e/audit.spec.ts`). Run 055 was
    62 + 2; the +2 are the toast-slot test and the filtered-empty-section test
    in `e2e/agent-pipeline.spec.ts`.
    `test-results/.last-run.json` → `{"status": "passed", "failedTests": []}`,
    read from the file, not inferred from the piped summary.
- THE MIGRATION, RE-PROVED FROM SCRATCH (it changed in this round, so it was
  re-run rather than re-read). A throwaway embedded Postgres, and the REAL
  `prisma migrate deploy` — no raw SQL, no rewinding of `_prisma_migrations`.
  The ADR-057 migration folder was moved OUT of `prisma/migrations` first, so
  the ledger was built the way production's was:
  · `migrate deploy` #1 applied **11** migrations (everything before the
    rename). `_prisma_migrations` has no `20260819180000_agent_stages` row.
  · Live-shaped fixtures inserted at the OLD stages: an agent card at each of
    following_up / lead / didnt_answer / meeting_setting / lost / won, the `won`
    one carrying a REAL minted account (User + `bsystems_agent` UserRole +
    PortalRep) plus a FollowUp and a Meeting; a partner at following_up; a
    converted partner with its directory Partner row; 4 ActivityLog rows; and
    3 UndoEntry rows — an OLDER partner-card entry and a NEWER agent-card entry
    belonging to the SAME admin, plus a second admin's entry.
    BEFORE `{agent:following_up 1, agent:lead 1, agent:didnt_answer 1,
    agent:meeting_setting 1, agent:lost 1, agent:won 1, partner:following_up 1,
    partner:won 1}` — 8 rows.
  · The folder restored; `migrate deploy` #2 reported exactly **1** migration
    applied — ``Applying migration `20260819180000_agent_stages` `` — and the
    row is recorded `finished_at NOT NULL`.
    AFTER `{agent:lead 1, agent:contacted 1, agent:didnt_answer 1,
    agent:meeting_setting 1, agent:qualified 1, agent:lost 1,
    partner:following_up 1, partner:won 1}` — 8 rows. Exactly two moved.
  · **21 of 21 assertions PASS, 0 FAIL**: both renames; the four untouched agent
    stages; BOTH partner rows untouched; `converted` still true; `agentUserId`
    unchanged; 1 FollowUp + 1 Meeting still attached; the User still
    active + approved with `bsystems_agent` and the SAME PortalRep row; the
    partner's directory row intact; agent History reading `lead → contacted` and
    `contacted → qualified` while partner History still reads
    `lead → following_up` and `following_up → won`; the dead-stage undo retired;
    **the older entry underneath it retired too** (ADR-045 honesty); the other
    admin's entry untouched.
  · IDEMPOTENCE, both ways: `migrate deploy` #3 applied **0** migrations, and
    the migration FILE re-executed by hand (the manual-psql / `migrate resolve`
    path the header advertises) left a full snapshot — prospects, logs and undo
    rows — byte-identical. A pending undo written AFTER the deploy SURVIVES the
    re-run, which is the case a back-to-back re-run structurally cannot catch.
  · FINAL row counts: `partnerProspect 8, activityLog 4, undoEntry 4, user 1,
    portalRep 1, partner 1, followUp 1, meeting 1`.
- NEGATIVE CONTROL (the guards were proved to bite, not just to be green): the
  OLD statement 3 was pasted back into the shipped file and the migration suite
  re-run — **all 3 cases went RED** (honesty promotion, the already-migrated
  case, and the SQL ↔ import parity diff). The fixed statement was then restored
  and the suite re-run green. Without this the new assertions would have been
  unfalsifiable.
- BRAND AUDIT (by hand — no Agent tool in this environment): **PASS**. No hex,
  `rgb()`, `hsl()`, arbitrary Tailwind value or `font-family` in any changed
  component (`PartnersBoard.tsx`, `pages.tsx`, `ProspectEventPanel.tsx`,
  `HistoryPanel.tsx`, the new `historyPhrases.ts`). Both new stage families
  exist in ALL THREE scopes — `branding/byteforce/tokens.css` (8 vars),
  `branding/b-systems/tokens.css` (8), `src/themes/neutral.css` (8) — are
  bridged in `globals.css`'s `@theme inline` and bound in `design-system.css`'s
  `[data-stage-key]` block. ByteForce: `contacted` sits on the Royal Violet ramp
  beside `following`/`meeting`, `qualified` on the Bold Orange ramp one step
  short of `won`; no value outside the palette + the ADR-014 danger red.
  B-Systems: `contacted` is Process Lavender, `qualified` Signal Pink — used as
  a well tint / accent bar / chip, never as a page surface or body text; no
  green, teal or orange. RTL: no physical left/right in any changed file;
  `.toast-wrap` is `inset-inline: 0`. No emoji in App A strings.
- Failures: none. The only red during the round was self-inflicted and fixed
  before the final run: the new toast e2e asserted `toHaveText` on the toast
  `<p>`, which also contains the `aria-hidden` "!" icon — it is `toContainText`
  now. Root-caused with an instrumented throwaway spec (dragged card, live
  `.col--over-valid`, actual toast text) rather than by retrying, and the
  throwaway spec was deleted. Nothing was filed in BUGS.md.

## Run 057 — 2026-08-21 — The accounting row ✓ carries its settled state (founder)
- Suites/commands: `npx tsc --noEmit` · `npx vitest run` (embedded per-run
  Postgres, launched from `D:\CRM` — the lowercase-cwd trap of Run 052 still
  applies) · `npx playwright test e2e/accounting.spec.ts` on the STOCK config at
  port **3100** (checked free first: nothing was listening on 3000 or 3100, so
  no copied config was needed and no other workstream's process was touched).
  The FULL Playwright suite is the phase gate's job, not this change's.
- Cases:
  · tsc **clean (0 errors)** on the final tree.
  · vitest **311 passed / 0 failed**, 25 files — the Run 056 baseline held
    UNCHANGED (this change adds no unit test; its contract is a rendered
    attribute + class, which is e2e's ground).
  · Playwright `e2e/accounting.spec.ts`: **5 passed / 0 failed**, 1.9m.
    Run 047 had 4 tests in this file; the +1 is the new
    *"the row ✓ turns green while the row is settled — and back again"*.
    `test-results/.last-run.json` → `{"status": "passed", "failedTests": []}`,
    read from the file rather than inferred from the piped summary.
    The four pre-existing tests are unchanged, assertions included — the first
    one still clicks `row.locator("button").first()` (the ✓) and still reads
    EGP 4,321 / 1,111 / 3,210 off the dashboard.
- What the new e2e actually proves (state, never paint): on a manual expense,
  an income row and the AUTO payroll row derived from the roster — the ✓ starts
  `aria-pressed="false"` and WITHOUT `row-toggle--acct-settled`; one click makes
  the existing green chip appear (Collected / Paid) AND the button report
  `aria-pressed="true"` + the class; a second click clears BOTH. Repeated under
  `company=bsystems` so the other brand's surface is exercised too. Rows are
  booked into a far-future month (`2099-01`); the bsystems rows are wiped anyway
  by the import test's replace-all a few tests later.
  **Two corrections after review (see Run 058), both applied to this spec.**
  (a) "no colour is ever sampled" was true and was the wrong call for the
  cross-brand leg: the state class is set by ONE React branch regardless of
  brand, so asserting it under `company=bsystems` added no brand signal at all.
  That leg now samples the resolved background once and compares it with the
  ByteForce one. (b) "an isolated far-future month" was not exact: the ✓ stamps
  the collection with TODAY's date, so between a click and its un-click an
  income row's cash sits in the CURRENT month by design. Every row still ends
  un-settled and the suite is serial with the absolute-total test first, so the
  isolation held — but the spec now says so in its own words, and a new leg
  deliberately walks the current-month view to prove the un-settle round trip
  from there too.
- Failures: none in the final run. Two reds on the way, both self-inflicted and
  fixed: (1) the first attempt at the AUTO-row assertion used
  `getByText("from roster")`, which is a strict-mode violation — the row carries
  the badge AND the type cell "Salary (from roster)"; it is `{ exact: true }`
  now. (2) one earlier full-vitest run showed a single failure in
  `src/lib/services/agent-stages-migration.integration.test.ts` (snapshot
  equality). It reproduced neither on the clean HEAD tree (3/3) nor on the final
  tree (311/311, twice), touches nothing this change edits, and is a flake of
  the shared embedded-Postgres round — recorded here rather than filed in
  BUGS.md, and worth a second look if it returns during the gate round.
- Brand audit (checklist, by hand): PASS on everything it checked — but it
  checked the wrong thing in one place, and Run 058 caught it. "…which already
  exist in ALL THREE scopes" was verified the way every automated guard here
  verifies it: by searching the FILES. In `branding/b-systems/tokens.css` the
  pair was declared inside the `.bs-mesh` rule, not inside
  `[data-brand="bsystems"]` — present in the file, absent from the scope, and
  with a bare `var()` and no fallback that means no green under a real B-Systems
  root. Fixed in Run 058 (moved into the scope) along with the guard itself:
  `src/lib/brand-tokens.test.ts` reads tokens per SCOPE now. The rest of this
  audit stands: no hex, no `rgb()/hsl()`, no `font-family` in any changed file;
  no physical left/right (the rule sets background/border-color/color only, so
  RTL is unaffected); no new token; no emoji added to any App A string. Contrast
  #1B7A44 on #E6F4EC = 4.73:1 (AA, normal text), identical in both brands.

## Run 058 — 2026-08-21 — Green settled ✓: reviewer findings adjudicated, then the FULL gate
- Scope: the ten reviewer findings on commit af52ab9 (the row ✓ carrying its
  settled state), verified one by one against the code, then the whole gate on
  the resulting tree. Everything below is the FINAL tree, folded into that same
  commit — nothing here shipped as a follow-up.
- Suites/commands: `npx tsc --noEmit` · `npx vitest run` (embedded per-run
  Postgres) · `npx playwright test` — the FULL suite, stock config, port
  **3100**. Both 3000 and 3100 were checked free before starting (nothing
  listening), so no config was copied and no other workstream's process was
  touched. All three launched from `D:\CRM` with a CAPITAL D: the first vitest
  attempt of this session ran from a lowercase `d:\CRM` and every one of the 25
  files died with "Vitest failed to find the runner" / "Cannot read properties
  of undefined (reading 'config')" — the Run 052 trap, still live. Worth knowing
  precisely, because it is easy to misread as a broken test: the SAME lowercase
  cwd also kills a single-file run on a clean HEAD, which looks like "this file
  cannot be run alone". It can. From `D:\CRM` a single-file run is fine and was
  used for the red/green probe below.
- Cases:
  · tsc **clean (0 errors)**.
  · vitest **312 passed / 0 failed**, 25 files. Run 057 was 311; the +1 is the
    new *"the accounting green pair is declared in ALL THREE brand SCOPES"* in
    `src/lib/brand-tokens.test.ts`. One existing test was also tightened (the
    ADR-019 parity check now reads the scope, not the file) — it stays green on
    the fixed tree and goes red on the broken one, see below.
  · Playwright FULL suite: **65 passed / 0 failed / 2 skipped**, 10.0m. Run 056
    (the last full round) was 64 + 2; the +1 is the accounting green test from
    this commit. The 2 skips are the standing audit opt-ins
    (`e2e/audit.spec.ts`). `test-results/.last-run.json` →
    `{"status": "passed", "failedTests": []}`, read from the file, not inferred
    from the piped tail.
- Findings adjudicated (10 — 2 medium fixed, 1 medium answered and covered,
  6 low fixed/absorbed, 1 low recorded as a boundary):
  · **The accounting green was NOT in the B-Systems brand scope** (medium,
    real, and the most valuable finding of the round). In
    `branding/b-systems/tokens.css` the pair sat inside the `.bs-mesh` rule —
    in the file, outside `[data-brand="bsystems"]`, since the day it landed in
    8fe9e05. Both consumers spend it through a bare `var()` with no fallback,
    so under a real B-Systems root the ✓ and the `.acct-chip--good` pill would
    paint no green at all; it only ever looked right because the accounting
    layout stamps `data-brand="byteforce"` on `<html>` and the scope div merely
    inherits. Moved into the brand scope. **The guards were blind because they
    all read the FILE:** `brand-tokens.test.ts` now extracts tokens from the
    SCOPE with a brace-matching `scopeBody()` — applied to the ADR-019 two-brand
    parity check AND to a new ADR-057-style three-scope check over
    `--color-acct-*`. Verified the new test actually bites: reverting the token
    move turns it RED (`expected [] to deeply equal [ '--color-acct-positive',
    '--color-acct-positive-tint' ]`), and the old file-scanning form stayed
    green through it: that is not a hypothesis, it is Run 057 — the whole suite
    was green on the misplaced tree.
  · **`aria-pressed` contradicted the accessible name** (medium, real; raised
    twice, as findings 2 and 7). `aria-label` carried the ACTION and flipped
    with the state, so a collected row announced "Mark pending, pressed". Fixed
    the way the APG says: the name is now the state (`Collected` / `Paid`) and
    never moves, `aria-pressed` carries on/off, and the action wording lives in
    `title` alone — which also dissolves the low finding that `aria-label` and
    `title` were the identical string being announced twice.
  · **Un-settling an income row can remove it from the month on screen**
    (medium, real behaviour, deliberately kept). Cash basis: a collected row
    lists under its issue month AND its cash month; clearing the collection
    clears the cash, so a row that was in the view only on the cash basis
    leaves it. The proposed fix (hold the row) would park an uncollected amount
    and its Pending receivable in a month it does not belong to. Kept, recorded
    in the ADR-054 addendum and the CHANGELOG in the founder's own terms, and
    the e2e now walks that leg — collect in `2099-01`, switch to the CURRENT
    month, un-settle the green ✓ THERE, assert the row leaves and is Pending
    again under `2099-01`.
  · **Token-file comments named a fence narrower than the shipped CSS** (low,
    real): all three said "scoped to .acct-chip" while `.row-toggle--acct-settled`
    had joined it. They are the surface `/brand-audit` reads, so all three now
    name both consumers and cite the addendum.
  · **A failed toggle was silent and a double click could undo itself** (low,
    real): `useAction` returned `busy` and `error` and both row action groups
    threw them away. The ✓ is `disabled` while its own request is in flight, and
    a `.row-error` renders beside the buttons — it matters more now that the
    button's colour is the row's primary state cue.
  · **The cross-brand e2e leg asserted only a class name** (low, real): the
    class comes from one React branch either way, so it carried no brand
    signal. That leg now samples the resolved background and compares it with
    the ByteForce one; the comment no longer claims to be the token guard and
    points at `brand-tokens.test.ts`, which is.
  · **The "isolated month" claim was not exact** (low, real): the ✓ stamps
    TODAY, so an income row's cash sits in the current month between a click and
    its un-click. No correctness change — serial workers, absolute-total test
    first, every row ends un-settled — but the spec comment, TESTING Run 057 and
    the PROGRESS entry now say it plainly instead of overclaiming.
  · **The roster's ⇄ toggle carries no state** (low, explicitly a judgment
    call): agreed and deliberately excluded — it moves an effective-dated
    segment, it is not a money-row settlement, and the founder asked about the
    ✓. Recorded as a boundary in the ADR-054 addendum so the next reader finds
    the reason instead of the gap.
- New/changed test files: `src/lib/brand-tokens.test.ts` (+1 test, and the
  ADR-019 check made scope-aware), `e2e/accounting.spec.ts` (the green test
  rewritten around the fixed accessible name, plus the cash-month leg and the
  cross-brand paint sample; the four pre-existing tests untouched).
- Failures: none. No flake this round — including
  `src/lib/services/agent-stages-migration.integration.test.ts`, the one Run 057
  saw fail once and could not reproduce; it passed in the full round here.
  Still not filed in BUGS.md, still worth watching.
- Brand audit (checklist, by hand): **PASS**, and this time on the scopes rather
  than the files. (1) No hex, no `rgb()/hsl()`, no `font-family` added outside
  `branding/` and `src/themes/` — the only `rgba(...)` in a changed non-token
  file is the e2e constant `NO_PAINT = "rgba(0, 0, 0, 0)"`, which is how
  `transparent` serializes out of `getComputedStyle`, named and commented as
  such. (2) Scope integrity: `--color-acct-positive` / `-tint` now resolve
  inside `[data-brand="byteforce"]`, `[data-brand="bsystems"]` and
  `[data-brand="neutral"]`, identical values in all three, proven by test rather
  than by eye. (3) B-Systems: no pink surface, no gradient, no mesh touched —
  `.bs-mesh` only LOST two declarations that never belonged to it; the green is
  the accounting exception, fenced and now correctly written down in the file.
  (4) ByteForce: palette untouched; no emoji added to any App A string (the ✓
  glyph is pre-existing button content). (5) RTL: the new `.row-toggle:disabled`
  and `.row-error` rules set opacity/cursor/font/color only — no physical
  left/right anywhere; the actions row gained `items-center`, a logical
  alignment. Contrast unchanged: #1B7A44 on #E6F4EC = 4.73:1 (AA, normal text).

## Run 059 — 2026-08-21 — One-month payroll adjustment (ADR-058): deduction/bonus writable, then the override
- Scope: the two commits of ADR-058, gated per commit. NOT the full suite —
  this session's gate was, by instruction, `npx tsc --noEmit` plus the
  accounting unit + integration tests plus `e2e/accounting.spec.ts`. The FULL
  suite belongs to `/phase-gate`.
- Suites/commands, all launched from `D:\CRM` with a CAPITAL D (the Run 052
  trap: a lowercase cwd kills vitest here, single-file runs included):
  `npx tsc --noEmit` · `npx vitest run src/lib/accounting
  src/lib/services/accounting.integration.test.ts` · `npx vitest run
  src/lib/brand-tokens.test.ts` · `npx playwright test e2e/accounting.spec.ts`
  on the stock config, port **3100** (checked free with `netstat` before every
  round — nothing listening on 3000 or 3100, so no config was copied and no
  other workstream's process was touched).
- Cases:
  · tsc **clean (0 errors)** before each of the two commits.
  · COMMIT 1 — vitest accounting **62 passed / 0 failed**, 4 files (engine 39,
    the new `src/lib/services/accounting.integration.test.ts` 10, import and
    export integration unchanged). New coverage: the negative-net refusal, the
    Int/negative/cap refusals, a net of exactly zero ACCEPTED (the boundary is
    not off by one), non-payroll rows stripped on write, clearing stores NULL
    and the export omits the key, a typed 0 stays 0, and editing an IMPORTED row
    preserves deduction 100 / bonus 50. Engine side: the adjustment reaching
    `expenseIn`, `pnl`, `netIn`, `treasuryThrough`, `departments` and
    `dashboard`, a bonus raising `apTotal` by exactly the bonus, and the roster
    standing untouched through it.
  · COMMIT 1 — Playwright `e2e/accounting.spec.ts` **6 passed / 0 failed**.
  · COMMIT 2 — vitest accounting **74 passed / 0 failed**, 4 files (+12 in the
    service integration file: every paid-state transition named in the brief —
    unpaid auto → override, paid auto → override, a deliberate un-approval,
    delete unpaid, delete paid with its ORIGINAL date, toggle-then-delete in
    both directions, move to another month, move to another person, move off
    payroll — plus the dormant-mark equivalence check that compares every total
    with and without the mark to the piaster, the roster-untouched check and the
    department-bucket check).
  · COMMIT 2 — Playwright `e2e/accounting.spec.ts` **7 passed / 0 failed**,
    2.0m. `test-results/.last-run.json` → `{"status": "passed",
    "failedTests": []}`, READ FROM THE FILE, not inferred from a piped tail.
  · `src/lib/brand-tokens.test.ts` **9 passed** — no new token was introduced
    (the row maths uses `.u-muted`, the modal banner `.info-banner`, the new
    action `.row-toggle--restore`, all existing and token-driven), and a hex /
    rgb / font-family scan over both touched UI files returns nothing.
  · Migration check: `prisma/migrations/.../migration.sql:35-36` already
    declares `"deduction" INTEGER` and `"bonus" INTEGER`. NO migration written.
- Failures found and fixed: **BUG-012** — `e2e/accounting.spec.ts` was ALREADY
  RED on a clean tree, before any of this work. Its cross-brand paint comparison
  sampled a settled ✓'s background the instant `toHaveClass(SETTLED)` resolved,
  and `.row-toggle` transitions `background-color` over .15s, so it read
  `rgba(230, 244, 236, 0.97)` against the ByteForce sample's solid
  `rgb(230, 244, 236)` — a different alpha every run (0.925 and 0.97 observed).
  Confirmed pre-existing by stashing the ADR-058 work and re-running the single
  test on clean `main`. Fixed with a `settledPaint()` helper that polls until
  the paint stops moving; the missing-token case the sampling exists to catch
  still fails, as a timeout rather than a mismatch.
- Two e2e failures of my own, both fixed before the commit: a strict-mode
  violation where the person's name matched both the modal banner and the Person
  option (scoped to `.info-banner`), and an assertion that tried to read a
  far-future member's salary off the Roster page, which evaluates everyone at
  TODAY by design (replaced with the two assertions that actually prove the
  roster stands — next month's derived row, and the row that returns after the
  override is deleted).
- Verdict: **PASS** for the stated scope. The full suite is `/phase-gate`'s job.

## Run 060 — 2026-08-21 — ADR-058 review round: the FULL gate on the final tree, plus a money proof
- Scope: the same two commits (ADR-058), re-gated after a review round whose
  seven findings were fixed and folded back into them. Unlike Run 059 this is
  the FULL gate: whole vitest suite, whole Playwright suite, brand audit, and a
  numbered money proof of the deduction and the bonus.
- Suites/commands, all launched from `D:\CRM` with a CAPITAL D (the Run 052
  trap: a lowercase cwd kills vitest here):
  `npx tsc --noEmit` · `npx vitest run` (whole suite) · `npx playwright test`
  (whole suite) on the stock config, port **3100** (`netstat` showed nothing
  listening on 3000 or 3100 before each round, so no config was copied and no
  other workstream's process was touched; the one orphaned `next start -p 3100`
  left by a cancelled round was verified by command line as this run's own child
  before being stopped).
- Cases:
  · `npx tsc --noEmit` — **clean, 0 errors**, on the final tree.
  · `npx vitest run` — **347 passed / 0 failed**, 26 files (was 339/26 on the
    pre-review tree: +8 new tests, all of them regression guards for this
    round's findings). New in `accounting.integration.test.ts`: 2b rewritten
    (the parked mark and the restore), 2c (a DELIBERATE un-approval, and that it
    stays gone), 4 rewritten against a distinct seeded approval date, 4b (an
    approval that ORIGINATES on the override), 6d (moving an on-hold override
    onto an approved person-month), 7 (the second covering row refused on both
    create and update, with the unlinked extra still allowed), 8 (no orphan mark
    where the roster posts no salary) and THE MONEY PROOF. New in
    `import.integration.test.ts`: the negative-net line refused before the
    REPLACE runs, and a negative-component line that still nets ≥ 0 imported
    untouched for fidelity.
  · `npx playwright test` — **FULL SUITE, 67 passed / 0 failed / 2 skipped**
    (`audit.spec.ts`, skipped by its own guard as before), 10.1m, exit code 0.
    `test-results/.last-run.json` → `{"status":"passed","failedTests":[]}`,
    READ FROM THE FILE, not inferred from a piped tail. Two assertions added to
    the override journey: the month and person fields are `disabled` in override
    mode, and a second payroll row for the same person-month is refused with
    *"already has a payroll row"* while the row count and the tile stay put.
  · BRAND AUDIT over the changed UI (`forms.tsx`, `expenses/page.tsx`,
    `dict/accounting.ts`, `design-system.css`) — **PASS**. (1) Hex / rgb /
    font-family scan over every added line: nothing. (2) Scope: the accounting
    shell re-stamps `[data-brand]` per company and the changed markup is
    brand-agnostic (`.info-banner`, `.field-input`, `.row-toggle--restore`,
    `.u-muted`, `text-brand-danger` → `--color-brand-danger`). (3) B-Systems: no
    pink surface, no gradient, no mesh; the one new rule uses
    `--color-surface-tint`, which is Lavender Mist there. (4) ByteForce: palette
    untouched, no emoji in any new App A string. (5) RTL: no physical
    left/right added. ONE FINDING, FIXED: the newly reachable
    `.field-input:disabled` state had no defined appearance and would have
    borrowed the browser's grey — given `--color-surface-tint` / `--color-muted`,
    both of which exist in ALL THREE scopes (`branding/byteforce/tokens.css:36`,
    `branding/b-systems/tokens.css:44`, `src/themes/neutral.css:31` and :27/:40).
- MONEY PROOF (`accounting.integration.test.ts` → "ADR-058 — the money proof",
  all figures Int piasters, EGP ×100). One month (2026-03), two people on the
  roster — Nour 500,000 in Branding, Sara 700,000 in Video — one collected
  invoice of 2,000,000, Nour's salary approved and Sara's not:
  | after | month payroll | paid | on hold | P&L expenses | P&L net | A/P | treasury | roster |
  |---|---|---|---|---|---|---|---|---|
  | 0 · two DERIVED salaries | 1,200,000 | 500,000 | 700,000 | 500,000 | 1,500,000 | 700,000 | 1,500,000 | 1,200,000 |
  | 1 · Nour −20,000 deduction, Paid | 1,180,000 | 480,000 | 700,000 | 480,000 | 1,520,000 | 700,000 | 1,520,000 | 1,200,000 |
  | 2 · Sara +30,000 bonus, On hold | 1,210,000 | 480,000 | 730,000 | 480,000 | 1,520,000 | 730,000 | 1,520,000 | 1,200,000 |
  | 3 · the ✓ on Sara's row | 1,210,000 | 1,210,000 | 0 | 1,210,000 | 790,000 | 0 | 790,000 | 1,200,000 |
  Every movement is exactly the adjustment and nothing else: −20,000 on the
  deduction (month total, paid spend, P&L expenses; +20,000 to net profit and to
  the treasury — the cash he did not pay out), +30,000 on the bonus (month
  total, on-hold, A/P) with paid spend, the P&L and the treasury UNMOVED,
  because an unapproved bonus is not cash. The ✓ then moves 730,000 from on-hold
  to paid in one step. `committedSalary` reads the ROSTER and never moves:
  1,200,000 in all four states — the proof no roster segment was written.
  NO PERSON COUNTED TWICE, at every step: 2 payroll rows for 2 distinct
  rosterIds, with the derived count falling 2 → 1 → 0 → 0 as the overrides take
  over. Departments: Branding 480,000, Video 730,000, shared Overhead 0, and
  480,000 + 730,000 = 1,200,000 − 20,000 + 30,000 exactly.
- Failures found and fixed in this round (each reproduced against the real
  database BEFORE the fix and re-measured after — see PROGRESS Entry 053):
  · HIGH — the shadow deleted the approval mark on ACQUIRE. Measured before:
    approved March salary paidExpenseIn 500,000 → create an On hold linked row →
    0, mark gone → delete the row → still 0, derived row back UNAPPROVED. After:
    500,000 → 0 (covered, on hold) → 500,000 with paidDate 2026-03-05 intact.
    Same via a move: two approved people 1,000,000 → 0 before, → 500,000 (only
    the covered one) and both marks standing after.
  · HIGH — two linked payroll rows for one person-month: 2 rows and
    paidExpenseIn 1,000,000 for one 5,000 EGP salary before; a 400 naming the
    existing row after, on create AND on update, with one row and 480,000.
  · MEDIUM — the import had no negative-net floor: `{amount: 5000,
    deduction: 9000}` imported to a net of −400,000 (an expense that ADDS EGP
    4,000). Refused by name now, before the REPLACE transaction, with
    `acctExpense.count` still 0. A line that nets ≥ 0 through negative
    components (5000 − (−1000) + (−2000) = 4000) still imports untouched:
    treasuryNow −400,000, paidExpenseIn 400,000.
  · LOW — the mark's approval date was rewritten with today: seeded 2026-03-05,
    read back 2026-08-21 before; 2026-03-05 through the create and the delete
    after. The old test could not catch it (it compared against the override's
    own date, which is today's); the fixture now seeds a distinct earlier date.
  · LOW — an orphan mark for a person-month the roster does not pay: after
    delete the mark persisted, and reactivating the member made autoPayroll
    return the salary `paid: true` with paidExpenseIn 500,000, nobody having
    ticked it. After: no mark, `paid: false`, 0.
  · LOW ×2, presentation — the two Arabic payroll labels both opened with
    «تعديل» (they now differ at word one, as the English pair does), and the
    override banner named a month frozen at open time while the month field
    stayed editable (both that field and the person are now locked).
  One e2e failure of my own, fixed before the gate: `getByRole("button",
  {name: "Cancel"})` inside `.modal` is a strict-mode violation — the × close
  button carries `aria-label="Cancel"` too. Scoped to `button.btn-ghost`.
- Verdict: **PASS** — full vitest, full Playwright, tsc and the brand audit all
  green on the final tree, with the money proof measured rather than asserted.

## Run 061 — 2026-08-21 — ADR-059: one prospect pipeline, Waiting, and the login as its own action
- Suites/commands: `npx tsc --noEmit` (clean at every one of the four commits) ·
  `npx vitest run` (full, from `D:/CRM`) · `npx playwright test` (full, build +
  `next start -p 3100`) · a throwaway-database migration proof run twice ·
  `/brand-audit` checklist.
- Cases: **vitest 359 passed / 0 failed** (26 files) · **Playwright 70 passed /
  0 failed / 2 skipped** (10.2 min); `test-results/.last-run.json` reports
  `"status": "passed"` with an empty `failedTests`, read alongside the summary
  line rather than a tail-piped result.
- MIGRATION PROOF (the highest risk in this change), on a fresh embedded
  Postgres, schema deployed WITHOUT the new folder, then seeded and migrated
  with the real `prisma migrate deploy`:
  · BEFORE — partner cards at every OLD stage: `lead 1 · didnt_answer 1 ·
    following_up 1 · meeting_setting 1 · won 1 · lost 1`, plus one already
    migrated agent at `contacted`. Totals: 7 prospects, 1 directory Partner,
    1 attributed lead, 7 ActivityLog rows, 6 follow-ups, 6 meetings,
    3 pending undo entries.
  · AFTER — `lead 1 · contacted 1 · didnt_answer 1 · meeting_setting 1 ·
    qualified 1 · lost 1`, agent `contacted 1` untouched. Same totals for every
    table (7 / 1 / 1 / 7 / 6 / 6) — nothing created, nothing deleted — and
    pending undo 3 → 1 (the affected admin's whole set retired, the bystander
    admin's entry survived).
  · Relations: the converted partner kept `converted`, its directory Partner,
    that Partner's attributed lead, and both child records. Its History was
    rewritten to the new vocabulary while the INTERNAL lead's `following_up`
    history was untouched. Zero rows left on a retired stage.
  · IDEMPOTENCE: `migrate deploy` again (no pending migrations) AND a raw
    re-execution of every shipped statement — the full snapshot compared equal.
- SPEC coverage touched: §10.2 PP-1…PP-9 in full (unit, per row, for BOTH
  kinds), §7.2/§7.2b/§7.2c, §10.1 and the V2 B-rows as a regression net (the
  new `cancelledDestinations` slot must answer identically for the three lead
  pipelines), §13 journeys 3 and the partners/agents pair.
- Failures found and fixed inside the round: (1) `historyPhrases` dropped the
  legacy `PA-2` key when the two configs collapsed into one — every agent card
  moved during ADR-057's two days would have lost its "Returned to Lead" pill;
  fixed by naming the retired id explicitly, with its own test. (2) Three e2e
  drag failures, all the same root cause: dnd-kit scores the collision on the
  dragged CARD's rect and the grip sits at the card's inline-start edge, so
  aiming the POINTER at a column centre leaves the card straddling its
  neighbour — a drop meant for Contacted landed in Lead. The helper now aims so
  the CARD lands centred, and scrolls both ends into view first (seven columns
  are wider and taller than six). (3) A To-Do assertion matched the Undo
  button's own label ("Moved Quiet Contact to Contacted"); scoped to the list.
- Verdict: **PASS** — tsc, full vitest, full Playwright and the brand audit
  green, with the data migration proved on a throwaway database rather than
  asserted.
## Run 062 — 2026-08-21 — ADR-059 review round: fourteen findings adjudicated, then the FULL gate
- Scope: the same four commits (ADR-059), re-gated after a review round whose
  findings were fixed and folded BACK into them — no fifth commit. Full gate:
  tsc, whole vitest suite, whole Playwright suite, brand audit, and a second
  migration re-proof on a throwaway database.
- Suites/commands, all launched from `D:\CRM` with a CAPITAL D (the Run 052
  trap: a lowercase cwd kills vitest here):
  `npx tsc --noEmit` · `npx vitest run` (whole suite) · `npx playwright test`
  (whole suite) on the stock config, port **3100** (`netstat` showed nothing
  listening on 3000 or 3100 before the round, so no config was copied and no
  other workstream's process was touched) · `npx tsx .audit/migration-reproof.ts`
  (throwaway embedded Postgres on port 5477, deleted afterwards).
- Cases:
  · `npx tsc --noEmit` — **clean, 0 errors**, on the final tree.
  · `npx vitest run` — **361 passed / 0 failed**, 26 files (was 359/26 at Run
    061: +2 net, +5 new assertions folded into existing tests). New:
    `todo.integration.test.ts` "PP-8: a follow-up recorded on a Didn't Answer
    card reaches the To-Do" and "PP-8: a follow-up recorded on a meeting card
    stands BESIDE the meeting" (the old case that pinned the opposite was
    rewritten, not deleted — it still asserts the terminals stay out and that a
    NEWER meeting supersedes a follow-up); `prospect-stages-migration.integration.test.ts`
    grew an unexpected-kind fixture (`reseller` at `following_up` and at `won`),
    a `fingerprintValid` column in the parity snapshot, an `updatedAt`
    before/after comparison on BOTH paths, and a surviving-undo fixture (a
    pending entry whose payload names a LIVE stage on a card the rename MOVES);
    `transition.test.ts` PP-6 now pins `requiredGroupForTarget` per kind for
    every active origin.
  · `npx playwright test` — **FULL SUITE, 71 passed / 0 failed / 2 skipped**
    (`audit.spec.ts`, skipped by its own guard as before), 11.0m, exit code 0.
    `test-results/.last-run.json` → `{"status":"passed","failedTests":[]}`,
    READ FROM THE FILE, not inferred from a piped tail. New row, `ok 38`:
    *"PP-6: an agent drags into Qualified with no modal; PP-4 still gates the
    partner"* — the agent's drop leaves `.modal` at count 0 and the card wears
    "No login yet"; the seeded Alexandria Trading House partner wears it too;
    the partner's own drop opens the completeness gate (Key person name,
    Importance) with NO password field, and Cancel reverts to Lead.
  · BRAND AUDIT over the changed UI (`PartnersBoard.tsx`, `pages.tsx`) — **PASS**.
    (1) Hex / rgb / hsl / font-family scan over every ADDED line in the diff:
    nothing. (2) No new class and no new i18n key: the partner card reuses
    `.bcard-tag` and the existing `pPipeline.noLoginYet` (EN + AR already
    shipped), so every existing English string is byte-identical. (3) Scope
    integrity re-measured with the same `scopeBody` parser the guard now uses:
    44 `--color-stage-*` tokens declared, 44 of them INSIDE the brand block, in
    all three of `branding/byteforce/tokens.css`, `branding/b-systems/tokens.css`
    and `src/themes/neutral.css` — none outside, and the Waiting family
    (`""`, `-accent`, `-chip`, `-chip-ink`) present in every scope. (4) B-Systems:
    no pink surface, no gradient, no mesh added. (5) ByteForce: palette
    untouched, no emoji. (6) RTL: no physical left/right added.
- MIGRATION RE-PROOF (`.audit/migration-reproof.ts`, throwaway embedded Postgres,
  port 5477, fresh data dir, deleted after the run). The production shape, not a
  simulation of it: the new folder is parked OUTSIDE `prisma/migrations`, the
  schema is deployed from scratch without it, production-shaped rows are written
  in the RETIRED vocabulary, and then the real `npx prisma migrate deploy` runs —
  exactly what `scripts/start.mjs` runs at boot.
  · STEP 1 — `migrate deploy` from scratch: **12 migrations found, 12 applied**,
    "All migrations have been successfully applied."
  · BEFORE — **6 prospect rows**: `agent:contacted=1 · agent:qualified=1 ·
    partner:following_up=1 · partner:waiting=1 · partner:won=1 ·
    reseller:won=1`. Prospect history `following_up->won=2 · lead->following_up=1`.
    Internal lead: stage `following_up=1`, history `new->following_up=1`.
    Pending undo `admin-x=2 · admin-y=1 · admin-z=1`.
  · STEP 2 — `migrate deploy` again: **13 migrations found**, the new one
    applied. AFTER — **6 prospect rows** (nothing created, nothing deleted):
    `agent:contacted=1 · agent:qualified=1 · partner:contacted=1 ·
    partner:qualified=1 · partner:waiting=1 · reseller:qualified=1`. The
    unexpected kind travelled WITH the partners, which is what `kind <> 'agent'`
    promises. Prospect history `contacted->qualified=2 · lead->contacted=1`.
    Internal lead UNTOUCHED: stage `following_up=1`, history `new->following_up=1`.
    Pending undo `admin-x=0` (the whole pending set of the admin holding a
    DEAD-stage snapshot retired, older row included) · `admin-y=1` · `admin-z=1`.
  · STEP 3 — IDEMPOTENCE, twice over: `migrate deploy` a third time reports
    **"No pending migrations to apply."**, and a raw re-execution of every
    shipped statement leaves the whole count structure byte-identical
    (`idempotent (run1 === run2): true`).
  · `updatedAt` untouched by the SQL across the whole run (`true`) — the property
    undo's fingerprint and the board's ordering both depend on, and the reason
    the restore twin was moved to `$executeRaw`.
  · `_prisma_migrations` tail: `20260818100000_vault_module finished=true ·
    20260819180000_agent_stages finished=true ·
    20260821180000_unified_prospect_stages finished=true`.
- MUTATION PROOFS (a green test proves nothing until it can fail):
  · Narrow the migration's seven `kind <> 'agent'` predicates to
    `kind = 'partner'` → the new fixture fails, naming the stranded rows
    (`reseller:following_up=1 · reseller:won=1` where `contacted`/`qualified`
    were expected). Restored byte-for-byte (`git diff` on `prisma/migrations/`
    empty) and re-run green.
  · Restore `tx.partnerProspect.updateMany` in `normaliseProspectStages` → the
    parity test fails on `fingerprintValid: true` vs `false`. Restored and
    re-run green (3/3).
- Findings adjudicated (14 raised, several duplicates of the same defect):
  · FIXED — the ONE board judged every drop with `partnersConfigFor("partner")`,
    so an AGENT dragged into Qualified opened a confirmation modal with no fields
    in it, against PP-6 and the file's own comment. `onDragEnd` now resolves
    `partnersConfigFor(card.kind)`; the shared config is kept only for rendering
    columns. Covered by a new e2e row and a new unit row.
  · FIXED — the To-Do filtered `didnt_answer` out by COLUMN while the engine
    offers "Record a follow-up" from there, so the record went nowhere. SPEC
    §7.2c is normative and wins; the projection is now every ACTIVE stage. The
    test that pinned the old behaviour was rewritten.
  · FIXED — a follow-up recorded on a `meeting_setting` card removed the MEETING
    from the To-Do (and from the card's datum). The meeting row no longer
    competes; the card keeps the meeting datum in its own column.
  · FIXED — `normaliseProspectStages` bumped `@updatedAt` where the SQL does
    not, which would strand a restored pending undo on a permanent 409 and
    re-sort the board. Now `$executeRaw`, with the parity test widened to diff
    `updatedAt` and fingerprint validity.
  · FIXED — a qualified PARTNER with no login was indistinguishable from one
    with an account (PP-4 sets `converted` at qualification). "No login yet" is
    now computed for both kinds from the detail's own two conditions; SPEC §7.2b
    narrowed to card-carries-state / detail-carries-action, recorded in ADR-059.
  · FIXED — the stage-token guard scanned the FILE, not the `[data-brand]`
    SCOPE, so a misplaced token would pass (the Run 058 blind spot). Routed
    through `scopeBody`, like the accounting-green guard beside it.
  · FIXED (housekeeping) — `SAME_STAGE_FORM_SLOT` deleted (zero callers, and it
    composed through the now-nullable `followUpStage`); the migration test grew
    the unexpected-kind fixture that turns its header's claim into an assertion;
    four stale comments in `prisma/schema.prisma` and `services/partners.ts`
    naming the deleted `won_agent` gate rewritten to cite `createAgentAccount` /
    `createPartnerLogin` and PP-4a.
  · REFUTED — "widen the migration's stranding guard to every card the
    statements moved". The suggested predicate (`p.stage IN
    ('contacted','qualified')`) matches ALL partner cards after a successful
    run, so a retry — which `scripts/start.mjs` and the `/api/health` self-heal
    both perform — would retire undo entries created AFTER the first run. That
    destroys the documented idempotence to fix a frozen LABEL that names a
    retired column while the undo itself still applies correctly (proved above:
    `admin-y` keeps his entry and its fingerprint stays valid). The guard's own
    comment scopes it to the dead-stage WRITE-BACK, which is what it does.
- Verdict: **PASS** — tsc clean, full vitest 361/361, full Playwright 71 passed /
  2 skipped / 0 failed with `.last-run.json` green, brand audit PASS, and the
  data migration re-proved on a throwaway database with before/after row counts
  and two mutation proofs rather than a re-read.

## Run 063 — 2026-08-22 — ADR-060: roster lock, media_campaign + bsystems dept, the module bar, the install identity
- Suites/commands:
  - `npx tsc --noEmit` — clean after every one of the four commits.
  - `npx vitest run src/lib/accounting src/lib/services/accounting.integration.test.ts`
    — 5 files, 99 passed / 0 failed (engine + NEW constants.test.ts vocabulary
    guard + services integration + export/import round trips). Includes the
    regression that PROVES no historical number moved: the founder's real
    export (backups/all-companies-2026-08-17.json) still round-trips with
    identical totals, UNEDITED — that file already holds two campaign
    expenses booked under the pass-through label, and both still count
    exactly as before.
  - `npx playwright test e2e/accounting.spec.ts e2e/module-bar.spec.ts
    e2e/qa-sweep.spec.ts e2e/zoom.spec.ts e2e/nav-slider.spec.ts
    e2e/i18n.spec.ts e2e/board-touch.spec.ts e2e/leads-filters.spec.ts` —
    36 passed / 0 failed (6.9m), `.last-run.json` status "passed". qa-sweep
    now samples 601px (the band the four-segment strip overflowed by +44px)
    on every role, and the NEW module-bar spec runs with real scrollbars.
  - `npx playwright test --config=playwright.port3200.config.ts
    e2e/app-icon.spec.ts` — 1 passed; run on a COPY of the config at port
    3200 because another workstream (D:\Healthcare App) held 3100; the copy
    was deleted afterwards, per the port rule. Proves on the BUILT app that
    the root apple-icon + manifest inject without a root layout, the (home)
    favicon is the real mark, and the group icons are untouched.
- Cases: 137 passed / 0 failed / 0 skipped (99 unit+integration, 37 e2e, one
  interim e2e failure fixed mid-round: the Arabic leg raced the locale switch
  — clicking عربي then navigating cancels the setLocale action; the test now
  waits for html[dir=rtl] before navigating).
- Failures: none outstanding.
- SPEC coverage touched: §15 sweep (overflow at the new 601px viewport);
  accounting module (ADR-052/054/058 journeys re-run green, byte-identical
  strings asserted); the four-shell switcher walk; RTL legs.
- Review fold (same session, before push — the fixes live INSIDE these same
  four commits): module-bar.spec.ts grew a 6th test (320px: the long labels
  really overflow their ~67px cells and the cut is a visible ellipsis on the
  label span — text-overflow never applies to the grid seg itself); both
  sheet tap-size loops (qa-sweep + module-bar) now pin width ≥44 as well as
  height (the EN toggle segment was ~35px wide); accounting.spec.ts asserts
  the roster pointer as VISIBLE adjust-banner text, not only the badge's
  hover-only title. Final-tree full-suite gate: Run 064 below.
- Verdict: PASS — all four commits carried their own green tests; the full
  suite remains the gate phase's job.

## Run 064 — 2026-08-22 — ADR-060 review fold, then the FULL gate on the final tree
- Suites/commands:
  - `npx tsc --noEmit` — clean on the final tree (and after every fold edit).
  - `npx vitest run` — **27 files, 378 passed / 0 failed** (93.6s), rerun on
    the final tree after the review fold.
  - `npx playwright test` — **FULL SUITE: 79 passed / 0 failed / 2 skipped
    (the opt-in AUDIT=1 pair)** in 8.4m, port 3100 (free this session — no
    config copy needed). `test-results/.last-run.json` →
    `{"status":"passed","failedTests":[]}`.
- Money proof (the REAL engine via tsx, piasters, vs an identical base):
  - `media_campaign` 345,678 piasters (EGP 3,456.78), paid: P&L
    totalExpenses **+345,678**, expenseByType.media_campaign = 345,678,
    net **−345,678**; month total (expenseIn) **+345,678**, netIn
    **−345,678**; treasuryThrough **−345,678**. Every delta EXACTLY the
    row's piasters.
  - Pass-through unchanged: client budget 1,000,000 in (fee 150,000),
    850,000 forwarded → net delta **+150,000 (the fee only)**,
    totalExpenses delta **0**, treasury delta **+150,000** — the held
    850,000 washed through treasury and never touched profit.
- Measured mobile numbers (review findings, verified by the new assertions):
  - 320px viewport (305px client width, real scrollbars): each module-bar
    1fr cell ≈67px; ACCOUNTING/BYTEFORCE/B-SYSTEMS genuinely overflow
    (scrollWidth > clientWidth asserted on the label span) and the cut now
    carries an ellipsis (computed text-overflow asserted on the SPAN — a
    grid seg ignores it). Page overflow still ≤1px. At 390px (~85px cells)
    nothing clips.
  - Burger-sheet switcher segments: all six ≥44×44px asserted in BOTH axes
    (qa-sweep + module-bar loops); the EN toggle segment was ~35px wide
    before `min-inline-size: 44px`.
  - The roster pointer is VISIBLE modal-banner text ("…open Payroll
    Roster.") asserted in accounting.spec — no longer only a hover title.
- Gate discovery (fixed test-side, see IMPLEMENTATION "board auto-scrolls
  under a held drag"): the FULL suite failed twice at
  board-touch's grip-drag — green in isolation, green in Run 063's subset,
  green in Run 062's full gate. Repro pinned to accounting.spec (heavier
  since this batch) running first; the trace showed the drop landing on
  "New → Meeting Setting": dnd-kit's edge auto-scroll slid the board a full
  column under the held finger, and the test's PRE-drag drop coordinate hit
  the next stage, whose form has no "Follow-up date" field. Product correct;
  test fixed to park outside the auto-scroll zones, re-aim at the LIVE
  column box, and assert the modal eyebrow names the intended stage
  (a mis-aim now fails in ms, not a 60s hang). Pair repro green (grip drag
  2.4s), then the full suite above.
- Brand audit (checklist, by hand, over the changed UI): **PASS**. Only raw
  colors in the changed set are src/app/manifest.ts's documented asset
  exemption (#1D267D mirrors --bs-indigo; PWA manifests cannot read CSS
  tokens — ADR-060). New CSS is token-only (all tokens pre-existing in all
  three scopes), logical-properties RTL-safe (min/max-inline-size), no new
  fonts, no emoji in App A strings, brand scopes untouched (bar renders
  inside each shell's own data-brand root).
- Failures: none outstanding.
- Verdict: **PASS** — the four folded commits plus the board-touch aim fix
  shipped together on this green tree.

## Run 065 — 2026-08-23 — ADR-061: date-only follow-ups + the Today chip
- Suites/commands:
  - `npx tsc --noEmit` — clean after each of the two commits.
  - `npx vitest run src/lib/services/todo.integration.test.ts
    src/lib/services/same-stage.integration.test.ts
    src/lib/services/bsystems.integration.test.ts
    src/lib/services/leads.integration.test.ts` — 4 files, 72 passed
    (date-only round: withTime pins added; the two 09:00-Cairo-default
    pins — bsystems "day-only follow-up", same-stage light form — now
    guard every role).
  - `npx vitest run src/lib/datetime.test.ts src/lib/brand-tokens.test.ts`
    — 2 files, 13 passed (new sameCairoDay unit test; three-scope guards
    untouched by the chip CSS, which adds no tokens).
  - `npx playwright test byteforce-board board-touch journey1… journey3…
    journey4… prospect-pipeline same-stage todo.spec todo-assign` —
    23 passed (date-only round: forms without time inputs, board key
    datum date-only, `Follow-up time` asserted absent, `.last-run.json`
    status passed).
  - `npx playwright test follow-up-today byteforce-board board-touch
    leads-filters` — 11 passed (chip round: toggle on shows only today's,
    off restores, chip count === rendered cards === pill, overdue card
    disappears/reappears, Arabic اليوم RTL pass; `.last-run.json` passed).
- Cases: 46 e2e + 85 unit/integration passed / 0 failed / 0 skipped
  (34 e2e re-run in both rounds counted once per round above).
- Failures: none.
- SPEC coverage touched: §6.2 field groups (follow_up date-only), §6.3/V2
  §2.3 boards, T-1/T-5 forms, journeys 1/3/4, ADR-042 parity, ADR-059
  prospect-board exclusion.
- Verdict: PASS — both commits green in isolation; full suite deferred to
  the phase gate as usual.

## Run 066 — 2026-08-23 — ADR-061: the Today-only To-Do
- Suites/commands:
  - `npx tsc --noEmit` — clean.
  - `npx vitest run src/lib/services/todo.integration.test.ts
    src/lib/services/same-stage.integration.test.ts
    src/lib/services/assign.integration.test.ts
    src/lib/services/bsystems.integration.test.ts` — 4 files, 70 passed.
    The ADR-059 record-driven prospect projection tests became the ADR-061
    absence guards (no stage, record or meeting brings a prospect row
    back; a control lead's follow-up still lists); new money-does-not-
    vanish test pins statement/milestone expected YESTERDAY under Today
    while an overdue follow-up stays invisible.
  - `npx playwright test todo.spec todo-assign prospect-pipeline` —
    12 passed (`.last-run.json` status passed): no Overdue heading, the
    prospect row absent with a recorded follow-up due today, the assign/
    take-it flow intact on a today-due row.
- Cases: 12 e2e + 70 integration passed / 0 failed / 0 skipped.
- Failures: none.
- SPEC coverage touched: ADR-041 To-Do projection (superseded in part by
  ADR-061), PP-8 To-Do half (removed by ADR-061 — pipeline side intact),
  statements/milestones due semantics.
- Verdict: PASS — commit green in isolation; full suite is the gate's job.

## Run 067 — 2026-08-23 — ADR-061 ship gate (review-round fixes folded in)
- Review round folded into the three ADR-061 commits before this gate:
  `followUpDueAt` gains the spring-forward re-anchor (+ new groups.test.ts),
  the Today chip's Cairo day is sampled post-mount / on press via the shared
  `useTodayFilter` (no SSR hydration mismatch, no stale count across Cairo
  midnight; one memoized pass + a cached Intl formatter), a PRESSED chip
  with cards merely hidden says "No follow-ups due today" (new key, real
  Arabic), and docs corrections (FIVE→FOUR removed time inputs; the
  chip-hides-overdue reading added to the founder-confirmation flag).
- Suites/commands:
  - `npx tsc --noEmit` — clean on the final tree.
  - `npx vitest run` (FULL) — 29 files, 382 passed / 0 failed / 0 skipped
    (new groups.test.ts pins: 09:00-Cairo default, an explicit posted time
    kept, and 2026-04-24 00:30 — a wall-clock that does not exist — staying
    on its POSTED date instead of the eve).
  - `npx playwright test` (FULL suite; build + `next start` on 3100) —
    82 passed, 2 skipped, 0 failed in 12.7m. The two skips are
    audit.spec's opt-in guard (`AUDIT=1`), pre-existing and unrelated.
    `test-results/.last-run.json`: status "passed", failedTests [].
- Brand audit (checklist, by hand, over the changed UI): **PASS**. The
  review round adds NO CSS and NO tokens — the new empty-state string rides
  the existing token-driven `.col-empty`, the chip CSS is unchanged
  (stage vars with token fallbacks only). No raw colors or font-family in
  the round's additions, no physical left/right properties, real Arabic on
  the one new key, existing EN strings byte-identical.
- Cases: 84 e2e (82 passed + 2 pre-existing opt-in skips) + 382
  unit/integration passed / 0 failed.
- Failures: none.
- SPEC coverage touched: full regression — §6.2 field groups, both CRM
  boards (§6.3 / V2 §2.3), all journeys, To-Do, accounting, portal — the
  ship gate for the three ADR-061 commits.
- Verdict: **PASS** — shipped to origin/main.

## Run 068 — 2026-08-23 — ADR-062 commit 1: the TodoDone table, service and walls
- Suites/commands:
  - Migration proof on a THROWAWAY embedded Postgres (fresh data dir, port
    5700-range): `prisma migrate dev --name todo_done` generated
    `20260823071649_todo_done` on top of the 13-migration head; then on a
    SECOND fresh throwaway `prisma migrate deploy` applied all 14 from
    scratch and a repeat run reported "No pending migrations to apply"
    (idempotent boot).
  - `npx tsc --noEmit` — clean.
  - `npx vitest run` on todo-done.integration.test.ts +
    backup.integration.test.ts + todo.integration.test.ts — 3 files,
    27 passed / 0 failed / 0 skipped.
- Cases: 27 passed / 0 failed / 0 skipped. Covers: check/uncheck round-trip
  with completer identity + idempotence; the IDENTITY rule (new follow-up =
  new id arrives uncheckable-clean, old id refused); the dueAt snapshot
  refresh on a rescheduled meeting; liveness walls (moved stage, archived,
  not-today, overdue, unarranged/resolved/superseded meeting); brand from the
  route (cross-brand 404 both directions); ADR-061 prospect-parented records
  404 in leadIdOfTodoRecord; money kinds (pending-expected-yesterday
  checkable, paid refused, completed/undated refused, byteforce refused);
  Postgres-level cascades through deleteLead (FollowUp cascade AND the
  hand-deleted milestone path); backup round-trip with a TodoDone row (ids +
  FKs + completer survive) and a pre-TodoDone payload restoring cleanly with
  zero marks.
- Failures: none.
- SPEC coverage touched: §5.8 (new — manual completion walls + identity), §3
  server-side permissions, backup/restore invariants (ADR-053 sync triangle).
- Verdict: **PASS** — commit 8c894e9.

## Run 069 — 2026-08-23 — ADR-062 commit 2: the projection's Done section + UI round
- Suites/commands:
  - `npx tsc --noEmit` — clean.
  - `npx vitest run` on todo.integration.test.ts + todo-done.integration.test.ts
    — 2 files, 32 passed / 0 failed / 0 skipped (the 8 new ADR-062 projection
    cases on top of the ADR-041/061 set, which is untouched and green).
  - `npx playwright test e2e/todo-done.spec.ts e2e/todo.spec.ts
    e2e/todo-assign.spec.ts e2e/i18n.spec.ts` (build + `next start` on 3100 —
    the port was free; no config copy needed) — 7 passed / 0 failed in 3.0m.
    `test-results/.last-run.json`: status "passed", failedTests [].
- Cases: 32 unit/integration + 7 e2e passed / 0 failed. New projection cases:
  manual check leaves Today for Done with the completer's name and unchecks
  back; day-scoped marks (yesterday's mark neither hides nor lists);
  dueAt-snapshot reset on an in-place reschedule; the founder's own example
  via the REAL event service (auto "moved" beats a prior manual check, not
  restorable); supersession (new task arrives unchecked); meeting outcome
  read over the stage it left for; money (checked statement hides TODAY only
  and is back unchecked tomorrow; paid/completed land as auto-dones;
  uncheckMilestone returns the task); done-list scoping per role. E2E: the
  accessible checkbox (aria "Mark done: …"), Done — N heading, line-through
  + "Done · Elmur", uncheck restore, the board's drag event minting the
  disabled "Moved to Meeting Setting" auto-done row while the new meeting
  task arrives unchecked; the agent checking HIS row and 403ing on an
  admin-bucket record id and on the money kinds; todo-assign + todo + i18n
  re-run untouched-green (existing EN strings byte-identical).
- Brand audit (checklist, by hand, over the changed UI): **PASS** — the
  checkbox is the native input every other screen uses, zero new CSS and
  zero new tokens (three-scope law untouched); done rows use existing
  utilities (`text-brand-muted`, `line-through`); no physical left/right
  properties (flex order keeps RTL); real Arabic on all 13 new keys.
- Failures: none.
- SPEC coverage touched: §5.8 (manual + automatic completion, Done section,
  restore asymmetry, money day-scope), §13's new To-Do completion clause,
  ADR-055 row actions regression, i18n byte-identity.
- Verdict: **PASS** — commit 01dbf41. (The FULL vitest + Playwright sweep is
  the phase gate's job, per the working agreement.)

## Run 070 — 2026-08-23 — ADR-062 SHIP GATE: review adjudication + full suite + migration re-proof
- Scope: the three ADR-062 commits (8c894e9 / 01dbf41 / 9da6541) after the
  review round was folded into them — the guard-first fix on both done
  routes, the checkbox's dead-network path, the Done section's day-scope
  label, the delayed-meeting clarification, and the route-level scope-wall
  tests that SPEC §13's clause was asserting without cover.
- Suites/commands:
  - `npx tsc --noEmit` — **clean** (0 errors), run twice: after the code
    fixes and again on the final tree.
  - `npx vitest run` (FULL) — **31 files, 408 passed / 0 failed / 0 skipped**
    in 59.6s. (+8 over Run 069's set: the new
    `src/lib/services/todo-done-routes.integration.test.ts`.)
  - `npx playwright test` (FULL suite). Port 3100 was held by another
    workstream, so the config was COPIED to `playwright.config.port3117.ts`
    (baseURL + `next start -p 3117`), run, and the copy deleted — the other
    process was never touched. **85 passed + 2 skipped (the pre-existing
    opt-in skips) / 0 failed** in 13.0m; exit code 0.
    `test-results/.last-run.json`: `{"status":"passed","failedTests":[]}`.
  - MIGRATION RE-PROOF on a THROWAWAY embedded Postgres (fresh data dir,
    port 6474, deleted after — never the dev or test cluster):
    `prisma migrate deploy` from scratch applied **14/14** migrations ending
    at `20260823071649_todo_done`; a SECOND `deploy` reported **"No pending
    migrations to apply"**; `prisma migrate status` → **"Database schema is
    up to date!"**. `_prisma_migrations`: **14 rows, none rolled back**.
    `public` base tables: **40**.
- Migration structure verified in the database itself (not from the schema
  file): `TodoDone` has 9 columns (`id`, `followUpId`, `meetingId`,
  `statementId`, `milestoneId` nullable; `dueAt` NOT NULL; `completedById`
  nullable; `completedByLabel` NOT NULL; `completedAt` NOT NULL); 6 indexes
  (pkey + FOUR unique — one per FK — + `TodoDone_completedAt_idx`); 5 foreign
  keys — FollowUp / Meeting / Statement / Milestone all `ON DELETE CASCADE`,
  `completedById → User` `ON DELETE SET NULL`.
- Row counts on the freshly migrated database: TodoDone 0, Lead 0, FollowUp
  0, Meeting 0, Statement 0, Milestone 0, User 0. Live check on that same
  throwaway: inserting one mark → TodoDone **1**; a SECOND mark on the same
  `followUpId` → **23505 unique_violation**; deleting the parent Lead →
  TodoDone **0** (the FollowUp cascade carries the mark out).
- Cases (the review round's additions): 8 new route-level integration cases —
  an anonymous POST answering **401 for a real record id and for a made-up
  one alike, with a byte-identical message** (the pre-fix code answered 404
  vs 401: this case is red on the old routes); `bsystems_sales` completing an
  internal-bucket task and 403 on an agent-owned one; agent and partner each
  reaching only their own record, with the wall holding for the UNCHECK too
  (the other man's mark survives); the money kinds refusing sales and agent
  and admitting the admin; the ByteForce route refusing the money kinds
  outright (400); brand both directions (byteforce_staff walled off a
  B-Systems record, the B-Systems admin off a ByteForce one); the ADR-061
  prospect-parented 404; a deactivated account refused on its OWN record;
  and the liveness wall still refusing the admin a not-today task. One new
  e2e case: a meeting delayed to ANOTHER day leaves Today with no Done row,
  while one delayed to later TODAY stays, unchecked (SPEC §5.8).
- Brand audit (checklist, by hand, over the changed UI — TodoBody,
  TodoCheckbox, the todo dict): **PASS**. Diff scanned for hex/rgb/hsl
  literals, `font-family`, and physical `left`/`right`/`ml-`/`mr-`/`pl-`/
  `pr-` properties: **zero hits**. The one new element is a
  `text-xs text-brand-muted` span inside the existing `.card-head`, which is
  `display:flex; justify-content:space-between` — so it mirrors in RTL by
  order, with no physical property. Zero new tokens (the three-scope law
  untouched); `--color-muted` and `--color-danger` confirmed present in all
  three scopes (branding/byteforce, branding/b-systems, src/themes/neutral).
  i18n: exactly ONE new key (`doneScope` — "Completed today" / "أُنجزت
  اليوم") with real Arabic; the dict diff is purely additive, every existing
  EN string byte-identical.
- Failures: none. Found and FILED, not fixed: **BUG-013** — undoing a T-7
  delayed reschedule leaves `outcome: "delayed"` on the meeting (pre-existing,
  in the undo snapshot's ref ordering; reproduced on the embedded test
  Postgres). It is why the To-Do keeps its `doneMeetingDelayed` label rather
  than deleting it as dead code.
- SPEC coverage touched: §5.8 (all clauses, plus the new delayed-meeting
  sentence), §13's To-Do completion clause — now actually backed by
  integration tests at the wall, which was the gap this round closed — §3
  server-side permissions, ADR-017 fresh-authorization re-read.
- Verdict: **PASS** — shipped to origin/main.

## Run 071 — 2026-08-25 — ADR-063: the optional follow-up time (both commits)
- Scope: the two ADR-063 commits — the `dueTimeSet` marker + migration +
  backfill (commit 1) and the four restored form inputs + every conditional
  follow-up display + docs (commit 2).
- Suites/commands:
  - `npx tsc --noEmit` — **clean** (0 errors), run after each commit's code.
  - `npx vitest run` (FULL) — **32 files, 420 passed / 0 failed / 0 skipped**.
    (+12 over Run 070's 408: the new
    `src/lib/services/follow-up-time.integration.test.ts` — 9 cases — and 3
    new `followUpDueTimeSet` unit cases in `groups.test.ts`.)
  - `npx playwright test` (FULL suite). Port 3100 was held by another
    workstream (a `D:\Healthcare App` Next server), so the config was COPIED
    to `playwright.port3111.config.ts` (baseURL + `next start -p 3111`), the
    suite run against it, and the copy DELETED — the other process was never
    touched. **88 passed + 2 skipped (the pre-existing opt-in skips) /
    0 failed** in 12.1m; exit code 0.
    `test-results/.last-run.json`: `{"status":"passed","failedTests":[]}`.
    (+3 over Run 070's 85: the new `e2e/follow-up-time.spec.ts`.)
- MIGRATION PROOF on a THROWAWAY embedded Postgres (fresh data dir, port 5877,
  deleted after — never the dev, test or e2e cluster). The interesting half is
  that the backfill was proved over REAL legacy rows, not an empty table:
  1. `prisma migrate deploy` on an empty database → 15/15 applied.
  2. Rewound to the PRE-ADR-063 state: `ALTER TABLE "FollowUp" DROP COLUMN
     "dueTimeSet"` + the migration's `_prisma_migrations` row deleted
     (verified absent: `dueTimeSet present before the migration: false`).
  3. Planted **5** follow-ups across both sides of Egypt's DST: 14:30 Cairo
     (summer), 09:00 Cairo (summer), 21:45 Cairo (summer), 09:00 Cairo
     (winter), 09:01 Cairo (winter). **BEFORE: 5 rows, 0 time-set.**
  4. `prisma migrate deploy` → the ADR-063 migration applied over that data.
     **AFTER: 3 time-set / 2 date-only** — 14:30, 21:45 and 09:01 marked
     chosen; both 09:00 rows (summer AND winter, i.e. the Cairo wall clock,
     not a fixed offset) left as days.
  5. IDEMPOTENCE: the migration SQL re-executed by hand → **identical
     counts (3/2)**; a third `prisma migrate deploy` → **"No pending
     migrations to apply."**
  6. DRIFT: `prisma migrate diff --from-config-datasource --to-schema
     prisma/schema.prisma --exit-code` on a second throwaway cluster →
     **"No difference detected."**, exit 0 — the hand-written SQL and
     schema.prisma agree.
- Backfill parity (unit-level, inside the vitest run): the integration test
  READS the UPDATE statement out of the shipped migration file and runs it and
  `backfillFollowUpDueTimeSet` (backup.ts's twin, used by `importBackup`)
  against identical fixtures, diffing the classification — so the restore path
  cannot drift from the migration.
- Founder-journey e2e (`e2e/follow-up-time.spec.ts`, all green): the optional
  input is present and NOT `required`; blank submits cleanly and renders a bare
  date on the lead's records, the board card and the To-Do row; a chosen 16:45
  renders "…, 16:45" in all three; 23:45 is still on TODAY's list (the Cairo
  day never moves); Arabic reads "وقت المتابعة (اختياري)" right-to-left and a
  time chosen there lands.
- Adjusted (behaviour deliberately reversed, not a regression): the three
  existing `Follow-up time` **absence** assertions from ADR-061 —
  `byteforce-board.spec.ts`, `journey4-portal-rep-cycle.spec.ts`,
  `same-stage.spec.ts` — now assert the OPTIONAL input is visible and carries
  no `required`, and their date-only assertions stay exactly as they were
  (all three leave the box blank).
- Failures/bugs filed: none.

## Run 072 — 2026-08-25 — ADR-063 review round + the full ship gate
- Scope: the five review findings raised against the two ADR-063 commits, and
  the complete gate on the tree that shipped. Fixes were folded into the two
  existing commits (`8ed1119` code/migration, `763d71d` forms/display/docs) —
  no third commit.
- Findings adjudicated (4 fixed, 1 refuted-as-a-defect but documented):
  1. **`importBackup` ran the ADR-063 backfill unconditionally** (medium) —
     CONFIRMED and FIXED. Reproduced RED first, on the embedded test Postgres,
     with a permanent regression test rather than a throwaway probe: a
     `dueTimeSet = false` FollowUp at `2026-08-20T07:00:00Z` (10:00 Cairo) was
     exported carrying `"dueTimeSet": false` and came back from `importBackup`
     as `true` (`AssertionError: expected true to be false`). The restore now
     runs the twin only for a PRE-marker payload —
     `predatesFollowUpDueTimeSet(rows)`, i.e. `rows.some(r => !("dueTimeSet" in
     r))`, because `exportBackup` has no `select` and a post-marker export
     always states the key. Same test GREEN after the gate.
  2. **`prisma/seed.ts` broke the `dueTimeSet = false ⇒ 09:00 Cairo`
     invariant** (low) — CONFIRMED and FIXED. The four seeded follow-ups were
     verified with `Intl` in Africa/Cairo as 10:00 / 11:00 / 12:00 / 13:00
     (all inside Egypt's DST window). Three now carry `dueTimeSet: true`; the
     partner-referred lead's moved `2026-08-21T09:00:00Z → 06:00Z` (09:00
     Cairo, same Cairo DAY) and stays unmarked, so the demo holds one example
     of each shape. Confirmed no test or spec pins those instants.
  3. **Four stale "UNREFERENCED since ADR-061" i18n comments** (low) —
     CONFIRMED and FIXED in `auth.ts`, `crm.ts`, `internal.ts`, `partners.ts`.
     Comments only: the four `followUpTime` strings are byte-identical
     (`"Follow-up time"` / `"وقت المتابعة"`), which `e2e/i18n.spec.ts` and the
     three form specs re-proved in the run below.
  4. **The twin's "safe to run on any database" comment** (medium, same fix as
     1) — CONFIRMED and CORRECTED: it was only ever true of rows marked TRUE.
  5. **The spring-forward hour-shift is now visible** (low) — REFUTED as a
     defect, DOCUMENTED as an accepted consequence. Re-measured by running the
     shipped `cairoToUtc`/`utcToCairo`/`followUpDueAt` algorithm over every
     2026 Egypt transition: **45 date×time cases, 45 keep their posted Cairo
     DAY, 3 clocks move** — 00:00/00:30/00:59 on 2026-04-24 → 01:00/01:30/01:59
     — and those three wall clocks do not exist that night. No instant both
     keeps the day and shows 00:30, so no behaviour change; noted beside the
     nudge in groups.ts.
- Suites/commands (final tree, all after the fixes):
  - `npx tsc --noEmit` — **clean** (0 errors, exit 0).
  - `npx vitest run` (FULL) — **32 files, 422 passed / 0 failed / 0 skipped**
    in 110.0s. (+2 over Run 071's 420: both new cases in
    `backup.integration.test.ts` — a post-marker export round-trips a
    date-only row at a non-09:00 Cairo instant unchanged, and a PRE-marker
    export with the key absent is still backfilled.)
  - `npx playwright test` (FULL suite) — **88 passed + 2 skipped / 0 failed**
    in 11.9m, exit code 0. `test-results/.last-run.json`:
    `{"status":"passed","failedTests":[]}` (read directly, not through a pipe).
    The 2 skips are the pre-existing opt-in `audit.spec.ts` pair, unchanged
    since Run 070. Port 3100 was again held by another workstream (the
    `D:\Healthcare App` Next server, PID 26384 — never touched), so the config
    was COPIED to `playwright.tmp3111.config.ts` (baseURL + `next start -p
    3111`), the suite run against it, and **the copy deleted** — verified by a
    clean `git status` before committing.
- MIGRATION RE-PROOF on a THROWAWAY embedded Postgres (fresh data dir
  `.pgdata/proof-adr063`, port 5799, deleted at the end — never the dev, test
  or e2e cluster). **16 checks, 0 failures.** Real `prisma migrate deploy`
  throughout, against the shipped migration file:
  1. Empty database → `prisma migrate deploy` → **15/15 migrations recorded
     finished**, `dueTimeSet` present.
  2. Deploy AGAIN → **"No pending migrations to apply."**, still 15;
     `prisma migrate status` → **"Database schema is up to date"**. Column
     shape read from `information_schema`: **boolean / NOT NULL / DEFAULT
     false**.
  3. Rewound to the PRE-ADR-063 world — `ALTER TABLE "FollowUp" DROP COLUMN
     "dueTimeSet"` + its `_prisma_migrations` row deleted (column verified
     absent; `prisma migrate status` then reported it pending).
  4. Planted **4** legacy follow-ups, read back through the Cairo wall clock to
     prove the instants: **2026-08-20 14:30 and 09:00 (summer, UTC+3)** and
     **2026-01-15 14:30 and 09:00 (winter, UTC+2)**.
  5. `prisma migrate deploy` → `Applying migration
     20260825093000_follow_up_due_time_set` over that data. **Both 14:30 rows
     → `dueTimeSet = true`; both 09:00 rows → `false`**, summer and winter
     alike (the rule is a Cairo wall clock, never a fixed offset). Recorded
     once: `finished_at` set, `applied_steps_count = 1`, `rolled_back_at` null.
  6. IDEMPOTENCE: a further `prisma migrate deploy` → **"No pending migrations
     to apply."**, exactly **one** `_prisma_migrations` row; then the
     migration BODY replayed by hand as `scripts/start.mjs` would on a boot
     retry — the `ADD COLUMN IF NOT EXISTS` did not throw and the backfill
     `UPDATE` **matched 0 rows**, classification byte-identical.
- Brand audit over the changed UI (roleForms, LeadEventPanel,
  ProspectEventPanel, portal groupForms, GroupHistory, internal/pages,
  partners/pages, b-systems crm page): **PASS** — zero hex / `font-family` /
  `rgb()` / `hsl()` in any added line, **no new CSS custom property** (so the
  "a token must exist in all three scopes" law is not triggered at all), the
  inputs wear the shared `field-input` / `field-label` classes that already
  resolve through the theming layer, no physical left/right utilities added
  (RTL, A-12), no `data-brand` touched, and **0 emoji across 521 added lines**.
  The only hardcoded colours in the repo remain the two pre-existing,
  out-of-scope ones (`app/api/files/[id]/route.ts`'s standalone HTML page and
  `app/manifest.ts`'s PWA colours) — untouched by these commits.
- Failures/bugs filed: none.
