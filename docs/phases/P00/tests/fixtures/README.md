# Fixtures for the P00 checks

Every file under `minimal-repo/` is synthetic. It holds no real or personal data and no copy of
real deliverable content. It is a miniature repository with the same relative paths as the real one.

- `minimal-repo/` is valid for every check, the gate checks included (TC-P00-22-01), and is the base
  for the mutation catalogue NF-xx in `p00_fixtures.py`.
- Fixtures are static. No test regenerates them. If a fixture source file changes, the digests and
  sizes in `minimal-repo/docs/phases/P00/governance/source-inventory.md` must be recomputed in the same change.
- PII-like strings are never stored on disk. The mutations build them at run time from parts.
