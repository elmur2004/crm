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
