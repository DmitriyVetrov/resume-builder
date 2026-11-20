"""Markdown helpers for the P00 checks (standard library only)."""
import re

NUM_HEAD_RE = re.compile(r"^(#{1,6}) (\d+(?:\.\d+)*)\.?\s")
APP_HEAD_RE = re.compile(r"^## (?:Appendix|Приложение) ([A-Z])\b")
ANY_HEAD_RE = re.compile(r"^(#{1,6}) ")
CODE_SPAN_RE = re.compile(r"`[^`\n]*`")


def lines_of(text):
    """Split on LF and remove one trailing CR per line (used for source files)."""
    out = text.split("\n")
    return [ln[:-1] if ln.endswith("\r") else ln for ln in out]


def _heading_rows(lines):
    """Yield (index, level, title, token) for headings outside code fences.

    token is '§n' for numbered headings, 'App. X' for appendix headings, else None.
    """
    in_fence = False
    for i, ln in enumerate(lines):
        stripped = ln.lstrip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = ANY_HEAD_RE.match(ln)
        if not m:
            continue
        level = len(m.group(1))
        token = None
        n = NUM_HEAD_RE.match(ln)
        if n:
            token = "§" + n.group(2)
        else:
            a = APP_HEAD_RE.match(ln)
            if a:
                token = "App. " + a.group(1)
        yield i, level, ln[level + 1:].strip(), token


def headings(lines):
    return list(_heading_rows(lines))


def section_map(lines):
    """Section token of every line (see test plan 5.1). None = outside any section."""
    marks = {i: (lvl, tok) for i, lvl, _t, tok in _heading_rows(lines)}
    cur = "header"
    result = []
    for i in range(len(lines)):
        if i in marks:
            lvl, tok = marks[i]
            if tok is not None:
                cur = tok
            elif lvl == 2:
                cur = None
        result.append(cur)
    return result


def section_tokens(lines):
    """Set of '§n' tokens and 'App. X' tokens of numbered/appendix headings."""
    return {tok for _i, _l, _t, tok in _heading_rows(lines) if tok}


def split_row(line):
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def is_separator(cells):
    return bool(cells) and all(c and re.fullmatch(r"[-: ]+", c) for c in cells)


class Table:
    def __init__(self, header, header_line, rows):
        self.header = header
        self.header_line = header_line
        self.rows = rows  # list of (line_number_1_based, cells)

    def dict_rows(self):
        """Rows whose cell count matches the header, as (line, dict)."""
        out = []
        for ln, cells in self.rows:
            if len(cells) == len(self.header):
                out.append((ln, dict(zip(self.header, cells))))
        return out

    def bad_shape_rows(self):
        return [(ln, cells) for ln, cells in self.rows if len(cells) != len(self.header)]


def first_table(lines, start=0, end=None):
    end = len(lines) if end is None else end
    i = start
    while i < end and not lines[i].startswith("|"):
        i += 1
    if i >= end:
        return None
    header = split_row(lines[i])
    header_line = i + 1
    i += 1
    if i < end and lines[i].startswith("|") and is_separator(split_row(lines[i])):
        i += 1
    rows = []
    while i < end and lines[i].startswith("|"):
        rows.append((i + 1, split_row(lines[i])))
        i += 1
    return Table(header, header_line, rows)


def level_sections(lines, level):
    """List of (title, start_index_after_heading, end_index) for headings of exactly `level`.

    A section ends at the next heading of the same or a higher level.
    """
    rows = headings(lines)
    out = []
    for k, (i, lvl, title, _tok) in enumerate(rows):
        if lvl != level:
            continue
        end = len(lines)
        for j, lvl2, _t2, _k2 in rows[k + 1:]:
            if lvl2 <= level:
                end = j
                break
        out.append((title, i + 1, end))
    return out


def strip_code_spans(text):
    return CODE_SPAN_RE.sub("", text)


def backticked(text):
    return re.findall(r"`([^`\n]+)`", text)
