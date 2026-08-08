---
name: session-end
description: End-of-session ritual - record everything before stopping. Use whenever a working session is wrapping up, the user says stop, done, or wrap up, or a long task has just completed and no further work will happen now.
---

# /session-end

A session may not end with undocumented changes. Run all steps (delegate writing to the
`docs-keeper` subagent if convenient):

1. If tests were run this session and not yet logged, log them now (`/log-test`).
2. If any decision or SPEC §11 default was applied and not yet logged, log it (`/log-adr`).
3. For every module touched, ensure `docs/IMPLEMENTATION.md` reflects reality — including
   gotchas and workarounds discovered.
4. Run `git status`; commit or explicitly explain anything uncommitted.
5. Append the PROGRESS entry (template in `project-logging` skill): done / in progress /
   next steps / blockers / needs founder confirmation — carry unresolved confirmation
   items forward.
6. If a phase was completed this session, make sure the `/phase-gate` report exists in
   PROGRESS before closing.
7. Output a closing summary: what shipped, what's logged where, and the first task for
   next session.
