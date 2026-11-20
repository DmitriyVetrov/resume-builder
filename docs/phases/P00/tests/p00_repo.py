"""Read-only repository abstraction for the P00 checks.

Standard library only. Nothing in this module writes to disk.
"""
import hashlib
import os
from pathlib import Path
from typing import NamedTuple


class Finding(NamedTuple):
    """One check result. Sorting is by (tc_id, code, location, detail)."""

    tc_id: str
    code: str
    location: str
    detail: str


def find_real_root():
    """Walk up from this file to the first ancestor that looks like the repository root."""
    here = Path(__file__).resolve().parent
    for cand in [here] + list(here.parents):
        if (
            (cand / "docs" / "source" / "TECHNICAL-SPEC.md").is_file()
            and (cand / "scripts" / "check-blueprint.py").is_file()
            and (cand / ".claude").is_dir()
        ):
            return cand
    raise RuntimeError("repository root not found")


class Repo:
    """Repository view with optional in-memory overrides.

    overrides maps a POSIX relative path to replacement text, or to None for
    "deleted". Every read, size and digest honours the overrides.
    """

    def __init__(self, root, overrides=None):
        self.root = Path(root)
        self.overrides = dict(overrides or {})
        self._memo = {}

    def memo(self, key, fn):
        if key not in self._memo:
            self._memo[key] = fn()
        return self._memo[key]

    def exists(self, rel):
        if rel in self.overrides:
            return self.overrides[rel] is not None
        p = self.root / rel
        return p.is_file() and not p.is_symlink()

    def is_dir(self, rel):
        return (self.root / rel).is_dir()

    def read_bytes(self, rel):
        if rel in self.overrides:
            val = self.overrides[rel]
            if val is None:
                raise FileNotFoundError(rel)
            return val.encode("utf-8") if isinstance(val, str) else bytes(val)
        return (self.root / rel).read_bytes()

    def read_text(self, rel):
        return self.read_bytes(rel).decode("utf-8")

    def size(self, rel):
        return len(self.read_bytes(rel))

    def sha256(self, rel):
        return hashlib.sha256(self.read_bytes(rel)).hexdigest()

    def list_files(self, rel_dir):
        """Recursive regular files under rel_dir, POSIX relative paths, code-point sorted."""
        base = self.root / rel_dir
        found = set()
        if base.is_dir():
            for dirpath, dirnames, filenames in os.walk(base, followlinks=False):
                dirnames.sort()
                for name in sorted(filenames):
                    full = Path(dirpath) / name
                    if full.is_symlink() or not full.is_file():
                        continue
                    found.add(full.relative_to(self.root).as_posix())
        prefix = rel_dir.rstrip("/") + "/"
        for rel, val in self.overrides.items():
            if rel.startswith(prefix):
                if val is None:
                    found.discard(rel)
                else:
                    found.add(rel)
        return sorted(found)
