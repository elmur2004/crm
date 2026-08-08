# Agent Operating Manual — ByteForce × B-Systems Sales Platform

This file is for any agentic IDE or coding agent working in this repository (Antigravity, Claude
Code, or others). It defines *how* to work here. *What* to build lives in `SPEC.md`, the single
source of truth — product behavior, field definitions, transition rules, phases, testing plan,
and Definition of Done. If anything you infer conflicts with SPEC.md, SPEC.md wins.

## Source-of-truth hierarchy

1. `SPEC.md` — normative product + process contract (do not edit; evolution happens via ADRs).
2. This file / `CLAUDE.md` — operating rules.
3. `docs/` — the living project memory (append-only logs).
4. `.claude/skills/*/SKILL.md` — reference knowledge (brand systems, pipeline engine contract,
   logging templates). These are plain Markdown: read them even if your IDE has no skill system.

## Session protocol

- **Open:** read the latest entry of `docs/PROGRESS.md`, the "Needs founder confirmation" list,
  and the current phase checklist (SPEC §14). Check `git status` for leftovers. Propose a short
  plan of small tasks before writing code.
- **Close:** append a PROGRESS entry (template in `.claude/skills/project-logging/SKILL.md`),
  record any test runs in `docs/TESTING.md`, any decisions in `docs/DECISIONS.md`, and any module
  notes in `docs/IMPLEMENTATION.md`. A session must never end with undocumented changes — the goal
  is that a fresh session (or a different agent) resumes with zero lost context.

## Hard rules

- **Log everything.** Decision → ADR. Assumption applied from SPEC §11 → ADR. Test round →
  TESTING entry. Bug → BUGS entry. Gotcha/workaround → IMPLEMENTATION note. If it isn't logged,
  it didn't happen.
- **Phases are gates, not suggestions.** Build strictly in the order of SPEC §14 and verify each
  phase's Definition of Done (evidence, not vibes) before advancing. Global DoD is SPEC §15.
- **The pipeline engine is built once** as a shared parameterized module; the transition tables
  in SPEC §10 are normative and every row gets a test.
- **Branding is tokenized.** No hardcoded colors or fonts in components. Tokens:
  `branding/byteforce/tokens.css` (App A) and `branding/b-systems/tokens.css` (Apps B & C),
  scoped by a `data-brand` attribute. Brand rules live in the two brand skills.
- **Security:** server-side enforcement of roles (SPEC §3); hashed passwords; Zod validation on
  every mutation; upload type/size checks; no secrets in the repo.
- **Ambiguity:** SPEC §11 default → ADR → continue. Silent invention is forbidden.

## Repo layout

`SPEC.md` spec · `docs/` logs · `branding/` tokens + logo drop zones (founder supplies logo
files; adapt to the filenames actually present) · `.claude/` Claude Code config (skills, agents,
commands, permissions) — its skill files are useful reference for any agent.

## Kickoff (first session)

Follow SPEC §17: initialize the stack (deviations = ADR), complete `docs/ARCHITECTURE.md` v0,
write the first real PROGRESS entry, and present the Phase 0 plan before feature code.
