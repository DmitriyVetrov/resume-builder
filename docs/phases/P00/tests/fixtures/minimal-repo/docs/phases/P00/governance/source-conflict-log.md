# Source-Conflict Log (fixture)

## Log

| Conflict ID | Seed | Type | Sources | Summary | Affected IDs | Blocks P00 | Proposed handling | Status | Decider | Preparer | Needed by | Deadline | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SC-01 | K-01 | spec-vs-research | TECHNICAL-SPEC.md §5.1; README.md §2 | Two sources disagree about alpha behaviour | FR-AAA-01, D-01 | no | Owner decides between the listed options | OPEN | Product owner | Solution Architect (P02) | P02 | before P02 implementation | — |
| SC-02 | K-02 | ambiguity | TECHNICAL-SPEC.md header; DECISION-REGISTER.md ADR-004 | The spec state is unclear | D-01 | yes | Owner confirms the baseline | RESOLVED-BY-OWNER | — | — | — | — | decisions.md §4 |
| SC-03 | — | missing-reference | TECHNICAL-SPEC.md header; reference/README.md header | Paths docs/legacy/cv.pdf and .claude/skills/fixture/notes.md are not inventoried | D-02 | no | Owner decides whether to copy the files | OPEN | Product owner | Solution Architect (P00) | P01 | before P00 gate | — |
| SC-04 | — | spec-vs-research | TECHNICAL-SPEC.md §3.2; README.md §1 | The spec outranks the research | X1 | no | None needed; owner confirms at the gate | RESOLVED-BY-HIERARCHY | — | — | — | — | — |

## Notes

Synthetic log.
