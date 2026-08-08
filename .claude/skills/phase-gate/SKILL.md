---
name: phase-gate
description: Verify the current build phase against its Definition of Done with evidence, and record a gate report. Use before advancing to the next phase of SPEC section 14, when the user asks is the phase done, or at project end for the Global DoD of SPEC section 15.
---

# /phase-gate

Gates are evidence, not vibes.

1. Identify the current phase from `docs/PROGRESS.md` + SPEC.md §14.
2. List that phase's DoD items (at Phase 5, also walk the Global DoD in SPEC §15).
3. Verify each item with concrete evidence: file paths that exist, test run entries in
   `docs/TESTING.md` (fresh — rerun via the `qa-runner` subagent if stale), dashboard
   numbers vs fixtures, screenshots/routes for UI claims.
4. Delegate cross-checks: `spec-guardian` for behavior vs SPEC §§5-10, `brand-auditor`
   for §4.4 compliance.
5. Write a gate report as a PROGRESS entry: phase, checklist with PASS/FAIL per item and
   the evidence reference, overall verdict.
6. PASS → mark the phase complete and state the first task of the next phase.
   FAIL → list the exact gaps as next steps; the phase stays open. Never advance on FAIL.
