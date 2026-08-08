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
