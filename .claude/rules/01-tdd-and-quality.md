# TDD and quality gates

1. Test Architect defines test levels, risks, fixtures and acceptance mapping.
2. Test Engineer creates executable tests before implementation.
3. Confirm tests fail for the intended reason (red), implement minimum solution (green), refactor.
4. Run narrow tests after each change and full relevant suite before handoff.
5. Record exact commands, exit codes, environment and known skips in `test-results.md`.
6. No blanket coverage target substitutes for behavior coverage. Initial targets: Domain ≥90%, Application ≥85% as guidance; critical business paths require branch/negative-path tests.
7. Contract tests, persistence integration tests, rendering fixtures and export tests are mandatory where relevant.
8. Flaky tests must be fixed or quarantined with owner, issue and expiry; no silent retries as a pass.
