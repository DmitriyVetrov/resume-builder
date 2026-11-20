# P05 Dependencies

| Input | Status and use | Owner |
|---|---|---|
| P02 OpenAPI v1.0.0, ADR-006/ADR-040 | Frozen, read-only; generated TypeScript types and typed fetch wrapper are required, with no P05 API call | Contract Architect owns changes |
| P03 frontend skeleton and scripts | React 19, Vite, strict TypeScript 5.9.3, npm lockfile, Vitest/RTL, CI frontend and E2E jobs | P03 completed |
| ADR-003/ADR-008/ADR-041 | Fixed SPA/toolchain, frontend dependency direction, confirmed test tooling | Accepted |
| React Router, Tailwind CSS 4 and official Vite plugin, `@axe-core/playwright` | Exact versions selected and locked by Frontend Developer/Test Engineer; no CDN or telemetry | P05 implementation |
| P04 backend foundation | Runs in parallel; no source dependency or shared file edit | P04 Backend Developer |

P05 local tests need Node/npm; E2E uses the existing digest-pinned Playwright image and Docker. No live API, external account, production secret or paid service is needed. `frontend/README.md` documents commands; P15 verifies production SPA fallback for deep links.
