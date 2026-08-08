# Bug register — append-only

Format: `project-logging` skill (BUG-### | severity | where | repro | status). File bugs
the moment a failure is found; close them with a reference to the fixing commit/entry.

## BUG-001 — 2026-08-09 — vitest intermittently collects "no tests" via npm test
- Severity: minor (tooling flake, not product)
- Where: `npm test` / `npx vitest run` on Windows; roughly 1 run in 10 reports
  "Tests: no tests" with 0ms import and exits 1; the immediate rerun passes with
  the full suite. Correlates with vitest's `configLoader: 'native'` CJS/ESM warning
  on vitest.config.ts.
- Repro: run the suite repeatedly; non-deterministic.
- Status: open (workaround: rerun; every gate verdict in TESTING.md is from a run
  that actually collected the suite)
