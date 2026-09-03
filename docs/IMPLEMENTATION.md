# Implementation notes — living document

Module-by-module notes: what exists, where it lives, how it works, known limitations,
gotchas and workarounds. Write here **immediately** when something non-obvious is
discovered — never leave it only in the session's context. Keep newest notes appended
under the relevant module heading.

_Format per module:_
```
## <module / area>
- Location:
- What exists / how it works:
- Limitations / gotchas:
- Last updated: YYYY-MM-DD (Entry/ADR refs)
```

## Stack scaffold (kickoff)
- Location: repo root configs + `src/app/` shell + `prisma/` + `e2e/`.
- What exists / how it works: hand-written Next.js 16 App Router skeleton —
  `create-next-app` refuses a non-empty directory and would have clobbered README /
  .gitignore, so package.json, tsconfig, next/postcss/vitest/playwright configs and the
  brand-neutral `src/app/` shell were written directly (versions in ARCHITECTURE.md §2).
  Verified green: `npm run build`, `npm run typecheck`, `npx prisma generate`,
  `npm test` (TESTING.md Run 001).
- Limitations / gotchas:
  - **Prisma 7 `init` injects vendor agent-skills** into `.claude/skills/prisma-*`,
    plus `.windsurf/`, `.agents/`, `skills-lock.json`, and appends to `.gitignore`.
    The injected folders were deleted to keep the curated `.claude/` scaffold clean —
    expect them to reappear on future `prisma init`-style commands and re-delete.
  - Prisma 7 config lives in `prisma.config.ts` (root) and needs `dotenv` as a dev
    dep; the datasource URL comes from `DATABASE_URL` env, not schema.prisma.
  - SQLite connector supports **neither enums nor Decimal** → strings + integer EGP
    (physical decisions in ARCHITECTURE.md §5).
  - TypeScript resolved to **7.0.2 (tsgo era)** — build + typecheck pass today; if a
    tool in the chain chokes later, pin back to 5.x and ADR it.
  - `next build` auto-rewrites tsconfig (`jsx: react-jsx`, extra includes) — expected,
    keep its edits.
  - Playwright browsers are **not** downloaded yet (`npx playwright install` deferred
    until Phase 1 E2E work); `e2e/` holds only a README.
  - Vitest test currently: `src/lib/brand-tokens.test.ts` — palette + `[data-brand]`
    scope + ADR-001 guard (strips CSS comments before asserting the banned hex, since
    the token file header legitimately cites it).
  - **No top-level `src/app/layout.tsx` — deliberate and load-bearing.** The brand
    tokens are `:root[data-brand]`-scoped, so `data-brand` must sit on `<html>`;
    Next.js only allows per-section `<html>` via multiple root layouts, which require
    every route to live inside a route group (current: `src/app/(home)/`; brand groups
    land in Phase 0 per ARCHITECTURE §3). Do NOT "helpfully" re-add a top-level
    layout — it silently kills all brand theming.
- Last updated: 2026-08-08 (Entry 001, ADR-002…005, ADR-010…019)

## Pipeline engine (Phase 0)
- Location: `src/lib/pipeline-engine/` — constants.ts (every enum union + labels),
  types.ts (engine contract), transition.ts (pure core), configs/{internal-crm,
  partners,portal}.ts, index.ts barrel, transition.test.ts (every §10 row).
- What exists / how it works: `transition(config, {stage}, event, {role})` returns
  `{toStage, requiredGroup, sideEffects[], logTrigger, auto}` or a typed reject.
  Events: next_action, drag (portal only), proposal_sent, meeting_outcome,
  number_added, admin_won. The engine never touches the DB — services (Phase 1+)
  persist the move + group + side effects in one transaction and write ActivityLog
  from `logTrigger` (T-10). Follow-up context is derived from the ORIGIN stage
  (T-1 "context per origin"): proposal stage → after_proposal, meeting stage →
  after_meeting, else initial — this applies to drags too.
- Limitations / gotchas: T-8 cancelled→Following Up also yields context
  after_meeting (the origin rule; UI titles it "Following up after meeting").
  PP-2's "max two extra numbers" is structural (only number2/number3 columns exist;
  services reject when both are filled). Won gate completeness (PP-4) is enforced by
  the Zod schema of the `won_partner` group at the service boundary, not inside the
  pure engine.
- Last updated: 2026-08-08 (Entry 002, TESTING Run 003)

## Auth (Phase 0)
- Location: `src/lib/auth/` — index.ts (NextAuth v5, two Credentials providers),
  config.ts (edge-safe split config), guards.ts (ApiError, requireUser/requireRole/
  requireBrandStaff/requirePortalAdmin/requireDealAccess, handleRoute wrapper),
  hash.ts (bcryptjs cost 12), phone.ts (normalization + identifier kind), actions.ts
  (login/logout server actions); src/middleware.ts (coarse gating);
  src/app/api/auth/[...nextauth]/route.ts.
- What exists / how it works: JWT sessions carry {userId, roles[]}; guards re-read
  active+roles from DB per request (ADR-017). Providers enforce side separation:
  `internal` authenticates staff roles only, `portal` authenticates portal roles only
  (§3 "apps invisible across sides" starts at login). Middleware registers as
  Next 16 "Proxy" from src/middleware.ts (filename still supported).
- Limitations / gotchas: **prisma init's .env has no trailing newline** — appending
  vars with `>>` corrupts DATABASE_URL (cost a debugging round; .env rewritten).
  Prisma 7 requires a driver adapter: `@prisma/adapter-better-sqlite3` (export name
  is `PrismaBetterSqlite3`, lowercase "qlite"). AUTH_SECRET is generated into .env;
  `trustHost: true` is set for the single self-hosted deployment.
- Last updated: 2026-08-08 (Entry 002, TESTING Run 003)

## Theming (Phase 0)
- Location: src/app/globals.css (@theme inline mapping + bg-brand-hero/text-brand-meta
  utilities), src/app/(byteforce)/layout.tsx, src/app/(bsystems)/layout.tsx,
  src/themes/assets.ts, src/components/shared/BrandLogo.tsx, public/brand/ (served
  copies of branding/ logos).
- What exists / how it works: brand-prefixed utilities (bg-brand-primary,
  font-brand-display, rounded-brand-card, …) resolve at runtime against the active
  [data-brand] scope — verified in the built CSS. Fonts: fontsource packages
  (@fontsource/raleway 500-800, inter 400/500/700, jetbrains-mono 500) imported in
  the (bsystems) root layout — @font-face under literal family names, satisfying
  ADR-013 (refinement: files ship via npm instead of public/fonts/, same mechanism).
  Lama Sans still pending (A-13) — branding/byteforce/fonts/ exists but is empty.
- Limitations / gotchas: logos must be copied from branding/ to public/brand/ when
  founder drops new files (Next serves /public only); BrandLogo renders a
  typographic fallback for missing slots.
- Last updated: 2026-08-08 (Entry 002)

## App A services + API (Phase 1)
- Location: `src/lib/services/` (groups, leads, clients, sales-reps, metrics,
  activity), `src/lib/api/internal-crm.ts` (brand-fixed route-handler factory),
  `src/app/api/byteforce/**`, `src/lib/api-error.ts`.
- What exists / how it works: `applyLeadEvent` is the single write path for every
  pipeline move — engine transition → mandatory group payload (Zod, groups.ts) →
  one `$transaction` persisting move + group child record + side effects +
  ActivityLog. Event pre-writes: `proposal_sent` marks the latest unsent proposal;
  `meeting_outcome` stamps outcome/destination on the latest meeting;
  `meeting_reschedule` updates its datetime and RESETS outcome to null. A-1 client
  mapping lives in `createClientFromWon` (service ← latest proposal, toBeCollected =
  est − collected, upsert by leadId). Metrics implement §6.5 with ADR-012.
- Limitations / gotchas:
  - **Commit model**: every transition commits event + required group in ONE
    mutation; cancel = no request. Consequence: a proposal cannot be created
    already-sent — the UI saves it unsent, then "Mark as sent" fires `proposal_sent`
    with the after-proposal follow-up form (T-5's §5.3 narrative preserved).
  - ApiError lives in `src/lib/api-error.ts` NOT in guards — importing guards pulls
    the NextAuth runtime, which vitest cannot load (`next/server` resolution).
  - Integration tests: dedicated `file:./test.db` via vitest env + globalSetup
    migrate deploy; `fileParallelism: false` and 30s timeouts (SQLite-on-Windows
    transactions are slow, ~1-3s per multi-write test).
- Last updated: 2026-08-09 (Entry 003, TESTING Run 005)

## App A UI (Phase 1)
- Location: `src/components/internal/` (pages.tsx server bodies, LeadEventPanel,
  GroupHistory, HistoryPanel, forms, AppNav), `src/components/shared/` (StatCard,
  StageBadge, BrandLogo), `src/app/(byteforce)/byteforce/(app)/**`.
- What exists / how it works: page bodies are brand-parameterized server components
  (`InternalAppCtx {brand, basePath, apiBase}`) — Phase 2 mounts the SAME bodies
  under /b-systems. The `(app)` subgroup carries the nav layout + page-level auth;
  login stays outside it. LeadEventPanel implements §6.1/§6.2's conditional groups:
  next-action select opens the target stage's form; stage-contextual panels surface
  §5.3 events (Mark-as-sent when an unsent proposal exists in Sending Proposals;
  outcome panel when the latest arranged meeting lacks an outcome). E2E: dedicated
  e2e.db on port 3100, serial journeys, absolute assertions in journey 1 (fresh DB),
  delta assertions in journey 2.
- Limitations / gotchas: money inputs are pounds converted client-side via
  money.ts (`toPiasters`) before POST; keep new forms consistent. Rep-leads route
  uses /leads/rep/[repId] and /leads/lead/[leadId] (one dynamic slot per segment
  name). BrandLogo is a plain `img` (next/image logged aspect-ratio warnings).
- Last updated: 2026-08-09 (Entry 003, TESTING Run 005)

## App B — Partners pipeline + storage (Phase 2)
- Location: `src/lib/services/partners.ts`, `src/lib/storage/index.ts`,
  `src/app/api/b-systems/**`, `src/app/api/files/[id]/route.ts`,
  `src/components/partners/**`, `src/app/(bsystems)/b-systems/(app)/**`.
- What exists / how it works: the B-Systems CRM is a pure mount of Phase 1's
  brand-parameterized bodies (BSYSTEMS_CTX) + the internalCrmHandlers("bsystems")
  factory — zero duplicated logic. Partners: `applyProspectEvent` mirrors
  applyLeadEvent on partnersConfig; **PP-2 lives in `updateProspect`** (a non-empty
  value newly saved into number2/3 while stage=didnt_answer fires the engine's
  number_added in the same tx; overwriting a filled slot is an edit, no re-fire —
  max two is structural). PP-4's gate is the won_partner Zod schema, re-parsed at
  the service layer (defense-in-depth added to BOTH event services); conversion
  creates the Partner (dateJoined now) + converted flag in one tx. PP-5 =
  createLead with attribution via /api/b-systems/partners/[id]/leads. Storage:
  local driver under /uploads with opaque keys; validation = extension + size +
  magic-byte sniff (mp3 ID3/framesync, mp4 ftyp, pdf %PDF-, doc OLE, docx PK);
  serving ONLY via authenticated /api/files/[id] with Range support (inline
  <audio>/<video> seeking).
- Limitations / gotchas: `persistGroup` treats won_partner as a no-op branch — the
  gate data is consumed by the create_partner side effect, not stored as a child
  record (cost one debugging round). Next 16 deprecates middleware.ts: file is now
  `src/proxy.ts` (same NextAuth wrapper, build shows "Proxy"). Stale
  `.next/dev/types` breaks typecheck after deleting pages — `rm -r .next`.
- Last updated: 2026-08-09 (Entry 004, TESTING Run 007)

## Portal rep layer (Phase 3)
- Location: `src/lib/services/{portal-deals,won-deals,portal-reps}.ts`,
  `src/app/api/portal/**`, `src/components/portal/**`,
  `src/app/(bsystems)/portal/**` (landing, login, signup, (rep) group).
- What exists / how it works: `applyDealEvent` mirrors the other event services on
  portalConfig — the caller's REAL role reaches the engine, so P-2 is enforced in
  the engine + service + API (403), never UI-only. Drag & drop: dnd-kit board;
  a drop opens the target stage's modal form and NOTHING commits until submit
  (cancel = revert, §5.4/ADR-023); Won column visible to reps but a drop shows the
  clear block message. WonDeal (P-6) created exactly-once via the create_won_deal
  side effect. **Milestone redaction lives in `won-deals.ts`'s serializer** —
  locked values leave the server as null; the rep list polls /api/portal/won-deals
  every 5 s (ADR-009). Sign-up: CV validated BEFORE the user tx; CV deleted from
  storage if the tx fails; then the user logs in at /portal/login (?created=1
  banner). Profile: basics + CV replace + password change; phone shown, not
  editable (A-10).
- Limitations / gotchas: portal group forms live in
  `src/components/portal/groupForms.tsx` — a deliberate small duplication of the
  internal panel's fields (different config, no owner select — owner is the rep,
  stamped via ownerPortalRepId). dnd-kit drags in Playwright: grab the card
  CONTAINER (`[data-deal-card]`), not the inner link, and cross the 6px activation
  distance before travelling. LOG_ENTITY_TYPES gained "portal_rep" (additive to
  §9's list) for signup/profile events.
- Last updated: 2026-08-09 (Entry 005, TESTING Run 009)

## Portal admin layer (Phase 4)
- Location: `src/lib/services/{milestones,portal-admin}.ts`,
  `src/app/api/portal/admin/**`, `src/components/portal/{WonDealManager,
  DealDetailView}.tsx`, `src/app/(bsystems)/portal/admin/**`.
- What exists / how it works: milestones service enforces SEQUENTIAL order (check i
  requires i−1 completed; uncheck only the last completed — ADR-020's logged
  correction); redefinition blocked once any milestone is checked; A-11 sum
  mismatch returns a warning the UI shows non-blockingly. Admin dashboard applies
  ADR-012 per-card estimated value (won → WonDeal.estimatedValue, else latest
  proposal). Combined/per-rep board reuses DealBoard with isAdmin (drag into Won =
  P-6). DealDetailView is the shared §8.2 detail body for rep and admin shells.
  Admins hitting the rep CRM without a profile are redirected to /portal/admin.
- Limitations / gotchas: the milestone checkbox is a CONTROLLED input — Playwright
  must .click() and await toBeChecked(), not .check(). Journey 5 is self-contained
  (creates its own rep/deal) and asserts dashboard tiles as DELTAS — keep it that
  way so journey order never matters. defineMilestones caps at 100 values as a
  sanity rail ("unlimited" in spirit).
- Last updated: 2026-08-09 (Entry 006, TESTING Run 011)

## Hardening round (Phase 5)
- Location: prisma/seed.ts (final §13 fixtures), e2e/security-rbac.spec.ts,
  e2e/qa-sweep.spec.ts, README.md, src/app/(bsystems)/icon.png.
- What exists / how it works: seed is idempotent via a sentinel lead; ships both
  brands populated across every stage (+ A-1 clients), a converted partner with an
  A-6 unassigned attributed lead, and a won portal deal with milestones (M1
  checked → M2 unlocked, M3 locked). Security spec proves every §15 RBAC clause at
  the raw API; QA sweep asserts clean consoles + no horizontal overflow at all
  four §15 widths for every role.
- Limitations / gotchas: **journeys must never assert absolute dashboard numbers**
  — the seed populates every stage, so assert deltas (journey 1 was converted).
  E2E interactions with the won-deal manager must scope via `[data-won-deal]`
  (two manager cards exist post-seed). dnd-kit needs a stable `DndContext id` or
  SSR hydration mismatches spam the console (BUG-002).
- Last updated: 2026-08-09 (Entry 007, TESTING Run 013)

## Kickoff verification round
- Location: docs/ARCHITECTURE.md, docs/DECISIONS.md, branding/*/tokens.css, scaffold.
- What exists / how it works: a 10-agent adversarial workflow (5 review dimensions ×
  verify pass) checked ARCHITECTURE v1 + scaffold against SPEC and confirmed 21
  findings; all fixed same session. Highlights: root-layout restructure (above),
  money → Int piasters (ADR-018), JWT-vs-kill-switch guard design (ADR-017),
  Partners/internal transition-config gaps (ADR-010/011), font wiring strategy
  (ADR-013), semantic token contract (ADR-019).
- Limitations / gotchas: ADR-005's wording predates the fix round and reads
  present-tense about `src/lib/auth/hash.ts` — the wrapper is Phase 0 work (ADRs are
  append-only; ARCHITECTURE §2 carries the accurate "lands Phase 0" markers).
- Last updated: 2026-08-08 (Entry 001, TESTING Run 002)

## Branding assets
- Location: `branding/byteforce/`, `branding/b-systems/`.
- What exists / how it works: founder dropped two PNGs at the repo root during the
  session; classified and relocated per the drop-zone READMEs (mapping = ADR-006):
  gradient S-mark → `b-systems/logo-mark.png`, ByteForce primary lockup →
  `byteforce/logo-horizontal.png`.
- Limitations / gotchas: all other logo slots and the Lama Sans font files are still
  pending from the founder (A-13 fallback stack active in tokens.css).
- Last updated: 2026-08-08 (ADR-006)

## V2 restructure — verification round (V2-P4/P5)
- Location: src/lib/services/leads.ts, src/tests/db-reset.ts,
  playwright.config.ts, src/lib/pipeline-engine/constants.ts (STAGE_LABELS),
  e2e drag helper, built-CSS theme layering.
- What exists / how it works: notes discovered while shipping the V2-P4 UI and
  running the V2-P5 verification round (Entry 009, TESTING Run 014, ADR-030).
- Limitations / gotchas:
  - **leadEventSchema was missing the "drag" event variant** the board sends;
    the V1 portal had its own schema, so this only surfaced when the unified
    board reused /api/b-systems/leads/[id]/event. Added
    `z.object({type:"drag", to})` to the union (src/lib/services/leads.ts).
  - **src/tests/db-reset.ts deletion order**: Attachment must be deleted BEFORE
    Statement (payment-proof attachments FK-reference statements); the old
    order poisoned every later reset once a proof row existed.
  - **playwright.config.ts webServer now runs `prisma migrate deploy` before
    `next build`**: Playwright boots the webServer before globalSetup, and the
    build prerenders pages that query the database, so e2e.db must be migrated
    first.
  - **STAGE_LABELS.sending_proposal restored to "Sending Proposals"** — the V2
    constants rewrite had renamed it and broke ByteForce journey assertions;
    SPEC v1 naming is normative for ByteForce.
  - **E2E drag helper grabs the card's middle-right edge**: the card's top-left
    link and the new bottom "Mark ready to close" button both stop pointer
    propagation, so bottom-edge grabs were flaky.
  - **Tailwind `@theme inline` same-name self-reference (--color-stage-*)
    confirmed benign** in the built CSS: the reference is emitted inside
    @layer theme, and the unlayered :root[data-brand] token definitions always
    win.
- Last updated: 2026-08-09 (Entry 009, TESTING Run 014, ADR-030)

## Design system application (Claude Design handoff)
- Location: src/themes/design-system.css, src/themes/neutral.css, brand token
  files, docs/DESIGN-APPLICATION-SPEC.md, app headers, restyled screens.
- What exists / how it works: src/themes/design-system.css is the prototype's
  shared component layer — token-driven only; components reference its classes
  plus brand utilities; stage colors resolve through a data-stage-key
  attribute that sets the four per-stage custom properties. The
  extraction/synthesis pipeline lives in docs/DESIGN-APPLICATION-SPEC.md —
  treat it as the normative design reference for future UI work.
- Limitations / gotchas:
  - Header layout gotcha: `.user` must be `flex: none` — flex-shrink let its
    rigid children (bell/switcher/avatar/logout) overflow the shrunken box
    and push 2px past the viewport at 768px.
  - The restyle froze all rendered strings; the one test adjustment was
    journey5's "Total commission: 10%" combined-text assertion (label and
    value are separate elements in the money-tile pattern).
  - Playwright-driven overflow probing (a temporary spec measuring
    getBoundingClientRect of header children) was the fastest way to find
    the 2-px culprit — pattern worth reusing.
- Last updated: 2026-08-09 (Entry 010, TESTING Run 015, ADR-031)

## Seed — unified admin identity (founder directive)
- Location: prisma/seed.ts (upsertUser + admin/demo fixtures; base seed
  notes in "Hardening round (Phase 5)" above).
- What exists / how it works: in production the seed creates the admin
  ONLY — admin@byteforce.com, name "Elmur", both entities
  (bsystems_admin + byteforce_staff); demo accounts/fixtures are gated
  behind NODE_ENV=production (SEED_DEMO=1 overrides the gate), so demo
  passwords never reach a live system. The legacy
  admin@b-systems.example account is renamed in place to the new
  identity — no duplicate admin row, history intact.
- Limitations / gotchas: upsertUser re-asserts name AND password on
  every run — intentional (founder directive), so seeded accounts are
  always in the documented state; consequence: re-running seed in
  production resets the admin password back to the seeded value, so
  once the live password is changed, either change the seed value or
  don't re-run seed in production.
- Last updated: 2026-08-09 (Entry 012)

## Full-system backup/restore (ADR-032)
- Location: src/lib/services/backup.ts, /api/b-systems/backup route
  (GET export / POST import, requireBsAdmin), Export/Import controls on
  the admin Home, backup integration test.
- What exists / how it works: export serializes every table's rows verbatim
  (ids preserved) plus every uploaded file base64-embedded into one JSON
  document; import validates version/app, then one transaction deletes all
  rows in FK-safe reverse order and re-inserts parent-first; file blobs
  restore after the commit.
- Limitations / gotchas:
  - The backup insert/delete MODEL order lists must stay in sync with
    prisma/schema.prisma AND src/tests/db-reset.ts whenever models are
    added — a model missing from the lists silently drops its data from
    backups.
  - Prisma coerces ISO-8601 strings back into DateTime columns on insert,
    so backups need no custom date revival.
- Last updated: 2026-08-09 (Entry 013, TESTING Run 016, ADR-032)

## Theme CSS delivery under Turbopack dev
- Location: src/themes/*.css and the three root layouts (their CSS module
  imports).
- What exists / how it works: Turbopack-dev cannot resolve plain-CSS
  @imports placed after the tailwindcss import (production build tolerated
  it; dev did not) — theme CSS files (e.g. design-system.css) are therefore
  imported as modules from the root layouts instead of via CSS @import.
- Limitations / gotchas: keep new theme CSS files on the module-import
  path; do not reintroduce plain-CSS @import chains after the tailwindcss
  import.
- Last updated: 2026-08-09 (Entry 013, TESTING Run 016)

## PostgreSQL switch — embedded local Postgres (ADR-033)
- Location: prisma/schema.prisma + prisma/migrations/ (fresh
  20260809000000_init_postgres), src/lib/db.ts and prisma/seed.ts
  (@prisma/adapter-pg), embedded-postgres lifecycle in `npm run db:up` and
  the vitest / Playwright global setups.
- What exists / how it works: local dev and tests run REAL PostgreSQL via
  the `embedded-postgres` package (PG binaries from node_modules, no
  Docker). Ports/dirs convention: 5433 dev (persistent, .pgdata/dev,
  `npm run db:up`) · 5434 vitest (fresh per run, its globalSetup owns the
  lifecycle) · 5435 Playwright (fresh per run, globalSetup/globalTeardown
  own it). .pgdata/ is gitignored. `next build` needs no database
  (force-dynamic pages); each suite's global setup migrates — the
  Playwright webServer no longer does.
- Limitations / gotchas:
  - tsx runs scripts as CJS, so no top-level await in scripts/ — wrap in a
    main() function.
  - The retired SQLite migrations included the hand-written V2 data
    migration — any OLD SQLite database restores only via the ADR-032
    backup Export/Import path, not via migrate.
  - DATABASE_URL has no fallback — db.ts throws a clear error when unset.
- Last updated: 2026-08-09 (Entry 014, TESTING Run 017, ADR-033)

## Fixed-position modals vs Chromium containing blocks (fill-mode fix)
- Location: shared modal/motion layer — entrance animation classes on
  modal ancestors.
- What exists / how it works: in Chromium, an ancestor that RETAINS a
  transform (e.g. `animation-fill-mode: forwards` on an entrance
  animation) becomes the CONTAINING BLOCK for position:fixed descendants,
  so fixed modals get cropped to that ancestor's box. Root fix (ADR-034
  round): entrance animations use `animation-fill-mode: backwards` — the
  transform is not retained after the animation ends, the containing
  block is released, and fixed modals span the viewport again.
- Limitations / gotchas: any retained transform/filter/will-change on a
  modal ancestor reintroduces the trap — keep entrance animations on
  fill-mode backwards and never persist transforms above a fixed modal.
- Last updated: 2026-08-10 (Entry 016, ADR-034)

## Embedded Postgres — per-run data dirs + ports (test infra hardening)
- Location: vitest and Playwright global setups (embedded-postgres
  lifecycle; extends the ADR-033 conventions).
- What exists / how it works: test/e2e embedded-Postgres instances now use
  UNIQUE per-run data dirs and per-run pid-derived ports instead of the
  fixed 5434/5435.
- Limitations / gotchas: on Windows, crashed runs leave zombie
  sockets/shared-memory bound to the fixed ports — these survive the dead
  PID until reboot, so a fixed-port convention wedges every subsequent
  run. Per-run dirs/ports sidestep the leak entirely; do not return to
  fixed test/e2e ports. (Dev's persistent 5433 instance is unchanged.)
- Last updated: 2026-08-10 (Entry 016, TESTING Run 019)

## AnimatedValue count-up vs E2E numeric reads
- Location: dashboard KPI tiles (AnimatedValue) and journey 1's tile
  helper in the Playwright suite.
- What exists / how it works: dashboard numbers count up on load, so an
  E2E read taken mid-animation captures a transient value and races the
  animation. Pattern (journey 1 tile helper): poll the tile until two
  consecutive samples agree before asserting the number.
- Limitations / gotchas: any new E2E assertion against an animated number
  must reuse the settle-poll pattern — a single immediate read is a flake.
- Last updated: 2026-08-10 (Entry 016, TESTING Run 019)

## Uploads storage root — UPLOADS_DIR + Turbopack dynamic-fs build warnings
- Location: src/lib/storage/index.ts (uploadsDir(),
  uploadsDirConfigured()); consumed by the services layer and
  /api/health.
- What exists / how it works: the local-disk storage root honors the
  UPLOADS_DIR env (default `<cwd>/uploads` unchanged). The host's
  container filesystem is EPHEMERAL — every redeploy rebuilds the
  container and wipes `<cwd>/uploads` (the 2026-08-11 incident,
  BUG-004/ADR-035). Durability requires a persistent volume on the host
  with UPLOADS_DIR pointing at its mount path; /api/health's `uploads`
  section reports the dir path, persistentDirConfigured, a writable
  probe, and a missing-attachment count.
- Limitations / gotchas: (1) the env-dependent path makes the uploads
  module opaque to Turbopack's static analysis, so `next build` now
  emits "dynamic filesystem access" warnings — BENIGN for our
  `next start` container deploys (no standalone output tracing in use);
  do not chase them, revisit only if the deploy model ever moves to
  `output: 'standalone'`. (2) Missing blobs are surfaced via fileOk
  flags but attachment rows are NEVER auto-deleted — the rows are the
  re-upload worklist.
- Last updated: 2026-08-11 (Entry 018, ADR-035)

## /api/health — public disclosure tradeoff (ACCEPTED)
- Location: src/app/api/health/route.ts.
- What exists / how it works: /api/health is PUBLIC and disclosing by
  design — it is the founder-required self-healing diagnostic from the
  production login-incident round (that round predates this note and has
  no PROGRESS entry; this is its first logged record). It exposes
  first-line DB error text and admin-account status; the 2026-08-11
  18-agent adversarial review confirmed the disclosure and it is
  deliberately ACCEPTED, not fixed. The new `uploads` section scans up
  to 500 attachments and reports a missing-file count whose sample shows
  OPAQUE storage keys only — never filenames (filenames carry
  client/candidate names and the endpoint is public; the review caught
  and fixed an initial filename leak before ship). `ok` requires the DB
  plus a writable uploads dir; missing upload files alone do not flip
  `ok`.
- Limitations / gotchas: every future health addition must keep the
  no-filenames / no-secrets rule; locking the endpoint down would
  reverse a founder requirement and needs a new ADR.
- Last updated: 2026-08-11 (Entry 018, TESTING Run 021)

## Lead team chat + mentions (founder V5)
- Location: src/lib/services/comments.ts (mentionableUsersFor,
  resolveMentions, addLeadComment); shared route factory
  src/lib/api/leadComments.ts (makeCommentsPost(brand)) behind
  POST /api/{b-systems,byteforce}/leads/[id]/comments; UI
  src/components/shared/LeadChat.tsx (both lead detail pages) with the
  token-driven `.chat-*` block in design-system.css; ByteForce bell =
  NotificationsBell parameterized with apiBase/leadPathBase + new
  /api/byteforce/notifications routes.
- What exists / how it works: LeadComment (migration
  20260812113153_lead_comments; leadId FK cascade; authorUserId FK
  set-null with a persisted authorLabel so threads survive account
  deletion; body ≤2000; mentions JSON — model synced into the backup
  MODELS list and src/tests/db-reset.ts). Mentions are resolved
  server-side only from the requireLeadAccess-mirrored mentionable set;
  each resolved mention fans out a bell notification (type "mention",
  self-mentions skipped) and the post logs an activity row (action
  "comment", trigger "lead_chat"). Acting-as posts are labeled
  "Name (via AdminName)" everywhere (CurrentUser carries impersonatorId).
- Limitations / gotchas: (1) ACCEPTED behavior (26-agent review round,
  kept by choice): an unresolved @mention — typo or non-mentionable name
  — fails SILENTLY server-side; the only feedback is that it renders as
  plain text without a chip. (2) ByteForce mention notification rows are
  DELIBERATELY deep-link-less: Notification rows carry no brand, so a
  dual-role user's other-brand bell would deep-link into the wrong app;
  the notification body names the lead instead. Restore deep-links only
  after notifications carry a brand (ADR-036). (3) markNotificationRead
  is now ownership-checked: users mark only their OWN rows read; admins
  may also mark admin-broadcast rows. This closed a pre-existing IDOR
  (any B-Systems role could previously mark ANY notification read) —
  keep the ownership check if the bell API ever grows bulk operations.
- Last updated: 2026-08-12 (Entry 020, ADR-036, TESTING Run 023)

## HTTPS posture — logout fix + DEFERRED HSTS/https-redirect hardening
- Location: src/lib/auth/actions.ts (logout()); the deferred hardening
  would live in headers config / middleware when shipped.
- What exists / how it works: the 2026-08-12 SSL audit (3-agent
  workflow, TESTING Run 024) confirmed the app is scheme-clean: zero
  external scripts/fonts/CDN/analytics (mixed content impossible),
  every browser-loaded resource same-origin relative, no absolute-URL
  construction, empty next.config, middleware redirects relativized by
  Next itself. The ONE code-reachable downgrade path is fixed (BUG-005,
  commit ce5ff36): logout() used signOut({redirectTo}), which next-auth
  5 beta absolutizes against the proxy-reported x-forwarded-proto —
  behind a misreporting proxy, Log out emitted
  Location: http://<domain>/login. Now signOut({redirect: false}) plus
  a relative redirect(), following the existing proxy-trust semantics
  (no ADR needed).
- Limitations / gotchas: two hardening steps are DELIBERATELY NOT
  shipped — do not add them early: (1) an HSTS header (when shipped:
  short max-age first, NEVER preload initially) and (2) any
  proto=http → https 308 redirect. Precondition for BOTH: Cloudflare
  TLS confirmed working, i.e. /api/health `proxy.proto` === "https" —
  under Cloudflare "Flexible" SSL the origin always sees proto http, so
  an app-level https redirect recreates the historical "too many
  redirects" infinite loop. Related: env AUTH_URL=https://<domain> on
  the host also fixes NextAuth secure-cookie selection when the proxy
  misreports proto (founder action, Entry 021 (h)).
- Last updated: 2026-08-12 (Entry 021, BUG-005, TESTING Run 024)

## Arabic ⇄ English i18n layer (founder full-translation directive)
- Location: src/lib/i18n/ — core.ts (Locale en|ar, Msg {en,ar}, tFor,
  dirFor, cookie name), server.ts (getLocale from cookie, default en),
  actions.ts (setLocale server action); dictionary modules in
  src/lib/i18n/dict/ (labels.ts, auth.ts, internal.ts, crm.ts, admin.ts,
  partners.ts, chat.ts); LocaleProvider context + LanguageToggle chip
  (both app headers — desktop .user cluster + mobile nav sheet — and
  /login); all three root layouts stamp <html lang dir>; e2e coverage in
  e2e/i18n.spec.ts.
- What exists / how it works: hand-rolled, no library (ADR-037). A
  user-visible string is a Msg = {en, ar}; server components resolve via
  getLocale() + tFor, client components via the LocaleProvider context.
  Dict module conventions: a string lives in the module matching its
  surface (auth / internal / crm / admin / partners / chat); display
  names for domain constants (stage, lead type, owner type) go through
  the helpers in labels.ts — engine constants stay English in code, DB,
  and API payloads, and translation happens ONLY at render. Browser-tab
  titles localize via generateMetadata. Arabic is full RTL for free —
  the design system is logical-properties-based.
- Limitations / gotchas: IRON RULE for every future edit — EN output
  must stay byte-identical: any NEW user-visible string must be added as
  a Msg in the right dict module with the English text exactly as it
  would have been hardcoded. This is what let the entire pre-existing
  suite pass unchanged (TESTING Run 025) and is what keeps it meaningful
  as a regression net. Server-side error strings (zod/service ApiError
  messages surfaced in forms) are still English — translating them needs
  an error-code scheme (Entry 022 item (i)). ByteForce thin-page
  metadata titles are partly English. Terminology pending founder
  review: "CRM" → "المبيعات", "Retainer" → "عقد دوري" (Entry 022 item
  (j)).
- Last updated: 2026-08-13 (Entry 022, ADR-037, TESTING Run 025)

## Local Postgres encoding — UTF8 clusters (ADR-044, BUG-006)
- Location: scripts/local-postgres.ts (INITDB_FLAGS + warnIfNotUtf8),
  consumed by `npm run db:up` and both suites' global setups.
- What exists / how it works: every cluster this repo creates is initialised
  `-E UTF8 --locale=C`. Without those flags initdb inherits the Windows OS
  locale and builds a WIN1252 cluster in which no Arabic byte can be stored
  or matched (22P05) — fatal for a bilingual product (ADR-037). Because a
  cluster is only initialised once, startLocalPostgres additionally probes
  `SHOW server_encoding` whenever the data dir already existed and warns,
  naming the folder, if it is not UTF8.
- Limitations / gotchas: the flags apply at initdb time ONLY — an existing
  .pgdata/dev from before this change stays WIN1252 until the folder is
  deleted and recreated (data carries over via the ADR-032 backup
  export/import). Locale C means text ORDER BY is byte order locally (the app
  orders by timestamps or curated labels, so nothing shifted); ILIKE
  case-insensitivity still works for ASCII and is a no-op for Arabic. Prefer
  a UTF8 database everywhere else too — managed Postgres defaults to it.
- Last updated: 2026-08-14 (Entry 033, ADR-044, TESTING Run 036)

## Leads filter sidebar + universal search (founder round 2)
- Location: src/app/(bsystems)/b-systems/(app)/leads/page.tsx,
  src/components/bsystems/LeadsFilterPanel.tsx, the `.filter-*` /
  `.table--wrap` block in src/themes/design-system.css,
  leadSearchWhere/listBsLeads in src/lib/services/bsystems-admin.ts,
  strings in src/lib/i18n/dict/crm.ts, e2e/leads-filters.spec.ts.
- What exists / how it works: the filters are a plain GET form (unchanged
  param names: owner/stage/type/sort/view, new `q`) rendered as a start-side
  sidebar column from 900px up. Below 900px the SAME markup collapses behind
  a client-side disclosure (LeadsFilterPanel) whose chip counts the
  non-default controls; the desktop media query re-shows `.filter-body`
  regardless of its data-open state, so no JS is needed to reach the filters
  on a wide screen. Search is server-side only: leadSearchWhere ORs
  case-insensitive contains over name / companyName / number and, when the
  query is digits plus phone punctuation, adds a digits-only number match so
  "010 123" finds 0101234567.
- Limitations / gotchas: the sidebar costs the table ~230px, which pushed the
  Created column out of the horizontal scroller — hence `.table--wrap` (prose
  cells wrap, chips and the date stay on one line). Keep it on any table that
  sits beside the sidebar. The stage/type narrowing still happens in JS after
  the fetch (unchanged from round 1 — the admin list is page-sized); only the
  search and the owner bucket are SQL. If this list ever paginates, both must
  move into the query together or the counts will lie.
- Last updated: 2026-08-14 (Entry 033, TESTING Run 036)

## Filter panel — one component, two shapes (founder filter rounds 2–3)
- Location: src/components/shared/FilterPanel.tsx (was
  components/bsystems/LeadsFilterPanel), the .filter-* block in
  src/themes/design-system.css, src/lib/services/lead-search.ts
  (leadSearchWhere + leadTypeWhere), and the three surfaces that mount
  it: the B-Systems Leads list, the B-Systems board, and CrmBoardBody
  (ByteForce board).
- What exists / how it works: one client component owning only
  open/closed state around server-rendered GET-form children.
  variant="side" is the Leads list: a disclosure under 900px, and from
  900px up CSS hides the toggle and pins the body open as the sidebar
  column (.filter-panel--side scoping — the media query must never
  match the inline variant). variant="inline" is both boards: a
  disclosure at EVERY width above the board, because .board is a
  full-bleed breakout (margin-inline: calc(50% − 50vw + 8px)) computed
  against its CONTAINER — inside a grid column it would still span the
  viewport and paint over any side column. Both open automatically when
  activeCount > 0. The where-clause helpers are brand-agnostic so every
  lead surface composes the same matching rules.
- Limitations / gotchas: never move .board into a grid column without
  also neutralising its breakout — the two cannot coexist. Any new
  filter must be counted in that page's activeCount or the chip lies.
  Board filtering is server-side per request: a card that stops
  matching after a drag disappears on revalidation, which is intended
  (the filter is the view), but is worth remembering when debugging
  "my card vanished".
- Last updated: 2026-08-14 (Entry 035, TESTING Run 038)

## Undo — snapshot-inverse with an allowlist (ADR-045)
- Location: prisma/schema.prisma model UndoEntry (+ migration
  20260814131216_undo_entry), src/lib/services/undo.ts (recordUndo,
  invalidateUndo, pendingUndoFor, performUndo, UNDO_WINDOW_MS), the call
  sites in services/leads.ts (create/update/no-answer/ready/archive/
  applyLeadEvent + deleteLead), services/partners.ts
  (applyProspectEvent), services/milestones.ts and services/statements.ts
  (invalidate only), POST /api/undo, and the UI pair
  components/shared/UndoControl.tsx (server read) +
  UndoButton.tsx (client), mounted by both app layouts.
- What exists / how it works: an undoable mutation calls recordUndo with
  the entity's POST-mutation updatedAt as a fingerprint, a bilingual
  label snapshot, and a payload holding the prior state. performUndo
  claims the newest unconsumed entry atomically, verifies ownership,
  window, and fingerprint, applies the inverse, retires the user's other
  pending entries (one step, not a stack) and logs trigger "undo".
  persistGroup returns GroupWrites {created, updated} so a stage event
  knows exactly which child rows to delete and which in-place updates to
  restore. The pill is server-rendered from the layout, so it appears and
  disappears on the router.refresh() every mutation already performs — no
  polling.
- Limitations / gotchas: the fingerprint is the ENTITY ROW's updatedAt —
  a later change to a CHILD record does not bump it, so an undo can still
  fire under an unrelated child write (bounded: it only deletes ids it
  recorded itself, inside 10 minutes). Adding a new undoable action means
  three things together: record the inverse inside the SAME transaction,
  extend the UndoKind switch, and add a test — a kind with no branch
  throws "This action cannot be undone" at apply time, which is safe but
  useless. Any new financial or destructive path must call invalidateUndo
  or the button will offer a stale-but-valid older action. E2E locators
  beware: the pill's accessible name embeds the label ("Undo: Added
  Sidebar Search Lead"), so substring getByLabel matches can collide —
  use exact matching.
- Last updated: 2026-08-14 (Entry 036, ADR-045, TESTING Run 039)

## User deletion: the two references the schema does NOT protect (2026-08-17)
Auditing every `User` reference before writing ADR-049 turned up two that
look safe and are not, because Prisma's implicit `SET NULL` only covers a
declared relation:

1. **`Attachment.portalRepId` is `SET NULL`, and `PortalRep` CASCADEs from
   `User`.** Deleting an agent therefore destroys the profile but leaves its
   CV Attachment ROW behind with a null owner — and the file itself on disk
   for ever, reachable by nobody and cleaned by nothing. `deleteUser` deletes
   the attachment explicitly inside the transaction and removes the stored
   file after the commit (the same after-commit pattern `deleteLead` uses for
   statement proofs).
2. **`Statement.closerUserId` and `UndoEntry.userId` have no foreign key at
   all** — they are plain `String` columns (grep the migration SQL: no
   `Statement_closerUserId_fkey`, no `UndoEntry_userId_fkey`). Nothing in the
   database would have stopped them pointing at a deleted account. They are
   nulled / deleted by hand, and the ADR pins both.

The general lesson for anything added later: a `userId` column without a
declared relation is invisible to cascade planning. When adding one, either
declare the relation or add it to `deleteUser`'s explicit list.

Also worth knowing: `user.delete` is the LAST statement in the transaction on
purpose. Any reference the policy failed to release raises a foreign-key error
there, which aborts everything — so a future column can never leave an account
half-deleted; it produces a clean refusal ("still referenced by records that
cannot be released — deactivate it instead") instead.

## The prospect's attachment relation is kind-mixed (ADR-050)

`PartnerProspect.recordings` is named for what it used to hold, but it is just
`Attachment[]` — every row whose `partnerProspectId` points at the card. Since
an AGENT card also carries a CV there, **the relation name lies**: an unfiltered
`include: { recordings: true }` now returns the CV too, and rendering it would
drop a PDF into the `<audio>`/`<video>` player list.

Every read that means "cold-call recordings" therefore filters explicitly —
`recordings: { where: { kind: "recording" } }` — and the CV is fetched as its
own `findFirst({ where: { partnerProspectId, kind: "cv" } })`. The two places
that deliberately do NOT filter are `deleteProspect` (it must collect every
storage key the card owns, CV included) and the `attachment.deleteMany` beside
it. If a third attachment kind is ever hung off a prospect, grep
`partnerProspectId` and give each read its own kind filter — renaming the
relation would be a bigger migration than it is worth.

## A new stage group needs an arm in `persistGroup`, even when it writes nothing

The `won_agent` gate is consumed by the `create_agent` side effect, not by a
child record — exactly like `won_partner` and `won_deal`. But `persistGroup`
(leads.ts) ends in an `else { throw }`, so a group with no arm fails **inside
the transaction** with the confusing message `Group payload "won_agent" does
not match required "won_agent"` (both sides identical — the mismatch is that
neither branch matched). The new integration tests caught it before the commit.
When adding a stage group, add its arm to `persistGroup` first, even if the
body is only a comment saying which side effect consumes it.

## Vault (ADR-053): two traps met while porting the sniffing rules (2026-08-18)

1. **Test fixtures with literal control bytes.** The partners cv fixture read
   as `Buffer.from("PK")` in every editor view, but the file actually contains
   `PK\x03\x04` with RAW 0x03/0x04 bytes inside the string literal — invisible
   in normal display, and any "exact string" patch against what you *see*
   misses. Found via `od -c`. The replacement writes the escape sequence
   (`"PK"`) so the bytes are visible in source from now on.
2. **The upgraded OOXML check is stricter than what two old call sites
   relied on.** sniffOk's docx rule was a bare "PK" prefix — any ZIP passed.
   Tightening it (container listing must show `[Content_Types].xml` + a
   `word/` part) is exactly the reference app's rule and a real security fix,
   but it silently flips the verdict on any existing fixture that faked a docx
   with zip bytes. Both call sites (cv uploads, won-deal contract PDFs reuse
   the cv rule) were audited; only the fixture needed updating. When
   strengthening a validator, grep the tests for the OLD weakest accepted
   input first — each one is a decision to make, not a failure to chase.
3. **Undo's `performUndo` was a two-way branch** (lead | prospect) with the
   final ActivityLog line hardcoding the same ternary. Adding the vault kinds
   forced it into a delegate map + type guard; the log line now passes the
   entry's own entityType through. Any future undoable entity should extend
   `VAULT_DELEGATES`-style maps rather than adding a third hand-rolled branch.

## Board card chips: the geometry contract for tests (2026-08-19)

Adding Call/WhatsApp chips onto every board card broke FOUR e2e tests over
three runs, each a different flavour of the same assumption:

1. **`card.click()` clicks the geometric CENTER** — which, on a chip-bearing
   card, may be a chip that `stopPropagation`s on purpose. The whole-card
   navigation test now clicks the card's subtitle line (`.bcard-rep`): plain
   text, no handlers, always bubbles to the card.
2. **Drag helpers that grab "the middle-right edge"** land on the chips row
   at some card heights. journey3's `dragTo` now grabs the subtitle's own
   box; the byteforce/journey helpers keep their proven grab points but any
   NEW drag helper should grab `.bcard-rep`.
3. **`card.getByRole("link")` with no name** assumed one link per card
   (data-entry's cleanup did — deriving the card id from "the" href). Three
   links live there now; always name the link.
4. **A failed cleanup cascades.** data-entry's strict-mode abort left rows on
   the shared serial DB and journey5's drag then missed — the spec's own
   comment predicted exactly this. When a spec fails mid-run, suspect the
   NEXT failures are its debris before treating them as real.

Also: wa.me link building (`waDigits` in `src/lib/phone-dial.ts`) is a THIRD
phone normalization, deliberately separate from `telDigits` (dialer, keeps
numbers as typed) and `auth/normalizePhone` (login identity). wa.me demands
bare country-code digits; the Egyptian-mobile inference (01x → 20…) is a
business default, and anything 0-leading that isn't an EG mobile yields NO
link rather than a wrong one. Do not merge these three — their failure modes
differ (a wrong dial is retyped; a wrong wa.me link messages a stranger).

## DragOverlay replaces the transform-drag on all three boards (2026-08-19)

The founder's column cap (`.col-cards` max-height + inner scroll) is
incompatible with dnd-kit's default transform-follow: a transformed card
inside a scrolling, clipping column vanishes under siblings (the old
`.col[data-drag-origin]` overflow lift was a partial fix and is retired).
Each board's card is now split into a pure `…CardBody` (all content, hooks
included) rendered by (a) the in-column draggable shell — which stays PUT and
ghosts to 35% while dragging — and (b) a `<DragOverlay>` clone. The clone is
`aria-hidden` and carries no `data-deal-card`: it lingers through the drop
animation, and for that window it must not double the card's links in the
accessibility tree (a bare `getByRole` hitting two identical name links is a
strict-mode FAIL — Playwright does not retry those). DragOverlay is
position:fixed; the page-entry animation uses fill-mode `backwards`
specifically so no ancestor keeps a transform that would trap it.

Drag helpers got one more rule: after the coarse travel, RE-MEASURE the
target column and land on its live box before `mouse.up`. dnd-kit
auto-scrolls the board mid-drag; coordinates measured before `mouse.down`
can be a column off by drop time on a loaded machine.

And the nav slider's own trap, for the record: a "stalled" chevron that
moves 30px per press is not a broken animation — 30px was 70% of a strip
squeezed to ~43px by the header's fixed logo + user cluster. `slide()` pages
by `max(70% of the strip, 160px)` now, and the spec runs at a width where
the strip has a workable share.

## The touch-action trap: a drag activator is a scroll killer (2026-08-19)

dnd-kit's PointerSensor needs `touch-action: none` on whatever starts a drag,
because the browser would otherwise steal the gesture for panning. Put that on
the CARD — which is what `bcard touch-none` did on all three boards — and you
have told the browser "no pan may BEGIN here". Cards cover essentially the whole
board, so on a phone that one declaration killed three scrolls at once: the
column's own `overflow-y`, the board's `overflow-x`, AND the page-scroll
chaining past the bottom of the column. The founder's report reads like three
separate bugs; it is one line of CSS.

Rules that follow, and the traps inside them:

* `touch-action: none` belongs on a SMALL DEDICATED HANDLE and nowhere else.
  `.bcard-grip` is the only place in `src/themes/design-system.css` that carries
  it. Anything that inherits or expands that rule (a pseudo-element used to grow
  the hit area, for instance) re-creates a dead scroll zone.
* SMALL MEANS BOUNDED IN BOTH AXES, and the second axis is the one that gets
  missed. The grip first shipped 26px wide by the FULL CARD HEIGHT — small in
  the axis anyone thinks about, and in the other axis a strip that STACKS: with
  a 9px gap between cards, a column of them is one effectively unbroken 26px
  no-scroll band running the entire length of the column. Measured at 390px
  with the shipped `--page-pad`, the card sits at x 23-221 and the band at
  x 195-221 — it starts at the horizontal centre of the screen and runs down
  the natural right-thumb zone. A 140px vertical swipe there leaves
  `scrollTop` at 0 and emits `pointerdown, pointerup` with no `pointercancel`
  (the browser never claims the gesture), against `pointerdown,
  pointercancel` + `scrollTop 125` for the same swipe on the card body — the
  founder's original report reproduced inside the thing that was supposed to
  fix it, and past the sensor's `distance: 6` it is a real stage move, which on
  a drop into New commits with no confirmation form at all. It is 26 x 44px
  centred now (`inset-block: 0; margin-block: auto`), which clears WCAG 2.5.8
  on both axes, hits the 44px thumb target and leaves a live scrollable gutter
  above and below every grip. `e2e/board-touch.spec.ts` pins BOTH ends: the
  grip's height must be ≥ 24px and ≤ half the card, and a swipe that starts in
  the rail's own column but below the button must scroll the list.
* On the card use `manipulation`, not `pan-y`. MEASURED with CDP touch events:
  `none` gives scrollTop 0 / scrollLeft 0; `manipulation` and `pan-x pan-y` both
  give 79 / 79; `pan-y` gives 79 / **0** — it silently kills the board's
  horizontal pan, which is exactly the "plausible fix" someone will try next.
  `manipulation` also keeps pinch-zoom, which the app's default Next viewport
  allows.
* The handle forwards dnd-kit's `onPointerDown` and THEN calls
  `stopPropagation()`. Never `preventDefault()` there:
  `bindActivatorToSensorInstantiator` bails on `nativeEvent.defaultPrevented`,
  so preventing the default would kill the very drag the handle exists to start.
  Binding the same activator to both the handle and its ancestor card is safe —
  dnd-kit stamps `nativeEvent.dndKit` and ignores the bubbled second call.
* The mouse gate reads `pointerType` off the REACT SYNTHETIC event, before the
  sensor sees it. Never re-spread raw `listeners` onto the card div; that is the
  regression `src/components/shared/CardGrip.tsx` exists to prevent, and it is
  invisible on a desktop test run.
* The grip is rendered by the card BODY, not by the draggable shell, because the
  DragOverlay clone renders that body verbatim. A shell-only grip would make the
  clone 26px wider in content than the card it replaces, so the clamped name and
  the wrapping chips row would visibly re-flow under the founder's finger at the
  instant of pick-up.
* Playwright cannot swipe. `page.touchscreen` exposes only `tap()`, so a touch
  PAN must be driven over CDP `Input.dispatchTouchEvent`
  (touchStart / touchMove x N / touchEnd, then ~400ms for the fling to settle).
  See `e2e/board-touch.spec.ts`.
* NEVER RESET A SCROLLER PROGRAMMATICALLY BETWEEN TWO TOUCH GESTURES. An
  `el.scrollTop = 0` assignment can leave the scroller in a state where the very
  next touch sequence that STARTS INSIDE IT is swallowed — the same swipe scores
  145 on a fresh page and 0 after the assignment, and is fine again on the
  second try or when it starts outside the reset element. That makes the
  assertion after it pass or fail for a reason that has nothing to do with the
  CSS under test. Put the scroller back with the same `touchSwipe` helper (a
  bounded loop, then assert `scrollTop === 0`) and re-read every box afterwards.
  Sample points must come from LIVE geometry too: the fling decides how far the
  column travelled, so a card picked by index can be half off screen by the time
  you touch it — pick the card whose rect is provably inside the list.
* dnd-kit AUTO-SCROLLS a scrollable ancestor while a drag hovers near its edge.
  Any "dragging did not scroll the column" assertion is therefore only honest at
  `scrollTop === 0` with an upward drag (or at the bottom with a downward one);
  anywhere in the middle the auto-scroll is real and the test is measuring the
  wrong thing.

## The scrollbar / vw trap: `100vw` is not the width you can use (2026-08-19)

`100vw` INCLUDES the classic scrollbar. `documentElement.clientWidth` does not.
Chromium keeps that scrollbar at a fixed PHYSICAL thickness, so in CSS px it is
`15 / zoom` — 30px at 50% zoom, 15px at 100%, 7.5px at 200%. Any layout rule that
mixes `vw` with the space the page can actually use is therefore wrong at every
zoom except the one it was tuned at, and its error CHANGES SIGN across the
ladder.

`.board`'s full-bleed breakout was `margin-inline: calc(50% - 50vw + 8px)`. The
`+8px` cancels exactly one scrollbar (16 ≈ 2×8) at exactly 100% zoom. Everywhere
else `overflow = SB/2 − 8` and `board.left = 8 − SB/2`: the page genuinely gained
a horizontal scrollbar at every step below ~94%, and the board's start edge went
off-screen (−7px at 50%, −22px at 25%). Worse, `SB` is 0 when the page does not
scroll and 15/zoom when it does, so the WHOLE BOARD slid sideways by 7.5px at
100% zoom (15px at 50%) the moment a filter or a new card made the page long
enough to scroll. That lateral jump under a title that does not move is what
"the UI gets so scattered" means.

The fix is a unit that already means the right thing: `cqw` resolves against a
container's CONTENT box, which excludes the scrollbar. `.shell-body` (a plain
`<div>` the four shells wrap around `<main class="page">`) is
`container-type: inline-size`, and the board's arithmetic is written in `cqw`
with the old `vw` pair left above it as a legacy fallback.

Traps to know before touching any of it again:

* A MISSING WRAPPER DOES NOT ERROR. With no eligible container, `50cqw` falls
  back to the small-viewport size — the same value `vw` gives — so the route
  silently reverts to the bug. `e2e/zoom.spec.ts` asserts the container per
  route (A10) for exactly this reason.
* HEADLESS CHROMIUM HIDES SCROLLBARS. playwright-core pushes `--hide-scrollbars`
  into every headless launch, so `100vw === clientWidth` in the suite and nowhere
  else. That is why `qa-sweep.spec.ts` and `nav-slider.spec.ts` have asserted "no
  horizontal overflow" for months while the founder's real Chrome overflowed by
  7px at 50% zoom. `e2e/zoom.spec.ts` opts out with
  `test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } })`.
  Keep that opt-out SCOPED TO THAT FILE — putting it in `playwright.config.ts`
  moves geometry by 15px under the whole existing suite.
* MODELLING ZOOM TAKES THREE KNOBS, and no single one of them is zoom:
  (a) viewport scaling (`1440/z` x `760/z`) for the layout half — this is what
  moves media queries and what vh/vw resolve to; (b) a forced scrollbar width
  (`html::-webkit-scrollbar { width: 15/z }`) for the half (a) cannot express —
  and it MUST be injected with `context.addInitScript`, because injecting it
  after load does not relayout an already-created scrollbar and silently keeps
  measuring 15px; (c) `documentElement.style.zoom` for the fractional-pixel
  half, used only for overlap/drift checks — it never moves a media query, so it
  must not be used to test breakpoints. The spec also forces
  `html { overflow-y: scroll }`, because a zoomed-OUT viewport makes the page
  short, the scrollbar disappears, and the bug hides just as thoroughly as
  `--hide-scrollbars` hides it.
* `container-type: inline-size` was CHECKED for two side effects that the CSS
  containment spec would predict, and neither reproduces in current Chromium
  (verified with dedicated probes, not by reading): a `position: fixed` element
  inside the container stays viewport-anchored after a 900px scroll (top 0,
  height = viewport), and the container does NOT trap a `z-index: 60` descendant
  below a `z-index: 20` sticky header painted outside it. The app has no portals
  — every modal, toast and the undo pill render inline inside the page tree — so
  if a future engine changes either behaviour, every modal in both apps starts
  scrolling with the page or hiding under the header. Re-run those two probes
  before upgrading a browser baseline.
* VIEWPORT UNITS ARE STILL FINE where the thing being sized genuinely is a share
  of the viewport and is not required to agree with the content area:
  `.bell-menu { min(360px, 90vw) }`, `.toast { min(520px, 88vw) }`,
  `.login-shell { min-height: 100vh }`, `.modal { max-height: 90vh }` (measured:
  clips nothing at any zoom, do not "fix" it). The ones that were wrong are the
  ones whose result had to LINE UP with something else.

* RENAMING A STAGE KEY HAS FOUR BLAST RADII, AND THREE OF THEM ARE SILENT
  (ADR-057, the agent pipeline). The loud one — the board renders no column for
  the old key — is the one you will find in five seconds. The other three:
  (a) THE TO-DO PROJECTION. `src/lib/services/todo.ts` queries prospects with a
      literal `stage: { in: [...] }` and re-checks the stage per row. It lives
      nowhere near the partners code and it is the founder's most-used screen.
      Miss it and every renamed card's follow-up disappears with NO error, NO
      log and NO empty state. It now reads
      `partnersConfigFor(prospect.kind).followUpStage`, and the query list is
      documented as the UNION of both configs' slots.
  (b) PENDING UNDO ENTRIES. `UndoEntry.payload` holds the PREVIOUS stage
      verbatim, and the safety check is a fingerprint against the row's
      `updatedAt`. Prisma's `@updatedAt` is applied CLIENT-side, so a raw-SQL
      migration does NOT bump it — the fingerprint still matches and undo will
      cheerfully write the dead stage back. Two things now stop that: the
      migration consumes those entries, and `undoProspectEvent` refuses any
      snapshot stage that is not in the card's own `config.stages`. Ship both;
      either alone leaves a hole (a snapshot can also arrive from a restore).
      AND RETIRE THE WHOLE PENDING SET, NOT THE OFFENDING ROW. `pendingUndoFor`
      takes the user's NEWEST unconsumed entry and nothing retires the one
      underneath it, so a user routinely holds several. Consuming only the
      renamed card's entry promotes the entry below it — a different record,
      minutes older — to the head of the queue, and its fingerprint still
      matches, so "Undo" silently reverts something that was not the last thing
      the user did. Scope the statement to the OLD value in the SNAPSHOT
      (`payload->>'stage'`, not the card's current stage) and retire by
      `userId`: that keeps the honesty invariant AND is the only version that is
      genuinely idempotent, because no entry written after the migration can
      carry a dead stage. A back-to-back "run it twice" test cannot catch this —
      create a pending entry BETWEEN the two runs.
  (c) BACKUP RESTORE. `importBackup` is `deleteMany` + `createMany` with ids
      preserved and zero transformation, so an export taken before the rename
      re-inserts the old keys onto a migrated database — and the admin doing
      the restore is usually already recovering from something else. The import
      now runs the WHOLE normalisation inside its own transaction. There
      is no schema constraint that would have caught it: `stage` is plain TEXT
      with no enum and no CHECK. Doing only the CARD rewrites is a half fix that
      looks complete: the restored ActivityLog rows keep printing the old column
      names on a board that has none, and restored pending undos keep being
      offered though they can only ever fail. Put the normalisation in ONE named
      helper and diff it against the shipped SQL in a test — two hand-written
      copies of the same migration WILL drift, and the SQL is the one that can
      never be called from TypeScript.
  (d) THE HEALTH PROBE CANNOT SEE A DATA-ONLY MIGRATION. `/api/health`'s
      `schemaProbe` selected ONE column — and one added by migration 2 of 12, so
      it had been stale for the accounting and vault migrations too. A rename
      migration adds no column, so the probe returns true, `ok: true` is
      reported, the self-heal never fires, and `scripts/start.mjs` boots anyway
      after three failed `migrate deploy` attempts: cards stranded on stages the
      board cannot render, behind a green check. Probe the LEDGER instead — diff
      the `prisma/migrations` folder names against `_prisma_migrations` rows with
      `finished_at NOT NULL AND rolled_back_at IS NULL` — which is correct for
      every future migration with nothing to keep in sync. Degrade to the old
      column probe when the directory or the table cannot be read, so a
      differently-packaged deploy does not cry wolf.
* A "PARAMETERIZED" CONFIG IS ONLY PARAMETERIZED AS FAR AS ITS LITERALS.
  `partnersConfigFor(kind)` existed and looked like the extension point, but the
  config's BODY still held literal stage keys — `ACTIVE_ACTIONS`, the
  `stage === "following_up"` in `sameStageExtras`, the `stage === "won" ||
  stage === "lost"` terminal guard, and `attendedDestinations`'s literal array.
  Spreading a new `wonStage` over that would have produced a config that
  reported the right slots and behaved like the old pipeline. The rule: if a
  config declares a slot, nothing in that config may compare against the slot's
  VALUE. The engine core (`transition.ts`) was already clean — it was the config
  that was not. THE RULE EXTENDS TO EVERY CONSUMER, AND THE SWEEP MISSED TWO:
  `prospect.stage === "didnt_answer"` sat ~330 lines below the `keyDatum` switch
  that had just been converted, and `stage === "meeting_setting"` sat inside the
  very component that now reads `config.meetingStage` twice. Both were harmless
  ONLY because the two kinds happen to share those keys — the same accident that
  made the wrong-config bug below invisible for weeks. Grep for every quoted
  stage id in the files you touch, not just the ones the failing test pointed
  at; a passing suite proves nothing here, because no fixture has a third kind
  that moves those slots.
* THE VOCABULARY IS NOT JUST `stageLabel`. Renaming a stage updates the column
  titles, the chips and the history from→to for free, because they all
  interpolate the label helper. What it does NOT update is anything keyed on the
  §10 ROW ID: `HistoryPanel`'s `TRIGGER_PHRASES` mapped the literal `"PP-2"` to
  SPEC's prescribed sentence, so giving the new pipeline its own `PA-2` silently
  deleted a NORMATIVE phrase from every agent card — and deleted it
  inconsistently, since the migration rewrote `fromStage`/`toStage` but not
  `trigger`, so old rows on the same card kept showing it. Build such maps FROM
  the configs' trigger slots, never from literals, and assert on the id the
  ENGINE emits rather than on the config, so the map and the engine cannot
  disagree.
* THE UI READ THE WRONG CONFIG AND HAD BEEN GETTING AWAY WITH IT.
  `ProspectEventPanel` consulted the bare `partnersConfig` for `terminalStages`,
  `nextActions`, `attendedDestinations` and the cancelled destinations, even
  though `defaults.kind` was already on its props and the SERVICE layer resolved
  the config per kind correctly. It worked only because both kinds ran the same
  stages. The failure it would have produced is asymmetric and easy to miss in
  manual QA: the DRAG path reads its columns from the board's config and would
  have looked fine, while the detail page silently offered stages the server
  then rejected. Same shape in `pages.tsx`'s `keyDatum` and in
  `addAlternativeNumbers`, which passed the partner config into `transition` for
  a card that might be an agent.
* TWO KANBANS ON ONE PAGE: THREE THINGS THAT BITE.
  (a) dnd-kit registers droppables PER CONTEXT, and four of the six stage ids
      are common to both stage sets. Two sibling `<DndContext>`s keep the
      registries apart, but the moment anyone "simplifies" them into one, a drop
      on Agents/Didn't-Answer resolves to whichever droppable registered last
      and cards teleport between pipelines. The ids are namespaced
      `${kind}:${stage}` so that refactor is survivable rather than silent.
  (b) `<DndContext id>` was a hardcoded literal. Mounted twice it emits two
      elements with the same `DndLiveRegion-*` / `DndDescribedBy-*` DOM ids, and
      every draggable's `aria-describedby` resolves to the first — the Agents
      board narrated by the Partners board's live region. Invisible to sighted
      QA and to every assertion in the suite. The id is per-pipeline now.
  (c) ALL the drag state must live inside the per-pipeline component, not in the
      dispatcher. Hoisting `pending` / `draggingId` / `busy` / `error` is the
      obvious shortcut and it gives you one modal shared by two boards and a
      DragOverlay clone painted in the wrong section.
* PLAYWRIGHT STRICT MODE IS THE CANARY FOR A DUPLICATED BOARD. The default view
  is Kind = All, so `[data-stage="lead"]` and three siblings match twice from
  the day the stacked view ships, and journey 3 fails on strict mode rather than
  on a real regression. `.board` carries `data-pipeline` for exactly this; scope
  every column locator through it. Also give the drag helper a
  `scrollIntoViewIfNeeded()` — the second board's columns start below the fold.
* THE THREE-SCOPE TOKEN LAW WAS NOT ACTUALLY TESTED. `brand-tokens.test.ts`'s
  ADR-019 parity case compared `branding/byteforce/tokens.css` against
  `branding/b-systems/tokens.css` and never read `src/themes/neutral.css` at
  all — which is precisely the file whose omission reached production before.
  Note that neutral.css packs a whole token family onto ONE line, so an
  anchored `^\s*--token:` regex silently sees only the first declaration per
  line; the new parity test uses an unanchored match. It also asserts the
  `@theme inline` bridge in `globals.css`, and walks every stage of every
  pipeline through `stageKey()` — whose `default` is `"lost"`, so a stage added
  without a colour case does not fail a build, a type check or a screenshot
  review; it just paints the new column, including a WIN column, in the Lost
  palette.
* A DATA-ONLY PRISMA MIGRATION IS HAND-WRITTEN AND UNVERIFIABLE BY `migrate dev`.
  `schema.prisma` does not change, so nothing generates the folder and nothing
  will re-derive it. Prisma checksums `migration.sql`, so editing it after the
  first apply makes `migrate deploy` fail — and `scripts/start.mjs` then boots
  the app ANYWAY, against an unmigrated database, which is the stranded-card
  state the migration exists to prevent. Write it once, prove it before the
  first deploy, never touch it. `/api/health`'s `schemaProbe()` only selects
  `User.registrationStatus`, so it reports `schemaCurrent: true` on a database
  that is schema-current but never got the DATA migration — the health endpoint
  cannot detect this class of drift, and that is fine only because
  `migrate deploy` is idempotent and runs at boot.
  To prove one against the REAL deploy path rather than raw SQL: apply all
  migrations to a throwaway database, `DELETE FROM "_prisma_migrations" WHERE
  "migration_name" = '<folder>'` to rewind the ledger, insert live-shaped
  fixtures, then run `npx prisma migrate deploy`. Rewind and deploy again for
  idempotence. Pair it with an integration test that reads the shipped .sql off
  disk and executes it, so the test can never drift from the file.

## Payroll (ADR-058): three traps met while making one month adjustable (2026-08-21)
- Location: `src/lib/services/accounting.ts` (`expenseSchema`,
  `resolveExpenseData`, `shadowPayrollMark` and its four call sites),
  `src/components/accounting/forms.tsx` (`ExpenseModal` `prefill`, `egpOrNull`,
  `ExpenseActions`), `src/app/(accounting)/accounting/expenses/page.tsx`.
- What exists / how it works: a one-month payroll adjustment is a LINKED MANUAL
  payroll expense that `autoPayroll`'s `covered` set makes replace that person's
  derived salary row for that month only. The roster is never written. See
  ADR-058 for the decision and the approval invariant.
- Traps:
  - **AN EDIT SILENTLY BECAME AUTHORITATIVE.** `resolveExpenseData` builds an
    EXPLICIT data object that is passed to BOTH `create` and `update`. While it
    omitted `deduction`/`bonus`, a PATCH left the stored values untouched — so
    an imported deduction survived an edit *by accident*. The moment those keys
    were added, every PATCH began writing them, and any path that failed to
    prefill the form would zero an imported deduction on the first save and the
    month's cost would jump. The DTO fields and the modal prefill are therefore
    not polish, they are the correctness requirement, and they had to land in
    the SAME commit as the schema change. Regression guard: import the legacy
    row (deduction 100 / bonus 50), PATCH it with the exact body the modal sends
    when nothing was changed, assert 100/50 still stored.
  - **`egp()` FOLDS BLANK TO ZERO.** `egp(fd, key)` is
    `toPiasters(String(fd.get(key) || "0"))`, which is right for a required
    amount and wrong for an optional one: clearing the field would store 0, and
    `export.ts` only omits the key when the value is NULL. Storing zeros would
    start emitting `deduction: 0` on every payroll row and change the document
    the old app reads. `egpOrNull()` sits beside it — blank is null, a typed "0"
    is 0 — and optional money must use it.
  - **TWO STORES, ONE FACT.** A derived salary's approval is an
    `AcctPayrollPayment` row; a manual row's is its own `paid` flag. Nothing in
    the schema links them: `AcctPayrollPayment` cascades on the MEMBER, not on
    the expense, so deleting an override does not touch the mark. The fix is the
    single-owner invariant (ADR-058 decision 4) — the mark is written as a
    SHADOW of the covering expense on create, update, ✓ toggle AND delete. The
    delete write is redundant while the shadow holds and is kept deliberately:
    a row IMPORTED from the old app never had a shadow written, so without it
    deleting an imported linked payroll row would lose its approval.
  - Ordering inside `updateExpense` matters: when the row stops covering the
    person-month it used to cover (month moved, person moved, type left
    payroll), the OLD key is written from the OLD row's state FIRST, then the
    new coverage is shadowed. `resolveExpenseData` nulls `rosterId` for any
    non-payroll type, so `existing` — not the updated row — is the only place
    the old link can still be read.
  - **ACQUIRE MUST NOT DESTROY WHAT RELEASE CANNOT REBUILD** (found in review,
    fixed in this same commit). The shadow's first cut was symmetric: paid →
    upsert the mark, not paid → `deleteMany`. Symmetric is wrong, because the
    two directions are not the same act. Writing an approval is idempotent;
    deleting one throws away the only copy. With the delete branch firing on
    every create, "+ Add expense → Payroll → pick a person" — which ships
    Status = On hold — destroyed that person-month's approval on save, and the
    delete then rebuilt the derived row from nothing: a full salary out of paid
    spend, permanently (500,000 → 0 → 0 piasters, measured). `shadowPayrollMark`
    now takes `{ unapprove }` and only two call sites pass it true:
    `toggleExpensePaid`, and `updateExpense` when `stillCovers && existing.paid
    && !row.paid`. Everything else parks. The rule to keep: a write that
    ACQUIRES ownership of a fact may overwrite it only with something it can
    give back.
  - **AN UPSERT THAT RE-DATES IS NOT A RE-ASSERTION.** `update: { paidDate }`
    on the mark rewrote the approval date with the day the OVERRIDE was typed,
    so the derived row came back ticked but claiming an approval date it never
    had (seeded 2026-03-05 → read back 2026-08-21). The branch is `update: {}`:
    an approval already on record keeps its own date; a new one takes the
    covering row's. The test that guarded this could not fail — it compared
    against the override's own `paidDate`, which is today's — so the fixture now
    seeds a distinct earlier date and asserts `APPROVED_ON` explicitly.
  - **`covered` IS A SET, `monthExpenses` IS NOT.** `autoPayroll` suppresses the
    derived row ONCE per rosterId; every stored row for the month is emitted
    unfiltered. Two linked payroll rows for one person-month therefore both
    count a full salary (2 rows, 1,000,000 piasters for one 5,000 EGP salary,
    measured) — in the section total, the P&L, the department margins and the
    treasury alike, with no unique index on `(rosterId, month)` to stop it. The
    engine cannot tell them apart after the fact, so `refuseSecondCoveringRow`
    guards both the create and the update path inside their transactions and
    returns a 400 naming the existing row. The service layer is the right place:
    every app write goes through it, while the IMPORT deliberately does not (a
    legacy file is history, and refusing it would block the founder's own data).
  - **A MARK NEEDS A DERIVED ROW TO BELONG TO.** The shadow wrote the mark from
    the covering row's state without checking that the roster posts a salary for
    that person-month at all. For an inactive member, deleting a paid override
    left the mark behind; making him active over that month later materialised
    the salary ALREADY APPROVED (0 → 500,000 piasters, nobody having ticked
    anything), and the orphan also pinned the month into `activeMonths()`
    permanently. `rosterPostsSalary()` reads the member with segments and gates
    the upsert on `memberAt(member, month).active && salary > 0`.
  - **THE IMPORT IS THE OTHER WRITE PATH.** `expenseSchema`'s negative-net
    refusal covered the form and nothing else, and the import is the only path
    that has ever populated `deduction`/`bonus`. `zMoneyOrNull` had no `min` and
    no cross-field check, so `{amount: 5000, deduction: 9000}` imported to a net
    of −400,000 piasters — a paid expense that ADDS EGP 4,000 to the treasury.
    The check lives in `zExpense` and throws `ApiError` from inside the refine
    (the `egpToPiasters` precedent — Zod does not swallow it), which lands
    BEFORE the REPLACE transaction, so a refused file destroys nothing.
- Limitations / gotchas: the Roster PAGE evaluates every member at the current
  Cairo month (it answers "who is on the payroll now"), so a member whose first
  segment starts in the future reads there as Inactive with no salary. That is
  existing, intentional behaviour — but it means a far-future e2e fixture cannot
  prove "the roster is untouched" by reading that page. Prove it instead where
  the salary is in force: the NEXT month's derived row, and the row that comes
  back after the override is deleted. A roster edit would have moved both.
- Last updated: 2026-08-21 (ADR-058, Entry 053, BUG-012)

## ADR-059 — collapsing two stage sets into one, live (2026-08-21)
- Why it was more than a rename: the moment a stage key leaves `config.stages`,
  every row still holding it is un-actionable (`transition` rejects with
  `event_invalid_for_stage`), invisible on the board (columns come from the
  config), absent from the To-Do (`stage: { in: [...] }`) and painted as a LOSS
  (`stageColors`' default is `lost`). So the config change, the data migration
  and the stage TOKENS had to ship together or a partner card would have spent
  the gap stranded in no column at all. They did: commit 1 carries the engine
  AND the token family, commit 2 the migration.
- Traps hit, in the order they bit:
  - **A retired trigger id is still stored for ever.** `historyPhrases` derives
    its map from the configs' `numberAdded` slots, which is exactly right — but
    collapsing two configs into one made that map yield ONE id, silently
    dropping `PA-2`. ActivityLog is append-only: every agent card moved during
    ADR-057's two days carries it, and each would have lost its "Returned to
    Lead — new number added" pill with no error anywhere. Legacy ids now have a
    named list and their own test. The same reasoning is why the agent's
    terminal row got a NEW id (PP-6) instead of reusing PA-4, whose meaning
    changed completely, and why PP-1…PP-5 kept theirs.
  - **A null role slot breaks the things that COMPOSE from it, not the things
    that read it.** `groupForStage` handles `followUpStage: null` by falling
    through, which is the whole point. But two places built values out of the
    slot: `SAME_STAGE_FORM_SLOT.follow_up_again` (the follow-up form would have
    rendered EMPTY — the feature dies silently, tests green) and the core's
    hardcoded cancelled-meeting pair `[followUpStage, lostStage]` (which would
    have collapsed to Lost alone). Fix for both: ask the engine. The UI now
    switches on the required GROUP via the exported `requiredGroupFor`, and
    cancelled destinations are a config slot the three lead pipelines answer
    identically (asserted, byte for byte).
    *Follow-up (review round):* leaving the disarmed composer in the tree is not
    neutral. `SAME_STAGE_FORM_SLOT` survived with zero callers and a doc comment
    still telling the next reader to use it — a one-line reintroduction of the
    same empty form. Delete a helper the moment its last caller goes; a
    `@deprecated` note on the OTHER map is not a substitute.
  - **One board, two configs: `config.stages` is shared, behaviour is not.**
    When both kinds collapsed onto one column set it became natural to resolve
    the config once per BOARD. That is right for rendering (`stages` is literally
    the same array object for either kind) and wrong for every decision: only
    three slots differ, and one of them — `wonRequiredGroup` — is exactly what
    the drag handler consults to decide modal-or-commit. `partnersConfigFor("partner")`
    used board-wide answered `{group:"won_partner"}` on an AGENT's drop into
    Qualified, so PP-6's pure move opened a confirmation modal that rendered no
    fields (the modal itself re-asked with the card's own kind and got `null`).
    It cost a click, not data, and no test saw it: the e2e drags stopped at
    Waiting and Contacted, and the panel path was already correct. Rule: the
    shared config may render columns; anything that ASKS the engine must pass
    the card's own `partnersConfigFor(card.kind)`.
  - **A "statement for statement" twin must match the statements' SIDE EFFECTS
    too.** `normaliseProspectStages` is the TypeScript twin of the two shipped
    migrations for the one path SQL cannot reach (`importBackup` re-inserting a
    PRE-rename export). It used `tx.partnerProspect.updateMany`, and Prisma
    applies `@updatedAt` CLIENT-side — so the twin bumped a column the raw SQL
    leaves alone. Two things ride on that column: undo's integrity FINGERPRINT
    (a restored pending entry whose snapshot names a still-live stage is
    deliberately left pending — and would then 409 for ever on the restore path
    while succeeding on the SQL path) and the board's `orderBy: { updatedAt:
    "desc" }` (a restore would silently re-sort every renamed card to the top of
    its column). The rewrite is now `tx.$executeRaw`. The parity test grew a
    `fingerprintValid` flag and a live-payload undo fixture, and asserts
    `updatedAt` is unmoved on BOTH paths — reverting the raw UPDATE fails it.
  - **Ignoring an unexpected payload is worse than refusing it.** With Qualified
    requiring no group for an agent, a stale client posting `won_agent` was
    silently accepted and the payload dropped — the card qualified and the
    client believed it had minted an account. `applyProspectEvent` now refuses a
    group on a move that requires none, and the route's Zod union no longer
    knows the retired group at all.
  - **The To-Do can lose rows in BOTH directions.** Keying the projection off
    the follow-up RECORD instead of the stage fixes founder item 2.1, but the
    stage `in` list is now the only guard left: too narrow and every prospect
    follow-up vanishes from the admin's most-used screen; too wide and a stale
    follow-up on a terminal card nags for ever. The list must be exactly the
    ACTIVE stages — `lead, contacted, didnt_answer, meeting_setting, waiting` —
    because the ACTION is offered from every one of them, and SPEC §7.2c makes
    the record, not the column, the thing that puts a card on the screen. The
    first draft kept `didnt_answer` out ("its key datum is already awaiting a new
    number"), which meant the admin could press a button, have a FollowUp row and
    an ActivityLog entry written, and see nothing anywhere. A rule that filters
    by COLUMN inside a projection whose whole point is "not the column" is a
    contradiction that reads as reasonable in a comment; check the ACTION SET,
    not the intuition.
  - **Two record kinds must not compete once BOTH are deliberate.** The same
    reversal that offered `follow_up_again` from every active stage turned the
    To-Do's "newest child wins" tiebreak into a data-loss bug in one direction:
    recording a call on a card with a meeting booked made the MEETING vanish from
    the screen whose stated purpose is "so I don't miss anything". Supersession is
    only real one way (a meeting arranged after a follow-up absorbs that call);
    two commitments on two dates are two rows. The card, which has one line,
    resolves it differently: the meeting column keeps its own datum when a meeting
    is arranged, and a recorded follow-up fills the line everywhere else.
  - **Playwright drags: aim the CARD, not the pointer.** Seven 218px columns is
    ~1598px of board, so both ends need `scrollIntoViewIfNeeded` before
    measuring (page.mouse works in viewport coordinates). More subtly, dnd-kit
    scores collisions on the dragged card's rect and the grip sits at the card's
    inline-START edge — pointing at a column's centre leaves the card straddling
    its neighbour, and a drop meant for Contacted landed in **Lead**. The helper
    now offsets the pointer so the CARD lands centred on the target. Adjacent
    columns stay unreliable by nature (the source can out-overlap the target),
    so the drag tests cross several columns and the panel covers the short hops.
  - **`getByText` on a page with an Undo bar.** The undo button's own label
    ("Moved Quiet Contact to Contacted") matches the card's name, so a To-Do
    assertion that the card is ABSENT failed on the corner of the screen. Scope
    prospect-row assertions to `getByRole("listitem")`.
  - **A guard that scans the FILE is not a guard on the SCOPE.** The three-scope
    stage-token test read `--color-stage-*` out of the whole CSS file, so a token
    declared OUTSIDE its `[data-brand]` block would have passed while painting
    nothing under the neutral shell — the identical blind spot that let
    `--color-acct-positive` ship inside `.bs-mesh` (Run 058). The accounting guard
    directly below it had already been rewritten to route through `scopeBody`;
    the stage guard now does too. Placement is correct today (44 tokens, all
    in-scope, in all three files), so this is a trap closed rather than a bug
    fixed — which is exactly when it is cheapest to close.
  - **Retiring a name in code does not retire it in the schema comments.**
    `won_agent` was deleted from `RequiredGroup`, from `groupPayloadSchema` and
    from the Zod union, but `prisma/schema.prisma` still told the next reader
    that `agentUserId` is "set by the won_agent gate", and two more comments
    still described auto-provisioning that ADR-059 removed. The data layer is the
    first thing anyone consults when re-deriving a migration; grep the retired
    identifier across `prisma/` and comments, not just `src/**/*.ts`.
- Limitations / gotchas:
  - `converted` remains the honest "has a login" flag for an agent and is now
    routinely false on a Qualified card. Anything that assumes
    `stage === "qualified" ⇒ account exists` is wrong; the two places that read
    it (board chip, detail badge) were given the mirrored empty state, and the
    seed ships one agent in each shape so the state is visible on a fresh
    install rather than only after someone reproduces it.
  - A directory Partner with `userId: null` was always legal; it is now the
    DEFAULT after conversion, because the gate no longer carries a password.
    `createPartnerLogin` is the only path that mints a `bsystems_partner`
    account, and it is admin-only.
  - `nextActions` is now `stages.filter(s => s !== stage)`, so `lead` appears in
    the panel's dropdown for the first time. Harmless (a move to intake opens no
    group, exactly like the drag), but it is a visible change flagged for the
    founder rather than buried.

## ADR-060 — traps met across the five founder asks (2026-08-22)

### Removing a link orphans more than the link (item A)
Deleting the "Edit in roster" `<Link>` from `ExpenseActions` orphaned the
`Link` and `acctQuery` imports AND the component's `month` prop (its only
consumer was the link's href — every other use reads `row.month`). tsconfig
has no `noUnusedLocals`, so `tsc --noEmit` does NOT catch the dead imports —
only the Next build lint would. When removing an affordance here, grep the
component for what ONLY it consumed: the prop removal also needs the call
site in expenses/page.tsx or it is a compile error in one direction and a
lint failure in the other.

### The exporter emits raw ids; the OLD app degrades one-way (items B/C)
`export.ts` emits `type` and `serviceLine` verbatim — no whitelist, no
mapping. The reference SPA imports anything (its migrate() never validates
these columns) and its arithmetic is identical for any non-payroll type, but
its RENDERING degrades for ids it does not know: an unknown expense type
shows as the raw id (index.html EXP_MAP fallback), and — the serious one —
its departments report iterates its OWN dept list while counting overhead
only for UNTAGGED rows, so a `bsystems`-tagged cost appears in NO line there:
totalCost understated, directProfit overstated. Same for tagged income. Our
import of OLD files is provably unaffected (no enum anywhere on the import
path — `zStr.default("other")`). Round trips are fully faithful only for ids
the old app knows; the export is one-way-safe once the new vocabulary is in
use. Also: the SPA's expense-edit Type `<Select>` renders UNSELECTED for an
unknown id — an untouched Save keeps the value, one stray click re-types the
row silently.

### The two switchers share one class; the sheet lives inside the header (item D)
`EntitySwitch` and `LanguageToggle` both render `.switcher`, so the old
`≤600px .app-header .user > .switcher { display:none }` rule always hid BOTH.
The entity copy now carries its own `.switcher-entity` hook and leaves the
header at ≤820px, while that legacy rule keeps governing only the language
toggle. Second trap: the burger sheet is `position:fixed` but a DOM
DESCENDANT of `.app-header`, so every `[data-brand="bsystems"] .app-header
.switcher-seg` override (translucent white ink for the indigo ground) bled
into the light sheet — near-white text on a white card. The fix re-grounds
`.nav-sheet-extras` switchers explicitly, the same way `.nav-sheet-extras
.nav-item` had already been fixed for Log out. Anything styled "for the
header ground" must be scoped to `.user >` or re-grounded in the sheet.

### A title attribute is hover-only; touch needs visible text (item A, review fold)
The `from roster` badge's `title={fromRosterHint}` shows on desktop hover and
NEVER on touch — iOS/Android show nothing for a title on a non-interactive
span. On the phones item D targets, the badge explained nothing. The pointer
now ALSO rides as visible text appended to the adjust modal's locked banner
(the phone's one stop on a derived row) — appended as a separate sentence,
because `adjustBanner` is a frozen pre-ADR-060 English string that must stay
byte-identical. Rule of thumb: a `title` is garnish for mouse users; any
information a phone user needs must exist as rendered text somewhere on the
same path.

### text-overflow never applies to a grid container (item D, review fold)
Below ~340px the module bar's longest labels (ACCOUNTING, BYTEFORCE,
B-SYSTEMS — EN and the two Latin brand names in AR) outgrow a 1fr cell:
measured at a 320px viewport (305px client width) each cell is ~67px and the
labels hard-clipped with no affordance; at 390px (~85px cells) nothing clips.
Adding `text-overflow: ellipsis` to `.switcher-seg` itself would be a silent
NO-OP: the seg centers with `display:grid`, and text-overflow only applies to
block containers. The label therefore rides in its own `.switcher-label` span
— a block-level grid item whose `overflow:hidden` zeroes its automatic
minimum size, so it shrinks to the cell and ellipsizes. A 320px module-bar
test pins both halves (the label really overflows AND the ellipsis lives on
the span). Same trap family as flex containers; check `display` before
trusting text-overflow.

### The overflow band MOVES when the strip grows (item D)
BUG-010's fix hid the 3-segment strip ≤600px after measuring overflow at
400–555px. ADR-054's fourth segment made the strip ~307px and moved the
overflow band UP to ~601–645px (+44px measured at 601px EN) — above the old
hide threshold and exactly between qa-sweep's sampled widths (560, 768), so
the sweep stayed green over a live bug. Fixed structurally (the ≤820px bar
uses 1fr grid cells that cannot overflow) and 601 is now a permanent
qa-sweep viewport. Lesson: when a fixed-width element GROWS, every width
threshold derived from its old size is stale, and width sweeps must sample
the band a fix was measured in.

### Root metadata files work without a root layout (item E)
This repo deliberately has NO src/app/layout.tsx (ADR-007 — each route group
owns <html> to stamp data-brand). Root-level metadata FILE conventions
(src/app/apple-icon.png, src/app/manifest.ts) still inject into every
group's head and serve at /apple-icon.png and /manifest.webmanifest —
verified on the BUILT app (e2e/app-icon.spec.ts), not assumed. Group-level
icon.svg files keep overriding the favicon per group; the root apple-icon
and manifest apply platform-wide. The proxy matcher does not cover these
paths, so they are public — which an installable icon must be.

### Icon PNGs: strip the c2pa block, bake the plate
public/brand/b-systems/logo-mark.png is 636×1101 RGBA whose bulk is a c2pa
metadata block (61KB); a System.Drawing re-encode at display size is ~7KB
and pixel-identical at favicon sizes. iOS composites a transparent
apple-touch icon onto BLACK and maskable icons are cropped to a circle, so
the white plate is baked into the PNGs (mark at ~70% height; maskable mark
inside the central safe zone), never left to the platform.

## The board auto-scrolls under a held drag — e2e drops must aim at LIVE geometry (2026-08-22)

Caught by the ADR-060 gate round (TESTING Run 064), in a spec this batch never
edited: `board-touch.spec.ts`'s grip-drag test failed twice in the FULL suite
(and in a 2-file repro with `accounting.spec.ts` before it) yet passed in
isolation, in Run 063's subset, and in Run 062's full gate. The trace showed
the modal opening for "New → Meeting Setting" — ONE COLUMN PAST the aimed
Following Up. Mechanism: the test computed its drop point from PRE-drag
bounding boxes, capped at x=350 on a 390px viewport — inside dnd-kit's
edge auto-scroll zone. While the CDP-driven finger hovered there, dnd-kit
kept scrolling the board; on a warm/loaded server (the batch made
accounting.spec heavier, slowing each CDP round trip just enough) the board
slid a whole column between aim and release, and the fixed coordinate landed
on the next stage. Its form has no "Follow-up date" field, so the test hung
60s on a field that existed only in the stage it MEANT to hit. The product is
correct — edge auto-scroll is how a thumb reaches far columns.

Fix (test-side only): `touchDragToStage` drags toward the pre-drag sliver,
PARKS mid-viewport (outside both auto-scroll zones) until scrolling stops,
re-reads the target column's live box, settles on it, then lifts — and the
test now asserts the modal EYEBROW names the intended stage, so a mis-aim
fails loudly in milliseconds instead of hanging. Lesson for every dnd e2e
here: any coordinate computed before `touchStart`/`mousedown` is stale the
moment auto-scroll can run; either re-acquire at release time or pin the
landed target in the assertion (do both).

## ADR-061 — telling a follow-up's time input from a meeting's (2026-08-23)
- The repo had ELEVEN `type="time"` inputs named `time` when the founder
  asked to remove "the time of the follow up". Only FOUR belonged to
  follow-ups. The name attribute is identical either way, so the only safe
  test is the submit path: which payload builder harvests the field, and
  which Zod group receives it.
  - REMOVED (submit path ends in `group: "follow_up"` → `followUpSchema`):
    `internal/LeadEventPanel.tsx` FollowUpFields,
    `bsystems/roleForms.tsx` FollowUpFieldsV2 (the `!light` branch),
    `partners/ProspectEventPanel.tsx` FollowUpFields,
    `portal/groupForms.tsx` FollowUpFields — plus the `time:` line in each
    matching payload builder (followUpFromForm ×2, followUpPayload,
    prospectGroupPayload's follow_up arm).
  - KEPT (submit path ends in `group: "meeting"` or `"meeting_reschedule"`):
    LeadEventPanel MeetingFields and its delayed-outcome reschedule form,
    BsEventPanel's reschedule form, roleForms MeetingFieldsV2,
    ProspectEventPanel's meeting fields and its reschedule form,
    portal MeetingFields. `meetingSchema` still REQUIRES date+time+mode for
    an arranged meeting and `meetingRescheduleSchema` requires both —
    deliberately unchanged.
- Trap: after deleting an input, `String(fd.get("time"))` is the string
  `"null"`, which FAILS `timeStr` — removing only the input, not the
  payload line, turns every follow-up submit into a 400. The builders send
  no `time` key at all now.
- The 09:00-Cairo default lives in ONE place (`followUpDueAt` in
  groups.ts); it was already pinned by two integration tests
  (bsystems "day-only follow-up", same-stage "light form") — those now pin
  the behavior for every role, not just agents. Review round: the same
  function now carries the spring-forward clamp `startOfCairoDay` already
  had — an API-posted 00:xx on Egypt's transition day (a wall-clock that
  does not exist; the solver lands on the EVE) re-anchors one hour forward
  so a posted time can never move a follow-up off its posted date
  (unit-pinned in groups.test.ts; the 09:00 default was always safe).
- The Today chip compares Cairo days CLIENT-side in `useTodayFilter`
  (TodayChip.tsx, shared by both boards): one `utcToCairo` day-string per
  card against a today sampled AFTER mount and re-sampled on every press —
  never at render, where the SSR clock and the hydration clock straddling
  Cairo midnight would text-mismatch the count and a tab left open past
  midnight would filter on yesterday (review; SSR paints "Today · 0" for
  one beat instead). Same day-definition as `sameCairoDay`, proven by the
  datetime unit test; the per-card pass is memoized and datetime.ts caches
  its one Intl.DateTimeFormat, so drag-hover re-renders stay cheap.
  `cairoDayWindow` was not reused there because it lives in the todo
  service next to `db` imports; pulling it into a client bundle would drag
  Prisma along.
- Review round: a PRESSED chip with zero matches while the column still
  holds cards renders "No follow-ups due today" (new key, real Arabic) —
  the plain `emptyColumn` "Nothing here yet" would misread as an empty
  column.

## ADR-062 — the To-Do completion identity trap, and where the rules live (2026-08-23)

The founder's 2.2/2.3 ask ("a checkbox next to every task") hides one sharp
edge: **what is a task's identity?** Key the mark to anything but the
underlying record id and completion silently becomes per-LEAD — his exact
complaint. The traps met:

- **The projection threw the id away.** `TodoItem` carried kind/at/href/leadId
  but not the FollowUp/Meeting/Statement/Milestone id, even though every
  query already held it. The fix is one field (`recordId`) — but any UI keyed
  on the rendered row (title, date string, lead id) would have been wrong in
  a way no quick test catches: it only shows once a SECOND follow-up lands on
  the same lead.
- **Append-only records make identity free — except ONE.** Follow-ups,
  proposals, notes: new record, new id, so "a new follow-up arrives
  unchecked" needs zero code. The exception is Meeting on reschedule
  (`persistGroup` meeting_reschedule): the SAME row gets a new datetime. A
  checked meeting rescheduled to later today would stay invisibly done.
  Rather than hooking the reschedule path (a hook someone will forget the
  next time a record becomes editable), `TodoDone.dueAt` snapshots the due
  instant at check time and the PROJECTION honours a mark only while the
  snapshot equals the record's current instant. The rule sits in one place;
  reschedule code knows nothing. If another record ever grows an
  edit-the-date path (statements/milestones have none today), it is covered
  for free.
- **Day-scoping is load-bearing on money only.** Marks count only when
  `completedAt` falls in today's Cairo window. Lead tasks leave the window by
  themselves (ADR-061 killed overdue), but a PERMANENT mark on a pending
  statement/milestone would override the money-never-vanishes asymmetry for
  ever. Tests pin the "back tomorrow, unchecked" behaviour specifically.
- **Auto beats manual, decided in the projection.** A task checked manually
  whose lead then moves appears in BOTH derivations; if manual won, Done
  would offer a restore that cannot restore (the CRM moved on). The live set
  is computed first, manual marks subtract only from it, and the auto loop
  skips live keys — so the precedence is structural, not an if-chain.
- **The wall is two-layered on purpose.** Routes re-derive access from the
  RECORD (`leadIdOfTodoRecord` → `requireLeadAccess`; money → admin), so a
  client's kind/recordId pair is never trusted — and the service separately
  refuses non-live records so a 403-proof caller still cannot mint marks on
  yesterday's tasks or another brand's rows. Prospect-parented FollowUps
  (leadId null) 404 inside `leadIdOfTodoRecord`, or `requireLeadAccess(null)`
  would have been a crash path.
- **…but "resolve the record, then guard it" inverted the house order**
  (caught in review). Every other route guards first; these two could not,
  because the guard needs a leadId only the record knows. Left as written,
  an ANONYMOUS POST did real database work and answered 404 for a made-up
  record id but 401 for a real one — a record-existence oracle with no
  session. The shape that keeps both properties: authenticate up front, then
  pass the caller down. `requireLeadAccess(leadId, known?)` takes an
  already-authenticated user, and the role check inside `requireRole` is
  split out as `assertRole(user, ...roles)` so the money branch gates on
  admin without a second `auth()` + user read. **Rule for the next route
  that must look something up to know who may touch it: `requireUser()`
  first, always — the lookup is not the guard.**
- **Testing a route, not just its service.** The scope walls (SPEC §13) live
  in the route, so proving them at the service layer proves nothing —
  `setTodoDone` takes an already-guarded caller by contract. The pattern that
  works here without a browser: `vi.mock("@/lib/auth/index", () => ({ auth }))`
  with a `vi.hoisted` stub, then import the route module and call `POST(new
  Request(...))` against the real embedded Postgres. Only the session is
  fake; guards, Zod, `handleRoute`'s error mapping and the service are real.
  Note the mock must be declared by the `@/lib/auth/index` specifier even
  though `guards.ts` imports `./index` — Vitest matches the resolved file, so
  both spellings hit the same module.
- **A rejected fetch is not a failed response.** `TodoCheckbox` (and the
  `MilestoneCheckbox` it copies) awaited `fetch` with no try/catch: on a
  non-ok RESPONSE it showed the error, but on a REJECTION (offline, server
  restart mid-request) the handler threw, `setBusy(false)` never ran, and the
  row's checkbox stayed `disabled` until a full reload — the one failure mode
  with no message and no retry. try/catch/finally. `MilestoneCheckbox` still
  carries the same wart (one control per won-deal page); it is untouched here
  only to keep the ADR-062 diff honest.
- **Cascade note.** All four TodoDone FKs cascade at the DATABASE, so
  `deleteLead`'s hand-deleted statements/milestones retire marks without the
  service knowing — verified through the real `deleteLead` in the
  integration suite. The backup MODELS list places `todoDone` after all five
  parents (user, lead-cascaded followUp/meeting, milestone, statement);
  reversed deletes clear it first. A pre-TodoDone export restores cleanly
  (missing table key → `?? []`).

## ADR-063 — giving an optional field back: the omit-the-key trap, and the flag that had to exist (2026-08-25)
- **The trap ADR-061 wrote down, met from the other side.** ADR-061's note
  records that after DELETING a time input, `String(fd.get("time"))` is the
  literal string `"null"`, which fails `timeStr` and 400s every follow-up
  submit. Restoring an OPTIONAL input hits the same edge from the opposite
  direction: an input the user never touches submits `""`, and
  `String(fd.get("time"))` on a MISSING field is still `"null"`. Both fail
  the HH:mm gate. The four builders therefore send
  `time: String(fd.get("time") || "") || undefined` — the exact
  omit-when-empty idiom already used for `ownerSalesRepId` /
  `followingUpWith` in the same objects (`JSON.stringify` drops an
  `undefined` value, so the key never leaves the browser, and Zod's
  `.optional()` accepts it on any non-JSON path too). Never `""`, never
  `"null"`, never a bare `String(...)`.
  The four builders: `internal/LeadEventPanel.tsx` `followUpFromForm`,
  `bsystems/roleForms.tsx` `followUpPayload`,
  `partners/ProspectEventPanel.tsx` `prospectGroupPayload` (follow_up arm),
  `portal/groupForms.tsx` `followUpFromForm`. The SEVEN meeting time inputs
  and their `meetingSchema` / `meetingRescheduleSchema` requirements were not
  touched — ADR-061's KEPT list still holds.
- **Why a flag and not a formatting rule.** `FollowUp.dueAt` is one UTC
  instant, so "blank ⇒ 09:00 Cairo" (ADR-061) makes a defaulted row and a
  deliberate 09:00 row byte-identical. There is no render-time predicate that
  can separate them, now or ever — hence `dueTimeSet`, written from the WIRE
  in `followUpDueTimeSet` (groups.ts), next door to `followUpDueAt` so the
  slot rule and the marker rule cannot drift apart.
- **The backfill's one false negative is structural, not a bug.** The rule is
  "not 09:00 Cairo ⇒ the user chose it". A pre-ADR-061 user who typed 09:00
  is indistinguishable from the default and stays date-only. Two things make
  this the right trade: the wrong answer shows LESS rather than inventing a
  time, and the rule is stated in the migration file itself, in the ADR, and
  in the founder-facing CHANGELOG.
- **Cairo wall clock in SQL, not a fixed offset.**
  `("dueAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')::time <> TIME '09:00'`
  — `dueAt` is `timestamp` (no zone) holding UTC, so the first `AT TIME ZONE`
  labels it and the second converts. Egypt runs DST, so a naive
  `dueAt::time <> '07:00'` would be right for half the year and wrong for the
  other half; the fixture set in `follow-up-time.integration.test.ts` plants
  09:00 rows on BOTH sides of the transition for exactly this reason.
- **Two copies of the same rule, kept honest by a parity test.** The
  migration cannot reach `importBackup`, which re-inserts a pre-marker export
  onto an already-migrated database — so `backfillFollowUpDueTimeSet` in
  backup.ts is its twin (the arrangement `normaliseProspectStages` already
  uses). The integration test READS the UPDATE statement out of
  `prisma/migrations/20260825093000_follow_up_due_time_set/migration.sql` and
  runs both against identical fixtures, diffing the classification — so the
  twin cannot silently drift from what ships.
- **A twin that runs blind is a different bug (review catch, fixed before
  push).** Copying `normaliseProspectStages`'s arrangement, the ADR-063 twin
  was first called unconditionally inside the restore transaction. That works
  for stages — a retired stage key is never a legitimate value — and is WRONG
  here: `exportBackup` uses `findMany()` with no `select`, so a post-marker
  export carries `"dueTimeSet": false` on every date-only row, `createMany`
  restores that false faithfully, and the blind backfill then flipped any of
  them not sitting at 09:00 Cairo. Export → Import would grow clocks nobody
  chose. The discriminator is the payload's SHAPE, not its version: a
  pre-marker export has no `dueTimeSet` key at all, which is
  `predatesFollowUpDueTimeSet(rows)` in backup.ts, and the gate reads
  `if (predates…) await backfill…`. The lesson worth carrying: **before
  copying a restore-path twin, ask whether the value it rewrites can be
  legitimate.** For a renamed enum key, no. For a boolean with a meaningful
  `false`, yes — and then the twin needs an era test in front of it.
  The old doc comment ("rows already marked are never touched, so this is safe
  to run on any database") was true only of rows marked TRUE; it now says so.
- **`dueTimeSet = false` ⇒ 09:00 Cairo is an INVARIANT, and the seed was
  breaking it.** Everything the backfill does rests on that implication, and
  `prisma/seed.ts` was the one writer producing rows the rule calls impossible
  (10:00 / 11:00 / 12:00 / 13:00 Cairo, unmarked) — which is precisely what made
  the blind-backfill bug observable on a demo database. Three seeded follow-ups
  now say `dueTimeSet: true`; the fourth moved to 09:00 Cairo (06:00Z) and stays
  unmarked, so the demo shows both shapes. If a future write path needs a
  date-only row, it must land on 09:00 Cairo or carry the marker — there is no
  third option.
- **The spring-forward nudge is now visible.** `followUpDueAt` moves a posted
  00:00–00:59 forward one hour on Egypt's transition day (that wall clock does
  not exist), and ADR-063 is the first release that PRINTS the result: 00:30 on
  2026-04-24 reads back as 01:30. Same instant as before, newly legible.
  Measured over every 2026 transition: 45 date×time cases, 45 keep their posted
  DAY, 3 clocks move — all of them the non-existent midnight hour. Accepted and
  noted in groups.ts rather than "fixed", because no instant both keeps the day
  and shows 00:30.
- **Where a follow-up's clock is decided (all of it).** Service:
  `todo.ts` `withTime: f.dueTimeSet` on the Today row AND the Done row (it
  was a constant `false` — ADR-061). Render: `formatCairo(dueAt, dueTimeSet)`
  in `b-systems/crm/page.tsx` (Next + the negotiation Response datum),
  `internal/pages.tsx` (ByteForce board), `partners/pages.tsx` (prospect
  card) and `internal/GroupHistory.tsx` — that last ONE line serves the lead
  detail, the prospect detail and the call sheet, which is why there is no
  fourth place to forget. `formatCairoDate(x)` is exactly
  `formatCairo(x, false)`, so the conditional is a one-argument change.
- **e2e gotcha: the same lead name appears TWICE on the To-Do.** Recording a
  second follow-up supersedes the first, and ADR-062 puts the superseded one
  in the Done section — with the same lead link, so a bare
  `page.locator("li").filter({ has: link })` is a strict-mode violation. Row
  assertions scope to the Today `<section>` first. Likewise the "no clock"
  assertion on the lead detail must sit on the `Due …` PARAGRAPH, not on the
  `.record-group`: every record group also prints its creation stamp, which
  always carries a time.
- Last updated: 2026-08-25 (Entry 058, ADR-063)

## ADR-064 — the traps in ordering ONE column and in counting a boolean (2026-08-25)

**1. The one-button toggle made the counter unreachable.** The scouting for this
work said the card "offers both a Didn't answer action and an Answered-clear-flag
action". It does not, and did not: `BsBoard`/`InternalBoard` render a SINGLE
button whose label flips (`lead.noAnswer ? clearNoAnswer : markNoAnswer`) and
whose body posts `{ value: !lead.noAnswer }`. So the moment a lead was flagged,
the only thing the card could do was clear it — a tally would have been frozen at
1 for ever, and every test would still have passed. Read the render, not the
summary. Fixed by splitting it into two buttons: "Didn't answer" is always
offered on an active card (each press = `{ value: true }` = one more try), and
"Answered — clear flag" appears beside it only when there is something to clear.

**2. `Infinity - Infinity` is `NaN`, and a NaN comparator silently corrupts a
sort.** The natural way to sort "nulls last" is to map null to
`Number.POSITIVE_INFINITY` and subtract. Two datetime-less cards then compare as
`NaN`, which `Array.prototype.sort` treats as "no opinion" — the result is
implementation-defined and, worse, quietly plausible. `orderMeetingColumn`
branches (`if (ka === kb) return 0; return ka < kb ? -1 : 1`) instead, and a unit
test pins that several undated cards keep their incoming order at the back.

**3. Ordering ONE column of a shared list.** The boards do
`leads.filter(l => l.stage === stage)` per column over one array, so "sort just
this column" has to be expressed on the whole array. Sorting the array by
`(stage, meetingAt)` would re-order everything else. The trick is to sort the
meeting cards among themselves and write them back into the SLOTS they already
occupied: every other card stays at its original index, which is the invariant
the unit test actually asserts (`f1 / m-soon / p1 / m-late / f2`).

**4. `useTodayFilter` is a hook, so the accessor must be stable.** Generalising
it from "reads `followUpDueAt`" to "takes an accessor" put a function into the
memo dependency list. An inline `(l) => isMeetingCol ? l.meetingAt : l.followUpDueAt`
would be a new identity every render and would recompute the filter every time.
Each board declares `FOLLOW_UP_AT` / `MEETING_AT` at MODULE level and the column
picks between them with a ternary. Also worth remembering: the hook must be called
unconditionally, so a column with no chip passes `null` rather than skipping the
call.

**5. The sort key must be the datum the card PRINTS.** The meeting line on a card
comes from `meetings[0]?.datetime` (latest record; neither expression consults
`arranged` — both ask only whether a datetime is there). Sorting by anything
else — say, only arranged meetings — would produce a column where the printed
times are out of order, which reads as a bug however defensible the rule is.
`meetingAt` is therefore computed by the same expression as `keyDatum`, and in
`partners/pages.tsx` it was extracted into one `meetingAtOf(p)` used by both, so
the two cannot drift. **Correction (review):** an earlier draft added that an
unarranged record WITH a datetime is V2 §3's "proposed slot" and prints its
time. That shape is real in the schema and both expressions handle it, but
`persistGroup` nulls the datetime whenever `arranged` is false, so no write path
produces it and every card in the diary is an arranged meeting. See ADR-064 for
why persisting the proposed slot was deliberately NOT done here.

**6. Counting a boolean means the write is no longer idempotent — and one test
depended on that.** `setNoAnswer` began with `if (lead.noAnswer === value) return
lead;`. Removing it wholesale would break ADR-039's pinned behaviour ("clearing
an already-clear flag writes no third row"). The guard is now asymmetric: only
the CLEAR path early-returns (`if (!value && !lead.noAnswer && count === 0)`);
counting up never does, because that is the entire feature.

**7. An undo payload that stores a DERIVED value cannot restore a number.** The
old payload was `{ noAnswer: !value }` — the inverse computed from the incoming
argument. That works for a boolean and is useless for a count: undoing the 4th
attempt has to leave 3, which `!value` cannot express. The payload now snapshots
what was actually there (`{ noAnswer: lead.noAnswer, noAnswerCount:
lead.noAnswerCount }`). Same trap in `StageEventSnapshot`, which the stage-move
auto-clear writes.

**8. Undo entries written before the migration.** The undo window is minutes, but
a deploy can land inside one, so a pending `lead_no_answer` entry can carry only
the old boolean. `noAnswerCountOf(count, noAnswer)` in `undo.ts` revives a
missing or malformed count as the honest minimum (flagged ⇒ 1, clear ⇒ 0) and is
covered by a test that rewrites a real pending entry into the old shape.

**9. Keeping the boolean is not redundancy, it is the restore path.**
`exportBackup`/`importBackup` recreate rows verbatim (`createMany` over whatever
the file holds). A dropped column breaks restoring every file taken before the
change — this repo has been bitten by schema-vs-backup mismatches before. So
`noAnswer` stays, maintained as `noAnswerCount > 0` in every write, and the
integration suite's `marker()` helper re-asserts that invariant on every single
transition rather than trusting the writers.

**9b. Keeping the column is not enough — the RESTORE needs the migration's twin
too, and this one does not want ADR-063's gate.** A pre-tally backup has Lead
rows with `noAnswer: true` and no `noAnswerCount` key; `createMany` hands them
the default 0, and a flagged card with a zero tally renders NO badge. So
`backfillNoAnswerCount(tx)` joins the two twins already inside `importBackup`.
The ADR-063 twin is gated on `predatesFollowUpDueTimeSet` because `dueTimeSet =
false` is a legitimate modern value and re-running the rule over it would invent
a clock. `noAnswer = true` with `noAnswerCount = 0` is NOT a legitimate value —
no write path can produce it — so this twin runs blind, like the stage
normalisation, and matches nothing on a modern payload. The test asserts both
directions: a pre-tally payload comes back flagged-at-1, a modern payload
carrying 5 comes back at 5. Whenever a column is added whose value is derivable
from an older column, ask which of those two shapes the new field is.

**10. The badge had to stay byte-identical at count 1.** `e2e/no-answer.spec.ts`
and `e2e/byteforce-board.spec.ts` both assert `getByText("No answer", { exact:
true })` after a single press. Rendering "No answer · 1" would have broken two
untouched specs — and the founder's own instruction was that one attempt must not
read as a clumsy 1. Both point the same way: no number on the first attempt.

**11. Arabic plurals are a real trap.** "3 مرات" is right, "11 مرات" is not
(11+ takes the singular مرة). Rather than hand-roll count bands, the Arabic
sentence is phrased count-agnostically — "عدد المحاولات: 11" — which is
grammatical for every n. The visible badge reuses the Today chip's `label · n`
join, already proved to render correctly right-to-left.

**12. Port hygiene on this machine.** Playwright hardcodes 3100 and another
workstream was holding it, so both e2e rounds ran from a temporary copy of
`playwright.config.ts` on 3140 (deleted afterwards, never committed). The
pid-derived e2e Postgres port also collided — with a Windows ZOMBIE socket, not a
live process (`netstat` showed LISTENING on a pid `Get-Process` could not find),
which is exactly the failure mode the config's own comment warns about. Pin a
verified-free port in the copy rather than killing anything.

**13. Counting is where the transaction boundary starts to matter (review).**
`setNoAnswer` inherited the file's ordinary shape — `getLead` outside, the write
inside `db.$transaction` — which is harmless for a BOOLEAN (two racing presses
both write `true` and agree) and quietly wrong for a COUNTER (two racing presses
both read 2 and both write 3, so a try is lost). The tell is the assignment, not
the transaction: an absolute value computed from a read taken before the lock is
a lost update however tight the tx is. Re-reading INSIDE the transaction does not
fix it either — a plain `SELECT` takes no row lock under READ COMMITTED, so both
callers still compute 3. Only an atomic operator does: `{ increment: 1 }`
compiles to `SET "noAnswerCount" = "noAnswerCount" + 1`, and the second UPDATE
blocks on the row lock and then re-reads the committed value.

The second half of the trap is the undo entry. Its payload was copied from the
same pre-transaction snapshot, and `recordUndo`'s `fingerprint` is taken from the
row the write RETURNED — so the loser's entry carried a stale count with a
fingerprint that MATCHED. Nothing rejected it; the undo was accepted and rolled
the tally further back than the press it was undoing. A stale snapshot guarded by
a fresh fingerprint is worse than no guard, because it looks verified. The
counting path now derives the prior from `fresh.noAnswerCount - 1`; the clear
path, which writes an absolute 0 and so cannot derive anything, reads inside the
transaction.

Testing this needed a real race, not a sequential loop: the integration suite
runs against a real embedded Postgres, so `Promise.all` over N presses genuinely
overlaps. The undo assertion is a SET (`priors === [0,1,2,3]`) rather than a
sequence, because concurrent landing order is not deterministic while "every
press names the number it truly replaced" is.

**14. A card gains ~40px when it is flagged, not ~16px (review).** The obvious
arithmetic — a third inline button wraps the meta row, so +1 text line — is half
the answer. Measured in Chromium at the 218px six-column width, the same card
goes 195.4px → 235.5px when it carries a tally, because the `No answer · n` badge
ALSO wraps `.bcard-chips` onto a new line beside the owner chip, Call and
WhatsApp. Two wraps, not one. Anything sized off a card measurement has to be
re-measured after a change to EITHER row, and the measurement has to be taken
from a constructed worst-case card: the seed data's tallest card is 186.3px and
would have hidden this entirely.

The floor that constant feeds is not free to grow. `--bcard-h-max` went 204 → 220
(floor 429 → 461px) rather than to the 244 the flagged rich card would justify,
because 2*220+9+12 = 461 is the largest floor that still sits under 62vh on the
founder's 1440x760 monitor (471px) — past that the floor takes over from the
middle of the clamp and his board visibly changes height at his own zoom, which
the band's comment exists to prevent. When a measured constant and a documented
promise disagree, say which one you honoured and why, in the comment.

**15. A filter on a DROP TARGET needs a release (review).** ADR-061's Today chip
was safe on Following Up because a non-matching drop needs the rep to type a
non-today date. On Meeting Setting the drop form defaults to "not arranged", an
unarranged meeting stores no datetime at all, and the chip keeps only cards with
a today instant — so the default drop is invisible, every time. The same
component moved to a column with a different default turned a rare papercut into
the common case. `useTodayFilter` now takes a `landedHere` counter and releases
when it bumps; the boards own the counter because only they know a commit
succeeded. Defaulting it to 0 keeps every existing caller's behaviour, which is
what let it be applied to all three boards without re-proving each column.

## ADR-065 — the traps in shipping a notification you cannot test (2026-08-25)

### 1. "One central helper" was three write paths, and the third was the one that mattered
The plan said the push should hook into "the ONE central place that writes a
Notification". There wasn't one. `notifyAdmins` and `notifyUser` lived in
`services/notifications.ts`, but `addLeadComment` (`services/comments.ts:136`)
called `tx.notification.create` directly, inside its own transaction, for the
@mention loop. Hooking the helper alone would have shipped a feature where five
of six notification types buzz your phone and the sixth — the one a colleague
sends you ON PURPOSE to get your attention — silently does not.

The fix is small and worth copying: a private `writeNotification(client, input)`
that takes a `Prisma.TransactionClient` (which a full `PrismaClient` satisfies,
so `db` passes too), with `notifyAdmins`/`notifyUser` as thin public faces over
it, and `notifyUser`'s `type` union widened to include `mention`. **The lesson is
the audit, not the refactor:** before hooking "the central place", grep for the
model's `.create` across the whole tree, not just the module that names it.

    grep -rn "notification.create" src/

### 2. A fire-and-forget inside a transaction is unobservable — give it a handle
`schedulePush` deliberately does not await, because two of the three write paths
sit inside `db.$transaction` and holding a transaction open across a call to a
push service puts somebody else's outage on our connection pool. But a
fire-and-forget cannot be asserted: a test that calls `notifyAdmins()` and then
checks the fake sender races the delivery and passes or fails by luck.

The module keeps a `Set` of in-flight promises and exports
`pushDeliveriesSettled()`. Tests await it; a future graceful-shutdown hook can
too. Each promise already carries its own `.catch()`, so `Promise.all` over the
set can never reject and can never turn a delivery failure into an unhandled
rejection on a request thread.

### 3. `Uint8Array` is no longer a `BufferSource`
`pushManager.subscribe({ applicationServerKey })` takes a `BufferSource`, and
under the ES2024 lib types that means an `ArrayBufferView<ArrayBuffer>`
specifically. The canonical `urlBase64ToUint8Array` helper — the one in the
Next.js PWA guide, in every blog post, and in half the SW files on the web —
returns `Uint8Array<ArrayBufferLike>` and no longer type-checks:

    Type 'Uint8Array<ArrayBufferLike>' is not assignable to type
    'string | BufferSource | null | undefined'
      Types of property 'buffer' are incompatible.

Allocate the `ArrayBuffer` first, fill a view over it, and return the BUFFER
(`urlBase64ToBytes` in `PushToggle.tsx`). Same bytes, and it satisfies the type
without a cast — worth preferring over the `as unknown as BufferSource` that a
hurried fix reaches for, because the cast would also have hidden a real mistake.

### 4. Playwright pre-denies notifications, so "never asked" must be stated
A fresh Playwright `BrowserContext` reports `Notification.permission === "denied"`,
not `"default"`. The first UI-state test therefore rendered the BLOCKED state and
failed with `Expected: "off" / Received: "blocked"` — a correct component and a
harness artefact. `addInitScript` redefining `Notification.permission` (it is a
configurable static accessor) models each state of the world explicitly, which is
also how the blocked case and the iPhone-in-a-tab case are driven. Deriving these
from the harness's defaults would have been testing Playwright, not the app.

### 5. The keys must be read at runtime, and `NEXT_PUBLIC_` cannot be
Every guide — including Next.js's own PWA page — puts the VAPID public key in
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`. For this deployment that is silently wrong: the
container BUILDS the app and only then does the host inject environment
variables, so a `NEXT_PUBLIC_` value is inlined as the empty string for ever and
no restart can change it. The rule for this repo: **anything the founder sets on
the host after a build must be reached through a request, never a `NEXT_PUBLIC_`
name.** `GET /api/push/public-key` (`force-dynamic`, `no-store`) is that request,
and the service worker uses the same route when it has to re-subscribe itself.
A guard test would be nice; for now the secret sweep asserts that no
`NEXT_PUBLIC_*VAPID*` name exists anywhere in the tree.

### 6. Registering the service worker eagerly would have broken the inert path
The obvious shape — register `/sw.js` on mount, subscribe later — quietly
violates the one property that makes this safe to deploy: with no keys
configured the app must be EXACTLY what it was. An always-installed worker is a
permanent new failure surface for a feature nobody switched on, and it would
have made "no keys" observably different from "before this feature existed".
Registration therefore happens inside the click handler and nowhere else, and
the e2e proves the consequence rather than the intent:

    const regs = await navigator.serviceWorker.getRegistrations();
    expect(regs.map(r => r.scope)).toEqual([]);

### 7. Order of operations in the enable handler is an iOS requirement
`Notification.requestPermission()` must be the first statement after the click.
Registering the worker first and asking afterwards works on desktop Chrome and
fails on an iPhone, because iOS will not attribute the prompt to a user gesture
once an unrelated `await` has intervened. Nothing in CI can catch this — the
comment in `PushToggle.enable()` is the only guard, so it says why rather than
what.

### 8. `/sw.js` needs a cache header because of what sits IN FRONT of the origin
`updateViaCache: "none"` at registration handles the browser's HTTP cache.
Cloudflare is a separate problem: it caches by file extension unless the origin
says otherwise, and a stale service worker at an edge outlives the deploy that
fixed it — the worst shape of bug, because the fix deploys and nothing changes.
One `next.config.ts` `headers()` entry, scoped to `/sw.js` alone, sets
`no-cache, no-store, must-revalidate`. Scope it to the one path: a global header
block in that file would silently apply to every route in three apps.

### 9. The e2e suite shares one database, so a notification outlives its lead
`Notification.leadId` is a plain column with NO relation to `Lead`, so deleting a
lead leaves its notifications behind (this is pre-existing and deliberate —
history survives). A spec that manufactures notifications therefore has to mark
them read on the way out, or every later spec inherits a lit-up bell. Also:
`/api/byteforce/leads/[id]` has no DELETE (only the B-Systems namespace does), so
a ByteForce fixture lead is cleaned up by ARCHIVING it (ADR-043), which drops it
out of the boards, the counts and the To-Do — everything a later spec can see.

### 10. Proving a migration twice is not the same as proving it idempotent
`prisma migrate deploy` run twice proves almost nothing the second time: it reads
`_prisma_migrations`, sees the row, and skips the file. The case
`scripts/start.mjs` actually creates is a HALF-APPLIED migration replayed at
boot, so the proof has to execute the SQL FILE itself against the already-migrated
database — twice — and then check the data is still there. That is what caught
nothing this time and would have caught a bare `CREATE TABLE` or a bare
`ALTER TABLE ... ADD CONSTRAINT` (Postgres has no `IF NOT EXISTS` for the latter;
use a `pg_constraint` lookup inside a `DO $$ … $$` block).

## ADR-066 — the traps in narrowing a role you did not add (2026-08-26)

### 1. The column DEFAULT is the reason a non-admin must be refused FIRST
`canAccessAccounting` / `canAccessVault` default to `true` so no admin loses
anything at the migration. The consequence is easy to miss and expensive to get
wrong: **every row in `User` now says `true`**, including every sales rep, agent,
partner, data-entry account and ByteForce staffer. A guard that read the flag
before (or instead of) the role would have handed the entire company the books
the moment the migration ran — the feature would have been a privilege
escalation shipped as a restriction.

So the predicate checks `bsystems_admin` first and only then the flag, and the
test that protects the ORDER does not assert the status code (403 either way) —
it asserts the MESSAGE BODY: a non-admin must get "You do not have access to
this area" (the role wall), never "Your account does not have access to
Accounting" (the module wall). Reverse the two checks and only that assertion
goes red.

### 2. Forty walls, and the only honest audit is one that reads the folder
The scouting note said "FORTY route files … a missed route is a hole". Counting
them by hand once proves nothing about next month. The test therefore walks
`src/app/api/accounting` and `src/app/api/vault` with `readdirSync`, and for
every `route.ts` asserts (a) it calls the module guard and (b) it contains no
`requireBsAdmin` at all. The same sweep runs over `page.tsx`/`layout.tsx` in the
two route groups, skipping files that hold no page guard (the route-group
`<html>` shells never had one). A route or page added tomorrow cannot miss the
wall without turning this red.

Two details that make the sweep trustworthy rather than decorative:
- it asserts the ABSENCE of the old guard as well as the presence of the new
  one, so a route that calls both (a plausible half-finished edit) still fails;
- it asserts `files.length > 0` and a ≥ 40 floor, so a namespace that MOVES —
  and takes the scan's ground out from under it — fails instead of passing
  vacuously with zero files.

### 3. `requireBsAdminPage` had to stay, and stay unchanged
It is still the guard for `/b-systems/partners`, `/b-systems/partners-pipeline`
and their detail pages. The two module page guards WRAP it rather than replacing
its logic, which buys the ADR-051 bounce behaviour for free: a non-admin who
wanders into `/vault` is still sent to `/b-systems/crm` exactly as before, and
only somebody who IS an admin can ever reach the flag check. A blocked admin is
the only person who ever sees `/no-access`.

### 4. `/no-access` must live where no guard can reach it
Putting the refusal page anywhere inside `(accounting)` or `(vault)` would have
been an infinite redirect: the group layout guards run on every page in the
group, including the one you redirect to. Putting it under `/b-systems` would put
it behind the proxy matcher and the B-Systems shell (and give a blocked admin a
full app chrome around a "you cannot come in" message). It lives in `(home)`,
which owns its own `<html>`, is outside the proxy matcher, and holds only the
sign-in page — so nothing runs on it but its own `requireUser`. It reads no flag
and grants nothing; the decision was already made by the guard that redirected.

### 5. A required prop is the only durable way to hide a door
`EntitySwitch` used to take `roles: Role[]`. Adding `modules?: {...}` as an
optional prop would have compiled everywhere and silently kept showing the
segment at any call site that forgot it — and there are four (three shells plus
`AppNav`, which passes it through to two header shapes and a phone bar). Taking
the whole bearer as a REQUIRED prop turns every forgotten call site into a
compile error. `CurrentUser` already satisfies `ModuleAccessBearer`
structurally, so all four call sites became `user={user}`.

### 6. "Refuse a self-edit of the flags" would have broken a save the UI performs
The edit modal posts BOTH flags on every save of an admin, including your own
row, where they are locked at their current value — so `{canAccessAccounting:
true, canAccessVault: true}` arrives on a self-edit routinely. The no-self-lockout
rule therefore refuses `=== false` specifically, never "the field is present".
A test pins the no-op path passing, because the obvious stricter rule looks
safer and would have made your own row unsaveable.

### 7. The pinned admin's flags are deliberately NOT self-healed
`ensureAdminExists` re-asserts `active`, `registrationStatus`, the roles and the
password for `admin@byteforce.com` on every sign-in, and the seed re-asserts name
and password on every run. Neither touches the module flags, on purpose: if they
did, a block applied to that account on Monday would be silently undone by the
next deploy or the next sign-in, and "block some admins" would carry an unwritten
exception. The cost, stated plainly: if a second admin blocks the founder's own
account, the founder needs that second admin (or a database edit) to get it
back — he cannot do it himself, which is what the no-self-lockout rule is for.

### 8. Impersonation needed no code, which is exactly why it needed a test
`impersonate()` signs in AS the target, so `session.user.id` is the target's id
and `impersonatorId` is only a breadcrumb for the snap-back. Because
`requireUser` reads the row at `session.user.id`, the module flags follow the
impersonated account with no new logic at all. That is the correct behaviour and
it is invisible in the diff — so a future refactor of the session shape (say,
one that starts resolving the *impersonator* for auditing) could invert it
without a single line of this feature changing. Two tests pin both directions:
a full admin acting as a blocked one is refused; a blocked admin acting as a
full one is allowed.

## ADR-067 — the trap in applying a house rule without re-checking its premise (2026-08-29)

The merged shell put `CompanySwitch` in two places at once: in `ShellNav`'s
`extras` and in the page body. Both were reasoned; together they were a defect.
On a phone with the burger open, an account holding both companies got TWO live,
identically-named `role="group" aria-label="Switch company"` controls and two
`.company-switch-current` labels on one screen, with nothing hiding either.

It came from following a real house rule — "every control stays reachable from
the burger sheet" — past the condition that makes it true. That rule exists for
controls whose HEADER twin is hidden below 820px; `design-system.css` has the
matching `display:none` for each of the three (`.app-header .user > form`,
`> .switcher`, `> .switcher-entity`). The company switch has no header twin at
all: it lives in the page body, above `children`, on screen at every width. The
sheet copy therefore bought zero reachability and cost a duplicate. The rule was
right; its premise did not hold for this control.

Two things made it survivable-looking for a whole review cycle:
- **The e2e asserted the wrong shape.** It checked the sheet copy was
  `toBeVisible()`, which passes just as happily when there are two of them. A
  count is the assertion that can see a duplicate; "is visible" never can. Both
  specs now assert COUNTS (`toHaveCount(0)` in the sheet, `toHaveCount(1)` on
  the screen).
- **The specs that DID open the burger never checked for it**, and the specs that
  DID check the switch never opened the burger — the 320/390/601/820 loop only
  measured horizontal overflow. A defect that needs two conditions at once
  (narrow viewport AND sheet open AND both companies held) falls between specs
  that each hold one of them fixed.

The blast radius of removing it was measured rather than assumed: the next full
Playwright run came back 1 failed, naming `module-bar.spec.ts`'s sheet segment
count (7 → 5). That failure is the proof the sheet copy was really there.

## ADR-068 — the traps in changing a clock and in renaming a row (2026-08-29)

Two small-looking changes. One of them can corrupt stored data with a clean
typecheck; the other can make a test pass while proving nothing. Everything
below was met in practice, not imagined.

### 1. THE ONE-CHARACTER CATASTROPHE: `hour12` in the wrong half of the file
`src/lib/datetime.ts` is 75 lines and holds BOTH layers. `wallClockParts`
(storage) sits twenty lines above `formatCairo` (display), and both are "the
Cairo formatter" in anybody's head. A global "make it twelve-hour" edit hits
both.

`wallClockParts` reads `get("hour") % 24`. That `% 24` exists to normalise the
`"24"` that `hourCycle: h24` emits at midnight. Probed on this machine (Node
v22.14.0, ICU 76.1) for 2026-08-20 00:00 Cairo, `en-GB` emits:

| option | hour part |
|---|---|
| `hour12: false` | `"00"` ← what we need |
| `hourCycle: "h24"` | `"24"` ← corrected by `% 24` |
| `hour12: true` | `"12"` ← **`% 24` leaves it alone** |

So flipping that flag makes `cairoToUtc`'s iterative offset solver compute a
twelve-hour `diff` and converge on the wrong UTC instant for every
midnight-hour write. It typechecks. It shows up days later as follow-ups landing
on the wrong Cairo day. The mitigations shipped WITH the change: a comment at
the line saying why, and a round-trip test that asserts `utcToCairo(cairoToUtc(d,
t))` returns the same `"HH:mm"` for a spread including `"00:00"` and `"12:00"`.

### 2. A NEGATIVE ASSERTION THAT GETS WEAKER BY DOING NOTHING
`e2e/same-stage.spec.ts` proves a blank-time follow-up renders DATE-ONLY with
`expect(getByText(/8 Sept? 2026, \d{2}:\d{2}/)).toHaveCount(0)`. A twelve-hour
hour is ONE digit (`9:00 AM`), so after this change `\d{2}:\d{2}` stops matching
— and the assertion goes on passing whether or not a clock appears. Left alone
it would have quietly stopped testing the ADR-063 behaviour it exists for.
Widened to `\d{1,2}:\d{2}`.

This is the general shape worth remembering: when a rendering changes, the
assertions that PROVE ABSENCE are the dangerous ones, because they cannot fail
loudly. Every `toHaveCount(0)` / `not.toContainText` in the suite was re-read
against the new format, not just the positive ones.

### 3. THE 24-HOUR STRING IS DATA IN ~90 PLACES, DISPLAY IN ABOUT SIX
A repo-wide find/replace over `\d\d:\d\d` would have been a disaster. The WIRE
shape — `"HH:mm"` — is what `<input type="time">` submits, what
`services/groups.ts`'s `/^\d{2}:\d{2}$/` accepts, and what `cairoToUtc` parses
with `split(":")`. It appears in every `cairoToUtc(date, time)` argument, every
`utcToCairo` expectation, every `{ date, time }` API payload and every `.fill()`
in the e2e suite. None of it moved.

Two of those expectations are a specific trap: `groups.test.ts` and
`follow-up-time.integration.test.ts` assert that a posted `00:30` on Egypt's
spring-forward day is STORED as `01:30`. That is `followUpDueAt` nudging a
wall-clock that does not exist — the value is the stored one, not a rendering,
and reformatting it to `"1:30 AM"` would have been a category error that also
erased what the test was about.

### 4. THE BIDI PROBLEM ARABIC CREATES, AND WHY CSS COULD NOT FIX IT
The cheap version of this change is "keep the English date, swap AM/PM for
ص/م". It renders wrong. `"20 Aug 2026, 6:30 م"` in an RTL paragraph is one LTR
run plus a trailing RTL character; the bidi algorithm places the lone Arabic
character to the LEFT of the whole latin run, so the screen reads
`م 20 Aug 2026, 6:30` — the marker torn off the time and parked against the
date.

The repo has the usual remedy, `.u-ltr { direction: ltr; unicode-bidi: isolate }`
(`src/themes/design-system.css`), and four vault cells already use it. It does
not help here: `formatCairo`'s output is routinely concatenated into a longer
string BEFORE it reaches the DOM — `` `${t(board.nextPrefix)} ${formatCairo(…)}` ``,
`t(pPipeline.meetingAt).replace("{dt}", …)` — so there is no element to wrap
around just the datetime. Rendering Arabic natively (`ar-EG-u-nu-latn`) removes
the mixed run instead of styling around it, and needs no isolate anywhere.

Consequence to know: this also changed Arabic DATES (Arabic month names, U+060C
comma). `formatCairoDate` had to follow `formatCairo`, or the To-Do heading
would say `29 Aug 2026` directly above a row saying `29 أغسطس 2026، 4:45 م`. A
half-Arabic date system is worse than either consistent one. Flagged for founder
confirmation rather than presented as a bug fix.

### 5. ICU EMITS A DIFFERENT SPACE DEPENDING ON ITS VERSION
ICU ≥ 72 uses U+202F (NARROW NO-BREAK SPACE) before the day period in several
locale/version pairs; this machine's ICU 76.1 uses a plain U+0020 for `en-GB`.
Taking the string from `.format()` would make the whole suite hostage to the
Node base image. The output is assembled from `formatToParts` with the
pre-day-period literal normalised to `" "`, and a unit test asserts the
CODEPOINT — so an ICU bump fails one obvious assertion with a clear message
instead of scattering "expected 2:30 PM, got 2:30 PM" mysteries across
Playwright.

The same helper upper-cases the English marker: `en-GB` emits `"pm"`. Switching
to `en-US` to get `"PM"` was rejected — it reorders the date to `"Aug 8, 2026"`
and would have broken every date assertion in the suite.

### 6. A FORMATTED TIME THAT IS STORED, PUSHED, AND CANNOT BE FIXED RETROACTIVELY
`services/leads.ts` builds the meeting-request notification body by
concatenating the raw form values. That body is PERSISTED on the `Notification`
row and copied verbatim into the web-push payload, and it never passes through
`tFor` — it is a stored English sentence. It is now formatted from the INSTANT
(`formatCairo(cairoToUtc(date, time), "en")`), never by munging the string, so
`cairoToUtc`'s DST correctness is preserved.

Rows written before today keep their 24-hour text forever, so the bell will show
both shapes side by side while old notifications live. That is correct: the body
records what was SENT. A migration that rewrote it would be rewriting history —
do not.

### 7. THE ELEVEN `<input type="time">` FIELDS CANNOT BE MADE TO AGREE
They render per the viewer's OS/browser locale (the document's `lang="ar"` does
not control them) and always submit `"HH:mm"`. So a founder on a 24-hour device
types into a 24-hour picker and reads a twelve-hour result. Hand-rolling a
picker to "fix" that would break native mobile pickers, keyboard entry, autofill
and screen readers, and would put a second time parser next to the wire regex.
Accepted; written down so it is not re-discovered as a bug.

### 8. ONE COMPONENT WITH TWO CLOCKS, FOUND ONLY BY SWEEPING FOR IT
`LeadChat` built its own `Intl.DateTimeFormat` and never set `hour12` — so it
printed 24-hour in English (`en-GB` defaults to h23) and 12-hour in Arabic (`ar`
defaults to h12), and had done for months. Nothing could have noticed: there is
no test that compares two components' idea of a clock.

The fix is the shared `formatCairoShort`; the DEFENCE is
`src/lib/datetime.sweep.test.ts`, which walks `src/app` and `src/components` and
fails any file that renders a time. It was mutation-checked by dropping a
two-line offender into `src/components/shared/` and watching it name the file —
which turned out to prove less than it looked like proving. See trap 14.

### 14. A SWEEP BUILT AS A BLOCKLIST ONLY CATCHES THE SPELLINGS YOU THOUGHT OF
The first version of that sweep was one boolean AND: "builds
`Intl.DateTimeFormat` / `toLocaleTimeString` / `toLocaleString(`" AND "asks for
`hour` / `hour12` / `hourCycle`". Both halves leak, and review found three
clocks that walked straight through — each confirmed by adding a probe component
and watching the suite stay GREEN:

- **`toLocaleDateString(locale, { hour: "numeric" })`.** `toLocaleString(` is
  not a substring of `toLocaleDateString(`, so the FORMATTER half never fired.
  The single mutation probe used above happened to use `Intl.DateTimeFormat`, so
  it confirmed the one path that worked. One probe is not a mutation test.
  `toLocaleDateString` does honour `hour`/`minute`, and it is the API this
  codebase already uses at `b-systems/(app)/page.tsx` — the hole was over the
  live case.
- **`{ dateStyle: "medium", timeStyle: "short" }`.** Renders `20 Aug 2026,
  14:30` — byte-identical to the 24-hour string the whole rule exists to keep
  out — while naming none of the three option names the OPTION half looked for.
- **`new Date(x).toLocaleString("en-GB")`.** A clock with no options object at
  all, so no option-name rule can ever see it.

The lesson is structural, not about these three spellings: a rule that enumerates
BAD forms is only as good as the author's imagination, and the next Intl API is
not in it. The fix pairs the (widened) pattern rule with an INVENTORY — the
complete set of files under the swept roots touching ANY date/time locale API
must equal a short allowlist, each entry carrying a written reason. That flips
the default from "allowed unless I predicted it" to "denied until somebody
writes down why", which is the only version that survives an unknown API.

Two second-order notes worth keeping:
- The inventory has to disambiguate `toLocaleString` on a **Number** from
  `toLocaleString` on a **Date** — same method name, and the codebase has two
  money/counter sites. Guessing at the receiver textually is fragile; naming the
  two files in the allowlist and separately asserting they contain no `Date` at
  all is not.
- Writing the exceptions down surfaced one the ADR had been carrying in prose:
  the dashboard's bare-`ar-EG` weekday heading, which departs from the house
  `-u-nu-latn` latin-digit convention. It is now named in a test rather than
  remembered by a document.

### 9. THE REQUIRED LOCALE IS WHAT MADE THE CHANGE FINISHABLE
Adding `locale` with a default of `"en"` would have compiled everywhere and
silently printed English markers inside Arabic pages on 23 of 24 screens. Making
it REQUIRED turned the job into 48 compiler errors — including five sites that
passed `withTime` positionally, where `boolean` stopped being assignable to
`Locale` and pointed straight at the argument that had shifted. Third time this
rule has paid (ADR-066's `user` prop, ADR-067's `brand` positional).

### 10. THE TO-DO SPLIT HAD TO BE A LABEL, NOT A SECOND STATE
`negotiation_response` maps onto the SAME `{ followUpId }` unique key and runs
through the SAME validation branch as a plain follow-up. Two consequences that
had to be arranged deliberately:

- The projection keys its manual-mark lookup by `${kind}:${recordId}`. Left
  alone, a row ticked as a "follow-up" would have come back UNCHECKED the moment
  it started calling itself a negotiation response. The key is normalised
  (`negotiation_response` → `follow_up`) before the lookup, so the mark and the
  liveKeys set both stay on the record's identity rather than its label.
- A client posting the old kind for one of these records must tick the same row.
  A test pins it, because an app shell in a phone's cache is exactly the client
  that will do this.

### 11. READING THE STAGE INSTEAD OF THE CONTEXT WOULD HAVE LOOKED RIGHT
The obvious discriminator is `lead.stage === "negotiation"`. It passes the
happy-path test. It is wrong for the Done section: a response date is answered
and the deal moves to Won or Lost the SAME afternoon, at which point the Done row
would rename itself "Follow-up" and misreport what the person actually did today.
The record's stored `context` does not move, so it is the discriminator. Both
emission sites (live and Done) read it, and each was mutation-checked ALONE —
reverting only the Done site turns exactly one test red, which is the proof that
the second site is really covered and not shadowed by the first.

### 12. TWO PLAYWRIGHT PATTERNS THIS CHANGE RE-LEARNED
- `.check()` on a To-Do checkbox times out. The control POSTs and then
  `router.refresh()`es, so the row is replaced and the checked state arrives with
  the new DOM; `.check()` waits for the original element to report checked.
  `.click()` is the house pattern for this reason.
- A lead that has been through Negotiation has TWO rows in Done — the superseded
  original follow-up AND the response date — so `getByRole("listitem").filter({
  hasText: leadName })` is a strict-mode violation. Scoping by the row's own
  restore checkbox is both correct and a better assertion: it proves the two
  kinds are told apart on the same lead.
- The locale toggle is a server action; navigating on its heels is a race, not a
  behaviour. Arabic assertions go LAST in a spec, or wait on `html[dir]`.

### 13. A GUARD TEST FROM THE PREVIOUS COMMIT COULD NOT FAIL
Not this change, but found by it: `src/lib/crm/page-company-guards.test.ts`
carried four literal BACKSPACE characters (0x08) where it meant `\b`, so its
filter `/\brequireCompanyPage\b/` matched nothing and the whole "a shared page
still narrows its roles" check skipped every file. It read green because it never
ran. Fixed and mutation-checked (breaking a page's `narrowRoles` now turns it
red).

Worth knowing WHY it happened, because it can happen again: a tool layer between
the agent and the shell collapses `\\` to `\` inside heredocs, and Python then
interprets `\b` as a backspace escape. `grep -P '[\x00-\x1f]'` did not find it;
reading the file in Python and checking `ord(c) < 32` did. If a regex in a test
"just doesn't match anything", check the bytes before checking the logic.

## ADR-069 — the WhatsApp mark: the traps

### 1. THE OBVIOUS IMPLEMENTATION IS `localStorage`, AND IT IS THE ONE THING HE RULED OUT
"Turn the button green after I click it" is a two-line change with a browser
flag. The sentence immediately after it — *"it signals not just for my user, for
any user"* — makes that answer wrong: it would tell his team nothing and would
vanish when he opened the CRM on his phone. Read the whole request before
sizing it.

### 2. `preventDefault` IS THE TRAP, AND IT IS THE EASY THING TO WRITE
The natural shape for "do something when a link is clicked, then follow the
link" is: intercept, `await` the POST, then `window.open`. It is wrong three
ways here. Popup blockers kill a `window.open` that is not in the direct
gesture; awaiting puts the network in front of the founder's most-used control;
and a rejected promise surfaces as an error on a press whose only job was to
open WhatsApp. The chip never calls `preventDefault` at all — the anchor
navigates natively — and the mark is fired beside it.

### 3. A PLAIN `fetch` IS ENTITLED TO BE ABANDONED HERE
This press hands focus to a new tab immediately, which is exactly the lifecycle
event that lets a browser drop in-flight fetches. `navigator.sendBeacon` hands
the request to the BROWSER, which delivers it independently of the page — that
is the whole reason the API exists. `fetch(…, { keepalive: true })` is the
fallback with the same guarantee, and it is a real fallback rather than
decoration: `sendBeacon` returns `false` (not throws) when its queue is full.

### 4. sendBeacon SENDS NO BODY, SO THE ENDPOINT MUST NOT PARSE ONE
`navigator.sendBeacon(url)` posts with a null body and no `Content-Type`. A
route that opened with `z.object({...}).parse(await req.json())` — the house
shape for every other POST here — would 400 every single press, and the
`handleRoute` wrapper would turn it into a clean JSON error nobody ever sees,
because nothing awaits the response. The three routes deliberately have no Zod
schema and read nothing but the URL param and the session. That is also what
makes decision F trivially true: there is no body for a client to lie in.

### 5. `router.refresh()` AFTER THE PRESS IS A RACE, NOT A REFINEMENT
The board's other controls (`no-answer`, `ready`) `await` their POST and then
refresh. Copying that here breaks both halves of the request: the await blocks
the link, and the refresh can return a render taken BEFORE the mark committed,
which repaints the chip grey a second after it went green. The chip keeps a
STICKY optimistic flag instead — once true it never goes back to false — and no
refresh is fired at all. The e2e reflects this honestly: it asserts the instant
green with no reload, then reloads *in a `toPass` block* for the server truth.

### 6. A CLIENT MODULE CANNOT EXPORT A FUNCTION FOR A SERVER COMPONENT TO CALL
The first cut put `waSentLabel()` beside the chip in `WhatsappChip.tsx`. Every
surface except the three boards is a server component, and a plain function
imported from a `"use client"` module arrives on the server as a client
reference, not a function. The label builder lives in its own non-client module
(`components/shared/whatsappMark.ts`), which both sides may import.

### 7. THE DATE MUST BE FORMATTED SERVER-SIDE OR ADR-068's SWEEP CATCHES IT
`src/lib/datetime.ts` is the only legal home for a rendered clock, enforced by a
directory sweep over `src/app` and `src/components`. A chip that formatted its
own "3 Sep 2026" on the client would be the next `LeadChat`. The whole sentence
is built on the server through `formatCairoDate` and crosses the boundary as a
finished string; the client component receives no `Date` and no locale.

### 8. GREEN COULD NOT BE BORROWED FROM ACCOUNTING, EVEN THOUGH THE VALUE IS THE SAME
`--color-acct-positive` is fenced BY NAME: `brand-tokens.test.ts` asserts the
`--color-acct-*` set is EXACTLY two entries, and the ADR-054 addendum records
which classes may spend them. Reusing them for a CRM chip would have compiled,
looked right, and silently retired a rule that is still doing work. A new pair
with the same values keeps the product to one green while keeping two
independently-revocable fences. The new pair has its own three-scope test AND a
"spent by `.wa-sent` and nothing else" test; both were mutation-checked (delete
the neutral token → red; add a second consumer → red).

### 9. CSS SPECIFICITY DECIDED WHERE THE RULE COULD GO
`.wa-sent` rides on top of three different base classes, and each has a hover
rule at the same specificity (one class + one pseudo-class): `.btn-ghost:hover`,
`.call-cta--wa:hover`, `.card-dial:hover`. So `.wa-sent` and `.wa-sent:hover`
are declared AFTER all three in `design-system.css` — source order is the only
thing separating them. Placed earlier, the chip would have gone grey on hover on
two of the three surfaces, which is the kind of bug nobody screenshots.

### 10. THE SEEDED LEADS HAVE NO WHATSAPP LINK AT ALL
Every seeded number is `0221000001`-shaped — a Cairo landline — and `waDigits`
returns null for any 0-leading number that is not an Egyptian mobile, on purpose
(a landline has no WhatsApp and a foreign trunk prefix is unguessable). So the
chip does not render on ANY seeded card, and an e2e that reaches for it on demo
data finds nothing. Every WhatsApp spec has to create its own lead with a real
mobile number, which the existing `call-sheet` and `partners-agents` specs
already did.

### 11. `DELETE` DOES NOT EXIST FOR A BYTEFORCE LEAD
`/api/byteforce/leads/[id]` carries only `PATCH`. A spec that creates a ByteForce
lead cannot tidy up after itself; `byteforce-board.spec.ts`'s "Parity Deal" set
that precedent and `whatsapp-sent.spec.ts` follows it, which is safe only
because the suite is serial and this file sorts near the end. The B-Systems half
of the spec deletes its lead — through the ADMIN's context, because deleting a
lead is admin-only and the lead was created by sales.

### 12. THE PROSPECT'S WALL IS NARROWER THAN ITS CREATE PERMISSION
`requireProspectCreator` (admin + data entry) is the guard on creating a
partner/agent card, and reaching for it here would have been the natural
symmetry. It is wrong: ADR-051 gives data entry two Add buttons and no screen
that displays a card, so admitting it to the mark would let it write to records
it cannot see. Every surface that shows a prospect sits behind
`requireBsAdminCompanyPage`, so `requireBsAdmin` is the honest match — the wall
is the READ wall, not the write wall of a neighbouring action.

### 13. TWO SURFACES REACH THE RECORD INDIRECTLY, AND ONE OF THEM HAS A HOLE
The partner DIRECTORY shows `Partner.number`, not a prospect; `Partner.prospectId`
is required and unique, so there is exactly one card behind every directory row
and the two screens read and write the same mark. The AGENTS LIST shows
`User.phone` and reaches the card through `User.agentProspect` — which does not
exist for an agent who came through the public signup form, because `signupRep`
creates a `User` + `PortalRep` and no card at all. Those chips are plain links
with `markUrl = null`. That is a real gap, flagged rather than papered over: the
alternative is a third record kind carrying the same three columns.

### 14. `updateMany` STAMPS `updatedAt`, AND TWO THINGS IN THIS REPO RIDE ON THAT COLUMN
Prisma applies `@updatedAt` **client-side**, so ANY Prisma write — `update`,
`updateMany`, however narrow the `data` — bumps `updatedAt`. The first cut of the
mark used `updateMany`, and the review found what that costs on a record whose
pipeline state the press never touched:

- **undo's integrity FINGERPRINT is `updatedAt`** (`undo.ts`: `lead.updatedAt
  .toISOString() !== entry.fingerprint` → 409). Flag a lead "didn't answer", then
  press WhatsApp on the same card, and the pending Undo pill 409s — for ever.
  `performUndo` consumes the entry INSIDE the transaction that then throws, so the
  rollback leaves it unconsumed and the pill keeps offering the same dead action
  on every press until the ten-minute window runs out.
- **the boards order by `updatedAt desc`** (`bsystems-admin.ts`, `partners/pages`,
  `internal/pages`), so the first press silently re-sorted the card to the top of
  its column — a message we sent, reordering his board.

The fix is `$executeRaw` with the same conditional WHERE, which is exactly why
`normaliseProspectStages` in `backup.ts` is raw; that comment states the hazard in
this repo's own words and was written before this feature existed. Read it before
writing any "small side-effect column".

`invalidateUndo(tx, actor)` — the house answer for a NON-undoable mutation
(`leads.ts:452`, `milestones`, `statements`, the vault) — is deliberately **not**
what this uses. That rule exists so the button never offers an inverse that
cannot apply; with `updatedAt` untouched the inverse still applies perfectly, the
pill names the action it will revert, and undoing it leaves the mark standing
(no `undoLead` branch writes the WhatsApp columns). Calling it would have thrown
away a working Undo as the price of opening WhatsApp. Two integration cases pin
both halves — `updatedAt` unchanged on lead and prospect, and a real
`performUndo` applying after a press.

### 15. THE OPTIMISTIC GREEN BELONGS TO THE RECORD, NOT TO THE ELEMENT
One screen can print the chip more than once for the SAME record: the prospect
detail has the header chip and another after every number the card carries, all
with the same `markUrl`. With `useState` inside the chip, pressing one left its
siblings plain until the next server render — "green in one place and plain in
another", the exact confusion the one-component decision (§6) exists to remove,
reappearing INSIDE one component. The pressed set therefore lives in the module,
keyed by `markUrl`, and every chip subscribes with `useSyncExternalStore` (with a
`getServerSnapshot` of `false`, or the server render throws). An e2e presses the
header chip and asserts the inline chip goes green with no reload.

### 16. A STATE SENTENCE THAT *REPLACES* THE ACCESSIBLE NAME COSTS THE CONTROL ITS VERB
`aria-label={sentLabel ?? restLabel}` reads fine on eight of the nine surfaces,
where `restLabel` is the bare word "WhatsApp" and the sentence already opens with
it. On the CALL SHEET `restLabel` is *"Message on WhatsApp — 01001234567"* — the
only place the action and the number are spoken — so marking the lead silently
demoted the button to a state sentence: a screen-reader user could no longer tell
what it does or who it messages. ADR-069 §5's byte-identity guarantee covered
only the UNMARKED chip, so nothing caught it. That surface now COMPOSES the two
(`restLabel — sentLabel`) instead of swapping them, and prints the sentence in
visible words under the button as well, because `title` is a hover tooltip and
the call sheet is the one screen built for a phone, where hover does not exist.

## ADR-070 — the Links section: the traps

### 1. THE REQUEST SAYS "DELETE" AND THE MODULE SAYS "NEVER"
The literal word in the request is `Delete`. The module's law since ADR-053 is
that nothing in the Vault is hard deleted, and — the detail that settles it —
**Archive is one of the sections he lists in the same paragraph**. Building a
real `delete()` would have made the Links table the only one in the module that
can lose data, and building Archive silently under his word would have been us
changing the request without telling him. The rule followed: **implement the
module's law, then SAY SO in three places** (the ADR, the CHANGELOG in his own
words, and PROGRESS as *Needs founder confirmation*). Neither half is optional —
a silent substitution and a silent hard delete are both failures.

### 2. `mode: "insensitive"` IS `ILIKE`, AND A CATEGORY IS USER TEXT — ON BOTH PATHS
The obvious way to fold "portfolio" onto "Portfolio" is
`where: { category: { equals: value, mode: "insensitive" } }`. On PostgreSQL that
compiles to `ILIKE`, where `%` and `_` are WILDCARDS. A founder who types
`Q4_2026` as a category would then match `Q4x2026` and silently adopt an
unrelated spelling — on the WRITE path, deciding what gets stored for ever. The
fold is done in JS instead (`toLocaleLowerCase` after collapsing whitespace) over
the category column.

**This note first went on to accept the ILIKE on the read-only FILTER, "where the
worst case is a filter matching one row too many". That was wrong, and it was
wrong because it was reasoned rather than measured.** Run against a real cluster
with query logging on, Prisma emits `WHERE "category" ILIKE $1` for
`equals` + `mode: "insensitive"`, and the observed behaviour is:

```
equals+insensitive "Q4_2026"  -> Q4_2026, Q4x2026      (the _ is a wildcard)
equals+insensitive "%"        -> every row in the table (all four of four)
```

`%` is not bounded to one row — it is the whole vault, returned under a filter
box claiming to hold one category. The filter value is now escaped to a literal
before it goes in (`\` first, then `%` and `_`; backslash is Postgres's default
LIKE escape character), which leaves the case-insensitivity intact:
`"q4_2026"` still finds `Q4_2026` and nothing else. **The lesson worth keeping is
the method, not the fix: when a note says "the worst case is X", check X against
the database before writing it down.**

The `q` SEARCH box still uses `contains` + insensitive unescaped, deliberately:
a substring search is a search, a `%` in it widens a result set the user is
already scanning by eye, and every other vault search in the module behaves the
same way. An EXACT-match filter is the one that must match exactly.

### 3. THE ARCHIVED/LIVE SPLIT IN THE CATEGORY LIST IS DELIBERATE AND ASYMMETRIC
`listVaultLinkCategories()` (the filter and the datalist) reads **live** rows —
archiving the last link in a category should retire the category. `canonicalise()`
reads **every** row including archived ones — restoring an old link months later
must not resurrect a second spelling of a word already on the list. Getting this
backwards produces one of two bugs, and both are the near-duplicate problem the
folding exists to prevent.

### 4. RE-POSTING A PARSED OBJECT 400s ON ITS OWN `optional()`
`optionalText()` transforms an absent `notes` into `null`. The first cut of the
integration test built its request bodies from `vaultLinkSchema.parse(...)`
output and posted them at the route, which 400d: `null` is not `undefined`, so
`.optional()` rejects the very value the schema had just produced. The test now
keeps a `raw()` helper for what a BROWSER posts and a `link()` helper for what
the SERVICE takes, with a comment saying why. Worth knowing before writing the
next route test in this repo.

### 5. A FIELD HINT CONTAINING A COMMON WORD BREAKS `getByLabel`
The Category field's hint reads *"Pick a suggestion or type your own"*. Playwright
computes a field's accessible name from the whole `<label>`, hint included, and
`getByLabel` matches by SUBSTRING — so `getByLabel("Type")` resolved to two
elements (the Type select and the Category input) and the spec died in strict
mode. Fixed in the spec with a role query anchored to the start of the name
(`getByRole("combobox", { name: /^Type/ })`), not by contorting the copy. The
same trap is waiting in any vault modal whose hint happens to contain another
field's label.

### 6. AN `aria-label` REPLACES THE VISIBLE TEXT — AND THAT IS AN A11Y BUG, NOT A QUERY NUISANCE
Every Open link carries an `aria-label` so fifty identical "Open link" anchors are
distinguishable to a screen reader. The first version read
`"Open {name} in a new tab"`, which meant `getByRole("link", { name: "فتح الرابط" })`
— the VISIBLE words — found nothing: the accessible name is the sentence, not the
label. **This note first recorded that as a Playwright problem and worked around
it in the spec. It is a WCAG 2.5.3 (Label in Name, Level A) failure**: when the
accessible name does not contain the visible label, a speech-input user saying
"click Open link" activates nothing, and the test query failing is simply the
first honest symptom of that. The name now begins with the visible words —
`"Open link — {name} (new tab)"` / `"فتح الرابط — {name} (تبويب جديد)"` — so voice
reaches it and it still says which of fifty links it opens. **The rule: if a role
query cannot find an element by the words on it, fix the element before fixing
the query.**

### 7. THE DIRECTORY SWEEPS COVERED THE NEW ROUTES BEFORE THEY WERE WRITTEN
ADR-066's `module-access.integration.test.ts` walks `src/app/api/vault/**` and
fails any `route.ts` that does not call `requireVault()`, and walks
`src/app/(vault)/**` for `requireVaultPage`. Three new routes and one new page
arrived already covered — this is what that test was for, and it is why adding a
section to a walled module needs no new wall. The direct proof (a blocked admin
calling all three routes) was still written, because a sweep proves the guard is
CALLED and only a call proves it REFUSES.

### 8. `data.links` DID NOT EXIST YET WHEN THE OVERVIEW WAS SPLIT ACROSS TWO COMMITS
The service half (commit 1) adds `links` to `VaultOverview`; the page half
(commit 2) spends it. Splitting a typed projection across two commits is safe
only in that order — the field is added before it is read, so commit 1
type-checks alone and commit 2 type-checks alone. The reverse order would have
left an intermediate commit red.


### 9. A FOLD RUN UNCHANGED ON THE UPDATE PATH FOLDS A ROW ONTO ITSELF
`canonicalise()` adopts "the spelling already on file". On a CREATE that is
somebody else's row. On an UPDATE the row being edited is *itself* on file, so
re-spelling its own category — `investor deck q4` → `Investor Deck Q4` — matched
its own old spelling and wrote that back. The PATCH answered 200, the modal
closed, and the row read exactly what he had just corrected. **Nothing in the UI
was wrong; the bug was entirely that the scan included the subject of the edit.**
Two things make it permanent rather than annoying: the scan counts archived rows
(deliberately — trap 3), and ADR-053 forbids hard deletes, so once a fold key
exists its first spelling can never leave the table.

The fix has two halves and both are needed. `exceptId` removes the row from its
own scan, which frees a single-row category. For a category spread over several
rows the sibling's old spelling would still win, so a deliberate re-spelling
(same fold key, different spelling, not one of our own eight) renames the WHOLE
group in the same transaction, archived rows included. **Any normalise-on-write
helper in this codebase should be read with the same question: what does it do
when the value it is comparing against is the row being written?**

### 10. A BILINGUAL SUGGESTION LIST IS A NEAR-DUPLICATE GENERATOR
The eight category suggestions are `Msg` pairs (`{ en, ar }`), and the picker
offers whichever half matches the reader's language. The fold compared raw
strings, so `fold("Portfolio") !== fold("بورتفوليو")` and the two halves of one
pair never met: with the English one on file, picking the Arabic one opened a
second category holding half his links. The language toggle is on the same page,
so it took one click. **The folding was built to stop near-duplicates and our own
vocabulary was manufacturing them** — free text was never the risk here, the
translated list was.

Resolve to the PAIR before comparing: if the typed value is one of the eight in
either language, adopt whichever half is already stored. The same fold is applied
to the datalist, or eight concepts are offered as nine options with two of them
the same category. **Anywhere a bilingual `Msg` list can be STORED rather than
merely displayed, the pair is the identity and the string is not.**

### 11. A `<select>` WITH A `defaultValue` THAT IS NOT AN OPTION SILENTLY READS "ALL"
The category filter's options come from live rows; its `defaultValue` comes from
the query string. Archive the last link in a category and `router.refresh()`
re-renders the SAME url: the query still filters, the option is gone, and the
browser quietly selects the first option. The page then reads **Category: All**
above *"No links match these filters."* — two statements that cannot both be
true, and no error anywhere. **A browser does not report an unmatched
`defaultValue`; it just picks index 0.** Any select whose options are data and
whose value is a URL parameter needs the applied value rendered as an option of
its own.

### 12. A BACKUP RESTORE IS A WRITE PATH THAT SKIPS EVERY ZOD SCHEMA — MODULE-WIDE
`importVault()` and `importBackup()` validate the *envelope* (app name, version)
and then `createMany` the payload's rows straight into each table. **No column
validator runs.** So every invariant this codebase enforces in Zod — the
http/https URL rule, the closed `type` lists, the link-XOR-file rule on
`VaultSheet` — is true of the REST doors and not of a restore. `VaultLink` did
not introduce this; it inherited it the moment it joined `VAULT_MODELS` and
`MODELS`.

Two things follow, and only the first was done here. **At the point of USE, do
not trust the column**: the Links page renders an anchor only for an address that
really parses as `http:`/`https:`, so the page whose whole purpose is clicking
cannot be turned into a delivery mechanism by an edited export file. React would
also refuse to navigate a `javascript:` href, but a framework's sanitiser is not
where a product rule should live. **At the point of IMPORT, nothing was changed**:
re-validating URL columns on restore is a sensible defence, but it is a decision
about what a backup file *is* — strictly a snapshot of rows, or a document that
must re-earn its way in — and it would change the behaviour of restores for
three models at once. That belongs in its own ADR, not in a section commit.

The general shape is worth carrying: **wherever a table can be written by a bulk
path, the render is the last wall, and it has to behave like one.**

## ADR-071 — the calendar: the traps

### 1. A PULL THAT CARRIES MIGRATIONS MAKES THE TYPECHECKER LIE
The session opened by pulling 20 commits. The first `npx tsc --noEmit` printed a
page of errors in files nobody had touched — `whatsappSentAt` missing from a
dozen component prop types, `implicitly has an 'any' type` across two vault
pages. Every one was a phantom: the pulled migrations had never been applied and
the **generated Prisma client was still the pre-pull one**, so the types the
components were checked against did not have the columns the code now reads.
`prisma generate` cleared all of them at once.

This matters because the failure is indistinguishable from a real breakage, and
the obvious reflex — open the named files and start "fixing" them — corrupts
eight healthy files before anyone notices. **After a pull that touches
`prisma/`, run `prisma generate` before believing a single type error.** The tell
is that the errors name a column the migration you just pulled added.

### 2. `.next` OUTLIVES A DELETED ROUTE GROUP, AND `next build` TYPE-CHECKS ITS OWN CACHE
`tsc` and `next build` both reported `Cannot find module
'../../src/app/(byteforce)/…/page.js'` — for a route group ADR-067's merge
deleted. The errors are in `.next/types/validator.ts` and `.next/dev/types/…`,
files Next GENERATES by walking the route directory, and they had been generated
before the merge. They fail the build's type-check step even though the source
compiles, so the build reads as broken when nothing is.

Deleting `.next/dev` and `.next/types` regenerates both. Worth knowing that
**`next build` type-checks generated files that can be stale from a previous
tree shape**, so a route-group rename or deletion needs the cache cleared before
the next build is believed.

### 3. NEVER RUN `next build` WHILE PLAYWRIGHT IS RUNNING
The e2e config's `webServer` is `npm run build && npx next start -p 3100` — it
builds into the **same `.next`** the developer builds into. Running a production
build (or, worse, deleting `.next/types`) while a Playwright run is in flight
gives a run that reports `1 passed, 2 skipped, 14 did not run` with **exit code
0** — no error, no failed assertion, just a mostly-empty result that reads like
a pass at a glance. The first full run of this feature was thrown away for
exactly this and re-run clean.

And its sequel: **a killed Playwright run leaks its server.** `TaskStop` on the
test process does not stop the `next start -p 3100` child, so the next run dies
on `http://localhost:3100 is already used` — again with **exit code 0**. Find it
with `netstat -ano | grep :3100` and `taskkill //PID <pid> //F`.

Two lessons, both about the same thing: **in this repo an e2e "pass" must be
read from the counts, never from the exit code.**

### 4. A `useState` INITIALISER DOES NOT RE-RUN WHEN A SERVER COMPONENT RE-RENDERS
The month is a URL parameter, so paging months is a server navigation — but it
renders the *same* client component, so React keeps its state and
`useState(props.initialSelected)` is never re-applied. The grid would redraw as
September while the day panel below it stayed on an August date, reading
"Nothing on this day".

Fixed with React's documented adjust-state-during-render pattern (compare a
`monthKey` prop against state, reset during render, which re-renders before
paint so nothing wrong is ever shown) rather than a `key` on the component: a
key remounts, which would also throw away the person filter — and "show me Y's
month, then the next one" is precisely what somebody checking availability does.

**The general shape: any client state derived from a prop that a server
navigation can change needs an explicit reset.** There is no warning for this;
it renders perfectly and is simply wrong.

### 5. A MONTH GRID'S FIRST CELL IS USUALLY NOT IN THAT MONTH
`monthGrid` pads out to whole weeks, so `grid.from` — the instant the query
window opens — is the first *cell*, not the first of the month. August 2026
opens on a Saturday, so its Sunday-first grid starts on **26 July**, and
formatting `grid.from` printed **"July 2026"** as the title of an August
calendar. Caught by re-reading, not by a test: the month-navigation e2e compared
labels *changing*, which they did, correctly, while both were wrong.

The window and the label are two different questions and must be answered from
two different instants. Pinned now by an e2e case naming two months whose grids
start in the previous one.

### 6. A "BUSY" BLOCK LEAKS THROUGH ITS DOM ATTRIBUTES IF YOU LET IT
The privacy contract is "a time and a name". The first draft honoured that in
every rendered string — and then wrote `data-kind="meeting"` on the chip and put
a **Meeting / Personal** chip on the day-panel row. *"Y is in a client
meeting"* and *"Y has a personal appointment"* are two different facts, and the
contract promises neither. The service's own test passed throughout, because it
asserts on the service's fields and `kind` is structural there.

Busy chips now carry `data-kind="busy"` and busy rows carry no kind chip at all,
asserted in the e2e. **A privacy rule enforced only over rendered text is
enforced only against people who do not open the inspector.**

### 7. THE THING THAT MAKES THE FEATURE WORK IS NOT THE PAGE
The obvious build is the grid. But a meeting is reachable only through its
lead's owner, so a calendar built from the existing schema answers *"is Y
free?"* only when Y happens to own the lead — which, in the founder's own
example (X sets the meeting, Y must attend), is exactly when Y does not. The
page would have looked finished and answered the one question it was built for
incorrectly, silently, for every meeting.

`technicalSupport` sits on the same form and cannot be pressed into service: it
is free text, and a typed name is not an account. So the load-bearing part of
this feature is a two-column join table and a row of checkboxes — and worth
finding before the page is built, not after.

### 8. A "FILL THE ROSTER" QUERY WANTS ONE OWNER, NOT TWO
The narrowing in `persistGroup` (which accounts may be marked on a meeting) and
`listCalendarPeople` (whose time the grid draws) are the same question. The
first draft answered it twice — a literal role array inline in `leads.ts` beside
`rolesForCompany` in the calendar service — which is the drift the rest of this
codebase spends its comments preventing. Deduped to one exported predicate: a
person the form can offer is exactly a person whose time the grid can show.

### 9. A MISSING PLAYWRIGHT BROWSER LOOKS EXACTLY LIKE A BROKEN APPLICATION
Two full e2e runs reported `1 passed, 2 skipped, 14 did not run` with **exit
code 0**, and `test-results/.last-run.json` listed ~135 failed ids. It reads as
a catastrophic regression — every screen broken at once. The real cause was
`browserType.launch: Executable doesn't exist at …/chromium_headless_shell-1234`:
Playwright's browser binary was simply not installed on the machine (a version
bump moves the expected build number, so a previously working checkout stops
working with no code change at all).

The tell is that the ONE test that passed was `health.spec.ts`, which uses the
`request` fixture and never opens a browser. **When everything fails but the
API-only spec, suspect the browser, not the app.** `npx playwright install
chromium` fixes it.

And the trap inside the trap: this only became visible after the run's output
was captured in full. Piping a Playwright run through `tail -70` throws away the
error section and keeps the summary — which is how two runs in a row were read
as "interference" and re-run instead of diagnosed. **Capture the whole log to a
file; read the counts, never the exit code.**

### 10. AN END TIME THAT DOES NOT FOLLOW ITS START IS A BUG IN THE FORM, NOT IN THE USER
The dialog opened at 09:00–10:00. Setting the start to 11:30 left the end at
10:00, so the entry ended ninety minutes before it began, and the server did
exactly what it should: `400 — It has to end after it starts`. The person is
then looking at an error message for a mistake the form made on their behalf.

The e2e caught it only because the test happened to change the start and not the
end — which is precisely what a person does. Fixed by carrying the end with the
start and keeping the duration already chosen (floored at fifteen minutes, so an
inverted entry comes back valid rather than staying inverted).

The arithmetic is deliberately on the WALL CLOCK — `Date.UTC` used as
minutes-since-epoch over the typed digits, never as an instant. The Cairo
conversion happens once, server-side, in `eventWindow`. **A second timezone
opinion inside a component is how a clock drifts.**

## ADR-072 — the postpone column: the traps

### 1. `stageKey`'s DEFAULT BRANCH IS `"lost"`, AND A NEW STAGE FALLS INTO IT SILENTLY
`stageColors.ts` maps a stage id to the `data-stage-key` that binds its four
per-stage custom properties, and its `default:` returns **`"lost"`**. So a new
stage added to `INTERNAL_STAGES` with no case in that switch does not fail, does
not warn, and does not render untinted — it renders in **the Lost ramp**. For a
column whose entire purpose is distinguishing "paused" from "gone", that is the
worst possible silent default.

Worse, there are THREE switches (`stageKey`, `stageTint`, `stageAccent`) and
they fail differently: the first paints the wrong colour, while the other two
fall through to `bg-brand-surface-tint` / `bg-brand-border` — so a stage can be
half-bound and look almost right. `brand-tokens.test.ts` catches all three,
which is the only reason this was found; a reviewer reading the board would have
seen a plausible grey column.

The guard already existed in the right shape for ADR-059's `waiting` ("has its
OWN stage key — never aliased onto another column"). **A named case per stage,
plus a named test per stage, is the pattern** — the generic "resolves to a real
key" assertion is satisfied by aliasing and cannot protect you on its own.

### 2. THERE ARE THREE BRAND SCOPES, NOT TWO
Stage tokens live in `branding/byteforce/tokens.css`, `branding/b-systems/
tokens.css` **and `src/themes/neutral.css`** — the last is the unbranded scope
the module shells fall back to. Adding a stage to the two brand files and
stopping there fails `brand-tokens.test.ts`'s "identical stage token set across
ALL THREE scopes", which is exactly what it is for. The neutral scope binds
every stage to `--color-surface-tint`/`--color-border`, so the addition is
mechanical — but it has to be made.

### 3. A RULE THAT IS RIGHT EVERYWHERE CAN BE BACKWARDS IN ONE NEW PLACE
ADR-039's addendum — "ANY stage move signals the client was reached, so the
didn't-answer marker and its tally clear themselves with the move" — is correct
for every destination the product had. It is precisely inverted for a column
whose first named reason is *"not answering at all"*: it erases "we tried him
five times" at the exact moment that number becomes the reason for the move.

Nothing in the code could have flagged this; the rule reads as a general truth
and its comment argues for it convincingly. It surfaced only because an
integration case was written to assert the founder's stated intent ("keep both")
rather than to assert what the code did. **When a new destination inverts the
PREMISE of an existing rule, the rule needs a carve-out, and the carve-out
belongs next to the original reasoning** — not in the new feature's own module,
where the next reader of ADR-039 will never find it.

### 4. THE B-SYSTEMS LEAD-CREATE API IS NOT THE SHARED SCHEMA
`api/b-systems/leads` extends `createLeadSchema` with a **mandatory
`companyName`** (founder's rule), while the shared schema and the ByteForce
route keep it optional. An e2e helper copied from another spec without that
field answers **400** on creation — long before the spec's actual subject is
reached, and the failure reads as "my new feature is broken" rather than "my
fixture is wrong". Worth checking the route's own schema, not just the service's,
whenever a test seeds a B-Systems lead.

### 5. `data-stage` AND `data-stage-key` ARE THE SAME ELEMENT
The board column carries both attributes on one node. A test written as
`[data-stage="x"] [data-stage-key="x"]` (descendant) matches nothing — and on an
EMPTY column it matches nothing either way, so the mistake is invisible until
the column has cards. Assert the attribute on the column itself.

### 6. THE PLAYWRIGHT `webServer` BUILD CAN OUTRUN ITS 300s TIMEOUT ON A COLD CACHE
`webServer.command` is `npm run build && npx next start`, with
`timeout: 300_000`. On a cold `.next` this build took ~67s to compile plus type
checking and static generation, and the whole run died with `Timed out waiting
300000ms from config.webServer` before a single test executed. Running
`npx next build` once beforehand warms the cache and the same run then starts in
well under the budget. (Cheaper than raising the timeout, and it keeps the
timeout meaningful as a signal that something is actually wrong.)

### 7. `scrollIntoViewIfNeeded` PARKS A DRAG TARGET WHERE AUTO-SCROLL IS STILL FIRING
Adding a column pushed **Won** past the fold on an eight-wide board, and two
drag journeys started dropping cards on the wrong column. `page.mouse` speaks
VIEWPORT coordinates, so an aim at an off-screen column is clamped at the edge
and the card is released over whatever sits there — **the drop succeeds, on the
wrong column**, which is why it surfaced as "the win form never opened" rather
than as a drag error.

Scrolling the column in fixed most of it. It did not fix all of it, and the
reason is worth keeping: **`scrollIntoViewIfNeeded` scrolls the MINIMUM
distance**, leaving the target flush against the viewport edge — which is
exactly the zone where dnd-kit's auto-scroll keeps running. The board then moved
between the last pointer move and the mouse-up, and the card landed a column
further on. Two things fix it together:

- `column.evaluate(el => el.scrollIntoView({ inline: "center" }))` — **centre**
  the target so auto-scroll never engages;
- **converge** before releasing: re-aim at the column's live box until it stops
  moving between two readings (bounded, so a stuck board times out rather than
  looping).

**The tell for this whole class: it passed in isolation and failed in the
suite.** The journeys share a seeded database, so in a full run the board is
busier and starts scrolled differently. Any drag fix has to be verified by
running the journeys **in sequence**, never one at a time.

And the trap behind the trap: there are **five copies of `dragTo` across the e2e
specs and all five differ**. `prospect-pipeline.spec.ts` had already learned the
scrolling lesson when ADR-059 widened its board and wrote it down in its own
comment; three of the other four had not, because nothing shares the helper.
That duplication is now the single most likely thing to break the next time a
column is added.

### 8. ONE BOARD SCORES COLLISIONS ON THE CARD, ANOTHER ON THE POINTER
`prospect-pipeline.spec.ts` deliberately offsets its aim so the dragged CARD
lands centred on the target, because dnd-kit scores that board's collisions on
the card's rect. Copying that compensation into `journey5` overshot by a whole
column and dropped a win into Lost — that board resolves on the POINTER.

The two are a page apart and look like the same helper. **Before copying drag
geometry between specs, check which collision strategy the board under test
uses**; the failure is silent and lands on a plausible neighbour.

### 9. A DATE-DEPENDENT TEST THAT PASSES ELEVEN MONTHS OF THE YEAR
`whatsapp-sent.spec.ts` anchored a chip's accessible name on
`/^WhatsApp sent by Elmur on \d{1,2} \w{3} \d{4}$/`. **en-GB abbreviates
September as "Sept" — four letters** — so that regex cannot match for the whole
of September, and matches fine the rest of the year:

```
Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo",
  day: "numeric", month: "short", year: "numeric" }).format(new Date())
  →  "1 Sept 2026"
```

It surfaced when a long session's full run crossed midnight into 1 September:
two specs that had passed in every earlier run of the same session suddenly
failed, immediately after an unrelated change — which is exactly the shape that
invites blaming the change. **It would have failed on `main`, untouched, on the
same day.**

`same-stage.spec.ts` had already met this and writes `Sept?` with a comment; the
general rule is `\w{3,4}` (or an explicit `Sept?`) for any en-GB short month.
The tell that a failure is calendrical rather than causal: it appears in a spec
the change does not touch, and the change has no path to it.

### 10. DO NOT RUN THE UNIT SUITE ALONGSIDE PLAYWRIGHT EITHER
ADR-071 trap 3 says never run `next build` during a Playwright run. The same
applies to `npx vitest run`: it starts its own embedded Postgres and saturates
the machine, and a full e2e run alongside it came back with
`apiRequestContext.post: read ECONNRESET` against the test server — an
infrastructure failure that reads exactly like a broken endpoint.

The tell is the shape of the error, not its content: **ECONNRESET / socket
hang-up in ONE test, with the rest of the suite green**, is starvation, not a
regression. Re-run it with nothing else going before spending any time on it.

## ADR-073 — the third company: the traps

### 1. `\b` IN A NON-RAW PYTHON STRING IS A BACKSPACE, AND IT SURVIVES INTO THE FILE
Patching a test through a Python heredoc, I wrote a JS regex literal
`/\bcrmRolesFor\b/` inside an ordinary `'''…'''` string. Python read `\b` as the
**backspace escape**, so what landed on disk was
`/<0x08>crmRolesFor<0x08>/` — a regex that matches literal backspace characters
and therefore never matched anything.

The failure was maximally confusing: the branch silently did not fire, execution
fell through to a parser that found no known constant, and the test reported
`guard admits only ` — an EMPTY role list — for a page whose guard was plainly
correct. Three rounds of instrumentation went into the wrong half of the problem
because the source *looked* right in an editor: a backspace is invisible.

Two habits that would have cost nothing:
- **Use raw strings (`r'''…'''`) for any patch text containing a backslash**, or
  double every backslash and check.
- **`grep -P "\x08"` the tree** after script-driven edits. It found nothing else,
  which is the only reason this was a twenty-minute detour rather than a
  landmine.

### 2. A TERNARY ON A TWO-VALUE UNION IS A TRAPDOOR THE DAY THERE ARE THREE
`brand === "byteforce" ? a : b` is total while `Brand` has two members. Widening
the union does not break it, does not warn, and hands the new member the `else`
branch. Four of these existed (`configForBrand`, `staffRolesForBrand`,
`rolesForCompany`, `mentionableUsersFor`), and all four would have given Mindoo
B-Systems' answer.

`Record<Brand, T>` is the fix and the reason is mechanical rather than stylistic:
**an exhaustive map fails to compile when the union grows**, which is exactly the
moment somebody needs to be asked the question. Prefer it to a ternary or a
`switch` with a `default` anywhere the union is a set of tenants, brands or
companies.

The nastiest instance was `configForBrand`, because the fall-through was *nearly*
right — Mindoo really does copy B-Systems' pipeline — and the one thing it got
wrong was the role gate, so the board would have rendered perfectly and offered
no way to close a deal.

### 3. A FIRST-MATCH PARSER MISREADS A UNION
`nav.test.ts`'s `rolesFrom` returned on the first shared constant it recognised
in a guard's argument list. That was correct while every guard named exactly one.
`[...BS_PIPELINE_ROLES, ...MINDOO_ROLES]` broke it into an active lie: the test
reported the page admits *only* `mindoo_staff` and declared Won Leads shut to
every B-Systems role that has always had it.

It accumulates now. **Any parser that reads a spread should union, not
short-circuit** — the spread means "and", and a first match reads it as "or".

### 4. ADDING A TENANT CAN INVALIDATE AN OLD WALL, NOT JUST DEMAND A NEW ONE
`checkMilestone(id)` looked a milestone up by id alone. Perfectly safe with one
company that had milestones — the route's `requireBsAdmin` was the whole test,
and the comment said so. Mindoo wins the same way, so it has milestones too, and
that reasoning silently stopped holding: a B-Systems admin could reach a Mindoo
milestone and vice versa.

**When adding a tenant, re-read the justification of every existing guard, not
only the list of places that mention the tenant dimension.** The dangerous ones
say "admin only" and mean "there is only one admin worth worrying about". The
fix answers 404 rather than 403, so one company cannot enumerate another's ids.

### 5. A COMPONENT THAT IMPORTS A CONFIG HAS A TENANT BAKED IN
`BsBoard` and `BsEventPanel` imported `bsystemsCrmConfig` at module scope —
invisible in every call site, and impossible to vary. Both take the company as a
**required** prop now. Required rather than defaulted, for the ADR-066 §8 reason:
a default lets the next call site inherit the wrong pipeline silently, which is
the whole failure the prop exists to prevent.

### 6. A DEEP LINK INTO A *SHARED* SCREEN MUST CARRY THE COMPANY
The B-Systems board pushed `/b-systems/crm/lead/<id>` with **no `?company=`**.
That was correct for as long as the lead detail served one company: the page
falls back to the reader's DEFAULT company, which was always the right one.

The moment Mindoo shared that address, the same link became a 500 — the page
resolved `bsystems`, `getLeadDetail("bsystems", mindooLeadId)` threw
`404 Lead not found`, and because that call sits outside the page's try/catch it
surfaced as **"This page couldn't load"** on a lead the reader is entitled to.

ByteForce never exposed it because ByteForce leads live on a *different* route
(`/b-systems/leads/lead/…`), so the two-company era gave no warning at all. Four
links were affected — the card title, the card's call sheet, the card's click
handler, and the Leads table row — and each one is invisible in review because a
missing query parameter looks like nothing.

**Rule: the moment a route serves more than one tenant, every link to it carries
the tenant.** Grep for the route string, not for the bug.

### 7. AND THE PAGE ITSELF MUST USE THE RESOLVED COMPANY, NOT A LITERAL
The same page then called `getLeadDetail("bsystems", leadId)`. A sweep of the
shared and dual-company pages for `"bsystems"` string literals found three more
of exactly this kind:

- `listCalendarPeople("bsystems")` on the board **and** the lead detail — the
  "Also blocks" roster, which would have offered B-Systems' people on a Mindoo
  meeting and put a Mindoo meeting on the wrong company's calendar;
- `w.lead.brand !== "bsystems"` on the Won Deal detail — every Mindoo won deal
  would have 404'd, and read the other way this is the wall that stops one
  company opening another's deal by id.

None of these is reachable by reading the diff of the feature: they are
pre-existing lines that were *true* and silently stopped being so. **After
widening a page from one tenant to several, grep that page for the old tenant's
literal.** It takes a minute and it found four bugs here.

### 8. A THIRD SEGMENT OVERFLOWS A CONTROL THAT FIT TWO
`.switcher` is `flex: none`, which was fine while the company switch held two
mono, letter-spaced labels. A third pushed **43px of horizontal page overflow**
at the narrow end — caught only because `module-bar.spec.ts` asserts the page
never scrolls sideways at 320px and 240px.

ADR-060 had already solved this for the module bar (equal `1fr` grid cells that
cannot overflow any viewport at any zoom); the company switch simply had not
needed it yet. **A fixed-width control is a latent overflow bug waiting for its
next item** — and the assertion that caught it is a page-level one, not a
component-level one, which is why it was worth having.

### 9. ZOMBIE POSTGRES SOCKETS MAKE REPROS LIE
After a long session the machine held **nine** orphaned embedded-Postgres
listeners in the 5500–5999 band — sockets still marked LISTENING whose PIDs no
longer exist, so `taskkill` reports "process not found" and they persist until
reboot. Both `vitest.config.ts` and `playwright.config.ts` already derive their
port from the process PID precisely to dodge this ("a crashed run can leave a
Windows zombie socket on a fixed port"), but a new PID can still collide with
one, and then the run dies at startup with
`could not bind … FATAL: could not create any TCP/IP sockets` and a bare
`undefined` where the test summary should be.

Two of three attempts to reproduce an unrelated flake died this way. **If a run
ends with `undefined` and no test counts, read the top of the log for a bind
failure before believing anything about the code** — and re-run rather than
theorise, because a new process usually draws a free port.

### 10. "PASSES ALONE, FAILS IN THE SUITE" IS A BUDGET SYMPTOM AS OFTEN AS A STATE ONE
`impersonation.spec.ts` failed three full runs in a row and passed alone, in a
three-spec batch, and in a five-spec batch — the classic signature of leaked
state. Pairing it with the spec that precedes it alphabetically reproduced the
failure **once** and then passed on a second identical run, which is what ruled
state out: an ordering dependency does not come and go.

It is the only case in the suite performing three server-side auth round trips
(sign in → mint an impersonation session → snap back), and it always failed the
same way: a sign-in POST returning to `/login`, the test spending its entire 60s
on one `waitForURL`. The fix is the budget, not the assertions.

Worth checking first, and cheaply, was whether the change under review had moved
the landing this test waits for — a four-line script calling `landingFor` with
the old and new role sets proved it had not, which is what made "flake" an
honest conclusion rather than a convenient one.

---

## ADR-074 — MINDOO as its own system: five traps, four of them latent for months

### 1. A hardcoded API base is invisible until somebody presses the button

Every write on the shared B-Systems screens posted to a literal
`/api/b-systems`. Under ADR-073's `?company=mindoo` the board rendered
**perfectly** — same columns, same cards, same Won option — and every action on
it was refused by the brand wall the moment it arrived. Mindoo shipped
read-only, and the e2e that was supposed to cover it proved the SHAPE of the
board without ever clicking anything.

The general form: **a URL literal inside a client component is a company
decision made at the wrong layer**, and its failure lives on the far side of a
fetch where no amount of looking at the screen will find it. `apiBase` is now a
required prop on `BsBoard`, `BsEventPanel`, `MilestoneCheckbox`,
`WonDocumentUpload`, `BsAddLeadForm`, `EditLeadForm`, `DeleteLeadButton` and
`AssignLeadButton` — required rather than defaulted, because a default lets the
next call site inherit the wrong company silently, which is the whole failure
the prop exists to prevent.

**When a component fetches, assert the REQUEST, not the render.**
`page.waitForRequest` plus the response status is three lines and would have
caught this the day ADR-073 shipped.

### 2. "This parameter is a filter, not a tenant" has an expiry date

ADR-054 says it in as many words, and it was TRUE: a `?company=` on an
accounting route could not name anything the caller was not already entitled to,
because every account that could open the module held both companies. Adding
Mindoo makes the sentence false **and changes no code**, so nothing fails, no
test goes red, and the comment that documented the reasoning now documents a
hole.

The same shape appeared three more times in one afternoon:
`addWonDocument(wonDealId, …)` found a deal by id alone; every
`/api/vault/<kind>/[id]` route acted on a record found by id alone; and
`exportAllDoc()` iterated the platform's companies rather than the caller's.

**Grep for the reasoning, not just the code.** When a tenant is added, the
dangerous files are the ones whose comments say "this is safe BECAUSE
<something that is about to stop being true>".

### 3. The nullable column that meant "both"

`VaultTask.company` and `VaultEmployee.company` are nullable, and the schema
comment says `null = both`. With two companies that is unambiguous. With three
it is a question nobody has answered, and the two available answers are opposite
leaks: show untagged rows to everybody and Mindoo sees the founder's private
B-Systems tasks on day one; hide them from everybody and the accounts that
created them lose their own records.

The ruling: **an untagged row belongs to whoever holds the module's DEFAULT
company** (ByteForce, the SPA's default tenant since ADR-052). It keeps every
existing account's vault byte-for-byte and gives Mindoo exactly what is tagged
Mindoo. Written down in `services/vault/tenancy.ts` rather than inferred,
because the next person will have to make the same call for the next column.

### 4. Spreading a second `OR` into a Prisma `where` silently replaces the first

The vault's list queries already build an `OR` for the search box. A tenancy
clause spread in as `{ OR: [...] }` would have dropped either the search or the
wall depending on key order — no error, no type complaint, just one of two
filters quietly gone. Every clause rides `AND`, which collides with nothing
today and would be a compile error if it ever did.

Related, and the reason there are TWO helper functions rather than one with a
flag: `company` is a required String on forms/links/sheets/documents and
nullable on tasks/employees, so only the second may emit `company: null`. A
single helper returning a union has to be cast at every call site, and the cast
is exactly what stops the compiler noticing the day one of those columns
changes.

### 5. A ternary with a default is a trapdoor, again — and the third one had a colour

ADR-073 recorded four ternaries that had to become tables. ADR-074 found the
fifth, and it is the most misleading of the set:

```ts
// moduleBrand, before
return company === "bsystems" ? "bsystems" : "byteforce";
```

Mindoo's administrator opening `/accounting` with no `?company=` read **his own
books under ByteForce's colours**. Nothing is wrong with the numbers; the module
is simply telling him he is looking at somebody else's money, which is worse
than a rendering bug and completely invisible to a typechecker.

The fix has two halves and both matter: a TABLE (so a fourth company must be
answered), and a **server-supplied fallback** (so "no company on the URL" means
"this account's own default" rather than a literal). The first half alone would
still have shown ByteForce.

### 6. A note on the sweep tests

`page-company-guards.test.ts` scopes itself to `src/app/(bsystems)`, which is
correct and was silently insufficient the moment a second app group existed.
`mindoo-app.test.ts` is its sibling rather than an extension of it — the two
groups have different guards, and a single parameterised sweep would have to
know which guard belongs to which group, which is the thing worth stating
plainly in two files.

Both strip comments and normalise line endings before matching. That is not
defensive politeness: this project has no `.gitattributes`, so a Windows
checkout is CRLF on disk, and a needle containing a literal newline made an
earlier sweep RED for every file it touched — failing identically whether the
code was right or wrong (BUG-015, ACCESS AUDIT Run 081).


### 7. What an adversarial review of the finished diff found, and the pattern in it

The suites were green — 886 tests, a clean typecheck, a clean build, 14 new e2e
cases — and a six-dimension review of the diff found **eighteen real defects**.
Every one reproduced in the source. That is worth writing down as a method note
rather than a list of bugs, because the defects sort into four shapes and the
shapes are what generalise:

**Nine of the eighteen were ABSENCES.** A query with no company clause. A route
that does not exist behind a button that does. A broadcast with no reader in the
company it is about. A test suite grown alongside its code asserts what the code
DOES; almost nothing in it asserts what is missing, and a tenancy wall is
precisely a claim about absence. The fix is not more tests of the same kind — it
is tests written from the other direction, which is the rule
`company-scope.integration.test.ts` already stated for ADR-067 and which this
round had to re-learn: **seed a TWIN in the other company first, and assert what
is NOT returned.**

**The wall stops at the edge of whatever you were editing.** Every one of these
had a correctly-walled sibling three lines away: the vault's lists were scoped
and the activity feed beside them was not; employee CARDS were scoped and their
COUNTS were not; link ROWS were scoped and the category list BUILT FROM THEM was
not; the row was scoped and the FILE behind it was not. When you add a tenant,
the unit of work is not "the query" — it is "everything the screen renders",
including the numbers, the labels, the suggestions and the bytes.

**A read scoped is not a write scoped.** Re-spelling a link category ran an
`updateMany` across companies. Assigning a task resolved the assignee by id
alone. Both sat directly beneath reads that had been walled correctly in the
same session.

**And the seed could not express the change.** `upsertUser` only ADDED roles, so
"admin@byteforce.com no longer holds mindoo_staff" was a no-op on every database
that already existed. A seed that cannot revoke cannot describe a state; its own
doc comment had been promising that it could.

The cheapest durable lesson: **when a component fetches, assert the REQUEST.**
Three of the eighteen (and the read-only bug ADR-073 shipped) were invisible on
screen because the failure is on the far side of a fetch. `page.waitForRequest`
plus a status check is three lines and would have caught all four.
