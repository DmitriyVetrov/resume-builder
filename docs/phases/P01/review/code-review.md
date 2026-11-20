# Code Review — P01 (architecture review, one pass)

- Reviewer: Code Reviewer (Orca worker, task `task_3a25f1c62ac0`), 2026-11-02. Single pass (ADR-035 B-2).
- Target: `git diff main...HEAD` on `phase/P01` at commit `1d727be` (43 files, all documents).
- Inputs read: `CLAUDE.md`, `.claude/rules/*`, `.claude/agents/code-reviewer.md`, the `phase-code-review` skill, `PHASE.md`, `kickoff.md`, `architecture/phase-plan.md`, `architecture/domain-model.md`, `architecture/threat-model.md`, `decisions.md`, `acceptance-criteria.md`, `tests/test-plan.md`, `tests/check_p01.py`, `tests/test-results.md`, the 25 P01 ADRs (ADR-002…ADR-039), the register, `ARCHITECTURE.md` and `TRACEABILITY.md` diffs, and TECHNICAL-SPEC §2, §3, §5.1, §5.2, §5.11–§5.15, §8, §9, §10, §11, §12 and Appendix B.

Verdict: PASS

There are no blocker or critical findings. Three major findings are design gaps in accepted ADRs (idempotency guard, erasure on restore, cross-browser determinism gate). They do not invalidate the P01 architecture, but they must be closed before P02 freezes the contract, because M-1 changes contract semantics and M-3 changes the P10 go/no-go gate. The minor and info findings can go to the owning downstream phases.

## 1. Commands executed

| Command | Exit | Result |
|---|---|---|
| `python3 --version` | 0 | Python 3.13.5 |
| `python3 -B docs/phases/P01/tests/check_p01.py` | 0 | `RESULT PASS checks=12 negatives=21 failures=0` |
| `python3 scripts/check-blueprint.py` | 0 | `Checked 221 required files, 9 agents`, `Blueprint structure OK` |
| `git diff --name-only main...HEAD` filtered against phase-plan "Allowed paths" | — | no file outside the allowed paths |
| scratchpad probe (outside the repo): import `check_p01.py`, apply each of the 21 mutations, print the error messages | 0 | every negative produces exactly one message, and that message names the mutated item (e.g. `N-11d 1 \| ADR-029 status REQUIRED`) |
| `python3 scripts/phase-handoff-check.py --phase P01 --role code-reviewer --worktree .` | see §7 | run after writing this file |

## 2. Findings by severity

### Blocker
None.

### Critical
None.

### Major

**M-1. A document-write retry with the same key and a different body is acknowledged without being applied (NFR-10).**
- Where: `docs/blueprint/decisions/ADR-037-concurrency-idempotency-durability.md:26` (document writes keep only `lastWrite: {key, version, at}`), compared with `:27` (creates and uploads store a `requestHash` and return 422 on mismatch). `threat-model.md:88` (T-TA-07) says the request hash is compared in all cases, but ADR-037 does not do this for `PUT …/document`.
- Impact: if the client queue reuses an `Idempotency-Key` after it has coalesced newer edits into the body, the server returns 200 with the old version and ETag. The client then marks the newer edits "Saved", but they were never written. That is an acknowledged edit lost, which is a PHASE-GATES no-go class ("data loss"). The ADR-037 §4 queue rules (coalescing plus key reuse on retries) make this client mistake plausible. The threat model claims a mitigation that does not exist.
- Required fix (Solution Architect, before P02 freezes the contract): add `requestHash` (SHA-256 of the canonical body) to `lastWrite`. Same key and same hash → replay 200. Same key and different hash → 422 `idempotency_key_reused`. State in ADR-037 §4 that the key belongs to one immutable body, so coalesced edits always get a new key. P02 adds a contract test for this, and P07 adds a negative integration test.

**M-2. A restore can bring back resumes and photos the user deleted. The deletion ledger only lists accounts.**
- Where: `ADR-039-data-retention-and-deletion.md:29` and `:41` (the ledger holds only `{userId, deletedAt}`); `:46` (a restore re-applies the ledger "plus trash purges that are due"); `ADR-009-object-storage.md:29` ("Deleted photos … every restore re-applies the deletion ledger"); `threat-model.md:109` (T-ID-09 "purged resumes").
- Impact: three user actions remove data from live stores without a ledger entry: "Delete permanently" in the trash before 30 days, photo removal or replacement (FR-PHO-02), and snapshot expiry. A PITR or snapshot restore within the 30-day backup window brings back:
  - resumes the user deleted permanently: they reappear in the trash with `deletedAt` less than 30 days old, so they are not "due" for purge;
  - removed photo blobs: these become orphans, or come back attached if the resume document is restored from before the removal.
  ADR-009 §7 and T-ID-09 claim these cases are covered. They are not. For user-requested erasure (GDPR Art. 17) this is a privacy gap, though not a cross-user exposure.
- Required fix (Solution Architect; implemented in P13): extend the ledger to hold IDs only for permanent resume purges (`resumeId`, `ownerId`, `purgedAt`) and photo deletions (`photoId`, storage key prefix), with the same 35-day TTL. Alternatively, define a restore reconciliation step that also sweeps blobs that no live resume references. Then make ADR-009 §7, ADR-039 §4 and T-ID-09 say the same thing, and add both cases to the P13 restore drill.

**M-3. The ADR-010 go/no-go gate does not prove determinism across browsers, but the client-side export design depends on it.**
- Where: `ADR-010-shared-layout-engine-and-rendering.md:97-104`. G1 (parity) and G6 (determinism) are Node-only. G2 compares the preview in each browser with "the PDF raster" but does not say which PDF. G3 and G4 measure only Chromium, or "the browser" without saying which.
- Impact: PDF and TXT are written by whichever browser the user has, and NFR-05 lists four browser families. NFR-14 says the same version and settings *always* give the same PDF layout. FR-ACC-04 (ADR-010 §5, ADR-039 §6) assumes that a regenerated PDF equals an earlier export. All of this holds only if the PageModel is identical in Node, Chromium, Firefox and WebKit. That is plausible with the design (shaping from bundled fonts in JS or WASM), but the gate never tests it. Engine code can still pick up differences from `Intl`/ICU segmentation, `String.prototype.normalize`, the hyphenation data or float formatting, and the gate would pass anyway. NFR-03 also gives "TXT ≤ 1 s", and no criterion measures it.
- Required fix (Solution Architect, an ADR-010 §6 amendment; the gate runs in P10):
  - add a criterion G7: the PageModel hash, the PDF bytes and the TXT bytes are identical across Node, Chromium, Firefox and WebKit for the G1 fixtures, and G7 is required for Go;
  - state that G2 compares each browser's preview with the reference (Node) PDF;
  - name the reference browser and hardware for G3 and G4 (the CI runner as a stand-in for the NFR-01 "mid-range laptop");
  - measure G4 in WebKit as well as Chromium;
  - add TXT ≤ 1 s to G4.

### Minor

**m-1. The FR-ACC-04 "latest PDF/TXT" claim is overstated, and generating the archive in the browser has a cost nobody has assessed.**
- `ADR-010:28`, `ADR-009:25` and `ADR-039:56` say a regenerated PDF "equals the latest export" or "gives the same bytes". That holds only for the *current* document version and the *current* `engineVersion` and font versions. After a frontend release, or a later edit, the archive PDF differs from what the user actually downloaded.
- Also, a user at the limit (200 resumes, trash included) means 200 PDFs generated in one browser session. At the NFR-03 budget (5 s each for 4 pages) that is up to about 17 minutes, plus the memory for one zip, on phones too (NFR-05).
- Fix: record a `DELEGATED-DEFAULT` reading of FR-ACC-04 as "PDF/TXT of the current version, regenerated with the current engine". Have P13 define a streaming or batched archive build with progress, or allow the PDF part to be partial. FR-ACC-04 is a Should.

**m-2. The server-side data export is gated on e-mail verification, which may conflict with GDPR access and portability rights.**
- `ADR-013:16`, `ADR-036:51` and `threat-model.md:112` (T-ID-12: "unverified → 403"; T-EP-02 enforces it on the server).
- D-01 recommends verification "before the first export", meaning the product exports. Withholding an authenticated, re-authenticated user's own data (Art. 15/20) until they verify their e-mail address is a stronger restriction than the source asks for. Possession of the address says nothing about ownership of content the user typed in.
- Fix: either allow the JSON data export with re-authentication regardless of verification and gate only the PDF/TXT exports, or record the reason for the gate (anti-abuse) in ADR-013 and the GDPR table (threat model §6).

**m-3. Minimum lengths in the domain model contradict R-8 "No field is mandatory for saving" (FR-TYP-03).**
- `domain-model.md:67` (`Resume.title` 1…150) and `:104` (`ContactItem.text` 1…200), compared with `:191` (R-8).
- A contact item that was added but is still empty, or a title the user cleared, makes the full-document autosave fail with 400. Unless the client strips or normalises such values first, the queue stalls on a hard validation error.
- Fix (in the P02 schemas): either allow length 0 (empty contacts are skipped at render time, as empty sections are), or define a client normalisation rule and say how the queue surfaces a 400, rather than retrying it forever.

**m-4. Keeping only the last write key turns a lost response into a spurious conflict copy.**
- `ADR-037:26`. Sequence: tab A's write k1 succeeds (v2) but the response is lost. Tab B then writes k2 (v3). Tab A retries k1 and gets 412, because k1 is no longer `lastWrite.key`. Tab A then creates a conflict copy of content that was already saved.
- No data is lost, but the user sees a confusing extra copy.
- Fix: keep the last N keys (for example 5) in `lastWrite`, or have the client compare its body hash with the server's version before it creates a copy. Decide this in P07 or P08.

**m-5. Shared devices: cached thumbnails and photos are not covered by T-ID-06.**
- `ADR-010:33` caches thumbnails by `(resumeId, version)`, not per user. `ADR-009:19` serves photos with `Cache-Control: private, max-age=…`, so face images stay in the browser's disk cache. `threat-model.md:106` (T-ID-06) covers only drafts and queues.
- Fix: namespace the thumbnail cache by user ID, include it in the "remove local data from this device" action, and use a short `max-age` or `no-cache` with `ETag` for photo renditions. Add this to T-ID-06 (P08 and P11).

**m-6. Login before verification creates an account-enumeration residual that is not recorded.**
- `ADR-036:48`. An attacker signs up with a victim's address and a password the attacker chooses, then tries to log in. Success means the address was new; failure means an account already exists. The ADR also does not say whether sign-up opens a session. If it does only for new addresses, the response itself reveals whether the address exists.
- Fix: state in ADR-036 §8 that sign-up never opens a session (the user logs in explicitly), and record the residual risk in threat model §8 (RR-6, low) or decide to accept it.

**m-7. No retention rule for accounts that are never verified.**
- `ADR-039` §1 retention table. Squatted or abandoned unverified accounts (T-SP-07) and their resumes are kept indefinitely. Under data minimisation (Art. 5(1)(c)/(e)) they need a policy.
- Fix: decide on expiry after N days with no verification and no activity, with notice to the address, or record an explicit acceptance (P13).

**m-8. Thumbnail cost versus NFR-02.**
- `domain-model.md:238`: the library projection carries no document, so client-side thumbnails (ADR-010 §9) need one full-document fetch per visible card, plus the engine and fonts on the library route. ADR-010 R-04 lazy-loads those on editor routes only.
- None of G1–G6 covers the NFR-02 p95 ≤ 2 s load of the library with thumbnails.
- Fix: add a library-load measurement to the P10 prototype or to the P11 plan, and consider a batched documents endpoint in P02.

**m-9. `check_p01.py`: robustness gaps. The checks are not weakened.**
- `check_p01.py:296` counts a negative as passing when it returns *any* error. The test plan (§2 item 7) asks that the message *names the mutated item*. The probe in §1 shows every negative currently fails for the right reason, so there is no false pass today, but the module does not enforce it. Fix: add an expected substring per negative.
- `check_p01.py:174`: the path comparison against `_file` is tautological on the real tree, because `load()` takes `_file` from the same PLAN §8 row. A missing ADR file on the real tree is still caught by `complete()` ("missing file"). N-10b exercises only the tautological branch.
- `check_p01.py:150` skips threat rows whose ID is malformed (for example `T-SP-1`), so such a row escapes the 7-cell and Phase checks.
- `check_p01.py:67`: the `"no" in cell` test also matches "not" or "now".
- Owner: Test Engineer. None of this blocks the gate.

### Info

- **i-1.** Test-plan §4 lists 20 negatives, but its total says 21. The module adds N-09d (a missing mandatory threat topic), which is extra coverage, and `test-results.md` records the difference. No action.
- **i-2.** AC-P01-11 was amended (PD-P01-09) by the owner of both the criterion and the register, before the tests were written. The options are recorded, and the exception is narrow (ADR-010 only; N-11d proves that `REQUIRED` fails for any other ID). This does not weaken a test to make it pass.
- **i-3.** ADR-008 puts "DTO mapping to contract types" in Application, which couples use cases to the HTTP contract. Consider mapping in Api and keeping Application on its own commands and results. P04 can decide this inside F-BE-2.
- **i-4.** F-BE-5 (no content types as log properties) cannot be enforced by NetArchTest or reflection over references. It needs a Roslyn analyzer, or it has to rely on the T-ID-05 log-scan test. P04 should name the mechanism.
- **i-5.** ADR-019 drops the country picker that the D-07 recommendation allows. This narrows scope and does not breach an exclusion. The reasoning (free-text Location, principle P2) is sound.
- **i-6.** Until P11, P07 and P10 show placeholder thumbnails (ADR-010 §9, DD-P01-32). FR-LIB-01 and FR-TPL-02 are Must requirements, so P07 and P10 acceptance must not claim them as complete.
- **i-7.** The authentication and partitioning of the client-event endpoint (NFR-13) are not defined. Can guests report? What is the cap on field sizes? This is a P02 item, and the threat model could add a log-poisoning row (T-TA).
- **i-8.** ADR-012 §1 includes "support access paths" in the residency rule. With US-parented processors this cannot be fully guaranteed, and RR-1 already covers it. P15 should verify the EU Data Boundary terms.
- **i-9.** OOS-04 (the `CLAUDE.md` suite command and the "Still open" list) remains with the Program Coordinator at gate close (kickoff §6).

## 3. ADRs compared with TECHNICAL-SPEC

| Area | Assessment |
|---|---|
| Client-side layout, no server export endpoints (ADR-010) | **Consistent with the spec.** The spec is stack-agnostic and does not require server-side export. FR-PRV-02 (same layout result) is met by construction: one PageModel feeds the painter and the PDF writer. NFR-01 and FR-PER-02 (offline) favour layout running where the user types. FR-PDF-01 (one click, no e-mail or share link), FR-PDF-02/03/05/08 (vector text, subset fonts, ToUnicode, link annotations, metadata, tagging through the PDFKit candidate), FR-PDF-07 (a 600 px rendition is about 600 dpi at the 70 pt box) and FR-PDF-09 (G4) are all addressed. FR-TXT-01…07 are met by a pure serializer over the canonical document that shares the date formatting code. NFR-08's "authorization on every export" is met because the server serves only owner-checked documents and photos. NFR-13 is met by content-free client events. FR-ACC-03 needs no export deletion. Gaps: M-3 (cross-browser determinism is not gated), m-1 (FR-ACC-04 reading and cost), m-8 (NFR-02 with thumbnails). The D-01 export gate becoming a client-side rule is correctly recorded as accepted risk T-EP-04 / RR-3 (own data only) |
| Persistence (ADR-004) | Consistent: NFR-10 (majority and journal ack, PITR for RPO ≤ 1 min, daily snapshots kept 30 days), EU region, a local replica set |
| Object storage (ADR-009) | Consistent: FR-PHO-01…05, NFR-08 (magic bytes, re-encode, EXIF removed), private, API-mediated. The ledger claim is M-2 |
| Auth (ADR-036, 013, 014, 015, 038) | Consistent: NFR-08 (adaptive hash from the framework, nothing invented), FR-ACC-02 (1 h reset), D-01/D-02/D-03 follow the §12 recommendations. See m-2 and m-6 |
| EU hosting (ADR-012, 033, 034) | Consistent with D-20 "EU" and NFR-09. Every service in the personal-data path is pinned to Germany West Central or North, or to the provider's "Europe" location. No trackers or CDNs (CSP) |
| Concurrency (ADR-037, 029) | SC-01 is reconciled correctly (reload with a notice plus a conflict copy keeps both versions). See M-1 and m-4 |
| Retention (ADR-039, 016) | FR-ACC-03 (≤ 24 h on live data), D-04 (30 days), NFR-10 (backup expiry) are consistent. See M-2 and m-7 |
| Domain model | Matches §10.1 and §10.2, field for field (checked against the spec text). The limits follow NFR-12. See m-3 |

## 4. Security and threat model

- STRIDE coverage is complete: 40 rows across the 6 categories and 7 trust boundaries. Each row has a mitigation, a reference, a phase and a verification.
- The four mandatory topics of `.claude/rules/03-security-privacy.md` are designed, not just named:
  - authentication: hashing, revocable sessions, fragment tokens, anti-enumeration, back-off;
  - guest claim: no guest backend, explicit confirmation, namespacing;
  - object storage: private, owner-checked, managed identity, opaque keys;
  - export endpoints: none on the server; the data export requires re-authentication, uses `no-store` and is rate-limited.
- No-content logging is covered by T-ID-05, F-BE-5 and the log-scan test. GDPR has a lawful-basis and retention table.
- Gaps found: M-1 (a mitigation T-TA-07 claims but the design lacks), M-2 (the restore claim in T-ID-09), m-5 (device caches), m-6 (enumeration residual), m-2 (export gate versus GDPR), i-7 (client events).

## 5. Scope and exclusions

- **Scope (AC-P01-14):** every changed file is under the phase-plan "Allowed paths": `docs/phases/P01/`, `docs/blueprint/decisions/`, `DECISION-REGISTER.md`, `ARCHITECTURE.md`, `TRACEABILITY.md`. Nothing in `docs/source/**`, `contracts/**`, `backend/**`, `frontend/**`, `scripts/**`, `.claude/**` or `CLAUDE.md` changed. No speculative endpoints were created; phase-plan §7 lists contract consequences only.
- **Exclusions (AC-P01-13, TECHNICAL-SPEC §3.2):** none is introduced.
  - ADR-019…ADR-022 keep X4, X8, X9 and X10 excluded.
  - No AI or phrase libraries (X1, X2), no score (X3), no questionnaire (X5), no more than three templates (X6), no share link or send-by-e-mail (X7; e-mail is transactional only, per ADR-034 §1), no upsell (X11).
  - The D-05 "sample resume" is left to P07, with an X2 warning (domain-model §10).
- **AC-P01-16 (Should):** `TRACEABILITY.md` has the required NFR, §8 and §9 rows, FR-ACC includes P13, and FR-LIB-06 includes P12. `ARCHITECTURE.md` references the accepted ADRs. Both are met.

## 6. `check_p01.py` quality

- The module stays within budget: 303 lines, stdlib only, no I/O beyond reads, deterministic, exit code is the suite result.
- All 12 checks and 21 negatives from the test plan are implemented. Each oracle constant comes from the acceptance criteria, not from the documents under test. The SPEC §10.1 cross-check guards against a spec re-baseline.
- The checks are **not weakened** against the test plan. The only change to an oracle (AC-P01-11, ADR-010 `REQUIRED`) is documented and narrow (i-2).
- Robustness improvements are in m-9.

## 7. Handoff check

`python3 scripts/phase-handoff-check.py --phase P01 --role code-reviewer --worktree .` is run after this file is written. Its result is reported to the coordinator in the `worker_done` message.

## 8. Next owner

- **Program Coordinator:** route M-1, M-2 and M-3 to the P01 Solution Architect (the same worker, ADR-035 B-2). The fixes are amendments to ADR-037, ADR-039 with ADR-009 and the threat model, and ADR-010 §6. A delta re-review then covers only those files. The alternative is to record them as P02 entry obligations in `decisions.md`.
- **Then:** QA / Acceptance. m-1…m-8 go to the phases named in each finding. m-9 goes to the Test Engineer (optional).

## 9. Delta re-review (fix loop 1, cycle 1 of 2)

- Reviewer: Code Reviewer (Orca worker, task `task_7bcebfd8d5d6`), 2026-11-02. Delta only (ADR-035 B-2).
- Target: `git diff c21ae71 HEAD` on `phase/P01` (HEAD `026ac0b`): 14 files, 114 insertions and 52 deletions, all documents. The files are ADR-009, ADR-010, ADR-036, ADR-037 and ADR-039; `DECISION-REGISTER.md`; `ARCHITECTURE.md`; and, in `docs/phases/P01/`, `domain-model.md`, `phase-plan.md`, `threat-model.md`, `decisions.md`, `coordinator-log.md`, `backend-tasks.md` and `frontend-tasks.md`.
- Scope: every changed file is under the phase-plan "Allowed paths" (§ Allowed paths, lines 171–177). Nothing changed in `docs/source/**`, `contracts/**`, `backend/**`, `frontend/**`, `scripts/**`, `.claude/**` or `CLAUDE.md`. The diff does not touch `tests/check_p01.py`, so the suite is unchanged.

### 9.1 Commands executed

| Command | Exit | Result |
|---|---|---|
| `git diff --stat c21ae71 HEAD` | 0 | 14 files, as listed above |
| `python3 -B docs/phases/P01/tests/check_p01.py` | 0 | `RESULT PASS checks=12 negatives=21 failures=0` |
| `python3 scripts/phase-handoff-check.py --phase P01 --role code-reviewer --worktree .` | see §9.5 | run after this section was written |

### 9.2 Major findings

**M-1: RESOLVED.**
- `ADR-037:26-31` binds a key to one immutable body, using a SHA-256 request hash over RFC 8785 canonical JSON. The hash applies to every keyed request, document writes included.
- `lastWrite` is now `{key, requestHash, version, at}`, and the comparison runs before `If-Match`:
  - same key and same hash → 200 replay;
  - same key and a different hash → 422 `idempotency_key_reused`, nothing written, never an acknowledgment;
  - any other key → a normal conditional write.
- The `ADR-037` §4 queue rule (`:35-36`) gives every coalesced body a new key, makes a retry resend the stored body byte-for-byte, and keeps edits locally on a 422 instead of showing "Saved".
- Tests are assigned: a P02 contract test, a P07 negative integration test (document, version and ETag unchanged) and a P08 queue test (`ADR-037` Consequences).
- The same fix appears in threat model T-TA-07, in domain-model §3.2 (`lastWrite`), in phase-plan §7 "Writes", in BE-OBL-06, FE-OBL-04 and the register row, and in DD-P01-33.
- The claimed mitigation and the design now agree. A coalesced edit can no longer be acknowledged without being written.

**M-2: RESOLVED.**
- Under `ADR-039` §3 (`:43-47`), every non-expiry deletion writes a ledger entry **before** it deletes anything:
  - account purge → `account` entry;
  - trash purge by the job, or "Delete permanently" at any time → `resume` entry;
  - photo removal or replacement → `photo` entry with its key prefix.
- The ledger cannot be rolled back by the restore it is applied to (`ADR-039` §4, `:45`). Each entry is mirrored to an append-only blob container that is outside the photo backup and outside every restore, and has its own 35-day lifecycle. A purge deletes nothing until both writes succeed.
- The restore reconciliation (`:46-52`) has six steps: load the ledger, then apply `account`, `resume` and `photo` entries, then purge due trash and expired snapshots, then sweep orphan blobs. The sweep also covers a database and a photo container restored to different points in time.
- The P13 drill now covers all five cases this review found: an erased account, a resume deleted permanently before 30 days, a resume purged by the job, a removed photo and a replaced photo.
- ADR-009 §7, T-ID-09, domain-model §7–§8 (the `deletion_ledger` collection with `kind` and `subjectId`), BE-OBL-06/09, the register row and DD-P01-34 all say the same thing. The ledger holds IDs, key prefixes and timestamps only (`ADR-039` Security/privacy impact).

**M-3: RESOLVED.** All five requested changes are in `ADR-010` §6 (`:100-114`):
- G7 (cross-runtime identity) checks that the PageModel hash, the PDF bytes and the TXT bytes are identical in Node, Chromium, Firefox and WebKit for the G1 fixtures × A4/Letter. G7 is required for Go, and the gate text defines what happens on a G7 miss.
- G2 compares each browser's preview with the raster of the reference PDF written in Node.
- G3 and G4 name their reference: a GitHub-hosted standard Linux runner with pinned browser builds, the hardware recorded, and one spot check on a mid-range laptop.
- G4 is measured in WebKit as well as Chromium.
- G4 adds TXT ≤ 1 s p95.

ADR-010 §7 (`:94-97`) also removes the likely sources of divergence by design:
- no `Intl`, `toLocaleString`, `localeCompare` or `normalize` calls;
- bundled data for line breaks, normalisation and hyphenation;
- no transcendental `Math` functions;
- a fixed-precision number formatter.

`ARCHITECTURE.md`, the register row, phase-plan §4 and FE-OBL-06 now say G1–G7, and DD-P01-35 records the decision. The prototype fixture set includes one photo (`ADR-010:98`), so G7 also covers the path that embeds the photo.

### 9.3 Minor findings addressed in the same loop

- **Fixed:**
  - m-1: DD-P01-36 adds a "current version, current engine" reading of FR-ACC-04, plus batched, cancellable, possibly partial archive building in P13.
  - m-3: DD-P01-37 sets length 0…N, and a 400 on autosave is not retried.
  - m-5: DD-P01-38 namespaces the thumbnail cache by user ID and serves photos `private, no-cache` with `ETag`.
  - m-6: DD-P01-39 states that sign-up never opens a session and records the residual as RR-6.
- **Routed with an owner:** m-2 → P06, m-4 → P07/P08, m-7 → P13, m-8 partly fixed (recorded in the P10 report; target owned by P11).
- **Not changed:** m-9 is optional for the Test Engineer.

I checked each fix against the text. None of them breaks a recorded decision. DD-P01-07, -12 and -14 are amended by new rows, not rewritten.

### 9.4 New findings introduced by the fixes

There are no new blocker, critical or major findings.

**m-10 (minor, new). The orphan sweep's "no live resume references" is ambiguous about the trash.**
- Where: `ADR-039:52` (§4 step 6).
- Impact: if P13 reads "live" as "active", every restore deletes the photo blobs of trashed resumes. Those resumes can still be restored within 30 days (D-04, ADR-016), so they would come back without their photos. This is a self-inflicted data loss, small in scope.
- Required fix (P13 Solution Architect, or a one-line ADR-039 clarification): "live" means any resume document present in the restored database, active or trashed. Add a trashed resume with a photo to the restore drill.

**i-10 (info).** The last line of `decisions.md` §6 says `ARCHITECTURE.md` "still says G1–G6". That is stale: commit `f4e1120` already changed it to G1–G7. The note is an appended record, so it should not be rewritten. A later appended line can mark it done.

**i-11 (info).** Snapshots (FR-PER-05) may reference a photo ID whose blobs a removal or replacement already deleted. Step 4 of the reconciliation clears `header.photo` only in restored resumes. This is not a privacy gap, because the blobs stay gone. P07 or P08 should still define what restoring such a snapshot does (render without the photo).

**i-12 (info).** `private, no-cache` (ADR-009 §2) stops reuse through the app without a session, but the bytes remain in the browser's disk cache. T-ID-06 and RR-4 (medium, with user guidance) cover the residual, and `no-store` was considered and rejected in DD-P01-38. No action.

### 9.5 Verdict

M-1, M-2 and M-3 are resolved. The fixes introduce no blocker, critical or major finding. m-10 goes to P13. i-10 through i-12 need no action in P01.

Verdict: PASS

Next owner: Program Coordinator → QA / Acceptance for P01.
