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

## BUG-005 — 2026-08-12 — Log out emits an http:// redirect behind a proto-misreporting proxy
- Severity: major (scheme downgrade on one action; found by the
  2026-08-12 SSL audit round, not by a user report)
- Where: src/lib/auth/actions.ts logout() — signOut({redirectTo:
  "/login"}): next-auth 5 beta absolutizes redirectTo against the
  proxy-reported x-forwarded-proto, so behind a misreporting proxy
  (e.g. Cloudflare "Flexible" SSL) clicking Log out responded with
  Location: http://<domain>/login. The only code-reachable downgrade
  path found by the audit — everything else the browser loads is
  same-origin relative.
- Repro: deploy behind a proxy reporting x-forwarded-proto: http, sign
  in, click Log out, inspect the redirect response's Location header.
- Status: fixed (signOut({redirect: false}) + a relative redirect() —
  commit ce5ff36, Entry 021, TESTING Run 024)

## BUG-006 — 2026-08-14 — Arabic text cannot be stored or searched: local Postgres clusters are WIN1252
- Severity: major (the platform is bilingual; found while verifying the new
  Leads search in Arabic, not by a user report)
- Where: scripts/local-postgres.ts — `embedded-postgres` initdb ran with no
  flags, so on Windows the cluster inherited English_United States.1252 and
  every database (template0/1, postgres, crm) was created WIN1252. Any
  non-Latin-1 character raised SQLSTATE 22P05 `character with byte sequence
  0xd8 0xaf in encoding "UTF8" has no equivalent in encoding "WIN1252"` —
  on INSERT (an Arabic lead name) and on SELECT (an Arabic search query),
  surfacing as a 500 "This page couldn't load" on /b-systems/leads?q=<arabic>.
- Repro: `SELECT pg_encoding_to_char(encoding) FROM pg_database` on a cluster
  created before the fix → WIN1252; then insert any Arabic string.
- Status: fixed (ADR-044 — initdb `-E UTF8 --locale=C` on every local
  cluster, plus a start-up warning naming any pre-existing non-UTF8 data dir;
  Entry 033, TESTING Run 036 — unit: an Arabic lead name is found by
  listBsLeads search; e2e: an Arabic lead is created through the API and
  found through the Leads search box). The founder's existing .pgdata/dev
  cluster must be deleted and recreated (or migrated via an ADR-032 backup
  export/import) to accept Arabic locally; managed Postgres is UTF8 by
  default and was never affected.
