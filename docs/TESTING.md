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
