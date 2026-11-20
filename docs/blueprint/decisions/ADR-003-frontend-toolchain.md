# ADR-003 — Frontend toolchain configuration

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-02 (P01, decisions.md DD-P01-02)
- Source IDs: Fixed constraints React 19 + Vite and Tailwind CSS 4 (PROJECT-CHARTER; register ADR-003, ADR-005); NFR-02, NFR-05, NFR-09; P00 GOV-04 (needed by P02); conflict SC-29

## Context

React 19, Vite and Tailwind 4 are fixed. The language, runtime, package manager and app shape are open. P02 needs the TypeScript target for generated client types, and P03 needs the Node runtime for CI.

## Decision

- **Language:** TypeScript with `strict: true`, `noUncheckedIndexedAccess: true` and `exactOptionalPropertyTypes: true`. No `any` in generated API types.
- **Runtime for tooling:** Node.js **24 LTS** (supported until April 2028). It is pinned in `frontend/.nvmrc` and in `engines`, and CI uses the same major.
- **Package manager:** npm, which ships with Node, with a committed `package-lock.json`. CI uses `npm ci`.
- **App shape:** a client-rendered single-page application built by Vite into static files. It is served from our own origin in the EU (ADR-012, ADR-033) and calls the API on the same origin under `/api`. There is no SSR framework.
- **Frameworks:** React 19 (current 19.x) and Vite (current stable major at P05 start), with exact versions locked in P05. Tailwind CSS 4 is wired through the official Vite plugin.
- **Fonts and assets:** self-hosted and bundled (NFR-14, ADR-010). No third-party CDN, analytics or tag managers (NFR-09).
- **Left to P05** within these constraints: router, server-state library, form handling and folder conventions inside `frontend/src/{app,pages,features,entities,shared,widgets}`. **Left to P03:** the test tooling candidates (Vitest, React Testing Library, Playwright).

## Alternatives considered

- **pnpm or Yarn:** faster, but the extra tool gives little benefit for a single Node project. Rejected for v1. It is reversible.
- **Node 22 LTS:** shorter remaining support. Rejected.
- **An SSR or meta-framework (Next.js, Remix):** conflicts with the fixed Vite constraint and adds a server runtime. Rejected.
- **Plain JavaScript:** loses compile-time checking of the generated contract types. Rejected.

## Rationale

These are standard, conservative defaults with the longest support. Strict TypeScript makes the generated contract types useful (`.claude/rules/02-api-contract.md`). A static SPA keeps the frontend independent of the backend runtime.

## Consequences

P02 generates TypeScript types for strict mode. P03 sets up Node 24 in CI. P05 scaffolds with npm. Serving the SPA and the API on the same origin removes CORS and enables the strict cookie policy of ADR-036.

## Security/privacy impact

The same origin allows a `SameSite=Strict` session cookie and a strict CSP (`script-src 'self'`). The lockfile plus `npm ci` give a reproducible supply chain, and dependency scanning is set up in P03.

## Owner and date

Solution Architect (delegated, ADR-035), 2026-11-02.
