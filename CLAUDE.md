# CLAUDE.md

This is **DisCharge+**, a BCA Sem 5 minor project and TetraTHON 2026 entry.

- **Start every session by reading `docs/SESSION-CONTEXT.md`.** It holds all decisions,
  the MVP scope, the college PPT rules, open questions and next steps.
- The MVP is **built** (2026-09-30): `server/` (Express + MongoDB, tests in `server/tests`) and
  `client/` (React + Vite). The student asked the AI to build it; every choice made for them is in
  `docs/DECISIONS.md`. From here the assistant helps the student **understand** the code (viva prep),
  and reviews/teaches for new work unless the student asks for something to be built.
- For anything being built, `docs/07-mvp-scope.md` and `docs/10-prd.md` override the full-vision docs 01–06.
- Run `cd server && npm test` and `cd client && npm run build` after any code change.
- At the end of a working session, append a dated entry to §10 of `docs/SESSION-CONTEXT.md` and update
  §7–§9 if anything changed.
