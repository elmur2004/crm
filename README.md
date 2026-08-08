# ByteForce × B-Systems Sales Platform — Project Starter

One platform, two brands, three applications:
ByteForce CRM (internal) · B-Systems CRM + Partners (internal) · B-Systems Partnership Portal (external reps + admin).

`SPEC.md` is the single source of truth: full product specification, business rules, testing plan,
build phases, and Definition of Done. Everything else in this folder exists to make an AI coding
agent build it correctly and keep the context clean across sessions.

## How to start

**Claude Code** — open a terminal in this folder and run `claude`. `CLAUDE.md` loads automatically.
Say: `/session-start` (or paste the kickoff prompt from SPEC.md §17).

**Antigravity (or any other agentic IDE)** — open this folder as the workspace. `AGENTS.md` carries
the same operating rules; if the IDE doesn't auto-load it, paste the kickoff prompt from SPEC.md §17
as your first message.

## Before the first coding session

1. Drop the logo files into `branding/byteforce/` and `branding/b-systems/` (each folder's README
   lists the expected files — any format is fine, the agent adapts to what it finds).
2. If you have the Lama Sans font files (ByteForce), put them in `branding/byteforce/fonts/`.
   B-Systems fonts (Raleway, Inter, JetBrains Mono) come from Google Fonts — nothing to add.
3. That's it. Everything else is specified.

## Folder map

```
SPEC.md                  Master specification + process contract + kickoff prompt (§17)
CLAUDE.md                Claude Code project memory (auto-loaded)
AGENTS.md                Same operating rules for Antigravity / other agents
docs/                    Living project logs — architecture, decisions (ADRs), testing,
                         bugs, progress, changelog. Append-only. The project's memory.
branding/byteforce/      ByteForce tokens.css + logo drop zone + brand rules
branding/b-systems/      B-Systems tokens.css + logo drop zone + brand rules
.claude/
  settings.json          Pre-approved safe permissions for Claude Code
  agents/                Subagents: spec-guardian, qa-runner, brand-auditor, docs-keeper
  skills/                Brand + pipeline + logging knowledge, and workflow skills that
                         double as slash commands: /session-start /session-end /log-adr
                         /log-test /phase-gate /brand-audit
```

## Development (stack initialized 2026-08-08 — see docs/ARCHITECTURE.md)

```bash
npm install                # deps (Node 22+)
cp .env.example .env       # then set AUTH_SECRET; SQLite needs no setup (ADR-002)
npm run dev                # http://localhost:3000
npm test                   # vitest suites
npm run typecheck          # tsc --noEmit
npm run build              # production build
npm run test:e2e           # Playwright journeys (from Phase 1; needs npx playwright install)
```

## The one rule

If it isn't logged in `docs/`, it didn't happen. Every session opens by reading
`docs/PROGRESS.md` and closes by writing to it. Every assumption becomes an ADR.
Every test run is recorded. That is how the context stays clean and consistent
from the first session to the last.
