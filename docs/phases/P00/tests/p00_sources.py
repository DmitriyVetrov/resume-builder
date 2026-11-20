"""Oracle parsers for the sources the P00 checks read (standard library only).

Every expected value is computed here from the source files at run time.
"""
import fnmatch
import re

from p00_md import (
    backticked,
    first_table,
    headings,
    level_sections,
    lines_of,
    section_map,
    section_tokens,
    split_row,
)

PLAN_PATH = "docs/phases/P00/architecture/phase-plan.md"
SPEC_PATH = "docs/source/TECHNICAL-SPEC.md"
REGISTER_PATH = "docs/blueprint/DECISION-REGISTER.md"
TRACE_PATH = "docs/blueprint/TRACEABILITY.md"
DECISIONS_PATH = "docs/phases/P00/decisions.md"
STATUS_PATH = "docs/phases/P00/PHASE-STATUS.md"
AC_PATH = "docs/phases/P00/acceptance-criteria.md"
P00_DIR = "docs/phases/P00"
GOV_DIR = "docs/phases/P00/governance"

REQ_RE = re.compile(r"^\|\s*(FR-[A-Z]{3}-\d{2}|NFR-\d{2})\s*\|\s*([A-Z])\s*\|")
X_RE = re.compile(r"^\|\s*(X\d+)\s*\|")
PG_RE = re.compile(r"^\|\s*(PG-\d{2})\s*\|")
D_ROW_RE = re.compile(r"^\|\s*(D-\d{2})\s*\|")
REQ_TOKEN_RE = re.compile(r"\b(FR-[A-Z]{3}-\d{2}|NFR-\d{2})\b")
D_TOKEN_RE = re.compile(r"\bD-\d{2}\b")
ADR_TOKEN_RE = re.compile(r"\bADR-\d{3}\b")
DECISION_TAG_RE = re.compile(r"\[DECISION (D-\d{2})")
PHASE_TOKEN_RE = re.compile(r"\bP(0\d|1[0-5])\b")
ID_PATTERN_RE = re.compile(r"\b(FR-[A-Z]{3}-\d{2}|NFR-\d{2}|PG-\d{2}|X\d{1,2}|D-\d{2}|ADR-\d{3})\b")
SECTION_TOKEN_RE = re.compile(r"§\d+(?:\.\d+)*")
ROW_ID_RE = re.compile(r"^(?:ADR-\d{3}|FR-[A-Z]{3}-\d{2}|NFR-\d{2}|PG-\d{2}|X\d{1,2}|D-\d{2})$")


def phase_group(req_id):
    return "NFR" if req_id.startswith("NFR") else req_id[:6]


def phase_num(token):
    return int(token[1:])


# --------------------------------------------------------------------------- spec


class Ref:
    def __init__(self, kind, line, raw, rest=""):
        self.kind = kind  # img | export | readme | path
        self.line = line
        self.raw = raw
        self.rest = rest


IMG_EXPORT_RE = re.compile(r"(?<![\w/.-])(img|export)/([^\s`)\]|,;]*)")
README_REF_RE = re.compile(r"(?<![\w/.-])README\.md")
PATH_REF_RE = re.compile(r"(?<![\w/.-])((?:docs|\.claude)/[\w./-]+)")


class Spec:
    def __init__(self, repo):
        raw = repo.read_bytes(SPEC_PATH)
        self.size = len(raw)
        import hashlib

        self.sha256 = hashlib.sha256(raw).hexdigest()
        text = raw.decode("utf-8")
        self.lines = lines = lines_of(text)
        secs = section_map(lines)
        self.section_of_line = secs
        self.section_tokens = {t for t in section_tokens(lines) if t.startswith("§")}
        self.appendix_tokens = {t for t in section_tokens(lines) if t.startswith("App.")}

        table = first_table(lines)
        self.header_rows = {}
        self.header_dupes = []
        if table:
            for _ln, cells in table.rows:
                if len(cells) >= 2:
                    key = cells[0]
                    if key in self.header_rows:
                        self.header_dupes.append(key)
                    self.header_rows[key] = cells[1]
        self.version = self.header_rows.get("Version")
        self.status = self.header_rows.get("Status")

        self.req_defs = []  # (id, pri, section, lineno, line_text)
        self.x_defs = []
        self.pg_defs = []
        self.d_defs = []
        for i, ln in enumerate(lines):
            m = REQ_RE.match(ln)
            if m:
                self.req_defs.append((m.group(1), m.group(2), secs[i], i + 1, ln))
            m = X_RE.match(ln)
            if m and secs[i] == "§3.2":
                self.x_defs.append((m.group(1), i + 1, ln))
            m = PG_RE.match(ln)
            if m and secs[i] == "§8":
                self.pg_defs.append((m.group(1), i + 1, ln))
            m = D_ROW_RE.match(ln)
            if m and secs[i] == "§12":
                self.d_defs.append((m.group(1), i + 1, ln))

        self.reqs = {}
        for rid, pri, sec, ln, text in self.req_defs:
            self.reqs.setdefault(rid, {"pri": pri, "section": sec, "line": ln, "text": text})
        for rid, info in self.reqs.items():
            info["ddeps"] = sorted(set(D_TOKEN_RE.findall(info["text"])))
        self.req_ids = sorted(self.reqs)
        self.w_ids = sorted(r for r, i in self.reqs.items() if i["pri"] == "W")
        self.x_ids = sorted({x[0] for x in self.x_defs}, key=_num_key)
        self.x_tags = {}
        for xid, _ln, text in self.x_defs:
            self.x_tags.setdefault(xid, sorted(set(DECISION_TAG_RE.findall(text))))
        self.pg_ids = sorted({p[0] for p in self.pg_defs})
        self.d_ids = sorted({d[0] for d in self.d_defs})
        self.groups = sorted({phase_group(r) for r in self.req_ids})

        self.d_occ = {}
        for i, ln in enumerate(lines):
            sec = secs[i]
            if sec is None:
                continue
            for d in D_TOKEN_RE.findall(ln):
                self.d_occ.setdefault(d, set()).add(sec)

        # every requirement-like token anywhere
        self.req_tokens = {}
        for i, ln in enumerate(lines):
            for t in REQ_TOKEN_RE.findall(ln):
                self.req_tokens.setdefault(t, []).append(i + 1)

        self.refs = self._extract_refs()

    def _extract_refs(self):
        refs = []
        for i, ln in enumerate(self.lines):
            for m in IMG_EXPORT_RE.finditer(ln):
                rest = m.group(2).rstrip(".")
                refs.append(Ref(m.group(1), i + 1, m.group(1) + "/" + rest, rest))
            for m in README_REF_RE.finditer(ln):
                refs.append(Ref("readme", i + 1, "README.md"))
            for m in PATH_REF_RE.finditer(ln):
                raw = m.group(1).rstrip(".")
                refs.append(Ref("path", i + 1, raw))
        return refs

    def sanity(self):
        """Return list of problem strings (empty = sane)."""
        problems = []
        if "Version" not in self.header_rows or "Status" not in self.header_rows:
            problems.append("header: Version or Status row missing")
        for key in ("Version", "Status"):
            if self.header_dupes.count(key) or (list(self.header_rows).count(key) > 1):
                problems.append("header: duplicate " + key)
        if self.header_dupes:
            problems.append("header: duplicate rows " + ",".join(sorted(set(self.header_dupes))))
        seen = {}
        for rid, pri, sec, ln, _t in self.req_defs:
            if rid in seen:
                problems.append("requirement defined twice: " + rid)
            seen[rid] = 1
            if pri not in ("M", "S", "C", "W"):
                problems.append("bad priority %s for %s" % (pri, rid))
            if not (sec and (sec.startswith("§5.") or sec == "§11")):
                problems.append("requirement %s outside §5.x/§11: %s" % (rid, sec))
        for tok in sorted(self.req_tokens):
            if tok not in self.reqs:
                problems.append("undefined requirement token " + tok)
        for label, defs in (("X", self.x_defs), ("PG", self.pg_defs), ("D", self.d_defs)):
            ids = [d[0] for d in defs]
            if len(ids) != len(set(ids)):
                problems.append("duplicate %s IDs" % label)
            if not ids:
                problems.append("no %s IDs found" % label)
        if not self.req_defs:
            problems.append("no requirement IDs found")
        return problems

    # reference resolution -------------------------------------------------
    def resolve_ref(self, ref, paths):
        paths = set(paths)
        if ref.kind in ("img", "export"):
            d = "docs/source/%s/" % ref.kind
            names = sorted(p[len(d):] for p in paths if p.startswith(d))
            rest = ref.rest
            if rest == "":
                return bool(names)
            if re.fullmatch(r"\d{2}", rest):
                return any(n.startswith(rest + "-") for n in names)
            m = re.fullmatch(r"(\d{2})[–-](\d{2})", rest)
            if m:
                lo, hi = int(m.group(1)), int(m.group(2))
                return all(any(n.startswith("%02d-" % k) for n in names) for k in range(lo, hi + 1))
            m = re.fullmatch(r"(.*?)(\d+)…(\d+)(.*)", rest)
            if m:
                pre, a, b, suf = m.group(1), m.group(2), m.group(3), m.group(4)
                lo, hi = int(a), int(b)
                width = len(a)
                return all((pre + str(k).zfill(width) + suf) in names for k in range(lo, hi + 1))
            if "…" in rest or "*" in rest:
                pattern = rest.replace("…", "*")
                return any(fnmatch.fnmatchcase(n, pattern) for n in names)
            return rest in names
        if ref.kind == "readme":
            return "docs/source/README.md" in paths
        cand = ref.raw if ref.raw.startswith("docs/source/") else "docs/source/" + ref.raw
        return cand in paths


def _num_key(xid):
    return int(xid[1:])


# --------------------------------------------------------------------------- register


class Register:
    def __init__(self, repo):
        text = repo.read_text(REGISTER_PATH)
        self.lines = lines = lines_of(text)
        self.rows = {}  # id -> dict
        self.order = []
        self.dupes = []
        self.table_found = False
        start = None
        for i, ln in enumerate(lines):
            if ln.startswith("| ID |"):
                start = i
                break
        if start is not None:
            self.table_found = True
            table = first_table(lines, start)
            for ln_no, cells in table.rows:
                if len(cells) < 4:
                    continue
                rid = cells[0]
                if rid in self.rows:
                    self.dupes.append(rid)
                    continue
                self.rows[rid] = {
                    "topic": cells[1],
                    "status": cells[2],
                    "handling": cells[3],
                    "line": lines[ln_no - 1],
                }
                self.order.append(rid)
        self.adr_ids = sorted(r for r in self.rows if re.fullmatch(r"ADR-\d{3}", r))
        self.mirrors = {}
        for rid in self.order:
            for d in D_TOKEN_RE.findall(self.rows[rid]["handling"]):
                self.mirrors.setdefault(d, []).append(rid)

    def required_set(self, spec):
        req = set(spec.d_ids)
        for rid, r in self.rows.items():
            if r["status"] != "FIXED":
                req.add(rid)
            elif any(w in r["handling"] for w in ("OPEN", "PROPOSED", "recommended", "confirm")):
                req.add(rid)
        return req

    def status_of(self, ident):
        if ident in self.rows:
            return self.rows[ident]["status"]
        mirrors = self.mirrors.get(ident, [])
        statuses = {self.rows[m]["status"] for m in mirrors}
        if len(statuses) == 1:
            return statuses.pop()
        return None

    def release_blocker_ids(self):
        """IDs (ADR and their D-IDs) of register rows that say 'release blocker'."""
        out = set()
        for rid, r in self.rows.items():
            if "release blocker" in r["handling"].lower():
                out.add(rid)
                out.update(D_TOKEN_RE.findall(r["handling"]))
        return out

    def sanity(self, spec):
        problems = []
        if not self.table_found:
            problems.append("register table not found")
        if self.dupes:
            problems.append("duplicate register IDs: " + ",".join(sorted(set(self.dupes))))
        for rid, r in sorted(self.rows.items()):
            if r["status"] not in ("FIXED", "REQUIRED", "PROPOSED", "OPEN", "SOURCE-OPEN"):
                problems.append("%s: status outside vocabulary: %s" % (rid, r["status"]))
        for d in spec.d_ids:
            mirrors = self.mirrors.get(d, [])
            if not mirrors:
                problems.append("%s has no mirror in the register" % d)
                continue
            if len({self.rows[m]["status"] for m in mirrors}) != 1:
                problems.append("%s mirrors have different statuses" % d)
        return problems


# --------------------------------------------------------------------------- decisions.md


class DecisionsMd:
    def __init__(self, repo):
        text = repo.read_text(DECISIONS_PATH)
        self.lines = lines = lines_of(text)
        self.snapshot = None
        self.snapshot_problems = []
        snap = set()
        found = 0
        for level in (3,):
            for title, start, end in level_sections(lines, level):
                m = re.match(r"(2\.[12])\b", title)
                if not m:
                    continue
                tbl = first_table(lines, start, end)
                if not tbl:
                    self.snapshot_problems.append("no table in section " + m.group(1))
                    continue
                found += 1
                for _ln, cells in tbl.rows:
                    take = cells[:2] if m.group(1) == "2.1" else cells[:1]
                    for c in take:
                        snap.update(re.findall(r"\b(?:D-\d{2}|ADR-\d{3})\b", c))
        if found == 2:
            self.snapshot = snap
        else:
            self.snapshot_problems.append("expected sections 2.1 and 2.2, found %d" % found)
        self.section4 = []
        for title, start, end in level_sections(lines, 2):
            if re.match(r"4\.", title):
                self.section4 = lines[start:end]


# --------------------------------------------------------------------------- traceability


class Traceability:
    def __init__(self, repo):
        lines = lines_of(repo.read_text(TRACE_PATH))
        tbl = first_table(lines)
        self.groups = {}
        self.problems = []
        if not tbl:
            self.problems.append("no table")
            return
        for _ln, cells in tbl.rows:
            if len(cells) < 2:
                continue
            m = re.match(r"^(FR-[A-Z]{3})\b", cells[0])
            if not m:
                continue
            phases = sorted({"P" + p for p in PHASE_TOKEN_RE.findall(cells[1])})
            self.groups[m.group(1)] = phases


# --------------------------------------------------------------------------- phase plan


class AnchorRow:
    def __init__(self, doc, quote, ids_text, phase, raw):
        self.doc = doc  # 'P06/PHASE.md' or 'TRACEABILITY.md'
        self.quote = quote
        self.ids_text = ids_text
        self.phase = phase
        self.raw = raw


class Plan:
    def __init__(self, repo):
        text = repo.read_text(PLAN_PATH)
        self.lines = lines = lines_of(text)
        self.errors = []
        self.baseline_date = None
        tbl = first_table(lines)
        if tbl:
            for _ln, cells in tbl.rows:
                if len(cells) >= 2 and cells[0] == "Baseline date":
                    self.baseline_date = cells[1]
        if not self.baseline_date:
            self.errors.append("Baseline date missing")

        self.gov_paths = {}
        self._parse_section6()
        self.subsections = self._subsections()
        self._parse_conventions()
        self.gov = {}
        self.vocabs = {}
        self._parse_gov_sections()
        self._parse_anchors()
        self._parse_deadline_anchors()
        self._parse_seeds()

    # -- helpers
    def _h(self, level, pattern):
        out = []
        for title, start, end in level_sections(self.lines, level):
            if re.match(pattern, title):
                out.append((title, start, end))
        return out

    def _subsections(self):
        res = {}
        for title, start, end in level_sections(self.lines, 3):
            m = re.match(r"(7\.\d)\b", title)
            if m:
                res[m.group(1)] = (title, start, end)
        return res

    def _parse_section6(self):
        for title, start, end in level_sections(self.lines, 2):
            if re.match(r"6\.", title):
                tbl = first_table(self.lines, start, end)
                if not tbl:
                    break
                for _ln, cells in tbl.rows:
                    if len(cells) >= 3 and re.fullmatch(r"GOV-0\d", cells[0]):
                        bt = backticked(cells[2])
                        if bt:
                            self.gov_paths[cells[0]] = bt[0]
        if not self.gov_paths:
            self.errors.append("section 6 GOV paths not found")

    def _item(self, number):
        sub = self.subsections.get("7.1")
        if not sub:
            return None
        _t, start, end = sub
        for ln in self.lines[start:end]:
            if ln.startswith("%d. " % number):
                return ln
        return None

    def _parse_conventions(self):
        self.verification = []
        self.deadline_re = None
        self.deciders = []
        self.roles = []
        self.marker_re = None
        self.placeholders = []
        self.pii_email = None
        self.pii_phone = None
        self.cite_docs = []

        ln = self._item(5)
        if ln:
            seen = []
            for w in re.findall(r"`([a-z][a-z0-9]*)`", ln):
                if w not in seen:
                    seen.append(w)
            self.verification = seen
        ln = self._item(6)
        if ln:
            for b in backticked(ln):
                if b.startswith("^before"):
                    self.deadline_re = b
        ln = self._item(8)
        if ln:
            seg = ln.split("**Decider vocabulary:**", 1)[-1]
            seg = seg.split(". ", 1)[0]
            self.deciders = backticked(seg)
        ln = self._item(9)
        if ln:
            m = re.search(r"\{([^}]*)\}", ln)
            if m:
                self.roles = backticked(m.group(1))
        ln = self._item(10)
        if ln:
            for b in backticked(ln):
                if b.startswith("^- Accepted"):
                    self.marker_re = b
        ln = self._item(11)
        if ln:
            self.placeholders = backticked(ln)
        ln = self._item(12)
        if ln:
            bt = backticked(ln)
            if len(bt) >= 2:
                self.pii_email, self.pii_phone = bt[0], bt[1]
        ln = self._item(13)
        if ln:
            self.cite_docs = [b for b in backticked(ln) if b.endswith(".md") and not b.startswith("docs/")]
        for label, val in (
            ("verification vocabulary", self.verification),
            ("deadline regex", self.deadline_re),
            ("decider vocabulary", self.deciders),
            ("preparer roles", self.roles),
            ("owner marker", self.marker_re),
            ("placeholder tokens", self.placeholders),
            ("PII email regex", self.pii_email),
            ("PII phone regex", self.pii_phone),
            ("citation documents", self.cite_docs),
        ):
            if not val:
                self.errors.append("7.1: " + label + " not found")

    def _parse_gov_sections(self):
        path_to_id = {p: g for g, p in self.gov_paths.items()}
        for key in ("7.2", "7.3", "7.4", "7.5", "7.6"):
            sub = self.subsections.get(key)
            if not sub:
                self.errors.append("section %s missing" % key)
                continue
            title, start, end = sub
            bt = [b for b in backticked(title) if b.startswith("docs/phases/P00/governance/")]
            path = bt[0] if bt else None
            gid = path_to_id.get(path)
            h2s, tables = [], {}
            body = self.lines[start:end]
            for idx, ln in enumerate(body):
                if ln.startswith("Required H2 headings:"):
                    h2s = re.findall(r"`(## [^`]+)`", ln)
                m = re.match(r"^\*\*([^*]+)\*\* table header:(.*)$", ln)
                if m:
                    name = m.group(1)
                    hit = re.search(r"`(\|[^`]+\|)`", m.group(2))
                    if not hit:
                        for nxt in body[idx + 1: idx + 3]:
                            hit = re.search(r"`(\|[^`]+\|)`", nxt)
                            if hit:
                                break
                    if hit:
                        tables[name] = split_row(hit.group(1))
                if "∈ {" in ln:
                    lm = re.match(r"^\s*- (.+?) ∈ \{([^}]*)\}", ln)
                    if lm:
                        self.vocabs[(gid, lm.group(1))] = backticked(lm.group(2))
            self.gov[gid or key] = {
                "section": key,
                "path": path,
                "h2": [h[3:] for h in h2s],
                "tables": tables,
            }

    def _parse_anchors(self):
        self.anchors = []
        self.norm_prefixes = []
        sub = self.subsections.get("7.3")
        if not sub:
            return
        _t, start, end = sub
        body = self.lines[start:end]
        for ln in body:
            if "At least one row must cover" in ln:
                self.norm_prefixes = [
                    b for b in backticked(ln) if re.fullmatch(r"§\d+(?:\.\d+)?", b)
                ]
        for i, ln in enumerate(body):
            if ln.startswith("| Anchor source |"):
                tbl = first_table(body, i)
                for _l, cells in tbl.rows:
                    if len(cells) < 2:
                        continue
                    src, rule = cells[0], cells[1]
                    docs = [b for b in backticked(src) if re.fullmatch(r"P\d\d/PHASE\.md", b)]
                    if docs:
                        doc = docs[0]
                    elif "TRACEABILITY.md" in backticked(src):
                        doc = "TRACEABILITY.md"
                    else:
                        self.errors.append("anchor row without document: " + src)
                        continue
                    qm = re.search(r'"([^"]+)"', src)
                    phases = sorted({m for m in PHASE_TOKEN_RE.findall(rule)})
                    if doc == "TRACEABILITY.md":
                        self.anchors.append(AnchorRow(doc, None, "", None, src))
                        continue
                    if len(phases) != 1:
                        self.errors.append("anchor rule must hold exactly one phase: " + rule)
                        continue
                    self.anchors.append(
                        AnchorRow(doc, qm.group(1) if qm else None, rule, "P" + phases[0], src)
                    )
                break
        if not self.anchors:
            self.errors.append("7.3 anchors not found")
        if not self.norm_prefixes:
            self.errors.append("7.3 normative prefixes not found")

    def expand_anchor_ids(self, row, spec):
        """Return (ids, problems) for an anchor row, expanded against the spec IDs."""
        text = row.ids_text
        ids, problems = set(), []
        defined = set(spec.req_ids)
        rest = text
        for m in re.finditer(r"(FR-[A-Z]{3}-\d{2}|NFR-\d{2})…(FR-[A-Z]{3}-\d{2}|NFR-\d{2})", text):
            a, b = m.group(1), m.group(2)
            if a not in defined or b not in defined:
                problems.append("range endpoint undefined: %s…%s" % (a, b))
                continue
            pa, pb = a.rsplit("-", 1)[0], b.rsplit("-", 1)[0]
            if pa != pb:
                problems.append("range crosses groups: %s…%s" % (a, b))
                continue
            lo, hi = int(a.rsplit("-", 1)[1]), int(b.rsplit("-", 1)[1])
            got = [r for r in defined if r.rsplit("-", 1)[0] == pa and lo <= int(r.rsplit("-", 1)[1]) <= hi]
            if not got:
                problems.append("empty range: %s…%s" % (a, b))
            ids.update(got)
        rest = re.sub(r"(FR-[A-Z]{3}-\d{2}|NFR-\d{2})…(FR-[A-Z]{3}-\d{2}|NFR-\d{2})", " ", rest)
        for m in re.finditer(r"(FR-[A-Z]{3})-\*", rest):
            got = [r for r in defined if r.startswith(m.group(1) + "-")]
            if not got:
                problems.append("empty wildcard: " + m.group(0))
            ids.update(got)
        rest = re.sub(r"FR-[A-Z]{3}-\*", " ", rest)
        for t in REQ_TOKEN_RE.findall(rest):
            if t not in defined:
                problems.append("undefined ID in anchor: " + t)
            else:
                ids.add(t)
        if not ids and not problems:
            problems.append("anchor expands to nothing: " + text)
        return sorted(ids), problems

    def _parse_deadline_anchors(self):
        self.deadline_anchors = []
        sub = self.subsections.get("7.5")
        if not sub:
            return
        _t, start, end = sub
        body = self.lines[start:end]
        for i, ln in enumerate(body):
            if ln.startswith("| IDs |"):
                tbl = first_table(body, i)
                for _l, cells in tbl.rows:
                    if len(cells) < 3:
                        continue
                    ids = sorted(set(re.findall(r"\b(?:D-\d{2}|ADR-\d{3})\b", cells[0])))
                    bm = re.search(r"≤ (P\d\d)", cells[1])
                    qm = re.search(r'"([^"]+)"', cells[2])
                    src = cells[2]
                    doc = None
                    dm = [b for b in backticked(src) if re.fullmatch(r"P\d\d/PHASE\.md", b)]
                    if dm:
                        doc = dm[0]
                    else:
                        rm = re.search(r"DECISION-REGISTER (ADR-\d{3})", src)
                        if rm:
                            doc = rm.group(1)
                    self.deadline_anchors.append(
                        {
                            "ids": ids,
                            "bound": bm.group(1) if bm else None,
                            "quote": qm.group(1) if qm else None,
                            "source": doc,
                            "raw": cells[0],
                        }
                    )
                break
        if not self.deadline_anchors:
            self.errors.append("7.5 deadline anchors not found")

    def _parse_seeds(self):
        self.seeds = []
        sub = self.subsections.get("7.7")
        if not sub:
            self.errors.append("section 7.7 missing")
            return
        _t, start, end = sub
        body = self.lines[start:end]
        for i, ln in enumerate(body):
            if ln.startswith("| Seed |"):
                tbl = first_table(body, i)
                for _l, cells in tbl.rows:
                    if len(cells) < 4:
                        continue
                    self.seeds.append(
                        {
                            "id": cells[0],
                            "tokens": backticked(cells[2]),
                            "blocking": "Expected Blocks P00 = yes" in cells[3],
                        }
                    )
                break
        if not self.seeds:
            self.errors.append("7.7 seeds not found")

    # -- formats compared between real and fixture plans (TC-P00-22-03)
    def formats(self):
        return {
            "gov": {k: self.gov[k] for k in sorted(self.gov)},
            "gov_paths": self.gov_paths,
            "vocabs": {"%s|%s" % k: v for k, v in sorted(self.vocabs.items(), key=lambda kv: (str(kv[0][0]), kv[0][1]))},
            "verification": self.verification,
            "deadline_re": self.deadline_re,
            "deciders": self.deciders,
            "roles": self.roles,
            "marker_re": self.marker_re,
            "placeholders": self.placeholders,
            "pii": [self.pii_email, self.pii_phone],
            "cite_docs": self.cite_docs,
        }

    def vocab(self, gid, label):
        return self.vocabs.get((gid, label), [])


def get_plan(repo):
    return repo.memo("plan", lambda: Plan(repo))


def get_spec(repo):
    return repo.memo("spec", lambda: Spec(repo))


def get_register(repo):
    return repo.memo("register", lambda: Register(repo))


def get_decisions(repo):
    return repo.memo("decisions", lambda: DecisionsMd(repo))


def get_trace(repo):
    return repo.memo("trace", lambda: Traceability(repo))


# --------------------------------------------------------------------------- citations


def doc_path(doc):
    if doc in ("TECHNICAL-SPEC.md", "README.md", "reference/README.md"):
        return "docs/source/" + doc
    if doc == "CLAUDE.md":
        return "CLAUDE.md"
    m = re.fullmatch(r"(P\d\d)/PHASE\.md", doc)
    if m:
        return "docs/phases/%s/PHASE.md" % m.group(1)
    return "docs/blueprint/" + doc


def citation_regex(plan):
    alts = []
    for d in plan.cite_docs:
        if d == "Pxx/PHASE.md":
            alts.append(r"P(?:0\d|1[0-5])/PHASE\.md")
        else:
            alts.append(re.escape(d))
    loc = r"(?:§\d+(?:\.\d+)?|header|App\. [AB]|ADR-\d{3}|FR-[A-Z]{3}-\d{2}|NFR-\d{2}|PG-\d{2}|X\d{1,2}|D-\d{2})"
    return re.compile(r"^(" + "|".join(alts) + r") (" + loc + r")$")


def parse_citations(cell, plan):
    """Return (good, bad): good = [(doc, loc)], bad = [raw text]."""
    rx = citation_regex(plan)
    good, bad = [], []
    for part in cell.split(";"):
        raw = " ".join(part.split())
        if not raw:
            bad.append(part)
            continue
        m = rx.match(raw)
        if m:
            good.append((m.group(1), m.group(2)))
        else:
            bad.append(raw)
    return good, bad


def doc_locations(repo, doc):
    """(section tokens, appendix tokens, exists) of a citation document."""

    def build():
        rel = doc_path(doc)
        if not repo.exists(rel):
            return (set(), set(), False)
        lines = lines_of(repo.read_text(rel))
        toks = section_tokens(lines)
        return ({t for t in toks if t.startswith("§")}, {t for t in toks if t.startswith("App.")}, True)

    return repo.memo(("doc", doc), build)


def citation_resolves(repo, doc, loc):
    secs, apps, exists = doc_locations(repo, doc)
    if not exists:
        return False
    if loc == "header":
        return True
    if loc.startswith("§"):
        return loc in secs
    if loc.startswith("App."):
        return loc in apps
    if loc.startswith("ADR-"):
        return doc == "DECISION-REGISTER.md" and loc in get_register(repo).rows
    if doc == "TECHNICAL-SPEC.md":
        spec = get_spec(repo)
        universe = set(spec.req_ids) | set(spec.pg_ids) | set(spec.x_ids) | set(spec.d_ids)
        return loc in universe
    return False


def valid_universe(repo):
    def build():
        spec = get_spec(repo)
        reg = get_register(repo)
        return (
            set(spec.req_ids)
            | set(spec.pg_ids)
            | set(spec.x_ids)
            | set(spec.d_ids)
            | set(reg.adr_ids)
            | set(spec.section_tokens)
        )

    return repo.memo("universe", build)
