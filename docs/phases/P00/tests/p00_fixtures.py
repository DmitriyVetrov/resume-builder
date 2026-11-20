"""Mutation catalogue NF-01 ... NF-39 (test plan 8.3) plus added mutations NF-40 ...

Each mutation is a pure function from fixture text to mutated text, applied through
Repo(overrides=...). Nothing is written to disk. PII-like strings are built at run time.
"""
import hashlib
from pathlib import Path

from p00_md import split_row
from p00_repo import Repo

FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures" / "minimal-repo"

P0 = "docs/phases/P00/"
G1 = P0 + "governance/source-inventory.md"
G2 = P0 + "governance/requirements-traceability.md"
G3 = P0 + "governance/exclusion-register.md"
G4 = P0 + "governance/decision-owner-register.md"
G5 = P0 + "governance/source-conflict-log.md"
DECISIONS = P0 + "decisions.md"
STATUS = P0 + "PHASE-STATUS.md"
DEPS = P0 + "dependencies.md"
SPEC = "docs/source/TECHNICAL-SPEC.md"
PHASE03 = "docs/phases/P03/PHASE.md"


# ------------------------------------------------------------------ table editing helpers


def _table(lines, h2):
    start = lines.index("## " + h2)
    i = start + 1
    while not lines[i].startswith("|"):
        i += 1
    header = split_row(lines[i])
    rows = []
    j = i + 2
    while j < len(lines) and lines[j].startswith("|"):
        rows.append(j)
        j += 1
    return i, header, rows


def _row_index(lines, h2, key):
    _h, _header, rows = _table(lines, h2)
    for r in rows:
        if split_row(lines[r])[0] == key:
            return r
    raise KeyError("%s/%s" % (h2, key))


def _join(cells):
    return "| " + " | ".join(cells) + " |"


def set_cell(h2, key, col, value):
    """Edit: set column `col` of the row whose first cell is `key`. value may be a callable."""

    def edit(text):
        lines = text.split("\n")
        _hi, header, _rows = _table(lines, h2)
        r = _row_index(lines, h2, key)
        cells = split_row(lines[r])
        k = header.index(col)
        cells[k] = value(cells[k]) if callable(value) else value
        lines[r] = _join(cells)
        return "\n".join(lines)

    return edit


def delete_row(h2, key):
    def edit(text):
        lines = text.split("\n")
        del lines[_row_index(lines, h2, key)]
        return "\n".join(lines)

    return edit


def copy_row(h2, key, new_key=None, **cols):
    """Insert a copy of row `key` right after it, with a new first cell and optional column edits."""

    def edit(text):
        lines = text.split("\n")
        _hi, header, _rows = _table(lines, h2)
        r = _row_index(lines, h2, key)
        cells = split_row(lines[r])
        if new_key is not None:
            cells[0] = new_key
        for col, val in cols.items():
            cells[header.index(col.replace("_", " "))] = val
        lines.insert(r + 1, _join(cells))
        return "\n".join(lines)

    return edit


def sub(old, new):
    def edit(text):
        assert old in text, old
        return text.replace(old, new, 1)

    return edit


def set_header(h2, old, new):
    def edit(text):
        lines = text.split("\n")
        hi, header, _rows = _table(lines, h2)
        header[header.index(old)] = new
        lines[hi] = _join(header)
        return "\n".join(lines)

    return edit


def swap_header(h2, a, b):
    def edit(text):
        lines = text.split("\n")
        hi, header, _rows = _table(lines, h2)
        ia, ib = header.index(a), header.index(b)
        header[ia], header[ib] = header[ib], header[ia]
        lines[hi] = _join(header)
        return "\n".join(lines)

    return edit


def append(extra):
    def edit(text):
        return text + extra

    return edit


def drop_line(prefix):
    def edit(text):
        lines = text.split("\n")
        keep = [ln for ln in lines if not ln.startswith(prefix)]
        assert len(keep) == len(lines) - 1, prefix
        return "\n".join(keep)

    return edit


def chain(*edits):
    def edit(text):
        for e in edits:
            text = e(text)
        return text

    return edit


# ------------------------------------------------------------------ catalogue


class Mutation:
    def __init__(self, nf, edits, targets, note=""):
        self.nf = nf
        self.edits = edits  # list of (path, edit_fn or None for delete)
        self.targets = targets  # list of (tc_id, code or None, needle or None)
        self.note = note

    def overrides(self, repo):
        out = {}
        for path, fn in self.edits:
            out[path] = None if fn is None else fn(repo.read_text(path))
        return out


CATALOGUE = []


def add(nf, edits, targets, note=""):
    CATALOGUE.append(Mutation(nf, edits, targets, note))


def _digest_flip(text):
    lines = text.split("\n")
    r = _row_index(lines, "Files", "docs/source/README.md")
    cells = split_row(lines[r])
    h = cells[4]
    cells[4] = h[:-1] + ("0" if h[-1] != "0" else "1")
    lines[r] = _join(cells)
    return "\n".join(lines)


def _digest_upper(text):
    return set_cell("Files", "docs/source/README.md", "SHA-256", lambda v: v.upper())(text)


def _bytes_plus(text):
    return set_cell("Files", "docs/source/README.md", "Bytes", lambda v: str(int(v) + 1))(text)


def _pii_email():
    return "jane.roe" + "@" + "example.invalid"


def _pii_phone():
    return "+" + " ".join(["12", "3456", "789", "01"])


R = "Requirements"
A = "TC-P00-"

# AC-P00-07 / 08
add("NF-01", [(G2, delete_row(R, "FR-AAA-02"))], [(A + "07-01", "MISSING_ID", "FR-AAA-02")])
add("NF-02", [(G2, copy_row(R, "FR-BBB-01", "FR-ZZZ-99"))], [(A + "07-01", "INVENTED_ID", "FR-ZZZ-99")])
add("NF-03", [(G2, copy_row(R, "FR-AAA-01"))], [(A + "07-01", "DUPLICATE_ID", "FR-AAA-01")])
add("NF-04", [(G2, set_cell(R, "FR-BBB-01", "Pri", "M"))], [(A + "08-01", "WRONG_PRIORITY", "FR-BBB-01")])
add("NF-05", [(G2, set_cell(R, "FR-BBB-01", "Spec section", "§5.1"))], [(A + "08-01", "WRONG_SECTION", "FR-BBB-01")])
add("NF-06a", [(G2, set_cell(R, "FR-BBB-01", "Phases", "P04, P05, P16"))], [(A + "08-02", "INVALID_PHASE", "FR-BBB-01")])
add("NF-06b", [(G2, set_cell(R, "FR-BBB-01", "Phases", "P04, P00"))], [(A + "08-02", "INVALID_PHASE", "FR-BBB-01")])
add("NF-06c", [(G2, set_cell(R, "FR-BBB-01", "Phases", "P04, P3"))], [(A + "08-02", "INVALID_PHASE", "FR-BBB-01")])
add("NF-06d", [(G2, set_cell(R, "FR-BBB-01", "Primary phase", "P03"))], [(A + "08-02", "PRIMARY_NOT_IN_PHASES", "FR-BBB-01")])
add("NF-06e", [(G2, set_cell(R, "FR-BBB-01", "Phases", "P04,,P05"))], [(A + "08-02", "LIST_FORMAT", "FR-BBB-01")])

# AC-P00-15 / 16 deadlines (GOV-04)
RG = "Register"
add("NF-07a", [(G4, set_cell(RG, "ADR-008", "Deadline", "before P03"))], [(A + "15-03", "BAD_DEADLINE_GRAMMAR", "ADR-008")])
add("NF-07b", [(G4, set_cell(RG, "ADR-008", "Deadline", "Before P03 implementation"))], [(A + "15-03", "BAD_DEADLINE_GRAMMAR", "ADR-008")])
add("NF-07c", [(G4, set_cell(RG, "ADR-008", "Deadline", "2000-12-01"))], [(A + "15-03", "BAD_DEADLINE_GRAMMAR", "ADR-008")])
add("NF-07d", [(G4, set_cell(RG, "ADR-008", "Deadline", "before P00 implementation"))], [(A + "15-03", "INVALID_PHASE", "ADR-008")])
add("NF-08a", [(G4, chain(set_cell(RG, "ADR-003", "Deadline", "before P02 implementation"),
                          set_cell(RG, "ADR-003", "Preparer", "Solution Architect (P02)"),
                          set_cell(RG, "ADR-003", "Needed by", "P02")))],
    [(A + "16-01", "DEADLINE_AFTER_ANCHOR", "ADR-003")])
add("NF-08b", [(G4, set_cell(RG, "ADR-003", "Deadline", "before P01 gate"))], [(A + "16-01", "DEADLINE_AFTER_ANCHOR", "ADR-003")])
add("NF-08c", [(G4, chain(set_cell(RG, "ADR-008", "Needed by", "P02"),
                          set_cell(RG, "ADR-008", "Deadline", "before P03 implementation")))],
    [(A + "15-03", "DEADLINE_AFTER_NEEDED_BY", "ADR-008")])
add("NF-08d", [(G4, set_cell(RG, "ADR-008", "Deadline", "before P03 gate"))], [(A + "15-03", "DEADLINE_AFTER_NEEDED_BY", "ADR-008")])
add("NF-09a", [(G4, set_cell(RG, "D-01", "Status", "PROPOSED"))], [(A + "17-01", "STATUS_CHANGED", "D-01")])
add("NF-09b", [(G4, set_cell(RG, "D-01", "Status", "ACCEPTED"))],
    [(A + "17-01", "STATUS_CHANGED", "D-01"), (A + "17-01", "FORBIDDEN_STATUS", "D-01")])

# seeds (GOV-05)
LG = "Log"
add("NF-10a", [(G5, set_cell(LG, "SC-01", "Seed", "—"))], [(A + "19-01", "MISSING_SEED", "K-01")])
add("NF-10b", [(G5, set_cell(LG, "SC-01", "Sources", "TECHNICAL-SPEC.md §5.1; TECHNICAL-SPEC.md header"))],
    [(A + "19-01", "MISSING_SEED_TOKEN", "README.md §2")])
add("NF-10c", [(G5, set_cell(LG, "SC-04", "Seed", "K-01"))], [(A + "19-01", "DUPLICATE_SEED", "K-01")])

# AC-P00-03 / 01 / 23
add("NF-11a", [(G1, _digest_flip)], [(A + "03-01", "SHA256_MISMATCH", "docs/source/README.md")])
add("NF-11b", [(G1, _digest_upper)], [(A + "03-01", "BAD_DIGEST_FORMAT", "docs/source/README.md")])
add("NF-11c", [(G1, _bytes_plus)], [(A + "03-01", "BYTES_MISMATCH", "docs/source/README.md")])
add("NF-12a", [(G3, sub("Synthetic register.", "TBD"))], [(A + "01-03", "PLACEHOLDER_TOKEN", "TBD")])
add("NF-12b", [(G3, sub("Synthetic register.", "`TODO`"))], [(A + "01-03", "PLACEHOLDER_TOKEN", "TODO")],
    "no code-span exemption in GOV files")
add("NF-12c", [(DEPS, append("\nThe token `TBD` is quoted here as code.\n"))], [(A + "01-01", None, None)], "boundary, passes")
add("NF-12d", [(DEPS, append("\nPending phase execution\n"))], [(A + "01-01", "PLACEHOLDER_TOKEN", "Pending phase execution")])
add("NF-13a", [(G1, sub("Synthetic inventory of the fixture sources.", "Contact " + _pii_email()))],
    [(A + "23-01", "PII_EMAIL", None)])
add("NF-13b", [(G5, set_cell(LG, "SC-01", "Summary", "Two sources disagree " + _pii_phone()))],
    [(A + "23-01", "PII_PHONE", None)])
add("NF-13c", [(G2, set_cell(R, "FR-AAA-01", "Notes", "2026-10-24 " + hashlib.sha256(b"x").hexdigest() + " round(10×1.2) + 0.5"))],
    [(A + "23-01", None, None)], "boundary, passes")

# file-level rules
add("NF-20", [(G4, None)], [(A + "01-02", "MISSING_FILE", "decision-owner-register.md")])
add("NF-21", [(G3, sub("## Implied exclusions", "## Implied"))], [(A + "01-02", "MISSING_HEADING", "Implied exclusions")])
add("NF-22", [(G2, swap_header(R, "Phases", "Primary phase"))], [(A + "01-02", "BAD_TABLE_HEADER", None)])
add("NF-23", [(G2, set_cell(R, "FR-BBB-01", "Summary", "a | b"))], [(A + "01-02", "ROW_SHAPE", None)])
add("NF-24a", [(G5, lambda t: t.replace("\n", "\r\n"))], [(A + "01-02", "BAD_ENCODING", "source-conflict-log.md")])
add("NF-24b", [(G5, lambda t: "﻿" + t)], [(A + "01-02", "BAD_ENCODING", "source-conflict-log.md")])

# inventory
F = "Files"
add("NF-25a", [(G1, delete_row(F, "docs/source/img/02-beta.png"))], [(A + "02-01", "INVENTORY_MISSING", "02-beta.png")])
add("NF-25b", [(G1, copy_row(F, "docs/source/README.md", "docs/source/img/99-none.png"))], [(A + "02-01", "INVENTORY_EXTRA", "99-none.png")])
add("NF-25c", [(G1, copy_row(F, "docs/source/README.md"))], [(A + "02-01", "INVENTORY_DUPLICATE", "README.md")])
add("NF-26a", [(G1, set_cell(F, "docs/source/README.md", "Authority", "normative"))], [(A + "04-02", "AUTHORITY_RULE", None)])
add("NF-26b", [(G1, set_cell(F, "docs/source/README.md", "Kind", "photo"))], [(A + "04-01", "BAD_VOCAB", "README.md")])
add("NF-26c", [(G1, sub("- Spec version: 9.9 fixture", "- Spec version: 9.8 fixture"))], [(A + "04-03", "BASELINE_MISMATCH", "Spec version")])
add("NF-26d", [(G1, sub("- File count: 10", "- File count: 9"))], [(A + "04-03", "BASELINE_MISMATCH", "File count")])
add("NF-26e", [(G1, drop_line("- Spec status:"))], [(A + "04-03", "BASELINE_KEY_MISSING", "Spec status")])
add("NF-27a", [(G5, set_cell(LG, "SC-03", "Type", "ambiguity"))],
    [(A + "05-02", "UNRESOLVED_REFERENCE", "docs/legacy/cv.pdf"), (A + "05-02", "UNRESOLVED_REFERENCE", ".claude/skills/fixture/notes.md")])
add("NF-27b", [(SPEC, append("\nSee also `img/77-new.png`.\n"))], [(A + "05-02", "UNRESOLVED_REFERENCE", "img/77-new.png")], "source drift")
add("NF-27c", [(SPEC, append("\nSee also `img/01–04`.\n"))], [(A + "05-02", "UNRESOLVED_REFERENCE", "img/01–04")], "boundary")
add("NF-28a", [(G1, set_cell("Requirement ID census", "FR-AAA", "M", "2"))], [(A + "06-01", "CENSUS_MISMATCH", "FR-AAA")])
add("NF-28b", [(SPEC, sub("| FR-BBB-02 | C | Beta two | Directories `img/` and `export/` |",
                          "| FR-BBB-02 | C | Beta two | Directories `img/` and `export/` |\n| FR-BBB-03 | M | Beta three | |"))],
    [(A + "07-01", "MISSING_ID", "FR-BBB-03"), (A + "06-01", "CENSUS_MISMATCH", None)], "source drift")

# verification, summary, deps
add("NF-29a", [(G2, set_cell(R, "FR-AAA-02", "Verification", "review"))], [(A + "08-03", "W_WITHOUT_GUARD", "FR-AAA-02")])
add("NF-29b", [(G2, set_cell(R, "FR-AAA-01", "Verification", "unit-test, review"))], [(A + "08-03", "BAD_VOCAB", "FR-AAA-01")])
add("NF-29c", [(G2, set_cell(R, "FR-BBB-02", "Summary", lambda v: v + "x"))], [(A + "08-04", "SUMMARY_LENGTH", "FR-BBB-02")], "boundary 121")
add("NF-30a", [(G2, set_cell(R, "FR-AAA-01", "Decision deps", "—"))], [(A + "09-01", "MISSING_DECISION_DEP", "D-01")])
add("NF-30b", [(G2, set_cell(R, "FR-AAA-01", "Decision deps", "D-01, D-99"))], [(A + "09-02", "INVENTED_ID", "D-99")])

# anchors
add("NF-31a", [(G2, chain(set_cell(R, "FR-AAA-01", "Phases", "P04"), set_cell(R, "FR-AAA-01", "Primary phase", "P04")))],
    [(A + "10-01", "ANCHOR_VIOLATION", "FR-AAA-01")])
add("NF-31b", [(G2, set_cell(R, "NFR-01", "Notes", "deviation: SC-99"))],
    [(A + "10-03", "BAD_DEVIATION_REF", "SC-99"), (A + "10-01", "ANCHOR_VIOLATION", "NFR-01")])
add("NF-31c", [(G2, chain(set_cell(R, "FR-BBB-02", "Phases", "P07"), set_cell(R, "FR-BBB-02", "Primary phase", "P07")))],
    [(A + "10-02", "ANCHOR_VIOLATION", "FR-BBB-02")])
add("NF-31d", [(PHASE03, sub("FR-AAA scope", "FR-AAA range"))], [(A + "10-04", "ANCHOR_PROVENANCE", "P03/PHASE.md")], "source drift")

# normative content, pagination
add("NF-32a", [(G2, delete_row("Pagination rules", "PG-02"))], [(A + "11-01", "MISSING_ID", "PG-02")])
add("NF-32b", [(G2, set_cell("Normative content without requirement IDs", "§9", "Spec section", "§8"))],
    [(A + "11-02", "UNCOVERED_SECTION", "§9")])
add("NF-32c", [(G2, set_cell("Normative content without requirement IDs", "§9", "Spec section", "§9.9"))],
    [(A + "11-02", "INVALID_SECTION", "§9.9")])
add("NF-32d", [(G2, set_cell("Normative content without requirement IDs", "§6", "Spec section", "§6.1"))],
    [(A + "11-02", None, None)], "boundary, passes: §6.1 covers §6")

# exclusions
X = "Exclusions"
add("NF-33a", [(G3, set_cell(X, "X2", "Status", "EXCLUDED"))], [(A + "12-02", "EXCLUSION_STATUS", "X2")])
add("NF-33b", [(G3, set_cell(X, "X2", "Linked decision", "—"))], [(A + "12-02", "MISSING_LINKED_DECISION", "X2")])
add("NF-33c", [(G3, set_cell(X, "X1", "Guard phases", "—"))], [(A + "12-03", "INVALID_PHASE", "X1")])
add("NF-33d", [(G3, set_cell(X, "X1", "Guard verification", "check later"))], [(A + "12-03", "NO_GUARD_TOKEN", "X1")])
add("NF-33e", [(G3, set_cell(X, "X1", "Guard verification", "review"))], [(A + "12-03", "NO_GUARD_TOKEN", "X1")], "boundary")
add("NF-33f", [(G3, set_cell(X, "X1", "Allowed boundary", "—"))], [(A + "12-03", "EMPTY_BOUNDARY", "X1")])
add("NF-33g", [(G2, set_cell(R, "FR-AAA-02", "Verification", "review"))], [(A + "12-04", "W_NOT_GUARDED_IN_MATRIX", "FR-AAA-02")])

# decision register
add("NF-34a", [(G4, copy_row(RG, "ADR-008", "ADR-001"))], [(A + "14-01", "EXTRA_ID", "ADR-001")])
add("NF-34b", [(G4, copy_row(RG, "ADR-008", "ADR-099"))], [(A + "14-01", "INVENTED_ID", "ADR-099")])
add("NF-34c", [(G4, copy_row(RG, "ADR-008", "ADR-004"))], [(A + "14-01", "DUPLICATE_ID", "ADR-004")])
add("NF-34d", [(G4, set_cell(RG, "D-02", "Source sections", lambda v: v.replace("TECHNICAL-SPEC.md §6.1; ", "")))],
    [(A + "14-02", "MISSING_SOURCE_SECTION", "TECHNICAL-SPEC.md §6.1")])
add("NF-34e", [(G4, set_cell(RG, "ADR-008", "Source sections", "TECHNICAL-SPEC.md header"))],
    [(A + "14-02", "MISSING_SOURCE_SECTION", "DECISION-REGISTER.md ADR-008")])
add("NF-34f", [(DECISIONS, lambda t: "\n".join(ln for ln in t.split("\n") if not ln.startswith("| ADR-008 |")))],
    [(A + "14-03", "SNAPSHOT_MISMATCH", "ADR-008")], "fixture run")
add("NF-35a", [(G4, set_cell(RG, "ADR-002", "Decider", "Solution Architect"))], [(A + "15-01", "BAD_DECIDER", "ADR-002")])
add("NF-35b", [(G4, set_cell(RG, "ADR-003", "Preparer", "Architect (P01)"))], [(A + "15-02", "BAD_PREPARER", "ADR-003")])
add("NF-35c", [(G4, set_cell(RG, "ADR-003", "Preparer", "Solution Architect (P02)"))], [(A + "15-02", "PREPARER_PHASE_MISMATCH", "ADR-003")])
add("NF-35d", [(G4, set_cell(RG, "ADR-008", "Needed by", "P00"))], [(A + "15-03", "INVALID_PHASE", "ADR-008")])
add("NF-35e", [(G4, set_cell(RG, "D-01", "Release blocker", "maybe"))], [(A + "15-04", "BAD_VOCAB", "D-01")])
add("NF-35f", [(G4, set_cell(RG, "D-01", "Release blocker", "no"))], [(A + "15-04", "RELEASE_BLOCKER_RULE", "D-01")])
add("NF-35g", [(DECISIONS, drop_line("- Accepted by owner on"))], [(A + "15-05", "OWNER_ACCEPTANCE_MISSING", "ADR-003")])
add("NF-35h", [(G4, set_cell(RG, "ADR-008", "Assignment", "ACCEPTED"))], [(A + "15-05", "BAD_VOCAB", "ADR-008")])
add("NF-36", [(G4, set_cell(RG, "D-01", "Source recommendation", lambda v: v.replace("Recommendation only: ", "")))],
    [(A + "17-02", "MISSING_RECOMMENDATION_PREFIX", "D-01")])

# conflict log
add("NF-37a", [(G5, set_cell(LG, "SC-03", "Conflict ID", "SC-05"))], [(A + "18-01", "NON_SEQUENTIAL_ID", "SC-05")])
add("NF-37b", [(G5, set_cell(LG, "SC-01", "Type", "other"))], [(A + "18-02", "BAD_VOCAB", "SC-01")])
add("NF-37c", [(G5, set_cell(LG, "SC-04", "Sources", "TECHNICAL-SPEC.md §3.2"))], [(A + "18-03", "TOO_FEW_CITATIONS", "SC-04")], "boundary")
add("NF-37d", [(G5, set_cell(LG, "SC-01", "Sources", "spec §5; README.md §2"))], [(A + "18-03", "BAD_CITATION", "SC-01")])
add("NF-37e", [(G5, set_cell(LG, "SC-01", "Sources", "TECHNICAL-SPEC.md §99; README.md §2"))], [(A + "18-03", "BAD_CITATION", "SC-01")])
add("NF-37f", [(G5, set_cell(LG, "SC-01", "Affected IDs", "—"))], [(A + "18-04", "EMPTY_AFFECTED", "SC-01")])
add("NF-37g", [(G5, set_cell(LG, "SC-01", "Affected IDs", "FR-AAA-01, D-01, FR-ZZZ-01"))], [(A + "18-04", "INVENTED_ID", "FR-ZZZ-01")])
add("NF-37h", [(G5, set_cell(LG, "SC-04", "Type", "ambiguity"))], [(A + "18-05", "HIERARCHY_TYPE_RULE", "SC-04")])
add("NF-37i", [(G5, set_cell(LG, "SC-02", "Evidence", "—"))], [(A + "18-05", "OWNER_EVIDENCE_MISSING", "SC-02")])
add("NF-37j", [(G5, set_cell(LG, "SC-01", "Decider", "—"))], [(A + "18-06", "BAD_DECIDER", "SC-01")])


def _sc02_open(text):
    return chain(
        set_cell(LG, "SC-02", "Status", "OPEN"),
        set_cell(LG, "SC-02", "Decider", "Product owner"),
        set_cell(LG, "SC-02", "Preparer", "Solution Architect (P01)"),
        set_cell(LG, "SC-02", "Needed by", "P02"),
        set_cell(LG, "SC-02", "Deadline", "before P01 implementation"),
    )(text)


add("NF-38a", [(G5, _sc02_open)], [(A + "20-01", "GATE_OPEN_BLOCKER", "SC-02")])
add("NF-38b", [(G5, set_cell(LG, "SC-02", "Blocks P00", "no"))], [(A + "20-02", "BLOCKER_FLAG_RULE", "SC-02")])
add("NF-39a", [(DECISIONS, drop_line("- Accepted by owner on"))], [(A + "25-01", "OWNER_RECORD_MISSING", None)])
add("NF-39b", [(DECISIONS, sub("Q-3, ", ""))], [(A + "25-01", "OWNER_RECORD_INCOMPLETE", "Q-3")])
add("NF-39c", [(STATUS, sub("Status: COMPLETED", "Status: IN_REVIEW"))], [(A + "25-01", "PHASE_STATUS_NOT_COMPLETED", None)])

# mutations added by the Test Engineer (none of the listed NF is changed or removed)
add("NF-40", [(G2, set_cell(R, "FR-AAA-01", "Req ID", "`FR-AAA-01`"))], [(A + "01-02", "FORMAT_MARKUP", None)],
    "added: markup in an ID cell")
add("NF-41", [(G5, chain(set_cell(LG, "SC-03", "Needed by", "P00")))], [(A + "18-06", "DEADLINE_AFTER_NEEDED_BY", "SC-03")],
    "added: Needed by P00 with 'before P00 gate' violates the ordering rule (m = n needs implementation)")
add("NF-42", [(G5, chain(set_cell(LG, "SC-03", "Needed by", "P00"), set_cell(LG, "SC-03", "Deadline", "before P00 implementation")))],
    [(A + "18-06", None, None)], "added boundary, passes: P00 allowed in an OPEN conflict row")
add("NF-43", [(G4, set_cell(RG, "D-01", "Linked IDs", "ADR-004, —"))], [(A + "14-01", "LIST_FORMAT", "D-01")],
    "added: em dash combined with other items")
add("NF-44", [(G3, set_cell("Implied exclusions", "FR-BBB-01", "Source", "FR-QQQ-01"))], [(A + "12-05", "INVENTED_ID", "FR-QQQ-01")],
    "added: invented ID in an implied exclusion")


BY_NF = {m.nf: m for m in CATALOGUE}


def fixture_repo(overrides=None):
    return Repo(FIXTURE_ROOT, overrides)


def mutated_repo(nf, root=None):
    base = Repo(root or FIXTURE_ROOT)
    m = BY_NF[nf]
    return Repo(base.root, m.overrides(base))
