# Project boundaries

- `backend/` is owned by Backend Developer.
- `frontend/` is owned by Frontend Developer.
- `contracts/openapi/` is owned by Contract Architect; changes require API compatibility review.
- `tests/contract/` is owned by Contract/Test Engineer; implementation agents may not edit tests to make code pass.
- `tests/e2e/` is owned by QA/Test Engineer.
- `tests/rendering/` and `tests/fixtures/` are owned by Test Engineer; implementation agents may not weaken them.
- `docs/source/` is owned by the product owner; agents do not edit it.
- `docs/blueprint/` and `docs/phases/` are owned by Architect/PM roles.
- Cross-boundary changes require explicit task assignment and list of allowed files.
- Generated code must be regenerated from source contract; never hand-edit generated artifacts.
