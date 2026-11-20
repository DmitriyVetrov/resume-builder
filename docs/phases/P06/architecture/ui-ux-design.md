# P06 UI and UX Design — Accounts and Shared Application System

- Owner: Solution Architect (delegated, ADR-035), 2026-11-03.
- Authority: [UI and UX design planning](../../../blueprint/UI-UX-DESIGN.md), TECHNICAL-SPEC §§2, 3.2, 5.1, 11 and Appendix A; P05 shell tokens in `frontend/src/app/shell.css`. The reference product has **no dedicated account screenshots**. Every P06 account screen below is a new design in a shared application style, not a reproduction of a reference route.
- Scope: finished P06 signup, verification, login, recovery, account settings, deletion and JSON export surfaces. P07 library and P08 editor reuse this application system; P14 verifies consistency. Resume-template type, colors and pagination are a separate P10–P12 system.

## Screen and reference map

| P06 screen or interaction | Source IDs | Exact visual reference and disposition |
|---|---|---|
| Public auth shell; sign-up and login | FR-ACC-01/02, NFR-05/06/08 | [03-dashboard-resumes.png](../../../source/img/03-dashboard-resumes.png): **adapt** simple top brand, confident heading and rounded white surfaces. **Exclude** publish/score/cover-letter/quick-action rail (TECHNICAL-SPEC §3.2 X7/X3). [15-contact-step.png](../../../source/img/15-contact-step.png): **adapt** generous field spacing and clear grouping; **exclude** wizard steps, progress, prefilled personal fields and advice panel (§5.3 single workspace; X5/X11). Account forms are new designs. |
| Verification pending, token success/failure and resend | FR-ACC-01, D-01/ADR-013 | [15-contact-step.png](../../../source/img/15-contact-step.png): **adapt** calm form hierarchy and feedback placement, with an email status panel instead of resume data fields; **exclude** stepper and automatic content. New screen. |
| Reset request and confirm | FR-ACC-02, ADR-036 | [15-contact-step.png](../../../source/img/15-contact-step.png): **adapt** labels, supporting text and action spacing; **exclude** photo/contact fields. New screen. |
| Account settings, re-auth, password change, data export | FR-ACC-02/04, NFR-09 | [70-finalize-formatting-tab.png](../../../source/img/70-finalize-formatting-tab.png): **adapt** compact application header and section navigation/selected state; **exclude** score, publish, email-resume, template controls and document typography (X3/X7). [22-preview-formatting-tab.png](../../../source/img/22-preview-formatting-tab.png): **adapt** inset group surfaces and clear panel headings; **exclude** template-specific settings. New screen. |
| Deletion confirmation; later guest claim prompt | FR-ACC-03/06, ADR-015/039 | [05-create-new-modal.png](../../../source/img/05-create-new-modal.png): **adapt** contained overlay, clear title, body and separated actions; **exclude** resume gallery and default-forward action. Use explicit destructive confirmation for deletion and explicit Save/Discard for a future local draft. New dialogs. |
| Future P07 library/P08 editor continuity | FR-LIB, FR-EDT-01/07 | [03-dashboard-resumes.png](../../../source/img/03-dashboard-resumes.png): **adapt** card rhythm, not dashboard promotions. [70-finalize-formatting-tab.png](../../../source/img/70-finalize-formatting-tab.png): **adapt** navigational hierarchy, not its wizard/finalize flow. [10-choose-template.png](../../../source/img/10-choose-template.png): **reuse only** a visible selected-state pattern and spacious card grouping for future design controls; **exclude** the filter gallery, recommendation badge and experience questionnaire (X5/X6). P07/P08/P10 own those finished screens. |

Research context: `docs/source/README.md` §§2.2–2.3 and §5 describe the dashboard, create modal, linear wizard and finalize page. TECHNICAL-SPEC §5.3 replaces that wizard with one editor workspace, and §3.2 excludes its promotions, import, publishing, scoring, phrase libraries and paywall. The source screenshots are visual evidence, **not pixel-equality baselines** for these new account screens.

## Visual system to establish in P06

The application should feel focused and refined: deep ink text, a restrained teal action color, pale blue-gray page canvas, warm neutral illustration fields, spacious cards and one clear primary action per view. The design uses overlapping soft background shapes only on auth pages; controls and content remain on opaque surfaces. It does not display sample resume text, a score, a completion percentage or decorative personal data.

Extend the existing Tailwind 4 `@theme` in `frontend/src/app/shell.css`, retaining the P05 `ink`, `surface`, `accent` and `line` roles so existing shell pages remain legible. Proposed additions and usage:

| Token / role | Value | Use |
|---|---|---|
| `--color-ink` | existing `#17283c` | Primary text |
| `--color-surface` | existing `#f5f7fa` | Page canvas |
| `--color-accent` | existing `#155e75` | Primary button/link and selected state; use white text |
| `--color-line` | existing `#c5d1dc` | Quiet dividers and fields |
| `--color-panel` | `#ffffff` | Cards, dialogs, form surface |
| `--color-accent-soft` | `#e5f3f3` | Selected navigation background and status panel; ink text |
| `--color-muted` | `#526577` | Supporting text; verify 4.5:1 on panel/canvas |
| `--color-warm` | `#f2eadf` | Auth illustration field only, never validation state |
| `--color-danger` | `#a33342` | Delete action/error text; white text only after contrast check |
| `--color-danger-soft` | `#fff0f2` | Destructive confirmation background; ink/danger text |
| `--color-focus` | existing focus amber `#b45309` | 3 px visible focus ring; verify 3:1 against adjacent surfaces |

Use a local-platform **system font stack** (`system-ui`, `-apple-system`, `Segoe UI`, sans-serif) for application text: no remote font request or new paid/licensed asset. Scale: 14 px auxiliary, 16 px body/form, 20 px card heading, 32–40 px page heading (clamp with viewport); line height 1.45–1.55. Use weight and spacing for expression, not a decorative display face. This is application typography only; preview/PDF use the versioned template fonts from their rendering phases. Cards: 16 px radius, 1 px line border and subtle shadow (`0 12px 32px rgb(23 40 60 / .08)`) on desktop; dialogs 20 px radius. Spacing uses a 4 px base, with 8/12/16/24/32/48 px steps. Form controls are at least 44 px high; buttons have 44 px minimum touch height. Keep one icon style: small authored inline SVG with 2 px strokes, no third-party icon package; visible text labels remain on critical actions and icon-only controls need accessible names. Decorative shapes are CSS, hidden from assistive technology.

Shared components live under `frontend/src/shared/ui/**`: `AppFrame`, `Surface`, `Button` (primary/secondary/danger), `TextField`, `PasswordField` with show/hide, `FieldError`, `StatusNotice`, `Badge`, `Dialog`, and `LoadingSkeleton`. Auth composition lives in `frontend/src/features/account/**` and route pages in `frontend/src/pages/**`; route/chrome tokens stay in `frontend/src/app/shell.css`. Components use native controls where possible. The P05 shell is an input; P06 finishes these shared controls so P07/P08 can reuse them. Do not add a UI kit or design-system dependency in P06 (DD-P06-08).

## Layout sketches and responsive rules

At 1280 px (and wider), auth pages use a 1120 px max-width canvas with a 44% warm visual/story region and a 56% white form region. The visual region contains only the brand line, one short benefit statement and abstract geometric shapes. The form column is capped at 480 px, vertically centered but scrollable. Account settings use an application header, a 220 px section nav and a main content column capped at 720 px.

```text
AUTH · ≥ 1024 px
┌──────────────────────────── application header / brand ────────────────────────────┐
│  warm quiet panel 44%             │  white account panel 56%                       │
│  large heading + abstract shapes  │  eyebrow → title → short help                  │
│  no resume preview or personal    │  labelled fields → inline errors               │
│  data                              │  primary action → recovery link                 │
└────────────────────────────────────┴────────────────────────────────────────────────┘

SETTINGS · ≥ 1024 px
┌──────────── brand / account menu / logout ─────────────────────────────────────────┐
│ section nav 220 │ account heading                                                 │
│ Profile         │ email status + resend                                            │
│ Security        │ password change (re-auth)                                        │
│ Your data       │ JSON download; separate danger zone → delete dialog             │
└─────────────────┴──────────────────────────────────────────────────────────────────┘
```

At exactly 1024 px retain two auth columns only if the form retains ≥400 px; otherwise stack. Below 1024 px, hide the decorative region but keep its headline as concise form intro. Settings nav becomes an accessible horizontal list with visible active state and wrapping, not a hidden menu. At 390 px use 16 px horizontal padding, single column, full-width primary button, 16 px field labels/body, no side illustration, no fixed-height cards, and no horizontal document scroll. Dialog width is `min(100% - 32px, 480px)`, max height within viewport with its own scroll and visible actions. Long email addresses wrap without widening cards. At 200% zoom on a 1280 px viewport the effective layout is narrow: all actions remain visible/reachable without horizontal scrolling, except a future document preview canvas which P11 governs. The editor's P05 three-panel layout at ≥1280 and panel tabs below 1024 remain the P08 target; P06 must not restyle it into a wizard.

## Screen behavior and states

| Route / surface | Primary and secondary actions | Required states, feedback and focus |
|---|---|
| `/sign-up` | Create account; link to Log in | Email and password fields, password rules, inline validation; submitting disables only submit and shows progress. Generic 202 goes to `/verify-email` pending state, without implying whether an address exists. Focus heading on navigation and first invalid field after failed submit. Do not log or persist password. |
| `/verify-email#t=…` and pending view | Verify when fragment present; resend with email; link to Log in | Capture and clear fragment, `no-referrer`; pending/sending/sent/success/invalid-or-expired. Generic resend feedback; token error offers resend. `emailVerified` refreshes after success. Status announced once in a polite live region. No raw token shown. |
| `/login` | Log in; links to Sign up and Forgot password | Loading, generic invalid credentials, throttled retry message derived from 429, authenticated redirect to original same-origin route or library. Show unverified badge and resend entry after login. Password paste/autofill allowed. |
| `/reset-password` and `/reset-password/confirm#t=…` | Request link; set new password | Generic request success; confirm validates password policy, handles invalid/expired token with new-request link, clears fragment/form after result, returns to login after success. No token in URL query, analytics or error view. |
| `/account` | Change password; Download account data (JSON); Delete account | Section nav plus email status. Re-auth dialog precedes sensitive actions and shows the five-minute freshness boundary through result feedback, not a countdown. Unverified download is disabled with explanatory text and resend link. Download states: preparing, success, recoverable error; never display JSON contents. |
| Delete dialog | Cancel; Delete account (danger) | Dialog states: explanation of ≤24 h live purge, password confirmation/reauth if needed, pending request, accepted sign-out. No preselected destructive action; initial focus on heading or Cancel, destructive button last. Escape/Cancel returns focus to trigger before submission. During submission prevent duplicate request and announce outcome. |
| Guest claim seam (P08 integration) | Save draft to account; Discard draft; Later | Only render when a local draft summary is provided. Show the draft title as escaped text, never send without explicit Save. P08 handles storage, 200-limit failure and deletion of local draft after confirmed server success; P06 styles the prompt and supports keyboard focus/return. |

Global states: `GET /session` bootstrap shows a quiet skeleton, never a flash of protected content. Network/offline failures offer retry and preserve typed non-secret email, but clear password/token fields on completion or route change. A 401 returns to login with a safe local return path; a 403 CSRF error refreshes session/CSRF before retrying only when the user explicitly retries. Unknown API Problem codes use a generic recoverable message. Re-auth and deletion dialogs use native `<dialog>` or an equally complete focus trap; close returns focus to the trigger. Error text and borders identify the affected field without color alone. Links/actions keep consistent labels across account pages.

## Motion, accessibility and visual evidence

Use 150 ms ease-out hover/focus surface changes and at most 180 ms panel entrance with opacity/translate ≤4 px; no auto-playing animation, parallax or loading spinner that conveys the only status. Under `prefers-reduced-motion: reduce`, remove nonessential transitions/translation and use instant state changes. Preserve P05 skip link and 3 px focus ring. WCAG 2.1 AA target: semantic headings/landmarks, programmatic labels, `aria-invalid`/`aria-describedby`, status/live announcements, 4.5:1 normal-text contrast, 3:1 UI/focus contrast, keyboard-operable dialog/actions and logical focus restoration. Validate token colors on their actual surfaces. Allow password managers, paste and `autocomplete` values (`email`, `new-password`, `current-password`). Never require a visual puzzle/CAPTCHA.

Test Architect adds bounded visual/interaction coverage to `tests/test-plan.md`: representative 1280/1024/390 px states, 200% zoom, keyboard focus/dialog flow, screen-reader names/live status and reduced-motion behavior. Test Engineer writes assertions before implementation using synthetic accounts and local fixtures; stable Playwright screenshots of login idle/error, verification success/failure, settings and deletion dialog at desktop and phone support human review. Capture screenshots locally or as CI artifacts without real contact data, token fragments or downloaded archive bytes. Reference images are not target golden files. Frontend Developer reports intentional visual deviations with reason and updated local evidence; Code Reviewer and QA compare the rendered UI to this document and the local P06 evidence. P14 rechecks cross-phase consistency, browser matrix and visual regression; it does not postpone P06 styling.
