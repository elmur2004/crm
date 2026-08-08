---
name: session-start
description: Start-of-session ritual - load the project state and propose a plan before touching code. Use at the beginning of every working session, or when the user says start, continue, resume, or asks where the project stands.
---

# /session-start

Run these steps in order; do not write code until step 6.

1. Read the latest entry of `docs/PROGRESS.md` — done / in progress / next steps /
   blockers / needs founder confirmation.
2. Read `docs/DECISIONS.md` headings (know the standing ADRs) and any open items in
   `docs/BUGS.md`.
3. Identify the current phase from SPEC.md §14 and what remains for its Definition of
   Done.
4. Run `git status` — if there are uncommitted leftovers, account for them before new
   work.
5. If brand or logo assets recently appeared in `branding/`, note that wiring them is a
   pending task.
6. Output a session brief: (a) where the project stands in one paragraph, (b) today's
   plan as a short list of small, verifiable tasks in phase order, (c) blockers or
   questions for the founder. Then proceed with the plan (or wait for approval if the
   user is present and reviewing).

Never skip this ritual — it is what keeps context clean across sessions.
