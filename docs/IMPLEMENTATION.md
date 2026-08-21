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
