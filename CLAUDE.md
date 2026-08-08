# ByteForce × B-Systems Sales Platform

`SPEC.md` at the repo root is the **single source of truth** for everything: product behavior,
business rules, phases, testing, and Definition of Done. When anything conflicts with SPEC.md,
SPEC.md wins. Read it in full before the first line of code.

## Operating rules (non-negotiable)

1. **Session open:** run `/session-start` (reads `docs/PROGRESS.md`, current phase, open items,
   proposes a plan). **Session close:** run `/session-end` (writes the PROGRESS entry, updates
   TESTING/DECISIONS/IMPLEMENTATION as needed). Never end a session with undocumented changes.
2. **Log everything.** Decisions → `/log-adr`. Test runs → `/log-test`. Bugs → `docs/BUGS.md`.
   Discovered complexity or workarounds → `docs/IMPLEMENTATION.md` immediately.
3. **Build by phases** (SPEC §14). Run `/phase-gate` before advancing; do not start a phase
   before the previous one passes its gate.
4. **Ambiguity:** check SPEC §11 first, apply its default, log an ADR. If §11 is silent, choose
   the most reasonable default, log an ADR, and flag "Needs founder confirmation" in PROGRESS.
   Never invent behavior silently.
5. **Pipeline engine:** one shared, parameterized module. The transition tables in SPEC §10 are
   normative — every row implemented and tested. Use the `pipeline-engine` skill.
6. **Branding:** zero hardcoded colors/fonts in components. Tokens live in
   `branding/byteforce/tokens.css` and `branding/b-systems/tokens.css`, consumed via the theming
   layer (`data-brand` scope). App A = ByteForce brand; Apps B and C (portal) = B-Systems brand.
   Use the `byteforce-brand` / `bsystems-brand` skills; run `/brand-audit` after UI work.
7. **Permissions are server-side.** Portal reps can never reach other reps' data or set Won.
   Only portal admin moves deals to Won or touches milestones.
8. Use subagents proactively: `spec-guardian` before merging behavior, `qa-runner` for test
   rounds, `brand-auditor` before phase gates, `docs-keeper` for log entries.

## Default stack (deviations require an ADR)

Next.js (App Router) + TypeScript · Tailwind driven by CSS-variable tokens · Prisma + PostgreSQL
(SQLite ok in dev) · NextAuth credentials + roles · dnd-kit (portal kanban) · Zod server-side
validation · Vitest + Playwright · local `/uploads` behind a storage abstraction. Currency: EGP.
Timezone: Africa/Cairo (store UTC).

## Key paths

Route groups `/byteforce`, `/b-systems`, `/portal`, `/portal/admin` · engine `src/lib/pipeline-engine/`
· themes `src/themes/` · docs protocol in the `project-logging` skill.
