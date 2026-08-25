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

Requirements: Node 22+, npm. The database is **PostgreSQL everywhere** (ADR-033);
locally an embedded Postgres runs from `node_modules` — no Docker, no install.

```bash
npm install
cp .env.example .env            # set AUTH_SECRET (e.g. `openssl rand -base64 32`);
                                # keep DATABASE_URL=postgresql://postgres:postgres@localhost:5433/crm
npm run db:up                   # terminal 1 — local Postgres (keep it running)
npx prisma migrate deploy       # terminal 2 — apply migrations
npx tsx prisma/seed.ts          # demo data for both brands (see accounts below)
npm run dev                     # http://localhost:3000
```

### Demo accounts (dev seed)

Everyone signs in at **`/login`** (one consolidated page, ADR-028) with an email or
phone; each account lands where its role points. Agents self-sign-up at
`/portal/signup`; partner accounts are created automatically at conversion with
the email + password the admin fills into the Won gate.

| Account | Identifier | Password | Lands in |
|---|---|---|---|
| **Admin (both entities)** | admin@byteforce.com | password123 | /b-systems |
| ByteForce staff | sara@byteforce.example | byteforce123 | /byteforce |
| B-Systems internal sales | omar@b-systems.example | bsystems123 | /b-systems/crm |
| B-Systems agent | 01001234567 | partner123 | /b-systems/crm |

The admin account is guaranteed in EVERY environment (local or production):
the app creates/repairs it before each sign-in attempt and PINS its password
to `ADMIN_PASSWORD` (env var; default `password123`) — name "Elmur", both
entities. To rotate the admin password in production, set `ADMIN_PASSWORD`. The other rows are demo data and
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
npm test               # vitest — starts its OWN fresh embedded Postgres (port 5434)
npm run typecheck      # tsc --noEmit
npx playwright install chromium   # once
npm run test:e2e       # Playwright — journeys 1–5 + security RBAC + QA sweep
                       # (own fresh embedded Postgres on 5435; app on port 3100)
```

Tests never touch your dev database — each suite boots and destroys its own
instance.

## Deploy

```bash
# build (needs NO database — pages are force-dynamic):
npm run build
# start (migrate first, every boot):
npx prisma migrate deploy && npm run start
```

- `DATABASE_URL=postgresql://user:pass@host:5432/dbname` (your managed Postgres)
  and `AUTH_SECRET` are required; set `AUTH_URL=https://your-domain` behind a proxy.
- First boot only: `NODE_ENV=production npx tsx prisma/seed.ts` creates THE admin
  (and nothing else) — then rotate its password.
- Uploads live in `./uploads` behind a storage abstraction (`src/lib/storage/`);
  mount it as a volume, or point an S3-compatible driver at the same interface.
- Moving between databases (or disaster recovery): the admin's Export/Import on
  the Home page restores a full backup onto any empty, migrated database — this
  is exactly how the dev data crossed from SQLite to Postgres.

### Phone notifications (web push) — optional, ADR-065

Push is OFF until the host has a VAPID keypair. With none set the app behaves
exactly as it did before the feature existed: no enable button, no service
worker registered, nothing sent. To switch it on, set these on the HOST (the
same place `DATABASE_URL` and `AUTH_SECRET` live) and restart:

| variable | required | what it is |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | yes | the public half; browsers receive it, so it is not a secret |
| `VAPID_PRIVATE_KEY` | yes | **secret.** Anyone holding it can push to every subscribed device |
| `VAPID_SUBJECT` | no | a `mailto:` or `https:` contact for the push services; defaults to `AUTH_URL`, then to the production origin |

Generate a pair with `npx web-push generate-vapid-keys` (the package is already a
dependency). Never commit them, never put them in a file inside the repository.
Both keys are read at RUNTIME on every request — there is deliberately no
`NEXT_PUBLIC_` variable here, because that would be baked into the client bundle
when the container builds, which happens before anything can be set on the host.
Rotating the pair is safe: a subscription is welded to the key it was made with,
so the control notices the mismatch, reads as OFF again on each device, and one
press re-subscribes it against the new key.

Then, on each device: open the app, press the bell, and press **Turn on phone
notifications**. On iPhone/iPad this works only from an app added to the Home
Screen and opened from there (iOS 16.4+); the control says so when it detects a
plain Safari tab.

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
