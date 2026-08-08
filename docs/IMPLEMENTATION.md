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
