# P08 Architecture Plan — Editor Workspace & Autosave

- Operator session, ADR-051, batch P08+P09 on branch `phase/P08+P09`, 2026-11-05. Tier: Claude Opus, effort `high` (AGENT-WORKFLOW "Model and effort").
- Dependencies: P07 is `COMPLETED`.
- Contract: `contracts/openapi/openapi.yaml` 1.0.0, frozen by P02. **No contract change** (step 2 skipped; P02 phase-plan §9.4: "P08 consumes P07 operations"). Backend: no production change.
- UI: [ui-ux-design.md](ui-ux-design.md). Decisions: [decisions.md](../decisions.md). Acceptance: [acceptance-criteria.md](../acceptance-criteria.md).

## Scope

| Source | P08 responsibility | Acceptance |
|---|---|---|
| FR-EDT-01…08 | Three-panel workspace, top bar, narrow tabs, leave warning. The preview panel shows a **structural draft** until P11; Design tab controls are P10; export actions are P12 (DD-P08-01, DD-P08-02) | AC-P08-01…05 |
| FR-LIB-05 | Open at the last selected section | AC-P08-03 |
| FR-HDR-01…06 | Header form, contact list, auto-link hint, kind hint | AC-P08-06 |
| FR-SEC-01…11 | Add, rename, reorder, hide, delete with undo, empty marker, entry and item reorder, type change, duplicate, list columns | AC-P08-02, 07–10 |
| FR-TYP-01…03, D-11 | Four forms, entry fields, editable labels, date warning | AC-P08-11 |
| FR-PER-01…05, NFR-10, ADR-037 §4, ADR-029 | Autosave queue, local drafts, conflict copy, document undo/redo, version history | AC-P08-12…17 |
| FR-PHO-01…05, DD-P07-06 (carried in from P07) | Upload with a local size check, crop, replace, remove, show toggle | AC-P08-18 |
| T-ID-06 | Local data namespaced by user, sign-out offers removal | AC-P08-19 |
| NFR-06, NFR-05, UI-UX-DESIGN | Keyboard, focus, axe, zoom, three browsers, finished visual design | AC-P08-20 |
| §3.2 | Nothing excluded is built | AC-P08-21 |

Out of scope: rich-text toolbar, paste and links (P09); template, colour and layout controls, `language` and `dateFormat` controls (P10); pagination, zoom and the real preview (P11); export and the FR-TYP-03 export check (P12); `reportClientEvents` (P11, DD-P08-07); scheduled recovery and restore drills (P13).

## Component boundaries

F-FE-2 layering. Types come only from the generated contract types.

**`entities/resume`** (pure, no React, usable by P10–P12): `index.ts` (existing), `operations.ts` (immutable document edits), `contact-link.ts` (FR-HDR-04), `safe-url.ts` (R-6, needed here for the contact link override and by P09's link dialog), `local-data.ts` (per-user IndexedDB drafts and last-section IDs, including the removal used at sign-out).

**`features/editor`** owns all editor state:

- `autosave.ts` — `AutosaveQueue`, the one write path of a resume in a tab. All I/O is injected, so it is a pure state machine under fake timers.
- `history.ts` — undo and redo over immutable documents.
- `session.ts` — `EditorSession`: document, selection, photo, history, queue, notices. Exposes `subscribe` and `getSnapshot` for `useSyncExternalStore`. **The single owner of local editor state:** forms never copy document values into local state.
- `crop.ts` — pure crop arithmetic.
- `Workspace.tsx` (top bar, panels, route page), `SectionPanel.tsx`, `forms/*`, `PhotoPanel.tsx`, `PreviewPanel.tsx`, `VersionHistory.tsx`, `useReorder.ts`, `controls.tsx`, `editor.css`.

**`features/account`**: the sign-out flow calls `entities/resume/local-data`. **`app/App.tsx`**: route wiring, the placeholder `Editor` removed.

## Key semantics

**Autosave queue** (ADR-037 §4). Debounce 750 ms. One attempt at a time: `{body, key, version}`, persisted before sending.

| Answer | Queue behaviour | Status |
|---|---|---|
| 2xx | Version from the response; if the local document moved on, a new attempt with a **new key** | Saved or Saving… |
| Network failure | Keep the attempt; retry the **same bytes and key**, backoff 1 s doubling to 30 s with jitter, immediately on `online` | Offline, changes kept locally |
| 5xx, 429, in-flight 409, CSRF 403 | Same, honouring `Retry-After` | Server unavailable, changes kept locally |
| 412 | Conflict flow | — |
| 409 `resume_trashed`, 404 | Conflict flow, then the read-only or gone state | — |
| 422 `idempotency_key_reused` | Client defect: drop the key, retry with a new key after backoff; **never** "Saved" until a real 2xx | Not saved |
| 400, 413, 428 | Not retried (R-8). Kept locally, field path shown, next edit tries again | Not saved: <where> |
| 401 | Keep the attempt, stop, link to log in. The draft replays the same key afterwards | Session expired |

An attempt whose outcome is unknown is resolved by replay **before** any newer body is sent. Sending a newer body first could answer a false 412 when the lost request had in fact applied (DD-P08-04).

**Conflict flow** (ADR-029). No unsynced edits: reload the latest with the ADR's notice. Unsynced edits: persist a `createResume` attempt (`source: document`, title `<title> (conflict copy)`, `copyPhotoFromResumeId`, one key), send it, then reload the latest with a notice linking to the copy. Failure (offline, `limit_reached`): the edits stay, the notice offers "Retry saving as a copy" and "Discard my changes".

**Local drafts** (DD-P08-05). One IndexedDB row per user, resume and tab: `{document, baseVersion, attempt, copyAttempt, updatedAt}`, removed when clean. On open: rows of tabs that are not alive (Web Locks) are recovered. The newest is adopted into the queue, which replays or conflicts naturally; older ones become conflict copies.

**History.** One document-level stack (DD-P08-03): at least 100 steps of immutable documents with shared structure, bursts in the same field coalesced within 1 s, selection restored with each step. Photo operations are server operations, confirmed separately, and not on the stack. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and `beforeinput` `historyUndo`/`historyRedo` are captured at workspace level, so native input undo cannot desynchronise a controlled field.

**Photo operations** go through `queue.runExclusive`: the queue drains, then the operation runs with the current version and stores the new one (one writer per tab, DD-P08-10).

## Risks

| Risk | Handling |
|---|---|
| Lost acknowledged edit, false "Saved" | State-machine tests per row above; E2E with lost responses and real reloads; a fixture API that enforces key, hash and `If-Match` and records violations |
| Duplicate conflict copies after a crash | The copy attempt is persisted before sending and replayed with the same key |
| Two tabs overwriting one draft | Rows per tab; liveness through Web Locks |
| Selection-less keyboard users cannot reorder | Up and down buttons with focus kept on a usable control and a live announcement |
| Editor state split between forms and session | Forms are controlled from the session snapshot only |
| P05 placeholder tests encode the placeholder | Recorded exception DD-P08-12, replaced by stronger tests |

## Slices and test budget

Vitest ≤ 70 cases, E2E ≤ 18 scenarios per browser, in the existing projects (`features/editor`, `entities/resume`, `tests/e2e/editor.spec.ts`). No new framework. **Recorded at step 5:** Vitest is 91 new cases, over the budget of 70, because 20 of them are table rows (`C01`, `O08`, `A07`, `A15`) that each name one rule, and the queue's answer table alone is 27 cases; merging rows would hide which rule broke. They run in milliseconds. E2E is 18 as planned. A real-stack acceptance spec (`tests/e2e/real-stack/`) runs in step 7 and is not part of the fixture suite.

| # | Slice | Depends on |
|---|---|---|
| 1 | Document operations, contact link, crop arithmetic, history | — |
| 2 | Autosave queue, local drafts, conflict flow | 1 |
| 3 | Session, workspace, top bar, section panel, preview | 1, 2 |
| 4 | Forms: header, contacts, four section types, entries | 3 |
| 5 | Photo and version history | 2, 3 |
| 6 | Sign-out local data, design pass, accessibility | 3 |

## Task list

1. Declaration seams (pure function signatures with throwing bodies, an inert route), tests, red evidence.
2. Implement slices 1–6; narrow tests continuously; `docs/phases/P08/tests/suite.cmd`.
3. Hand over to P09 steps 4–5 on the same branch; steps 6–8 run once for the batch.

## Allowed paths

- `docs/phases/P08/**`
- `frontend/src/**`
- `frontend/README.md`
- `tests/e2e/**`
