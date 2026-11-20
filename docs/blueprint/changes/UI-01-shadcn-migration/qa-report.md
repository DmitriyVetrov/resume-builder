# UI-01 Acceptance

Walked on 2026-11-08 against the production build (`vite preview`) with the synthetic E2E API, in
Chromium at 1280 px, light and dark, plus the automated evidence in `test-results.md`.

| ID | Result | Evidence |
|---|---|---|
| AC-UI-01 tokens only | PASS | T-04 over all application CSS/TSX incl. `shared/ui/` components; only the tweakcn block and `document color` lines hold literals. |
| AC-UI-02 theme visible | PASS | E-02: the Log in button background is the computed `--primary`, its text `--primary-foreground`, in all three browsers. Login, library, editor, Design tab, dialog and account screens inspected in both schemes. |
| AC-UI-03 scheme preference | PASS | T-01, T-02; E-01 (dark OS → dark), E-03 (switch to Light survives reload and overrides the OS; System returns to the OS). |
| AC-UI-04 shadcn primitives, dialog behavior | PASS | T-03; the unchanged account, library, editor and rich-text dialog tests (initial focus, Escape, busy, focus return, Undo focus after delete). |
| AC-UI-05 axe in dark | PASS | E-04 on login, library and editor; the existing light-scheme axe specs (P06, E07, E17, T10, Y09, Q11, E10) all pass. |
| AC-UI-06 document unthemed | PASS | E-05 (sheet `rgb(255, 255, 255)` in dark); `design.spec.ts` Y10 page screenshots match unchanged; rendering gate G2/G7, reference and export checks PASS. |
| AC-UI-07 no behavior change | PASS | Full frontend and E2E jobs green. Test changes are limited to DD-UI-04 (dialog located by role) and DD-UI-13 (`includeHidden` for one state behind the modal), both reviewed in R1/R2. |

Verdict: PASS

Known limits: a stored Dark preference can show one light frame before the bundle runs (DD-UI-08).
Checkbox, radio, range, the editor tabs and the export `<details>` stay native, styled by tokens
(DD-UI-07); replacing them is a behavior change for a later phase to decide.
