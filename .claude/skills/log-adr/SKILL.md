---
name: log-adr
description: Record an architecture/product decision as an ADR in docs/DECISIONS.md. Use whenever a decision is made, a SPEC section-11 assumption default is applied, the stack deviates from SPEC section 2, or the user says log this decision.
argument-hint: <short decision summary>
---

# /log-adr

1. Read `docs/DECISIONS.md`; find the last ADR number; next ID = last + 1.
2. Compose the entry with the exact template from the `project-logging` skill, filling
   Context / Decision / Alternatives considered from the current conversation and code
   reality. If it resolves a SPEC §11 assumption, name the A-# in `Resolves:`.
3. Base the title on: $ARGUMENTS (if empty, derive it from the decision itself).
4. Append to `docs/DECISIONS.md` (never edit past entries), date = today (YYYY-MM-DD),
   Status: Accepted.
5. If this decision needs the founder's sign-off, also add it to "Needs founder
   confirmation" in the next PROGRESS entry.
6. Confirm back: the ADR id, title, and one-line decision.
