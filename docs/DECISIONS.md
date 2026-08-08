# Decision log (ADRs) — append-only

Format: see `.claude/skills/project-logging/SKILL.md`. IDs sequential. Never rewrite
history; supersede with a new ADR.

## ADR-000 — 2026-08-08 — Project scaffold and default stack accepted
- Context: Repo initialized from the master spec before any code. A default stack was
  needed so Phase 0 can start without renegotiation.
- Decision: Adopt the SPEC §2 defaults (Next.js App Router + TypeScript, Tailwind on
  CSS-variable tokens, Prisma + PostgreSQL, NextAuth credentials, dnd-kit, Zod,
  Vitest + Playwright, local uploads behind a storage abstraction, EGP,
  Africa/Cairo display / UTC storage) unless a later ADR supersedes a specific item.
- Alternatives considered: Remix / SvelteKit (smaller ecosystems for this team's needs);
  Supabase-as-backend (less control over the pipeline engine's transactional side
  effects).
- Resolves: —
- Status: Accepted

## ADR-001 — 2026-08-08 — ByteForce Royal Violet is #53449B
- Context: The official "BYTEFORCE Brand Guidelines" PDF specifies Royal Violet
  #53449B (RGB 83·68·155). An earlier ByteForce design kit circulated #4B3B9C.
- Decision: #53449B is canonical everywhere (tokens, UI, assets). #4B3B9C must not
  appear in the codebase.
- Alternatives considered: keeping the design-kit value (rejected — the founder-supplied
  official brand book wins).
- Resolves: —
- Status: Accepted
