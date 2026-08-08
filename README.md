# ByteForce × B-Systems Sales Platform

One platform, two brands, three applications in a single Next.js deployment:

| App | URL space | Brand | Users |
|---|---|---|---|
| ByteForce CRM | `/byteforce` | ByteForce | Internal ByteForce team |
| B-Systems CRM + Partners | `/b-systems` | B-Systems | Internal B-Systems team |
| Partnership Portal | `/portal` (+ `/portal/admin`) | B-Systems | External sales reps + admin |

`SPEC.md` is the single source of truth (product spec, business rules, testing plan,
Definition of Done). The living project memory is in `docs/` — architecture, ADRs,
test log, bugs, progress. If it isn't logged there, it didn't happen.

## Setup (cold start)

Requirements: Node 22+, npm. No database server needed — dev runs on SQLite (ADR-002).

```bash
npm install
cp .env.example .env            # then set AUTH_SECRET (e.g. `openssl rand -base64 32`)
npx prisma migrate dev          # creates dev.db and applies migrations
npx prisma db seed              # demo data: both brands + portal (see accounts below)
npm run dev                     # http://localhost:3000
```

### Demo accounts (dev seed)

| App | Login at | Identifier | Password |
|---|---|---|---|
| ByteForce CRM | /byteforce/login | sara@byteforce.example | byteforce123 |
| B-Systems CRM | /b-systems/login | omar@b-systems.example | bsystems123 |
| Portal admin | /portal/login | admin@b-systems.example | admin123 |
| Portal rep | /portal/login | 01001234567 | partner123 |

## Test

```bash
npm test               # vitest — engine unit + service integration (dedicated test.db)
npm run typecheck      # tsc --noEmit
npx playwright install chromium   # once
npm run test:e2e       # Playwright — SPEC §13 journeys 1–5 + security RBAC + QA sweep
                       # (dedicated e2e.db on port 3100; reset + reseeded per run)
```

## Deploy

```bash
npm run build && npm run start
```

- Set `AUTH_SECRET` and `DATABASE_URL` in the environment.
- Production database: switch `prisma/schema.prisma`'s datasource provider to
  `postgresql`, install `@prisma/adapter-pg` and swap it in `src/lib/db.ts`
  (one file), then regenerate migrations against Postgres (ADR-002).
- Uploads live in `./uploads` behind a storage abstraction (`src/lib/storage/`);
  point an S3-compatible driver at the same interface for cloud storage.

## Architecture in one paragraph

Brand theming is structural: each route group owns its `<html data-brand="…">`, and
all brand values live in `branding/*/tokens.css` consumed through semantic
`brand-*` Tailwind utilities — components never hardcode colors or fonts. All four
pipelines (two internal CRMs, the partners pipeline, the portal) run on one pure
transition engine (`src/lib/pipeline-engine/`) whose SPEC §10 rows are each
unit-tested; services execute engine results atomically with their side effects and
activity log. Permissions are enforced server-side on every route (role + brand +
ownership guards re-read from the DB per request). Full details:
`docs/ARCHITECTURE.md`.

## Folder map

```
SPEC.md                  Master specification + process contract (immutable)
docs/                    Living logs: ARCHITECTURE, DECISIONS (ADRs), TESTING,
                         BUGS, IMPLEMENTATION, PROGRESS, CHANGELOG
branding/                Canonical brand tokens + founder logo/font drop zones
src/lib/pipeline-engine/ The shared engine — stages, transitions, configs
src/lib/services/        Use-case layer (transactions, side effects, activity log)
src/app/                 Route groups per app + brand-partitioned /api namespaces
e2e/                     Playwright: journeys 1–5, security RBAC, QA sweep
.claude/                 Agent tooling: skills, subagents, permissions
```
