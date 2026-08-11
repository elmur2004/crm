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

## BUG-002 — 2026-08-09 — dnd-kit hydration mismatch on portal boards
- Severity: minor (console error; no functional impact)
- Where: DealBoard — dnd-kit's auto-incremented `aria-describedby` id differed
  between SSR and client, logging a React hydration-mismatch console error on
  every board render (found by the Phase 5 QA sweep).
- Repro: open /portal/crm with the console open.
- Status: fixed (stable `id="deal-board"` on DndContext; QA sweep asserts clean
  consoles — TESTING Run 013)

## BUG-003 — 2026-08-09 — header nav overflows horizontally at 390px
- Severity: minor
- Where: AppNav (6 items under B-Systems: 156px overflow) and PortalNav (5px) at
  390px width — horizontal page scroll (found by the Phase 5 QA sweep).
- Repro: open /b-systems at 390px viewport.
- Status: fixed (flex-wrap on header + nav; sweep asserts ≤1px overflow at
  1440/1024/768/390 on every screen — TESTING Run 013)

## BUG-004 — 2026-08-11 — uploaded files lost on redeploy (proof link → "File missing from storage")
- Severity: critical (production data loss — every redeploy wiped ALL
  uploaded files: payment proofs, CVs, recordings, proposal/contract PDFs)
- Where: production hosting — uploads stored in `<cwd>/uploads` inside the
  app container. Found by the founder: a statement's proof link returned
  {"error":"File missing from storage"}.
- Repro: upload any file in production → redeploy → open the file's link →
  "File missing from storage".
- Root cause: the hosting platform rebuilds the app container on every
  deploy, wiping the container-local `<cwd>/uploads` directory, while the
  EXTERNAL Postgres keeps the attachment rows — DB and blob lifecycles
  diverged, so the UI kept linking files that no longer existed.
- Status: fixed (code — Entry 018, TESTING Run 021, ADR-035:
  UPLOADS_DIR-selected storage root; per-proof fileOk probes with
  missing-file UI states on Statements/Payments/printable document/
  prospect recordings; admin re-upload/replace path for paid statements;
  styled missing-file page for browser hits; /api/health uploads
  diagnostics). Durability itself is MITIGATION PENDING FOUNDER HOST
  ACTION: attach a persistent volume and set UPLOADS_DIR to its mount
  path (ADR-035). Already-lost blobs are unrecoverable unless an ADR-032
  backup export holds them — re-upload via Statements → Re-upload proof.
