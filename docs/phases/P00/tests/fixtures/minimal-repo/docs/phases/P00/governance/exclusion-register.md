# Exclusion Register (fixture)

## Exclusions

| Excl ID | Source section | Excluded feature | Linked decision | Status | Guard phases | Guard verification | Allowed boundary |
|---|---|---|---|---|---|---|---|
| X1 | §3.2 | Alpha feature | — | EXCLUDED | P03 | contract review: no alpha endpoint in the contract | Native browser behaviour is allowed |
| X2 | §3.2 | Beta feature | D-03 | EXCLUDED-PENDING-DECISION | P04 | component test: no beta control is rendered | Static help text is allowed |
| FR-AAA-02 | §5.1 | Alpha two | — | EXCLUDED | P03 | guard review: no alpha two control in the workspace | Nothing else is excluded |

## Implied exclusions

| Source | Excluded behavior | Guard phases | Notes |
|---|---|---|---|
| FR-BBB-01 | No beta service | P04 | — |
| §9 F42 | No print control | P05 | — |

## Notes

Synthetic register.
