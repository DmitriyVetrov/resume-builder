"""Check functions of the P00 test plan: one function per automated TC.

Each check has the signature check(repo) -> list[Finding] (sorted). Expected values are
computed from the sources at run time (test plan section 4, item 6).
"""
import re

from p00_md import first_table, level_sections, lines_of, strip_code_spans
from p00_repo import Finding
from p00_sources import (
    AC_PATH,
    DECISIONS_PATH,
    D_TOKEN_RE,
    GOV_DIR,
    ID_PATTERN_RE,
    P00_DIR,
    PLAN_PATH,
    SECTION_TOKEN_RE,
    SPEC_PATH,
    STATUS_PATH,
    citation_resolves,
    doc_path,
    get_decisions,
    get_plan,
    get_register,
    get_spec,
    get_trace,
    parse_citations,
    phase_group,
    valid_universe,
)

CHECKS = {}  # tc_id -> (kind, function)

ARCHITECT_ARTIFACTS = [
    "architecture/phase-plan.md",
    "decisions.md",
    "dependencies.md",
    "acceptance-criteria.md",
    "implementation/backend-tasks.md",
    "implementation/frontend-tasks.md",
    "implementation/governance-tasks.md",
]
PHASE_RE = re.compile(r"^P(0[1-9]|1[0-5])$")
PHASE_P00_RE = re.compile(r"^P(0[0-9]|1[0-5])$")
DEVIATION_RE = re.compile(r"deviation: (SC-\d{2})")
MARKUP_COLUMNS = {
    "Group", "Req ID", "Rule ID", "Excl ID", "Primary ID", "Conflict ID", "Pri", "Spec section",
    "Source section", "Phases", "Primary phase", "Verification", "Decision deps", "Kind",
    "Authority", "Personal data", "Status", "Type", "Blocks P00", "Release blocker", "Assignment",
    "Decider", "Preparer", "Needed by", "Deadline", "Linked IDs", "Linked decision", "Seed",
    "Affected IDs", "Guard phases",
}
GUARD_TOKEN_RE = re.compile(r"\b(review|contract|component|e2e|guard)\b")
FORBIDDEN_STATUS_RE = re.compile(r"\b(ACCEPTED|DECIDED|CLOSED|RESOLVED)\b", re.IGNORECASE)
REC_PREFIX = "Recommendation only:"
NONE = "—"


def check(tc_id, kind):
    def deco(fn):
        CHECKS[tc_id] = (kind, fn)
        fn.tc_id = tc_id
        return fn

    return deco


class Out:
    def __init__(self, tc):
        self.tc = tc
        self.items = set()

    def add(self, code, loc="", detail=""):
        self.items.add(Finding(self.tc, code, str(loc), str(detail)))

    def result(self):
        return sorted(self.items)


# ------------------------------------------------------------------ GOV loading


class GovDoc:
    def __init__(self, gid, path, raw):
        self.gid = gid
        self.path = path
        self.decode_error = False
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            self.decode_error = True
            text = raw.decode("utf-8", "replace")
        self.raw_text = text
        self.bom = text.startswith("﻿")
        self.has_cr = "\r" in text
        self.lines = lines_of(text.replace("﻿", "", 1))
        self.h2 = level_sections(self.lines, 2)
        self._tables = {}

    def table(self, name):
        if name not in self._tables:
            tbl = None
            for title, start, end in self.h2:
                if title == name:
                    tbl = first_table(self.lines, start, end)
                    break
            self._tables[name] = tbl
        return self._tables[name]

    def section_lines(self, name):
        for title, start, end in self.h2:
            if title == name:
                return self.lines[start:end]
        return []


def gov_path(repo, gid):
    return get_plan(repo).gov_paths[gid]


def gov(repo, gid):
    def build():
        path = gov_path(repo, gid)
        if not repo.exists(path):
            return None
        return GovDoc(gid, path, repo.read_bytes(path))

    return repo.memo(("gov", gid), build)


def rows(repo, gid, table, out):
    """Dict rows of a named table, or None (with MISSING_FILE recorded) if the file is absent."""
    doc = gov(repo, gid)
    if doc is None:
        out.add("MISSING_FILE", gov_path(repo, gid))
        return None
    tbl = doc.table(table)
    if tbl is None:
        return []
    return tbl.dict_rows()


def parse_list(cell):
    """(items, problems, is_none) for a comma-separated list cell."""
    if cell == NONE:
        return [], [], True
    items = [i.strip() for i in cell.split(",")]
    problems = []
    if any(i == "" for i in items):
        problems.append("empty item")
    if NONE in items:
        problems.append("em dash combined with other items")
    real = [i for i in items if i and i != NONE]
    if len(set(real)) != len(real):
        problems.append("duplicate item")
    return real, problems, False


def phase_num(token):
    return int(token[1:])


def gov02_rows(repo, out, table="Requirements"):
    return rows(repo, "GOV-02", table, out)


# ------------------------------------------------------------------ AC-P00-01


@check("TC-P00-01-01", "real")
def c_01_01(repo):
    out = Out("TC-P00-01-01")
    plan = get_plan(repo)
    ac_row = None
    if repo.exists(AC_PATH):
        for ln in lines_of(repo.read_text(AC_PATH)):
            if ln.startswith("| AC-P00-01 |"):
                ac_row = ln
    ticks = set(re.findall(r"`([^`\n]+)`", ac_row or ""))
    for rel in ARCHITECT_ARTIFACTS:
        if rel not in ticks:
            out.add("ANCHOR_PROVENANCE", rel, "path not backticked in the AC-P00-01 row")
        path = P00_DIR + "/" + rel
        if not repo.exists(path):
            out.add("MISSING_FILE", path)
            continue
        try:
            text = repo.read_text(path)
        except UnicodeDecodeError:
            out.add("BAD_ENCODING", path)
            continue
        lines = lines_of(text)
        first = next((ln for ln in lines if ln.strip()), "")
        if not first.startswith("# "):
            out.add("MISSING_H1", path)
        if not any(ln.strip() and not ln.startswith("#") for ln in lines):
            out.add("EMPTY_BODY", path)
        stripped = strip_code_spans(text)
        for tok in placeholder_hits(stripped, plan.placeholders):
            out.add("PLACEHOLDER_TOKEN", path, tok)
    return out.result()


def placeholder_hits(text, tokens):
    hits = []
    for tok in tokens:
        if tok in ("TBD", "TODO", "FIXME"):
            if re.search(r"\b" + re.escape(tok) + r"\b", text):
                hits.append(tok)
        elif tok in text:
            hits.append(tok)
    return sorted(hits)


@check("TC-P00-01-02", "real")
def c_01_02(repo):
    out = Out("TC-P00-01-02")
    plan = get_plan(repo)
    for gid in sorted(plan.gov_paths):
        path = plan.gov_paths[gid]
        doc = gov(repo, gid)
        if doc is None:
            out.add("MISSING_FILE", path)
            continue
        fmt = plan.gov.get(gid)
        if fmt is None:
            out.add("PLAN_FORMAT_CHANGED", path, "no format for " + gid)
            continue
        if doc.decode_error or doc.bom or doc.has_cr:
            out.add("BAD_ENCODING", path, "BOM, CR or invalid UTF-8")
        first = next((ln for ln in doc.lines if ln.strip()), "")
        if not first.startswith("# "):
            out.add("MISSING_H1", path)
        actual = [t for t, _s, _e in doc.h2]
        expected = fmt["h2"]
        for h in expected:
            if h not in actual:
                out.add("MISSING_HEADING", path, "## " + h)
        extra = [h for h in actual if h not in expected]
        for h in extra:
            out.add("UNEXPECTED_HEADING", path, "## " + h)
        present = [h for h in actual if h in expected]
        if not extra and sorted(present) == sorted(expected) and present != expected:
            out.add("UNEXPECTED_HEADING", path, "order differs: " + ", ".join(present))
        for name, header in sorted(fmt["tables"].items()):
            if name not in actual:
                continue
            tbl = doc.table(name)
            if tbl is None:
                out.add("BAD_TABLE_HEADER", path, "no table under ## " + name)
                continue
            if tbl.header != header:
                out.add("BAD_TABLE_HEADER", path, name)
                continue
            for ln, cells in tbl.bad_shape_rows():
                out.add("ROW_SHAPE", "%s:%d" % (path, ln), "%d cells, expected %d" % (len(cells), len(header)))
            for ln, d in tbl.dict_rows():
                for col, val in sorted(d.items()):
                    if col in MARKUP_COLUMNS and ("`" in val or "*" in val):
                        out.add("FORMAT_MARKUP", "%s:%d" % (path, ln), col)
    return out.result()


@check("TC-P00-01-03", "real")
def c_01_03(repo):
    out = Out("TC-P00-01-03")
    plan = get_plan(repo)
    for gid in sorted(plan.gov_paths):
        doc = gov(repo, gid)
        if doc is None:
            out.add("MISSING_FILE", plan.gov_paths[gid])
            continue
        for tok in placeholder_hits(doc.raw_text, plan.placeholders):
            out.add("PLACEHOLDER_TOKEN", doc.path, tok)
    return out.result()


@check("TC-P00-01-04", "sources")
def c_01_04(repo):
    out = Out("TC-P00-01-04")
    plan = get_plan(repo)
    for e in plan.errors:
        out.add("PLAN_FORMAT_CHANGED", PLAN_PATH, e)
    for gid, path in sorted(plan.gov_paths.items()):
        fmt = plan.gov.get(gid)
        if not fmt:
            out.add("PLAN_FORMAT_CHANGED", PLAN_PATH, "no section for " + gid)
            continue
        if fmt["path"] != path:
            out.add("PLAN_FORMAT_CHANGED", PLAN_PATH, "%s path differs from section 6" % gid)
        if len(fmt["h2"]) < 2:
            out.add("PLAN_FORMAT_CHANGED", PLAN_PATH, "%s: fewer than 2 H2 headings" % gid)
        if not fmt["tables"]:
            out.add("PLAN_FORMAT_CHANGED", PLAN_PATH, "%s: no table header" % gid)
        for name in fmt["tables"]:
            if name not in fmt["h2"]:
                out.add("PLAN_FORMAT_CHANGED", PLAN_PATH, "%s: table %s is not an H2" % (gid, name))
    if len(plan.gov_paths) != 5:
        out.add("PLAN_FORMAT_CHANGED", PLAN_PATH, "expected 5 GOV paths")
    return out.result()


# ------------------------------------------------------------------ AC-P00-02..06 (GOV-01)


def files_rows(repo, out):
    return rows(repo, "GOV-01", "Files", out)


@check("TC-P00-02-01", "real")
def c_02_01(repo):
    out = Out("TC-P00-02-01")
    rs = files_rows(repo, out)
    if rs is None:
        return out.result()
    listed = [d.get("Path", "") for _l, d in rs]
    on_disk = set(repo.list_files("docs/source"))
    for p in sorted(on_disk - set(listed)):
        out.add("INVENTORY_MISSING", p)
    for p in sorted(set(listed) - on_disk):
        out.add("INVENTORY_EXTRA", p)
    for p in sorted({p for p in listed if listed.count(p) > 1}):
        out.add("INVENTORY_DUPLICATE", p)
    return out.result()


@check("TC-P00-03-01", "real")
def c_03_01(repo):
    out = Out("TC-P00-03-01")
    rs = files_rows(repo, out)
    if rs is None:
        return out.result()
    for _ln, d in rs:
        path = d.get("Path", "")
        if not repo.exists(path):
            continue
        b = d.get("Bytes", "")
        if not re.fullmatch(r"\d+", b) or int(b) != repo.size(path):
            out.add("BYTES_MISMATCH", path, "listed %s, actual %d" % (b, repo.size(path)))
        h = d.get("SHA-256", "")
        if not re.fullmatch(r"[0-9a-f]{64}", h):
            out.add("BAD_DIGEST_FORMAT", path)
        elif h != repo.sha256(path):
            out.add("SHA256_MISMATCH", path)
    return out.result()


@check("TC-P00-04-01", "real")
def c_04_01(repo):
    out = Out("TC-P00-04-01")
    plan = get_plan(repo)
    rs = files_rows(repo, out)
    if rs is None:
        return out.result()
    for _ln, d in rs:
        for col in ("Kind", "Authority", "Personal data"):
            if d.get(col, "") not in plan.vocab("GOV-01", col):
                out.add("BAD_VOCAB", d.get("Path", ""), "%s=%s" % (col, d.get(col, "")))
    return out.result()


@check("TC-P00-04-02", "real")
def c_04_02(repo):
    out = Out("TC-P00-04-02")
    rs = files_rows(repo, out)
    if rs is None:
        return out.result()
    normative = [d.get("Path", "") for _l, d in rs if d.get("Authority") == "normative"]
    if normative != [SPEC_PATH]:
        out.add("AUTHORITY_RULE", "normative", "rows: " + ", ".join(normative))
    for _l, d in rs:
        if d.get("Path") == "docs/source/README.md" and d.get("Authority") != "evidence":
            out.add("AUTHORITY_RULE", d.get("Path"), "README.md must be evidence")
    return out.result()


BASELINE_KEYS = ["Spec version", "Spec status", "Spec SHA-256", "Baseline date", "File count"]


@check("TC-P00-04-03", "real")
def c_04_03(repo):
    out = Out("TC-P00-04-03")
    plan = get_plan(repo)
    spec = get_spec(repo)
    doc = gov(repo, "GOV-01")
    if doc is None:
        out.add("MISSING_FILE", gov_path(repo, "GOV-01"))
        return out.result()
    found = {}
    rx = re.compile(r"^- (Spec version|Spec status|Spec SHA-256|Baseline date|File count): (.*)$")
    for ln in doc.section_lines("Baseline"):
        m = rx.match(ln)
        if m:
            found.setdefault(m.group(1), []).append(m.group(2).strip())
    for key in BASELINE_KEYS:
        if len(found.get(key, [])) != 1:
            out.add("BASELINE_KEY_MISSING", key, "found %d times" % len(found.get(key, [])))
    expect = {
        "Spec version": spec.version,
        "Spec status": spec.status,
        "Spec SHA-256": spec.sha256,
        "Baseline date": plan.baseline_date,
        "File count": str(len(repo.list_files("docs/source"))),
    }
    for key in BASELINE_KEYS:
        vals = found.get(key, [])
        if len(vals) == 1 and vals[0] != expect[key]:
            out.add("BASELINE_MISMATCH", key, "listed value differs from the computed one")
    return out.result()


@check("TC-P00-04-04", "sources")
def c_04_04(repo):
    out = Out("TC-P00-04-04")
    spec = get_spec(repo)
    for key in ("Version", "Status"):
        if key not in spec.header_rows or spec.header_dupes.count(key):
            out.add("SPEC_SANITY", SPEC_PATH, "header row %s missing or duplicated" % key)
    return out.result()


@check("TC-P00-05-01", "sources")
def c_05_01(repo):
    out = Out("TC-P00-05-01")
    spec = get_spec(repo)
    kinds = {r.kind for r in spec.refs}
    for kind in ("img", "export", "readme", "path"):
        if kind not in kinds:
            out.add("NO_REFERENCES", SPEC_PATH, "no reference of kind " + kind)
    if not any(r.raw.startswith("docs/") for r in spec.refs):
        out.add("NO_REFERENCES", SPEC_PATH, "no docs/ path")
    if not any(r.raw.startswith(".claude/") for r in spec.refs):
        out.add("NO_REFERENCES", SPEC_PATH, "no .claude/ path")
    return out.result()


@check("TC-P00-05-02", "real")
def c_05_02(repo):
    out = Out("TC-P00-05-02")
    spec = get_spec(repo)
    rs = files_rows(repo, out)
    if rs is None:
        return out.result()
    paths = {d.get("Path", "") for _l, d in rs}
    unresolved = [r for r in spec.refs if not spec.resolve_ref(r, paths)]
    if not unresolved:
        return out.result()
    log = rows(repo, "GOV-05", "Log", out)
    texts = []
    if log is not None:
        for _l, d in log:
            if d.get("Type") == "missing-reference":
                texts.append(" | ".join(d.values()))
    for r in unresolved:
        if not any(r.raw in t for t in texts):
            out.add("UNRESOLVED_REFERENCE", "%s:%d" % (SPEC_PATH, r.line), r.raw)
    return out.result()


@check("TC-P00-06-01", "real")
def c_06_01(repo):
    out = Out("TC-P00-06-01")
    spec = get_spec(repo)
    doc = gov(repo, "GOV-01")
    if doc is None:
        out.add("MISSING_FILE", gov_path(repo, "GOV-01"))
        return out.result()
    tbl = doc.table("Requirement ID census")
    cells = tbl.dict_rows() if tbl else []
    computed = {}
    for rid, info in spec.reqs.items():
        g = phase_group(rid)
        c = computed.setdefault(g, {"Count": 0, "M": 0, "S": 0, "C": 0, "W": 0})
        c["Count"] += 1
        c[info["pri"]] += 1
    total = {k: sum(c[k] for c in computed.values()) for k in ("Count", "M", "S", "C", "W")}
    expected = dict(computed)
    expected["Total"] = total
    got = {}
    for _l, d in cells:
        got.setdefault(d.get("Group", ""), []).append(d)
    for g in sorted(set(expected) - set(got)):
        out.add("CENSUS_MISMATCH", g, "group row missing")
    for g in sorted(set(got) - set(expected)):
        out.add("CENSUS_MISMATCH", g, "unexpected group row")
    for g in sorted(set(got) & set(expected)):
        if len(got[g]) != 1:
            out.add("CENSUS_MISMATCH", g, "row repeated")
            continue
        d = got[g][0]
        for k in ("Count", "M", "S", "C", "W"):
            v = d.get(k, "")
            if not re.fullmatch(r"\d+", v) or int(v) != expected[g][k]:
                out.add("CENSUS_MISMATCH", g, "column " + k)
    return out.result()


# ------------------------------------------------------------------ GOV-02 row rules


def check_phases(out, loc, d):
    items, problems, none = parse_list(d.get("Phases", ""))
    for p in problems:
        out.add("LIST_FORMAT", loc, "Phases: " + p)
    if none or (not items and not problems):
        out.add("INVALID_PHASE", loc, "Phases empty")
    for it in items:
        if not PHASE_RE.match(it):
            out.add("INVALID_PHASE", loc, "Phases item " + it)
    primary = d.get("Primary phase", "")
    if not PHASE_RE.match(primary):
        out.add("INVALID_PHASE", loc, "Primary phase " + primary)
    elif primary not in items:
        out.add("PRIMARY_NOT_IN_PHASES", loc, primary)


def check_verification(out, loc, d, plan, is_w):
    items, problems, none = parse_list(d.get("Verification", ""))
    for p in problems:
        out.add("LIST_FORMAT", loc, "Verification: " + p)
    if none or (not items and not problems):
        out.add("BAD_VOCAB", loc, "Verification empty")
    for it in items:
        if it not in plan.verification:
            out.add("BAD_VOCAB", loc, "Verification item " + it)
    if is_w and "guard" not in items:
        out.add("W_WITHOUT_GUARD", loc)


@check("TC-P00-07-01", "real")
def c_07_01(repo):
    out = Out("TC-P00-07-01")
    spec = get_spec(repo)
    rs = gov02_rows(repo, out)
    if rs is None:
        return out.result()
    ids = [d.get("Req ID", "") for _l, d in rs]
    for i in sorted(set(spec.req_ids) - set(ids)):
        out.add("MISSING_ID", i)
    for i in sorted(set(ids) - set(spec.req_ids)):
        out.add("INVENTED_ID", i)
    for i in sorted({i for i in ids if ids.count(i) > 1}):
        out.add("DUPLICATE_ID", i)
    return out.result()


@check("TC-P00-08-01", "real")
def c_08_01(repo):
    out = Out("TC-P00-08-01")
    spec = get_spec(repo)
    rs = gov02_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        rid = d.get("Req ID", "")
        info = spec.reqs.get(rid)
        if not info:
            continue
        if d.get("Pri") != info["pri"]:
            out.add("WRONG_PRIORITY", rid, "%s != %s" % (d.get("Pri"), info["pri"]))
        if d.get("Spec section") != info["section"]:
            out.add("WRONG_SECTION", rid, "%s != %s" % (d.get("Spec section"), info["section"]))
    return out.result()


@check("TC-P00-08-02", "real")
def c_08_02(repo):
    out = Out("TC-P00-08-02")
    rs = gov02_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        check_phases(out, d.get("Req ID", ""), d)
    return out.result()


@check("TC-P00-08-03", "real")
def c_08_03(repo):
    out = Out("TC-P00-08-03")
    spec = get_spec(repo)
    plan = get_plan(repo)
    rs = gov02_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        rid = d.get("Req ID", "")
        is_w = spec.reqs.get(rid, {}).get("pri") == "W"
        check_verification(out, rid, d, plan, is_w)
    return out.result()


@check("TC-P00-08-04", "real")
def c_08_04(repo):
    out = Out("TC-P00-08-04")
    rs = gov02_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        s = d.get("Summary", "").strip()
        if not s or len(s) > 120:
            out.add("SUMMARY_LENGTH", d.get("Req ID", ""), "length %d" % len(s))
    return out.result()


@check("TC-P00-09-01", "real")
def c_09_01(repo):
    out = Out("TC-P00-09-01")
    spec = get_spec(repo)
    rs = gov02_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        rid = d.get("Req ID", "")
        info = spec.reqs.get(rid)
        if not info:
            continue
        items, _p, _n = parse_list(d.get("Decision deps", ""))
        for dep in info["ddeps"]:
            if dep not in items:
                out.add("MISSING_DECISION_DEP", rid, dep)
    return out.result()


@check("TC-P00-09-02", "real")
def c_09_02(repo):
    out = Out("TC-P00-09-02")
    spec = get_spec(repo)
    reg = get_register(repo)
    defined = set(spec.d_ids) | set(reg.adr_ids)
    rs = gov02_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        rid = d.get("Req ID", "")
        items, problems, _none = parse_list(d.get("Decision deps", ""))
        for p in problems:
            out.add("LIST_FORMAT", rid, "Decision deps: " + p)
        for it in items:
            if it not in defined:
                out.add("INVENTED_ID", rid, it)
    return out.result()


def gov05_ids(repo, out):
    rs = rows(repo, "GOV-05", "Log", out)
    if rs is None:
        return None
    return {d.get("Conflict ID", "") for _l, d in rs}


@check("TC-P00-10-01", "real")
def c_10_01(repo):
    out = Out("TC-P00-10-01")
    spec = get_spec(repo)
    plan = get_plan(repo)
    rs = gov02_rows(repo, out)
    sc_ids = gov05_ids(repo, out)
    if rs is None or sc_ids is None:
        return out.result()
    by_id = {d.get("Req ID", ""): d for _l, d in rs}
    for a in plan.anchors:
        if not a.phase:
            continue
        ids, _problems = plan.expand_anchor_ids(a, spec)
        for rid in ids:
            d = by_id.get(rid)
            if d is None:
                continue
            items, _p, _n = parse_list(d.get("Phases", ""))
            if a.phase in items:
                continue
            m = DEVIATION_RE.search(d.get("Notes", ""))
            if m and m.group(1) in sc_ids:
                continue
            out.add("ANCHOR_VIOLATION", rid, "%s expects %s" % (a.doc, a.phase))
    return out.result()


@check("TC-P00-10-02", "real")
def c_10_02(repo):
    out = Out("TC-P00-10-02")
    trace = get_trace(repo)
    rs = gov02_rows(repo, out)
    sc_ids = gov05_ids(repo, out)
    if rs is None or sc_ids is None:
        return out.result()
    for _l, d in rs:
        rid = d.get("Req ID", "")
        if rid.startswith("NFR"):
            continue
        planned = trace.groups.get(rid[:6])
        if not planned:
            continue
        items, _p, _n = parse_list(d.get("Phases", ""))
        if set(items) & set(planned):
            continue
        m = DEVIATION_RE.search(d.get("Notes", ""))
        if m and m.group(1) in sc_ids:
            continue
        out.add("ANCHOR_VIOLATION", rid, "TRACEABILITY.md plans " + ", ".join(planned))
    return out.result()


@check("TC-P00-10-03", "real")
def c_10_03(repo):
    out = Out("TC-P00-10-03")
    sc_ids = gov05_ids(repo, out)
    all_rows = []
    for table, key in (
        ("Requirements", "Req ID"),
        ("Pagination rules", "Rule ID"),
        ("Normative content without requirement IDs", "Spec section"),
    ):
        rs = gov02_rows(repo, out, table)
        if rs is None:
            return out.result()
        all_rows += [(d.get(key, ""), d) for _l, d in rs]
    if sc_ids is None:
        return out.result()
    for key, d in all_rows:
        for sc in DEVIATION_RE.findall(d.get("Notes", "")):
            if sc not in sc_ids:
                out.add("BAD_DEVIATION_REF", key, sc)
    return out.result()


@check("TC-P00-10-04", "sources")
def c_10_04(repo):
    out = Out("TC-P00-10-04")
    spec = get_spec(repo)
    plan = get_plan(repo)
    trace = get_trace(repo)
    for a in plan.anchors:
        if not a.phase:
            continue
        rel = doc_path(a.doc)
        if not repo.exists(rel):
            out.add("ANCHOR_PROVENANCE", a.doc, "cited document missing")
        elif not a.quote or a.quote not in repo.read_text(rel):
            out.add("ANCHOR_PROVENANCE", a.doc, "quote not found: %s" % a.quote)
        _ids, problems = plan.expand_anchor_ids(a, spec)
        for p in problems:
            out.add("ANCHOR_PROVENANCE", a.doc, p)
    if not any(a.doc == "TRACEABILITY.md" for a in plan.anchors):
        out.add("PLAN_FORMAT_CHANGED", PLAN_PATH, "no TRACEABILITY.md anchor row")
    if not trace.groups:
        out.add("PLAN_FORMAT_CHANGED", "TRACEABILITY.md", "no FR group rows parsed")
    for g, phases in sorted(trace.groups.items()):
        if not phases:
            out.add("PLAN_FORMAT_CHANGED", "TRACEABILITY.md", g + ": no phase")
    return out.result()


# ------------------------------------------------------------------ AC-P00-11


@check("TC-P00-11-01", "real")
def c_11_01(repo):
    out = Out("TC-P00-11-01")
    spec = get_spec(repo)
    plan = get_plan(repo)
    rs = gov02_rows(repo, out, "Pagination rules")
    if rs is None:
        return out.result()
    ids = [d.get("Rule ID", "") for _l, d in rs]
    for i in sorted(set(spec.pg_ids) - set(ids)):
        out.add("MISSING_ID", i)
    for i in sorted(set(ids) - set(spec.pg_ids)):
        out.add("INVENTED_ID", i)
    for i in sorted({i for i in ids if ids.count(i) > 1}):
        out.add("DUPLICATE_ID", i)
    sections = {pid: sec for pid, sec in ((p[0], spec.section_of_line[p[1] - 1]) for p in spec.pg_defs)}
    for _l, d in rs:
        rid = d.get("Rule ID", "")
        if rid in sections and d.get("Spec section") != sections[rid]:
            out.add("WRONG_SECTION", rid, d.get("Spec section", ""))
        check_phases(out, rid, d)
        check_verification(out, rid, d, plan, False)
    return out.result()


@check("TC-P00-11-02", "real")
def c_11_02(repo):
    out = Out("TC-P00-11-02")
    spec = get_spec(repo)
    plan = get_plan(repo)
    rs = gov02_rows(repo, out, "Normative content without requirement IDs")
    if rs is None:
        return out.result()
    secs = []
    for _l, d in rs:
        sec = d.get("Spec section", "")
        secs.append(sec)
        if sec not in spec.section_tokens:
            out.add("INVALID_SECTION", sec)
        check_phases(out, sec, d)
        check_verification(out, sec, d, plan, False)
    for prefix in plan.norm_prefixes:
        if not any(s == prefix or s.startswith(prefix + ".") for s in secs):
            out.add("UNCOVERED_SECTION", prefix)
    return out.result()


@check("TC-P00-11-03", "sources")
def c_11_03(repo):
    out = Out("TC-P00-11-03")
    spec = get_spec(repo)
    plan = get_plan(repo)
    if not plan.norm_prefixes:
        out.add("PLAN_FORMAT_CHANGED", PLAN_PATH, "no normative-content prefixes")
    for p in plan.norm_prefixes:
        if p not in spec.section_tokens:
            out.add("ANCHOR_PROVENANCE", p, "prefix is not a spec section token")
    return out.result()


# ------------------------------------------------------------------ AC-P00-12 (GOV-03)


def excl_rows(repo, out):
    return rows(repo, "GOV-03", "Exclusions", out)


@check("TC-P00-12-01", "real")
def c_12_01(repo):
    out = Out("TC-P00-12-01")
    spec = get_spec(repo)
    rs = excl_rows(repo, out)
    if rs is None:
        return out.result()
    expected = set(spec.x_ids) | set(spec.w_ids)
    ids = [d.get("Excl ID", "") for _l, d in rs]
    for i in sorted(expected - set(ids)):
        out.add("MISSING_ID", i)
    for i in sorted(set(ids) - expected):
        out.add("INVENTED_ID", i)
    for i in sorted({i for i in ids if ids.count(i) > 1}):
        out.add("DUPLICATE_ID", i)
    return out.result()


@check("TC-P00-12-02", "real")
def c_12_02(repo):
    out = Out("TC-P00-12-02")
    spec = get_spec(repo)
    plan = get_plan(repo)
    reg = get_register(repo)
    defined = set(spec.d_ids) | set(reg.adr_ids)
    rs = excl_rows(repo, out)
    if rs is None:
        return out.result()
    vocab = plan.vocab("GOV-03", "Status")
    for _l, d in rs:
        eid = d.get("Excl ID", "")
        status = d.get("Status", "")
        if status not in vocab:
            out.add("BAD_VOCAB", eid, "Status " + status)
        linked, problems, _none = parse_list(d.get("Linked decision", ""))
        for p in problems:
            out.add("LIST_FORMAT", eid, "Linked decision: " + p)
        for tok in linked:
            if tok not in defined:
                out.add("INVENTED_ID", eid, tok)
        tags = spec.x_tags.get(eid, [])
        if tags:
            if status != "EXCLUDED-PENDING-DECISION":
                out.add("EXCLUSION_STATUS", eid, status)
            for t in tags:
                if t not in linked:
                    out.add("MISSING_LINKED_DECISION", eid, t)
        elif eid in spec.x_ids or eid in spec.w_ids:
            if status != "EXCLUDED":
                out.add("EXCLUSION_STATUS", eid, status)
    return out.result()


@check("TC-P00-12-03", "real")
def c_12_03(repo):
    out = Out("TC-P00-12-03")
    spec = get_spec(repo)
    rs = excl_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        eid = d.get("Excl ID", "")
        if eid in spec.x_ids:
            want = "§3.2"
        elif eid in spec.w_ids:
            want = spec.reqs[eid]["section"]
        else:
            want = None
        if want is not None and d.get("Source section") != want:
            out.add("WRONG_SECTION", eid, d.get("Source section", ""))
        items, problems, none = parse_list(d.get("Guard phases", ""))
        for p in problems:
            out.add("LIST_FORMAT", eid, "Guard phases: " + p)
        if none or (not items and not problems):
            out.add("INVALID_PHASE", eid, "Guard phases empty")
        for it in items:
            if not PHASE_RE.match(it):
                out.add("INVALID_PHASE", eid, "Guard phases item " + it)
        gv = d.get("Guard verification", "")
        if not GUARD_TOKEN_RE.search(gv):
            out.add("NO_GUARD_TOKEN", eid, "no allowed token")
        else:
            rest = GUARD_TOKEN_RE.sub(" ", gv)
            if len(re.findall(r"\w+", rest)) < 2:
                out.add("NO_GUARD_TOKEN", eid, "no concrete description")
        ab = d.get("Allowed boundary", "").strip()
        if not ab or ab == NONE:
            out.add("EMPTY_BOUNDARY", eid)
    return out.result()


@check("TC-P00-12-04", "real")
def c_12_04(repo):
    out = Out("TC-P00-12-04")
    spec = get_spec(repo)
    rs = gov02_rows(repo, out)
    if rs is None:
        return out.result()
    by_id = {d.get("Req ID", ""): d for _l, d in rs}
    for w in spec.w_ids:
        d = by_id.get(w)
        items = parse_list(d.get("Verification", ""))[0] if d else []
        if d is None or "guard" not in items:
            out.add("W_NOT_GUARDED_IN_MATRIX", w)
    return out.result()


@check("TC-P00-12-05", "real")
def c_12_05(repo):
    out = Out("TC-P00-12-05")
    rs = rows(repo, "GOV-03", "Implied exclusions", out)
    if rs is None:
        return out.result()
    universe = valid_universe(repo)
    for ln, d in rs:
        loc = "row %d" % ln
        src = d.get("Source", "")
        toks = ID_PATTERN_RE.findall(src) + SECTION_TOKEN_RE.findall(src)
        if not any(t in universe for t in toks):
            out.add("INVENTED_ID", loc, "no valid ID or section in Source")
        for t in toks:
            if t not in universe:
                out.add("INVENTED_ID", loc, t)
        items, problems, none = parse_list(d.get("Guard phases", ""))
        for p in problems:
            out.add("LIST_FORMAT", loc, "Guard phases: " + p)
        if none or (not items and not problems):
            out.add("INVALID_PHASE", loc, "Guard phases empty")
        for it in items:
            if not PHASE_RE.match(it):
                out.add("INVALID_PHASE", loc, "Guard phases item " + it)
    return out.result()


# ------------------------------------------------------------------ GOV-04 helpers


def register_rows(repo, out):
    return rows(repo, "GOV-04", "Register", out)


def row_ids(d):
    linked, _p, _n = parse_list(d.get("Linked IDs", ""))
    return [d.get("Primary ID", "")] + linked


def deadline_parts(plan, text):
    if not re.match(plan.deadline_re, text):
        return None
    m = re.search(r"P(\d\d)", text)
    return int(m.group(1)), text.rsplit(" ", 1)[1]


def f_decider(out, loc, d, plan):
    if d.get("Decider", "") not in plan.deciders:
        out.add("BAD_DECIDER", loc, d.get("Decider", ""))


def f_preparer(out, loc, d, plan, allow_p00):
    pr = d.get("Preparer", "")
    lo = "0-9" if allow_p00 else "1-9"
    rx = re.compile(r"^(%s) \((P(0[%s]|1[0-5]))\)$" % ("|".join(re.escape(r) for r in plan.roles), lo))
    m = rx.match(pr)
    if not m:
        out.add("BAD_PREPARER", loc, pr)
        return
    dl = deadline_parts(plan, d.get("Deadline", ""))
    if dl and phase_num(m.group(2)) != dl[0]:
        out.add("PREPARER_PHASE_MISMATCH", loc, "%s vs %s" % (pr, d.get("Deadline", "")))


def f_timing(out, loc, d, plan, allow_p00):
    lo = "0-9" if allow_p00 else "1-9"
    nb = d.get("Needed by", "")
    n = None
    if re.match(r"^P(0[%s]|1[0-5])$" % lo, nb):
        n = phase_num(nb)
    else:
        out.add("INVALID_PHASE", loc, "Needed by " + nb)
    dl_text = d.get("Deadline", "")
    dl = deadline_parts(plan, dl_text)
    if dl is None:
        out.add("BAD_DEADLINE_GRAMMAR", loc, dl_text)
        return
    if dl[0] == 0 and not allow_p00:
        out.add("INVALID_PHASE", loc, "Deadline " + dl_text)
        dl = None
    if dl is not None and n is not None:
        if dl[0] > n or (dl[0] == n and dl[1] != "implementation"):
            out.add("DEADLINE_AFTER_NEEDED_BY", loc, "%s vs %s" % (dl_text, nb))


@check("TC-P00-14-01", "real")
def c_14_01(repo):
    out = Out("TC-P00-14-01")
    spec = get_spec(repo)
    reg = get_register(repo)
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    required = reg.required_set(spec)
    defined = set(spec.d_ids) | set(reg.adr_ids)
    ids = []
    for _l, d in rs:
        _items, problems, _n = parse_list(d.get("Linked IDs", ""))
        for p in problems:
            out.add("LIST_FORMAT", d.get("Primary ID", ""), "Linked IDs: " + p)
        ids += row_ids(d)
    for i in sorted(required - set(ids)):
        out.add("MISSING_ID", i)
    for i in sorted({i for i in ids if ids.count(i) > 1}):
        out.add("DUPLICATE_ID", i)
    for i in sorted(set(ids) - required):
        out.add("EXTRA_ID" if i in defined else "INVENTED_ID", i)
    return out.result()


@check("TC-P00-14-02", "real")
def c_14_02(repo):
    out = Out("TC-P00-14-02")
    spec = get_spec(repo)
    reg = get_register(repo)
    plan = get_plan(repo)
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    primaries = {d.get("Primary ID", ""): d for _l, d in rs}
    for did in spec.d_ids:
        d = primaries.get(did)
        if d is None:
            out.add("MISSING_ID", did, "no row with this Primary ID")
            continue
        linked, _p, _n = parse_list(d.get("Linked IDs", ""))
        for mirror in reg.mirrors.get(did, []):
            if mirror not in linked:
                out.add("MISSING_ID", did, "mirror %s not in Linked IDs" % mirror)
    for _l, d in rs:
        pid = d.get("Primary ID", "")
        good, bad = parse_citations(d.get("Source sections", ""), plan)
        for b in bad:
            out.add("BAD_CITATION", pid, b)
        for doc, loc in good:
            if not citation_resolves(repo, doc, loc):
                out.add("BAD_CITATION", pid, "%s %s does not resolve" % (doc, loc))
        have = {"%s %s" % (doc, loc) for doc, loc in good}
        need = []
        if re.fullmatch(r"D-\d{2}", pid):
            need.append("TECHNICAL-SPEC.md §12")
            for s in sorted(spec.d_occ.get(pid, [])):
                need.append("TECHNICAL-SPEC.md " + s)
        for i in row_ids(d):
            if re.fullmatch(r"ADR-\d{3}", i):
                need.append("DECISION-REGISTER.md " + i)
        for n in sorted(set(need)):
            if n not in have:
                out.add("MISSING_SOURCE_SECTION", pid, n)
    return out.result()


@check("TC-P00-14-03", "sources")
def c_14_03(repo):
    out = Out("TC-P00-14-03")
    spec = get_spec(repo)
    reg = get_register(repo)
    dec = get_decisions(repo)
    for p in dec.snapshot_problems:
        out.add("SNAPSHOT_MISMATCH", DECISIONS_PATH, p)
    if dec.snapshot is not None:
        required = reg.required_set(spec)
        for i in sorted(required - dec.snapshot):
            out.add("SNAPSHOT_MISMATCH", i, "required but not in decisions.md section 2")
        for i in sorted(dec.snapshot - required):
            out.add("SNAPSHOT_MISMATCH", i, "in decisions.md section 2 but not required")
    return out.result()


@check("TC-P00-14-04", "sources")
def c_14_04(repo):
    out = Out("TC-P00-14-04")
    for p in get_register(repo).sanity(get_spec(repo)):
        out.add("REGISTER_SANITY", "DECISION-REGISTER.md", p)
    return out.result()


@check("TC-P00-15-01", "real")
def c_15_01(repo):
    out = Out("TC-P00-15-01")
    plan = get_plan(repo)
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        f_decider(out, d.get("Primary ID", ""), d, plan)
    return out.result()


@check("TC-P00-15-02", "real")
def c_15_02(repo):
    out = Out("TC-P00-15-02")
    plan = get_plan(repo)
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        f_preparer(out, d.get("Primary ID", ""), d, plan, False)
    return out.result()


@check("TC-P00-15-03", "real")
def c_15_03(repo):
    out = Out("TC-P00-15-03")
    plan = get_plan(repo)
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        f_timing(out, d.get("Primary ID", ""), d, plan, False)
    return out.result()


@check("TC-P00-15-04", "real")
def c_15_04(repo):
    out = Out("TC-P00-15-04")
    plan = get_plan(repo)
    reg = get_register(repo)
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    blockers = reg.release_blocker_ids()
    for _l, d in rs:
        pid = d.get("Primary ID", "")
        rb = d.get("Release blocker", "")
        if rb not in plan.vocab("GOV-04", "Release blocker"):
            out.add("BAD_VOCAB", pid, "Release blocker " + rb)
        if blockers & set(row_ids(d)) and rb != "yes":
            out.add("RELEASE_BLOCKER_RULE", pid, rb)
    return out.result()


def owner_marker_present(repo, plan):
    try:
        dec = get_decisions(repo)
    except FileNotFoundError:
        return False
    return any(re.match(plan.marker_re, ln) for ln in dec.section4)


@check("TC-P00-15-05", "real")
def c_15_05(repo):
    out = Out("TC-P00-15-05")
    plan = get_plan(repo)
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    marker = owner_marker_present(repo, plan)
    for _l, d in rs:
        pid = d.get("Primary ID", "")
        a = d.get("Assignment", "")
        if a not in ("PROPOSED", "OWNER-ACCEPTED"):
            out.add("BAD_VOCAB", pid, "Assignment " + a)
        elif a == "OWNER-ACCEPTED" and not marker:
            out.add("OWNER_ACCEPTANCE_MISSING", pid)
    return out.result()


@check("TC-P00-16-01", "real")
def c_16_01(repo):
    out = Out("TC-P00-16-01")
    plan = get_plan(repo)
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    for a in plan.deadline_anchors:
        if not a["bound"]:
            continue
        bound = phase_num(a["bound"])
        for _l, d in rs:
            if not set(a["ids"]) & set(row_ids(d)):
                continue
            dl = deadline_parts(plan, d.get("Deadline", ""))
            if dl is None:
                continue
            if dl[0] > bound or (dl[0] == bound and dl[1] != "implementation"):
                out.add("DEADLINE_AFTER_ANCHOR", d.get("Primary ID", ""), "%s > %s" % (d.get("Deadline", ""), a["bound"]))
    return out.result()


@check("TC-P00-16-02", "sources")
def c_16_02(repo):
    out = Out("TC-P00-16-02")
    spec = get_spec(repo)
    reg = get_register(repo)
    plan = get_plan(repo)
    required = reg.required_set(spec)
    for a in plan.deadline_anchors:
        loc = ",".join(a["ids"])
        for i in a["ids"]:
            if i not in required:
                out.add("ANCHOR_PROVENANCE", i, "deadline-anchor ID is not in the required decision set")
        if not a["bound"] or not re.fullmatch(r"P\d\d", a["bound"]):
            out.add("PLAN_FORMAT_CHANGED", loc, "no bound")
        if not a["source"]:
            out.add("PLAN_FORMAT_CHANGED", loc, "no cited source")
            continue
        if a["quote"] is None:
            continue
        if a["source"].startswith("ADR-"):
            row = reg.rows.get(a["source"])
            hay = row["line"] if row else ""
        else:
            rel = doc_path(a["source"])
            hay = repo.read_text(rel) if repo.exists(rel) else ""
        if a["quote"] not in hay:
            out.add("ANCHOR_PROVENANCE", loc, "quote not found in %s: %s" % (a["source"], a["quote"]))
    return out.result()


def no_quote_anchors(repo):
    return sorted(",".join(a["ids"]) for a in get_plan(repo).deadline_anchors if a["quote"] is None)


@check("TC-P00-17-01", "real")
def c_17_01(repo):
    out = Out("TC-P00-17-01")
    reg = get_register(repo)
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        pid = d.get("Primary ID", "")
        status = d.get("Status", "")
        rec = reg.status_of(pid)
        if rec is not None and status != rec:
            out.add("STATUS_CHANGED", pid, "%s != %s" % (status, rec))
        if FORBIDDEN_STATUS_RE.search(status):
            out.add("FORBIDDEN_STATUS", pid, status)
    return out.result()


@check("TC-P00-17-02", "real")
def c_17_02(repo):
    out = Out("TC-P00-17-02")
    rs = register_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        if not d.get("Source recommendation", "").startswith(REC_PREFIX):
            out.add("MISSING_RECOMMENDATION_PREFIX", d.get("Primary ID", ""))
    return out.result()


# ------------------------------------------------------------------ GOV-05


def log_rows(repo, out):
    return rows(repo, "GOV-05", "Log", out)


@check("TC-P00-18-01", "real")
def c_18_01(repo):
    out = Out("TC-P00-18-01")
    rs = log_rows(repo, out)
    if rs is None:
        return out.result()
    if not rs:
        out.add("NON_SEQUENTIAL_ID", "Log", "no rows")
    for i, (_l, d) in enumerate(rs):
        want = "SC-%02d" % (i + 1)
        if d.get("Conflict ID", "") != want:
            out.add("NON_SEQUENTIAL_ID", d.get("Conflict ID", ""), "expected " + want)
    return out.result()


@check("TC-P00-18-02", "real")
def c_18_02(repo):
    out = Out("TC-P00-18-02")
    plan = get_plan(repo)
    rs = log_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        for col in ("Type", "Status", "Blocks P00"):
            if d.get(col, "") not in plan.vocab("GOV-05", col):
                out.add("BAD_VOCAB", d.get("Conflict ID", ""), "%s=%s" % (col, d.get(col, "")))
    return out.result()


@check("TC-P00-18-03", "real")
def c_18_03(repo):
    out = Out("TC-P00-18-03")
    plan = get_plan(repo)
    rs = log_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        cid = d.get("Conflict ID", "")
        good, bad = parse_citations(d.get("Sources", ""), plan)
        if len(good) + len(bad) < 2:
            out.add("TOO_FEW_CITATIONS", cid)
        for b in bad:
            out.add("BAD_CITATION", cid, b)
        for doc, loc in good:
            if not citation_resolves(repo, doc, loc):
                out.add("BAD_CITATION", cid, "%s %s does not resolve" % (doc, loc))
    return out.result()


@check("TC-P00-18-04", "real")
def c_18_04(repo):
    out = Out("TC-P00-18-04")
    rs = log_rows(repo, out)
    if rs is None:
        return out.result()
    universe = valid_universe(repo)
    for _l, d in rs:
        cid = d.get("Conflict ID", "")
        items, problems, none = parse_list(d.get("Affected IDs", ""))
        for p in problems:
            out.add("LIST_FORMAT", cid, "Affected IDs: " + p)
        if none or (not items and not problems):
            out.add("EMPTY_AFFECTED", cid)
        for it in items:
            if it not in universe:
                out.add("INVENTED_ID", cid, it)
    return out.result()


@check("TC-P00-18-05", "real")
def c_18_05(repo):
    out = Out("TC-P00-18-05")
    plan = get_plan(repo)
    rs = log_rows(repo, out)
    if rs is None:
        return out.result()
    marker = owner_marker_present(repo, plan)
    owner_docs = ("TECHNICAL-SPEC.md", "README.md", "reference/README.md")
    for _l, d in rs:
        cid = d.get("Conflict ID", "")
        status = d.get("Status", "")
        if status == "RESOLVED-BY-HIERARCHY" and d.get("Type") != "spec-vs-research":
            out.add("HIERARCHY_TYPE_RULE", cid, d.get("Type", ""))
        if status == "RESOLVED-BY-OWNER":
            ev = d.get("Evidence", "")
            ok = False
            if "decisions.md §4" in ev:
                ok = marker
            if not ok:
                good, _bad = parse_citations(ev, plan)
                ok = any(doc in owner_docs and citation_resolves(repo, doc, loc) for doc, loc in good)
            if not ok:
                out.add("OWNER_EVIDENCE_MISSING", cid)
    return out.result()


@check("TC-P00-18-06", "real")
def c_18_06(repo):
    out = Out("TC-P00-18-06")
    plan = get_plan(repo)
    rs = log_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        if d.get("Status") != "OPEN":
            continue
        cid = d.get("Conflict ID", "")
        f_decider(out, cid, d, plan)
        f_preparer(out, cid, d, plan, True)
        f_timing(out, cid, d, plan, True)
    return out.result()


def key_token_matches(k, citations, affected, plan):
    cset = {"%s %s" % (doc, loc) for doc, loc in citations}
    if k in affected or k in cset:
        return True
    if k in plan.cite_docs and k != "Pxx/PHASE.md" and any(doc == k for doc, _l in citations):
        return True
    if k.startswith("§") and ("TECHNICAL-SPEC.md " + k) in cset:
        return True
    if re.fullmatch(r"(?:ADR-\d{3}|FR-[A-Z]{3}-\d{2}|NFR-\d{2}|PG-\d{2}|X\d{1,2}|D-\d{2})", k):
        return any(loc == k for _d, loc in citations)
    return False


@check("TC-P00-19-01", "real")
def c_19_01(repo):
    out = Out("TC-P00-19-01")
    plan = get_plan(repo)
    rs = log_rows(repo, out)
    if rs is None:
        return out.result()
    seed_ids = {s["id"] for s in plan.seeds}
    by_seed = {}
    for _l, d in rs:
        s = d.get("Seed", "")
        if s == NONE:
            continue
        if s not in seed_ids:
            out.add("INVENTED_ID", d.get("Conflict ID", ""), "Seed " + s)
            continue
        by_seed.setdefault(s, []).append(d)
    for seed in plan.seeds:
        got = by_seed.get(seed["id"], [])
        if not got:
            out.add("MISSING_SEED", seed["id"])
        elif len(got) > 1:
            out.add("DUPLICATE_SEED", seed["id"])
        else:
            d = got[0]
            good, _bad = parse_citations(d.get("Sources", ""), plan)
            affected = set(parse_list(d.get("Affected IDs", ""))[0])
            for k in seed["tokens"]:
                if not key_token_matches(k, good, affected, plan):
                    out.add("MISSING_SEED_TOKEN", seed["id"], k)
    return out.result()


@check("TC-P00-19-02", "sources")
def c_19_02(repo):
    out = Out("TC-P00-19-02")
    plan = get_plan(repo)
    universe = valid_universe(repo)
    ids = [s["id"] for s in plan.seeds]
    if ids != ["K-%02d" % (i + 1) for i in range(len(ids))] or not ids:
        out.add("SEED_FORMAT", "7.7", "seeds are not K-01..K-nn without gaps")
    rx = None
    for s in plan.seeds:
        if not s["tokens"]:
            out.add("SEED_FORMAT", s["id"], "no key tokens")
    from p00_sources import citation_regex

    rx = citation_regex(plan)
    for s in plan.seeds:
        for k in s["tokens"]:
            if k in universe or (k in plan.cite_docs) or rx.match(k):
                continue
            out.add("SEED_FORMAT", s["id"], "key token not recognised: " + k)
    return out.result()


@check("TC-P00-20-02", "real")
def c_20_02(repo):
    out = Out("TC-P00-20-02")
    plan = get_plan(repo)
    rs = log_rows(repo, out)
    if rs is None:
        return out.result()
    for seed in plan.seeds:
        if not seed["blocking"]:
            continue
        got = [d for _l, d in rs if d.get("Seed") == seed["id"]]
        if not got:
            out.add("MISSING_SEED", seed["id"])
        for d in got:
            if d.get("Blocks P00") != "yes":
                out.add("BLOCKER_FLAG_RULE", d.get("Conflict ID", ""), seed["id"])
    return out.result()


# ------------------------------------------------------------------ AC-P00-23


def pii_scan(out, plan, path, data):
    text = data.decode("utf-8", "replace")
    em, ph = re.compile(plan.pii_email), re.compile(plan.pii_phone)
    for i, ln in enumerate(text.split("\n"), 1):
        if em.search(ln):
            out.add("PII_EMAIL", path, "line %d" % i)
        if ph.search(ln):
            out.add("PII_PHONE", path, "line %d" % i)


@check("TC-P00-23-01", "real")
def c_23_01(repo):
    out = Out("TC-P00-23-01")
    plan = get_plan(repo)
    files = repo.list_files(GOV_DIR)
    if not files:
        out.add("MISSING_FILE", GOV_DIR, "no files")
    for p in files:
        pii_scan(out, plan, p, repo.read_bytes(p))
    return out.result()


@check("TC-P00-23-02", "real")
def c_23_02(repo):
    out = Out("TC-P00-23-02")
    plan = get_plan(repo)
    for p in repo.list_files(P00_DIR):
        if p.endswith(".md"):
            pii_scan(out, plan, p, repo.read_bytes(p))
    return out.result()


# ------------------------------------------------------------------ spec sanity, constants


@check("TC-P00-S-01", "sources")
def c_s_01(repo):
    out = Out("TC-P00-S-01")
    for p in get_spec(repo).sanity():
        out.add("SPEC_SANITY", SPEC_PATH, p)
    return out.result()


# Format constants used by the checks, each with the document in which the same text must be found.
FORMAT_CONSTANTS = [
    (PLAN_PATH, "deviation: SC-nn"),
    (PLAN_PATH, "Recommendation only:"),
    (PLAN_PATH, "at most 120 characters"),
    (PLAN_PATH, "`PROPOSED`"),
    (PLAN_PATH, "`OWNER-ACCEPTED`"),
    (PLAN_PATH, "`RESOLVED-BY-HIERARCHY`"),
    (PLAN_PATH, "`RESOLVED-BY-OWNER`"),
    (PLAN_PATH, "`EXCLUDED-PENDING-DECISION`"),
    (PLAN_PATH, "`spec-vs-research`"),
    (PLAN_PATH, "`missing-reference`"),
    (PLAN_PATH, "`header`"),
    (PLAN_PATH, "`App. A`"),
    (PLAN_PATH, "<Role> (Pxx)"),
    (PLAN_PATH, "`TECHNICAL-SPEC.md §12`"),
    (PLAN_PATH, "`DECISION-REGISTER.md <ADR-ID>`"),
    (PLAN_PATH, "`§3.2`"),
    (PLAN_PATH, "`guard`"),
    (PLAN_PATH, "`OPEN`"),
    (PLAN_PATH, "release blocker"),
    (PLAN_PATH, "SC-nn"),
    (PLAN_PATH, "`Total`"),
    (PLAN_PATH, "`decisions.md`"),
    (AC_PATH, "PD-P00-03"),
    (AC_PATH, "PD-P00-04"),
    (AC_PATH, "PD-P00-05"),
    (PLAN_PATH, "Q-1"),
    (PLAN_PATH, "Q-5"),
    (PLAN_PATH, "`Product owner`"),
]


def provenance_check(repo):
    """TC-P00-S-02 (real repository only): format constants are found in the plan / AC."""
    out = Out("TC-P00-S-02")
    for rel, needle in FORMAT_CONSTANTS:
        if not repo.exists(rel) or needle not in repo.read_text(rel):
            out.add("ANCHOR_PROVENANCE", rel, "format constant not found: " + needle)
    return out.result()


# ------------------------------------------------------------------ gates


@check("TC-P00-20-01", "gate")
def g_20_01(repo):
    out = Out("TC-P00-20-01")
    rs = log_rows(repo, out)
    if rs is None:
        return out.result()
    for _l, d in rs:
        if d.get("Blocks P00") == "yes" and d.get("Status") == "OPEN":
            out.add("GATE_OPEN_BLOCKER", d.get("Conflict ID", ""), d.get("Seed", ""))
    return out.result()


@check("TC-P00-25-01", "gate")
def g_25_01(repo):
    out = Out("TC-P00-25-01")
    plan = get_plan(repo)
    marker = owner_marker_present(repo, plan)
    if not marker:
        out.add("OWNER_RECORD_MISSING", DECISIONS_PATH, "section 4")
    else:
        sec4 = "\n".join(get_decisions(repo).section4)
        for tok in ["Q-%d" % i for i in range(1, 6)] + ["PD-P00-03", "PD-P00-04", "PD-P00-05"]:
            if tok not in sec4:
                out.add("OWNER_RECORD_INCOMPLETE", DECISIONS_PATH, tok)
    ok = False
    if repo.exists(STATUS_PATH):
        for ln in lines_of(repo.read_text(STATUS_PATH)):
            if re.match(r"^Status: (COMPLETED|COMPLETED_WITH_APPROVED_EXCEPTIONS)$", ln):
                ok = True
    if not ok:
        out.add("PHASE_STATUS_NOT_COMPLETED", STATUS_PATH)
    return out.result()


# ------------------------------------------------------------------ runner


def run_checks(repo, kinds=("sources", "real"), only=None):
    """Run all checks of the given kinds. Returns {tc_id: [Finding]} sorted by tc_id."""
    results = {}
    for tc in sorted(CHECKS):
        kind, fn = CHECKS[tc]
        if kind not in kinds or (only and tc not in only):
            continue
        results[tc] = fn(repo)
    return results


def format_findings(findings, limit=50):
    lines = ["%s %s %s %s" % (f.tc_id, f.code, f.location, f.detail) for f in sorted(findings)]
    if len(lines) > limit:
        extra = len(lines) - limit
        lines = lines[:limit] + ["... and %d more" % extra]
    return "\n".join(lines)
