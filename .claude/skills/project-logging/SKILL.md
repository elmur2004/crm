---
name: project-logging
description: The documentation and logging protocol for this repository - session open/close ritual and the append-only templates for progress entries, ADRs, test runs, bugs, implementation notes, and changelog. Use at the start and end of every session and whenever any decision, assumption, test run, bug, or notable progress must be recorded in docs/.
---

# Project logging protocol

`docs/` is the project's memory. Append-only, dated, sequential IDs. If it isn't logged,
it didn't happen. `/session-start` and `/session-end` run the ritual; the `docs-keeper`
subagent can write entries for you. Full rules: SPEC.md §12.

## File map

| File | Holds | Write when |
|---|---|---|
| `docs/PROGRESS.md` | Session log | Every session close (and gate reports) |
| `docs/DECISIONS.md` | ADRs | Any decision, any SPEC §11 default applied, any stack deviation |
| `docs/TESTING.md` | Test run log | Every test round |
| `docs/BUGS.md` | Bug register | Any failure found / fixed |
| `docs/IMPLEMENTATION.md` | Module notes, gotchas | Immediately when discovered |
| `docs/ARCHITECTURE.md` | Living architecture | Any structural change |
| `docs/CHANGELOG.md` | User-visible changes | Each phase / release |

## Templates (copy exactly)

### PROGRESS entry
```
## Entry NNN — YYYY-MM-DD
- Done:
- In progress:
- Next steps:
- Blockers:
- Needs founder confirmation: (carry unresolved items forward; write "none" if empty)
```

### ADR
```
## ADR-NNN — YYYY-MM-DD — <short title>
- Context:
- Decision:
- Alternatives considered:
- Resolves: (A-# from SPEC §11, if applicable)
- Status: Accepted | Superseded by ADR-MMM
```

### Test run
```
## Run NNN — YYYY-MM-DD — <scope>
- Suites/commands:
- Cases: X passed / Y failed / Z skipped
- Failures: (case → BUG-### )
- SPEC coverage touched: (T-*/PP-*/P-* rows, journeys 1-5)
- Verdict:
```

### Bug
```
## BUG-NNN — YYYY-MM-DD — <title>
- Severity: critical | major | minor
- Where:
- Repro:
- Status: open | fixed (ref: commit/entry) | wontfix (ref: ADR)
```

## Rules

1. Read the target file first; increment from the last ID; never renumber or rewrite
   history — corrections are new entries referencing old ones.
2. A session may not end without a PROGRESS entry. `git status` leftovers must be
   explained in it.
3. ADRs that resolve a SPEC §11 assumption must name the A-#.
4. Keep the "Needs founder confirmation" thread alive across PROGRESS entries until
   each item is resolved by an ADR.
