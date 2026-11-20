# P03 browser canary

Runs the placeholder application in Chromium, Firefox and WebKit through the pinned Playwright image. The tests reject outbound browser requests.

## Real-stack acceptance (`real-stack/`)

Not part of the fixture suite: step 7 of a phase runs it against the real API. Start Compose's `mongo`, `azurite` and `mailpit`, the API in `Production` with `ReverseProxy__TrustedProxies__0=127.0.0.1`, and `node tests/e2e/real-stack/proxy.mjs frontend/dist 4190 5090`, then `npx playwright test -c playwright.real.config.ts` in the pinned image. Set `RESUMISER_QA_EVIDENCE` to a directory to keep screenshots. Start from a fresh database: `auth-email` allows only 5 sign-ups per 10 minutes.
