# P07 UI and UX Design — Resume Library

- Authority: [UI and UX design planning](../../../blueprint/UI-UX-DESIGN.md), TECHNICAL-SPEC §5.2, §3.2, FR-SEC-01, NFR-05/06. Visual system: [P06 ui-ux-design.md](../../P06/architecture/ui-ux-design.md), extended here, not replaced.
- Scope: `/resumes`, `/resumes/trash` and their dialogs. The editor route stays the P05 placeholder until P08. Source screenshots are evidence, not pixel baselines.

## Screen and reference map

| Screen or interaction | Source IDs | Reference and disposition |
|---|---|---|
| Library header and cards | FR-LIB-01/03/05 | [03-dashboard-resumes.png](../../../source/img/03-dashboard-resumes.png): **adapt** large heading, primary "Create new resume" on the right, two-column card rhythm, card title with updated date, thumbnail on a soft field, actions beside it. **Exclude** "Claim your URL" banner, Quick Actions rail, cover letters, Email, Unpublish and notifications (X3, X7, X11). |
| Create dialog | FR-LIB-02 | [05-create-new-modal.png](../../../source/img/05-create-new-modal.png): **adapt** contained modal, title, one explanatory line, selectable resume list, footer with "Start from scratch" and a primary action enabled only after a choice. **Exclude** the default-forward orange styling. Thumbnails in the list are omitted until P11. |
| Rename, delete and purge dialogs | FR-LIB-03/04 | Same modal language; [68-delete-section-confirm.png](../../../source/img/68-delete-section-confirm.png) for the plain confirmation tone. New screens. |
| Trash view | FR-LIB-04, ADR-016 | No reference: new, in the same system. |

No wizard, questionnaire, score, sample resume, publish, import or paywall affordance appears (X1–X11, ADR-017).

## Layout

Everything uses the P06 tokens in `shell.css` (`ink`, `surface`, `accent`, `line`, `panel`, `accent-soft`, `muted`, `danger`, `danger-soft`, `focus`), the system font stack, the 4 px spacing base, 16 px card radius and 44 px minimum targets.

```text
LIBRARY · ≥ 1024 px, content capped at 1120 px
┌ app header: brand · Resumes · Account ──────────────────────────────────────────┐
│ Resumes (h1, clamp 32–40 px)                          [+ Create new resume]     │
│ ─ My resumes ─ Trash ─   (tab links, aria-current=page, 1 px rule)              │
│ status region (polite; empty until something happens)                           │
│ ┌ card ───────────────────────────┐ ┌ card ───────────────────────────┐         │
│ │ Title (20 px, wraps)            │ │ …                               │         │
│ │ Last modified 3 Nov 2026, 12:00 │ │                                 │         │
│ │ ┌ soft field ─────────────────┐ │ │                                 │         │
│ │ │ ▭ page 112×158   [Open]      │ │ │                                 │         │
│ │ │   T1             Rename Copy │ │ │                                 │         │
│ │ │                  Delete      │ │ │                                 │         │
│ │ └─────────────────────────────┘ │ │                                 │         │
│ └─────────────────────────────────┘ └─────────────────────────────────┘         │
│                               [Load more]                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- Grid: `repeat(auto-fill, minmax(min(100%, 420px), 1fr))`, 24 px gap: two columns at 1280 and 1024, one at 390.
- Thumbnail placeholder: 112 × 158 px white page with `line` border, three muted bars and the template ID, `aria-hidden`; the template is also stated in text for assistive technology. At 390 px it stays beside the actions; actions wrap, none is hidden.
- Long or unbroken titles wrap with `overflow-wrap: anywhere`. An empty title shows `Untitled resume` in muted italic.
- Trash cards: same frame, "Deleted <date>", "N days left" (`Deletes today` at ≤ 0), actions Restore and Delete permanently. No Open: a trashed resume is read-only and the editor cannot save it.

## Behaviour

| Surface | Actions | States, feedback and focus |
|---|---|---|
| `/resumes` | Create; card Open, Rename, Copy, Delete; Load more | Heading renders immediately. Loading: skeleton with status text. Empty: "No resumes yet" plus "Create your first resume". Error: alert plus Retry, no stale cards hidden. 401: redirect to `/login?returnTo=/resumes`. Load more appends, keeps focus, moves it to the first new card. |
| Create dialog | Copy selected (primary, disabled until a choice), Start from scratch, Cancel | Native radio list of loaded resumes, title and date, hidden entirely when none exist. Initial focus Cancel. Success goes to the editor route. `limit_reached`: message with a link to Trash; dialog stays. Network failure keeps the same key and body for retry. |
| Rename dialog | Save, Cancel | Field prefilled and selected, help "Up to 150 characters", live count over the limit blocks Save with a field error. Loads the current document, sends only the title change. 412: "This resume changed elsewhere. Reload and try again." with the list refreshed. |
| Delete dialog | Cancel (initial focus), Move to trash (danger, last) | Explains 30-day restore. After success focus moves to the status message: "Moved to trash." with a Trash link. |
| `/resumes/trash` | Restore, Delete permanently, Load more | Empty: "Trash is empty". Restore returns focus to the status message. |
| Purge dialog | Cancel (initial focus), Delete permanently (danger, last) | States irreversibility. Duplicate submission is blocked while pending. |

Dialogs use the shared `Dialog` (native `<dialog>`, trap, Escape, focus return). Every server failure is mapped: `version_mismatch` and `not_found` refresh the list and explain; other errors use the shared message rules. Unknown `templateId` values render as text without crashing (FE-P02-04).

## Responsive, zoom and motion

No horizontal page scroll at 1280, 1024, 390 px or the 640 px zoom proxy; real 200% zoom is checked in QA. Dialog width `min(100% - 32px, 480px)`, its list scrolls and the footer stays reachable. Hover and focus surface changes are 150 ms and removed under `prefers-reduced-motion`.

## Evidence

Playwright screenshots with synthetic data: idle, empty, trash, create dialog and delete dialog at 1280 and 390 px, plus idle at 1024 px. Axe covers the same states in three browsers. QA compares with this document and records deviations.
