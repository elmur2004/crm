---
name: log-test
description: Record a test round in docs/TESTING.md and file failures in docs/BUGS.md. Use immediately after running any tests (unit, integration, E2E, or manual QA), or when the user says log the test run.
argument-hint: <scope of the run, e.g. "Phase 1 T-rows + journey 1">
---

# /log-test

1. Read `docs/TESTING.md`; next Run number = last + 1. Scope: $ARGUMENTS (or derive from
   what was just executed).
2. Fill the run template from the `project-logging` skill: suites/commands, counts,
   failures, and which SPEC coverage was touched (T-*/PP-*/P-* rows, journeys 1-5).
3. For each **new** failure, append a BUG-### entry to `docs/BUGS.md` (severity, where,
   repro, status open) and reference it from the run entry. For known failures, reference
   the existing BUG id.
4. If a previously open BUG now passes, append a status line marking it fixed with the
   fixing commit/entry reference.
5. Append the run entry; never rewrite old runs. Confirm back: run id, verdict, bug refs.

The `qa-runner` subagent can execute the suites and this logging in one delegation.
