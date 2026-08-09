# ByteForce × B-Systems Sales Platform

One platform, two brands, two applications in a single Next.js deployment (V2 —
the old partnership portal is merged into the B-Systems CRM, see
`docs/REQUIREMENTS-V2.md`):

| App | URL space | Brand | Users |
|---|---|---|---|
| ByteForce CRM | `/byteforce` | ByteForce | Internal ByteForce team |
| B-Systems CRM | `/b-systems` | B-Systems | Admin, internal sales, agents, partners — one role-aware app |

`SPEC.md` is the single source of truth for v1 behavior; `docs/REQUIREMENTS-V2.md`
(ADR-030) governs the V2 restructure and wins where they differ. The living
project memory is in `docs/` — architecture, ADRs, test log, bugs, progress. If it
isn't logged there, it didn't happen.

## Setup (cold start)

Requirements: Node 22+, npm. No database server needed — dev runs on SQLite (ADR-002).

```bash
npm install
cp .env.example .env            # then set AUTH_SECRET (e.g. `openssl rand -base64 32`)
npx prisma migrate dev          # creates dev.db and applies migrations
npx prisma db seed              # demo data for both brands (see accounts below)
npm run dev                     # http://localhost:3000
```

### Demo accounts (dev seed)

Everyone signs in at **`/login`** (one consolidated page, ADR-028) with an email or
phone; each account lands where its role points. Agents self-sign-up at
`/portal/signup`; partner accounts are auto-provisioned on conversion with the
password `{CompanyName}@Bsystemspartnership` (spaces stripped).

| Account | Identifier | Password | Lands in |
|---|---|---|---|
| **Admin (both entities)** | admin@byteforce.com | password123 | /b-systems |
| ByteForce staff | sara@byteforce.example | byteforce123 | /byteforce |
| B-Systems internal sales | omar@b-systems.example | bsystems123 | /b-systems/crm |
| B-Systems agent | 01001234567 | partner123 | /b-systems/crm |

The admin account is created by the seed in EVERY environment (local or
production) with exactly these credentials — name "Elmur", both entities, and
its password is re-asserted on every seed run. The other rows are demo data and
never seed on production (`NODE_ENV=production` skips them; force with
`SEED_DEMO=1`).

### B-Systems sections per role (V2 §2)

- **Admin:** Home · Leads · CRM · Won Leads · Partnership CRM · Partners · Agents ·
  Registrations · Statements · Users (incl. impersonation)
- **Internal sales:** CRM · Won Leads (never sees commissions)
- **Agents / Partners:** CRM (own leads, light forms) · Won Leads (with commission) ·
  Payments · Profile

## Test

```bash
npm test               # vitest — engine unit + service integration (dedicated test.db)
npm run typecheck      # tsc --noEmit
npx playwright install chromium   # once
npm run test:e2e       # Playwright — journeys 1–5 + security RBAC + QA sweep
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
`brand-*` Tailwind utilities (including the per-stage board column tints) —
components never hardcode colors or fonts. All three pipelines (ByteForce CRM, the
unified role-aware B-Systems CRM with its Negotiation stage and milestone-tab
confirm-win, and the Partnership CRM) run on one pure transition engine
(`src/lib/pipeline-engine/`) whose transition rows are each unit-tested; services
execute engine results atomically with their side effects and activity log.
Permissions are enforced server-side on every route (role + brand + owner-bucket
guards re-read from the DB per request). Full details: `docs/ARCHITECTURE.md`.

## Folder map

```
SPEC.md                  Master v1 specification + process contract (immutable)
docs/REQUIREMENTS-V2.md  The V2 restructure spec (normative for V2 behavior)
docs/                    Living logs: ARCHITECTURE, DECISIONS (ADRs), TESTING,
                         BUGS, IMPLEMENTATION, PROGRESS, CHANGELOG
branding/                Canonical brand tokens + founder logo/font drop zones
src/lib/pipeline-engine/ The shared engine — stages, transitions, configs
src/lib/services/        Use-case layer (transactions, side effects, activity log)
src/app/                 Route groups per app + brand-partitioned /api namespaces
e2e/                     Playwright: journeys 1–5, security RBAC, QA sweep
.claude/                 Agent tooling: skills, subagents, permissions
```
