# P08 Acceptance Criteria

Must criteria unless marked (S). Each is checked against the running system in `qa-report.md`.

| ID | Source | Observable criterion |
|---|---|---|
| AC-P08-01 | FR-EDT-01/05/06 | At 1280 px the section, editing and preview panels are visible. The preview panel has Preview and Design tabs. The top bar has an editable title, a save status, Undo, Redo and disabled Export PDF and Export TXT with a stated reason. An edit appears in the preview without a reload. |
| AC-P08-02 | FR-EDT-02, FR-SEC-07 | The panel lists Header and every section in document order with a type icon, title, hidden state and "empty" marker. Empty and hidden sections are absent from the preview. |
| AC-P08-03 | FR-EDT-03/04, FR-LIB-05 | Selecting a section opens its form and scrolls the preview to it within ±1 line. Clicking or activating a preview section selects it. Reopening the resume restores the last selected section; a deleted one falls back to Header. |
| AC-P08-04 | FR-EDT-07 | Below 1024 px there are tabs Sections, Edit, Preview, Design, and every function is reachable at 390 px with no horizontal page scroll. Selecting a section switches to Edit. |
| AC-P08-05 | FR-EDT-08 | No `beforeunload` prompt when everything is saved; a prompt when edits are unacknowledged. |
| AC-P08-06 | FR-HDR-01…05 | Full name ≤ 120, headline ≤ 200, contacts ≤ 200 with add, edit, reorder by drag and up/down, delete. E-mail gives `mailto:`, phone `tel:`, URL-like text `https://`, and `@handle` no link; the user can override. A kind hint can be set. Any characters are accepted. |
| AC-P08-07 | FR-SEC-02/03 | Add any number of sections of any of the four types with any title. Rename inline in the panel and in the form, ≤ 80, with letter case kept; the panel and preview update. |
| AC-P08-08 | FR-SEC-04/08, NFR-06 | Sections, entries and list items reorder by drag and by keyboard-reachable up and down, with no zone restriction and no date sorting. Focus stays on a usable control and the move is announced. Order is the same in panel, preview and saved document. |
| AC-P08-09 | FR-SEC-05/06/10 | Hide greys the section in the panel and removes it from the preview. Delete asks for confirmation and undo restores content and position. Duplicate (S) places the copy right after the original with new IDs, also for entries. |
| AC-P08-10 | FR-SEC-09 (S), FR-SEC-11 | Type change offers lossless conversions only and otherwise is disabled with a hint. List columns can be set to template default, 1 or 2 per section and is saved. |
| AC-P08-11 | FR-TYP-01/02/03, D-11 | All four forms exist. An entry edits title, organization, location, start, end or Present, date text, description and page break before. Start after end shows a warning and still saves. Field labels are editable per section and appear in the form only. Nothing is mandatory to save. |
| AC-P08-12 | FR-PER-01 | An edit is sent within 1 s of the last keystroke; reloading shows it. |
| AC-P08-13 | FR-PER-02, NFR-10 | Offline shows "Offline, changes kept locally", edits survive a reload of the draft, and everything syncs on reconnect without loss or duplicate write. |
| AC-P08-14 | ADR-037 §4, R-8 | One write in flight per tab. A coalesced body has a new key; a retry repeats bytes and key. A lost response never duplicates a version or shows a false conflict. 422 never shows "Saved". 400 is not retried and shows where. 401 keeps the edits and links to log in. |
| AC-P08-15 | FR-PER-03, ADR-029, DD-P08-06 | A stale tab without unsynced edits reloads with the ADR notice. With unsynced edits it creates `<title> (conflict copy)` once, reloads, and links to the copy. A failed copy offers retry and discard, and nothing is dropped without that choice. Trash and purge elsewhere behave the same. Tabs of one browser learn of new versions by `BroadcastChannel`. |
| AC-P08-16 | FR-PER-04 | At least 50 steps of undo and redo across content, structure and design by button and by Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z. Undone edits autosave. |
| AC-P08-17 | FR-PER-05 (S) | A version history lists snapshots, loads more, and restores one as an undoable edit. |
| AC-P08-18 | FR-PHO-01…05, DD-P07-06 | Upload JPEG, PNG or WebP. Over 5 × 1 048 576 bytes is refused locally with a message and no request; the server stays the authority for type and content. Crop with zoom and pan by pointer and keyboard. Replace, remove (with confirmation) and show or hide. Server answers are mapped to plain messages. |
| AC-P08-19 | T-ID-06 | Drafts and last-section IDs are namespaced by user ID, and another user on the device sees none of them. `localStorage` holds IDs only. Sign-out offers removal, warns if unsynced, and removes on request. |
| AC-P08-20 | NFR-05/06, UI-UX-DESIGN | Every action works by keyboard. Dialogs trap and return focus. Axe finds no WCAG 2.1 A/AA violation on the main states in three browsers. No overflow at 1280, 1024, 640 and 390 px; targets ≥ 44 px on narrow screens; reduced motion is honoured. The screens match `architecture/ui-ux-design.md`. |
| AC-P08-21 | §3.2, T-ID-05, T-ID-07, contract | No excluded feature or sample content. No resume content in the console or in URLs. No third-party request. `git diff main...HEAD -- contracts` is empty. |
