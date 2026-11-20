# P05 QA Report — Frontend Foundation

Date: 2026-11-03. Environment: Node 24.22.2, Docker, Vite preview, pinned Playwright Chromium/Firefox/WebKit. Backend not started.

Verdict: FAIL

| Criterion | Verdict | Evidence |
|---|---|---|
| AC-P05-01 | PASS | `bash docs/phases/P05/tests/suite.cmd` exited 0: locked install, lint, strict typecheck, 10 Vitest tests and Vite build passed; preview served without backend. |
| AC-P05-02 | PASS | Same suite, exit 0: 21 Playwright tests across three engines covered deep links, refresh, unknown URL and keyboard home recovery. |
| AC-P05-03 | PASS | Same suite, exit 0: desktop regions and 390 px keyboard panels passed in all engines, with no normal-width overflow. Independent check selected all four panels by keyboard. |
| AC-P05-04 | FAIL | Same suite, exit 0: axe WCAG 2.1 A/AA smoke passed on four routes in all engines. Independent Chromium check at 390 px with `document.body.style.zoom="2"` found document `scrollWidth=413`, `clientWidth=390`: horizontal overflow at 200% CSS zoom. Four panels and not-found home recovery remained keyboard reachable. CSS zoom approximates browser zoom. |
| AC-P05-05 | PASS | Same suite, exit 0: safe routed-error tests passed. Source inspection found an empty caught-error handler and generic fallback without exception text interpolation. |
| AC-P05-06 | PASS | Same suite, exit 0: API types regenerated before checks; `git check-ignore -v frontend/src/shared/api/generated/*` exited 0. Source inspection found same-origin `/api/v1` wrapper and no shell API call, remote asset, tracker, or working save/export control; browser API-denial tests passed. |
| AC-P05-07 | PASS | Same suite, exit 0: digest-pinned multi-stage image built; non-root identity, root and deep-link runtime checks passed; pinned OSV scan reported `No issues found`. Image manifest digest: `sha256:8d2d2c4363e6f6057a9f1f96906b02b94ded7366c4d9f40996e7f7f02a933edf`. |

## Exact commands and outcomes

- `bash docs/phases/P05/tests/suite.cmd` — exit 0; frontend jobs passed twice (10 unit tests each), 21 Playwright tests passed (7 per engine), image build/runtime passed, OSV scan found no issues. Two startup curl attempts received connection resets; retries succeeded.
- `npm run preview --prefix frontend -- --port 4174` — started successfully and served the independent check.
- `node --input-type=module -e 'import { chromium } from "@playwright/test"; const b=await chromium.launch({headless:true}); const p=await b.newPage({viewport:{width:390,height:844}}); await p.goto("http://127.0.0.1:4174/resumes/fixture-id/edit"); await p.evaluate(()=>document.body.style.zoom="2"); for (const name of ["Sections","Edit","Preview","Design"]) {const t=p.getByRole("tab",{name}); await t.focus(); await p.keyboard.press("Enter"); console.log(name,await t.getAttribute("aria-selected"),await p.getByRole("tabpanel",{name}).isVisible());} console.log("overflow",await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}))); await p.goto("http://127.0.0.1:4174/missing"); await p.evaluate(()=>document.body.style.zoom="2"); await p.getByRole("link",{name:/home/i}).focus(); await p.keyboard.press("Enter"); console.log("home",new URL(p.url()).pathname); await b.close();'` from `tests/e2e` — exit 1; local browser executable absent, so no acceptance evidence from this attempt.
- `pw_image="$(sed -n 's/^PLAYWRIGHT=//p' infrastructure/images.lock)"; docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -w /work/tests/e2e "$pw_image" node --input-type=module -e 'import { chromium } from "@playwright/test"; const b=await chromium.launch({headless:true}); const p=await b.newPage({viewport:{width:390,height:844}}); await p.goto("http://127.0.0.1:4174/resumes/fixture-id/edit"); await p.evaluate(()=>document.body.style.zoom="2"); for (const name of ["Sections","Edit","Preview","Design"]) {const t=p.getByRole("tab",{name}); await t.focus(); await p.keyboard.press("Enter"); console.log(name,await t.getAttribute("aria-selected"),await p.getByRole("tabpanel",{name}).isVisible());} console.log("overflow",await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}))); await p.goto("http://127.0.0.1:4174/missing"); await p.evaluate(()=>document.body.style.zoom="2"); await p.getByRole("link",{name:/home/i}).focus(); await p.keyboard.press("Enter"); console.log("home",new URL(p.url()).pathname); await b.close();'` — exit 0; four panels selected/visible, overflow 413/390, home `/`.
- `git check-ignore -v frontend/src/shared/api/generated/*` — exit 0; generated schema ignored.
- `python3 scripts/phase-handoff-check.py --phase P05 --role qa-acceptance --worktree .` — exit 0; `RESULT PASS`, role scope one file, blueprint and four suite commands green. The acceptance verdict remains FAIL because the zoom defect is outside the automated suite.

## Defect and handoff

At 390 px and 200% CSS zoom, the editor page overflows horizontally by 23 px. Frontend Developer should fix responsive overflow, then QA should repeat the zoom check and suite. Shared Compose/CI/image-lock integration remains the coordinator follow-up recorded in DD-P05-06.

## Re-run — 2026-11-03

Environment: Node 24.22.2, Docker, current Vite production build, pinned Playwright Chromium/Firefox/WebKit and OSV images; no backend. The earlier FAIL above remains the original finding. The header wrap fix and new 200% zoom browser assertion were present for this re-run.

| Criterion | Re-run | Evidence |
|---|---|---|
| AC-P05-01 | PASS | Suite exit 0: locked install, lint, strict typecheck, 10/10 Vitest tests in each frontend job, and build passed. Preview served without backend. |
| AC-P05-02 | PASS | 21/21 Playwright tests across three engines covered root/library/editor direct links, refresh, unknown URL and home recovery. |
| AC-P05-03 | PASS | Browser checks passed for desktop regions, 800 px tab mode and four keyboard-selected panels at 390 px. Independent keyboard check reached each panel. |
| AC-P05-04 | PASS | Axe WCAG 2.1 A/AA scans passed on four routes in three engines. New regression asserted no overflow after 200% CSS zoom at 390 px. Independent Chromium check measured 390/390 scroll/client width on all four routes and reached all panels and not-found recovery by keyboard. CSS zoom approximates browser zoom. |
| AC-P05-05 | PASS | Safe routed-error/recovery unit checks passed; source inspection confirmed silent caught-error handler and generic view text. |
| AC-P05-06 | PASS | Types regenerated before checks; ignored generated schema confirmed. Typed wrapper uses same-origin `/api/v1`; browser API-denial and external-request checks passed with zero shell API calls. |
| AC-P05-07 | PASS | Digest-pinned image built, served root/deep links as non-root, and OSV reported `No issues found`. Manifest list: `sha256:9a2d81c0bfa1a2b45fffea74330b6d8132eca0e7e8c3386dc9867840ee0c5bc0`. |

### Exact commands and exit codes

| Command | Exit | Result |
|---|---:|---|
| `bash docs/phases/P05/tests/suite.cmd` | 0 | 10/10 Vitest tests twice, 21/21 Playwright tests, image runtime/deep links and OSV scan passed. Two transient startup curl resets were retried successfully. |
| `npm run preview --prefix frontend -- --host 0.0.0.0 --port 4174` | 130 | Preview served the independent check, then stopped by Ctrl-C. |
| `git check-ignore -v frontend/src/shared/api/generated/*` | 0 | Generated schema ignored by `frontend/.gitignore`. |
| `git diff --check` | 0 | No whitespace errors. |
| `python3 scripts/phase-handoff-check.py --phase P05 --role qa-acceptance --worktree .` | 0 | `RESULT PASS`: QA role scope one file, blueprint check and four suite commands green. |

Independent browser command from repository root, exit 0:

```sh
pw_image=$(sed -n 's/^PLAYWRIGHT=//p' infrastructure/images.lock); docker run --rm --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/work" -w /work/tests/e2e "$pw_image" node --input-type=module -e 'import { chromium } from "@playwright/test"; const b=await chromium.launch({headless:true}); const p=await b.newPage({viewport:{width:390,height:844}}); for (const route of ["/", "/resumes", "/resumes/fixture-id/edit", "/missing"]) { await p.goto("http://127.0.0.1:4174"+route); await p.evaluate(()=>{document.body.style.zoom="2"}); const width=await p.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]); if(width[0]>width[1]) throw Error("overflow "+route+" "+width); console.log(route,"width",width.join("/")); if(route.includes("/edit")) for(const name of ["Sections","Edit","Preview","Design"]) { const tab=p.getByRole("tab",{name}); await tab.focus(); await p.keyboard.press("Enter"); if(await tab.getAttribute("aria-selected")!=="true" || !await p.getByRole("tabpanel",{name}).isVisible()) throw Error("panel "+name); console.log("panel",name,"keyboard reachable"); } if(route==="/missing") {await p.getByRole("link",{name:/home/i}).focus(); await p.keyboard.press("Enter"); if(new URL(p.url()).pathname!=="/") throw Error("home recovery"); console.log("home recovery /" );} } await b.close();'
```

Output: all four routes measured width `390/390`; all four panels were keyboard reachable; home recovery reached `/`. Three pinned engines passed automated smoke; the additional manual-style zoom check used Chromium. Shared Compose/CI/image-lock wiring remains the coordinator integration follow-up under DD-P05-06.

Verdict: PASS
