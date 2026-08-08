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
