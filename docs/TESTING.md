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
