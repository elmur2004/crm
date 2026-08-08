# Architecture — living document

Status: **v0 scaffold** — complete to v1 in the first working session (SPEC §17).
Update on every structural change. Decisions that shape this file get ADRs.

## 1. System overview
One codebase, one deployment. Three applications separated by route groups and RBAC,
two brands separated by the theming layer. See SPEC §1.

## 2. Stack
Default per SPEC §2 (Next.js App Router + TS, Tailwind on CSS-variable tokens,
Prisma + PostgreSQL, NextAuth credentials, dnd-kit, Zod, Vitest + Playwright, local
uploads behind a storage abstraction). Status: proposed — confirm or deviate via ADR
during Phase 0, then record exact versions here.

## 3. Route map (draft — finalize in Phase 0)
```
/                    → brand-neutral entry or redirect (decide via ADR)
/byteforce/…         → App A (data-brand="byteforce"): home, leads, crm, clients
/b-systems/…         → App B (data-brand="bsystems"): home, leads, crm, clients,
                       partners-pipeline, partners
/portal              → App C landing (gradient + mesh hero), /portal/signup, /portal/login
/portal/…            → rep: crm, won-deals, profile
/portal/admin/…      → admin: dashboard, crm (combined/per-rep), won-deals, sales-team
/api/…               → route handlers; every mutation Zod-validated + role-checked
```

## 4. Module map (draft)
```
src/lib/pipeline-engine/   pure transition core + pipeline configs + side-effect handlers
src/lib/auth/              session, roles, guards (server-side)
src/lib/storage/           upload abstraction (local dev, S3-ready)
src/lib/metrics/           tested dashboard queries (SPEC §6.5, §8.5)
src/themes/                ThemeProvider, data-brand wiring, imports branding/*/tokens.css
src/components/shared|byteforce|bsystems/
prisma/schema.prisma       physical schema (from SPEC §9) — document decisions below
```

## 5. Data model
Logical model: SPEC §9 (field groups are child records; ActivityLog on every transition).
Physical schema decisions (indexes, enums vs strings, cascade rules): record here as made.

## 6. Theming architecture
`branding/byteforce/tokens.css` + `branding/b-systems/tokens.css` are canonical; scoped by
`[data-brand]`; Tailwind utilities map to the CSS variables; components use semantic
tokens only. Logo/font assets: founder drops files into `branding/` — record the actual
filename → slot mapping here (and as an ADR) once wired.

## 7. Open architecture questions
- [ ] Login identifier for portal reps (phone vs email) — A-4/§8.1, decide via ADR.
- [ ] Postgres locally vs SQLite-dev/Postgres-prod — decide via ADR.
- [ ] Real-time milestone unlock (poll vs SSE/websocket) — P-8, decide via ADR.
