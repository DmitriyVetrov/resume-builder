# ADR-050 — Frontend foundation routing and state boundary

- Status: **Accepted** (`DELEGATED-DEFAULT`, ADR-035 A-4)
- Decider: Solution Architect (delegated, ADR-035)
- Date: 2026-11-03 (P05)
- Source IDs: ADR-003 (P05 router/state choice), ADR-008 F-FE-1…3, ADR-040 (generated contract types), TECHNICAL-SPEC §§3.2, 5.3 and 11 (NFR-05, NFR-06, NFR-09)

## Context

P03 left a placeholder React root. P05 needs stable browser navigation and shell-level failure recovery while account, library, editor state and API operations belong to later phases. The frozen v1.0.0 OpenAPI contract has no P05 operation.

## Decision

1. Use **React Router declarative mode** (`react-router`, `BrowserRouter`) inside the Vite SPA. Pin the selected exact compatible release in `frontend/package.json` and its lockfile. Route definitions live in `app/`; pages supply content. Reserve `/` and `/resumes` for the landing/library shell, `/resumes/:resumeId/edit` for an editor shell, and `*` for an accessible not-found page. Shell links use router navigation; direct URL refresh works through the SPA fallback in Vite preview and later same-origin hosting. A route does not silently create or load a resume.
2. The app shell owns only navigation and display state (such as the selected narrow-screen panel). API server state remains owned by later feature modules, which must use contract-generated types. P05 adds **no server-state or form-state library** because it performs no API call or form workflow. P06/P07/P08 choose those libraries, if needed, against their concrete requirements. Editor document state must never be copied into a shell-global store.
3. Place a React error boundary around routed content, with a plain-language error message and a working recovery action that resets the boundary or navigates to the safe landing route. It must not show error stacks, resume content, tokens or contact data. Unknown URLs use the not-found route, not the exception boundary.
4. Use the existing `app → pages → widgets → features → entities → shared` dependency direction. Centralize Tailwind 4 design tokens in a single stylesheet; the shell may use neutral placeholder UI but must not implement later editor, auth, library, rendering, save or export behavior.
5. Fulfil the frontend-local portion of P05-OBL-P03-02 with a multi-stage, digest-pinned `frontend/Dockerfile`, a minimal non-root static runtime and a local build/runtime/image-scan check. Shared Compose, image-lock, workflow and CI-script wiring cannot be changed in the P05 source slice while P04 and P05 run in parallel with disjoint file sets. The Program Coordinator must arrange that wiring after the parallel branches converge and before claiming the P03 container obligation complete; record it as an integration follow-up, not as P05 shell acceptance evidence.

## Alternatives considered

- Browser History API by hand: a smaller dependency, but deep links, navigation state and not-found behavior would need custom infrastructure. Rejected as more maintenance for a standard need.
- React Router Data or Framework mode: useful for route loaders/actions or framework services; P05 has neither and uses the already fixed Vite SPA shape. Deferred until a later requirement justifies it.
- A global server cache or state library in P05: anticipates P06/P07 behavior and risks duplicate ownership. Rejected for this phase; the choice is reversible.

## Consequences

The shell remains independently buildable and can run with no backend. P06–P12 fill route content through tested feature work without changing the routing mode unless their needs justify a new ADR. The app requires an SPA fallback for deep links in production hosting; P15 must verify it. The selected router and axe package are exact-pinned and scanned by the existing supply-chain job. The web image's shared CI/Compose integration remains an explicit coordinator follow-up because P05's source ownership excludes those shared files.

## Security, privacy and accessibility

Routes are presentation, not authorization; each later API operation still enforces ownership on the server. No shell telemetry, third-party CDN or remote font is allowed. Navigation, not-found and recovery controls are keyboard reachable and labelled. An error view must reveal no application data.

## References

- [React Router modes](https://reactrouter.com/start/modes) and [declarative installation](https://reactrouter.com/start/declarative/installation), accessed 2026-11-03.
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing), accessed 2026-11-03.
