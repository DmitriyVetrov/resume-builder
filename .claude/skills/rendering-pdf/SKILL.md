---
name: rendering-pdf
description: Rules for the shared preview/PDF layout engine and exports. Use when working on pagination, layout, fonts, PDF or TXT export, or rendering fixtures (FR-PRV, FR-PDF, FR-TXT, NFR-14).
---

# Rendering Pdf

Maintain one deterministic layout contract for preview and PDF. Test page geometry, fonts, line breaks, page breaks, Unicode, links and image placement against fixtures.

Source rules: `docs/source/TECHNICAL-SPEC.md` §6 (T1 design), §8 (pagination), §9 (TXT grammar), FR-PRV-02 (preview/PDF parity), NFR-14 (determinism, bundled fonts).

## Mandatory references
- `CLAUDE.md`
- `.claude/rules/` (loaded automatically)
- `docs/blueprint/PROJECT-CHARTER.md`
- Current phase package under `docs/phases/`
