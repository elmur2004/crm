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
