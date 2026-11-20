"""Deterministic, offline structural checks for the P01 architecture package."""
import copy
import re
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[4]
PATHS = {
    "KICK": "docs/phases/P01/kickoff.md",
    "PLAN": "docs/phases/P01/architecture/phase-plan.md",
    "DEC": "docs/phases/P01/decisions.md",
    "DOM": "docs/phases/P01/architecture/domain-model.md",
    "THR": "docs/phases/P01/architecture/threat-model.md",
    "REG": "docs/blueprint/DECISION-REGISTER.md",
    "SPEC": "docs/source/TECHNICAL-SPEC.md",
}
ADR_IDS = [f"ADR-{n:03}" for n in (2, 3, 4, 7, 8, 9, 10, 12, 13, 14, 15, 16,
                                     19, 20, 21, 22, 23, 25, 29, 33, 34, 36, 37, 38, 39)]
ADR_LINES = ("Status: **Accepted**", "Decider: Solution Architect (delegated, ADR-035)",
             "Date: 2026-11-02", "Source IDs:")
ADR_SECTIONS = ("Context", "Decision", "Alternatives considered", "Rationale",
                "Consequences", "Security/privacy impact", "Owner and date")
ENTITIES = ("User", "Resume", "LayoutSettings", "Header", "ContactItem", "Section",
            "TextContent", "ListContent", "EntriesContent", "Entry", "Photo")
RICH = ("Paragraph", "BulletList", "Text", "Link", "LineBreak")
SC = (1, 2, 5, 8, 9, 11, 17, 18, 19, 20, 21, 22, 23, 25, 26, 29, 30)
STRIDE = (("Spoofing", "SP"), ("Tampering", "TA"), ("Repudiation", "RE"),
          ("Information disclosure", "ID"), ("Denial of service", "DS"),
          ("Elevation of privilege", "EP"))
TOPICS = ("Authentication", "Guest-to-account claim", "Object storage access",
          "Export endpoints")
def section(text, number):
    match = re.search(rf"^## {number}\. [^\n]*\n(?P<body>.*?)(?=^## |\Z)",
                      text, re.M | re.S)
    return match.group("body") if match else ""
def rows(text):
    return [[cell.strip() for cell in line.strip().strip("|").split("|")]
            for line in text.splitlines() if line.startswith("|")]
def keyed(text, prefix):
    return {row[0]: row for row in rows(text) if row[0].startswith(prefix)}
def require(value, message):
    return [] if value else [message]
def adr(docs, identifier):
    return docs.get(identifier, "")
def complete(docs, identifier):
    body = adr(docs, identifier)
    errors = require(bool(body), f"{identifier} missing file")
    if not body:
        return errors
    errors += require(re.search(rf"^# {identifier}\b", body, re.M),
                      f"{identifier} missing H1")
    for line in ADR_LINES:
        errors += require(re.search(rf"^- {re.escape(line)}", body, re.M),
                          f"{identifier} missing {line}")
    for heading in ADR_SECTIONS:
        errors += require(re.search(rf"^## {re.escape(heading)}\s*$", body, re.M),
                          f"{identifier} missing ## {heading}")
    return errors
def keywords(docs, identifier, words):
    body = adr(docs, identifier).lower()
    return [f"{identifier} missing {word}" for word in words if word.lower() not in body]
def c_01(d):
    body = d["KICK"]
    roles = section(body, 2)
    row = next((r for r in rows(roles) if "Contract Architect" in r), [])
    i = row.index("Contract Architect") if row else -1
    errors = require(bool(body), "kickoff missing")
    errors += require(i >= 0 and i + 1 < len(row) and "no" in row[i + 1].lower(),
                      "Contract Architect Needed must be no")
    errors += require(re.search(r"^## 3\.[^\n]*ADR-035 B-4", body, re.M),
                      "kickoff §3 missing ADR-035 B-4")
    errors += require("None" in section(body, 4) and
                      re.search(r"^## 4\. Parallel slices", body, re.M),
                      "kickoff §4 Parallel slices missing None")
    errors += require(re.search(r"^## 5\.[^\n]*Decisions", body, re.M),
                      "kickoff §5 Decisions missing")
    return errors
def c_02(d):
    errors = complete(d, "ADR-007") + complete(d, "ADR-008")
    s5, s6 = section(d["PLAN"], 5), section(d["PLAN"], 6)
    rule = next((line for line in s5.splitlines() if line.startswith("1. ")), "")
    errors += require("only" in rule.lower() and "contract" in rule.lower(),
                      "PLAN §5 contract only link")
    errors += require("Rendering belongs to the frontend" in s5,
                      "PLAN §5 frontend rendering")
    for label in [*(f"F-BE-{n}" for n in range(1, 6)),
                  *(f"F-FE-{n}" for n in range(1, 4))]:
        for source in ("PLAN §6", "ADR-008"):
            text = s6 if source == "PLAN §6" else adr(d, "ADR-008")
            errors += require(label in text, f"{source} missing {label}")
    return errors
def c_03(d):
    return complete(d, "ADR-004") + keywords(d, "ADR-004", (
        "MongoDB", "8.x", "replica set", "Atlas", "Germany West Central",
        "majority", "RPO", "backup"))
def c_04(d):
    return complete(d, "ADR-009") + keywords(d, "ADR-009", (
        "Azure Blob Storage", "Germany West Central", "private", "through the API",
        "key", "re-encod", "export", "Azurite"))
def c_05(d):
    errors = sum((complete(d, x) for x in
                  ("ADR-036", "ADR-013", "ADR-014", "ADR-015", "ADR-038")), [])
    return errors + keywords(d, "ADR-036", (
        "PBKDF2", "210", "session", "HttpOnly", "CSRF", "token", "enumeration"))
def c_06(d):
    errors = complete(d, "ADR-010") + keywords(d, "ADR-010", (
        "layout engine", "PageModel", "PDF", "TXT", "Candidate", "prototype",
        "go/no-go", "parity", "NFR-01", "NFR-03", "fidelity", "determinis",
        "P10", "fallback"))
    table = keyed(adr(d, "ADR-010"), "G")
    for n in range(1, 7):
        errors += require(f"G{n}" in table, f"ADR-010 missing G{n}")
    return errors
def c_07(d):
    errors = sum((complete(d, x) for x in ("ADR-012", "ADR-033", "ADR-034")), [])
    for identifier, words in (("ADR-012", ("D-20", "Germany West Central")),
                              ("ADR-033", ("Germany West Central",)),
                              ("ADR-034", ("Europe",)),
                              ("ADR-004", ("Germany West Central",)),
                              ("ADR-009", ("Germany West Central",))):
        errors += keywords(d, identifier, words)
    return errors
def c_08(d):
    body = d["DOM"]
    errors = require(bool(body), "domain model missing")
    for name in ENTITIES + RICH:
        errors += require(re.search(rf"\b{re.escape(name)}\b", body),
                          f"domain missing {name}")
    for word in ("Invariants", "Limits", "Identifiers", "Persistence mapping"):
        errors += require(re.search(rf"^#+ .*{re.escape(word)}", body, re.M | re.I),
                          f"domain missing heading {word}")
    spec = d["SPEC"]
    s10 = re.search(r"^### 10\.1[^\n]*\n(.*?)(?=^### 10\.2|\Z)", spec, re.M | re.S)
    block = re.search(r"```[^\n]*\n(.*?)```", s10.group(1), re.S) if s10 else None
    names = set(re.findall(r"^([A-Z]\w+)\s+\{", block.group(1), re.M)) if block else set()
    errors += require(names == set(ENTITIES),
                      f"SPEC §10.1 entities differ: {sorted(names ^ set(ENTITIES))}")
    return errors
def c_09(d):
    body = d["THR"]
    s4, s5, s6, s9 = (section(body, n) for n in (4, 5, 6, 9))
    errors = []
    for n, (name, prefix) in enumerate(STRIDE, 1):
        match = re.search(rf"^### 4\.{n} {re.escape(name)}\s*\n(.*?)(?=^### 4\.|\Z)",
                          s4, re.M | re.S)
        errors += require(match, f"threat missing STRIDE {name}")
        if match:
            errors += require(re.search(rf"^\| T-{prefix}-\d\d \|", match.group(1), re.M),
                              f"threat {name} missing T-{prefix} row")
    for row in rows(s4):
        if not re.fullmatch(r"T-[A-Z]{2}-\d\d", row[0]):
            continue
        errors += require(len(row) == 7 and all(row), f"{row[0]} invalid cells")
        errors += require(len(row) == 7 and re.search(r"P\d\d", row[5]),
                          f"{row[0]} invalid Phase")
    topic_rows = rows(s5)
    for topic in TOPICS:
        errors += require(any(topic in row[0] for row in topic_rows),
                          f"threat §5 missing {topic}")
    errors += require(bool(s6) and "deletion" in s6.lower() and
                      "portability" in s6.lower(), "threat §6 deletion/portability")
    errors += require(bool(s9) and "- [ ]" not in s9, "threat §9 unchecked item")
    for label in [*(name for name, _ in STRIDE), *TOPICS, "logs",
                  "Account deletion and data export"]:
        errors += require(label.lower() in s9.lower(), f"threat §9 missing {label}")
    return errors
def c_10(d):
    table = keyed(section(d["PLAN"], 8), "ADR-")
    errors = require(set(table) == set(ADR_IDS),
                     f"PLAN §8 ADR IDs differ: {sorted(set(table) ^ set(ADR_IDS))}")
    for identifier in ADR_IDS:
        row = table.get(identifier, [])
        errors += require(len(row) == 4, f"PLAN §8 {identifier} row shape")
        path = re.search(r"`(ADR-[^`]+\.md)`", row[2]) if len(row) > 2 else None
        errors += require(path and path.group(1) == d.get(identifier + "_file"),
                          f"PLAN §8 {identifier} missing ADR file")
        errors += complete(d, identifier)
    return errors
def c_11(d):
    table = keyed(d["REG"], "ADR-")
    errors = []
    for identifier in ADR_IDS + ["ADR-032"]:
        row = table.get(identifier, [])
        allowed = {"REQUIRED"} if identifier == "ADR-010" else {"ACCEPTED", "FIXED"}
        status = row[2] if len(row) > 2 else "missing"
        errors += require(status in allowed, f"{identifier} status {status}")
        target = d.get(("ADR-012" if identifier == "ADR-032" else identifier) + "_file", "")
        errors += require(len(row) > 3 and f"decisions/{target}" in row[3],
                          f"{identifier} missing ADR link")
    for n in range(36, 41):
        errors += require(f"ADR-{n:03}" in table, f"ADR-{n:03} unregistered")
    for n in (6, 17, 18, 24, 26, 27, 28, 30, 31, 40):
        identifier = f"ADR-{n:03}"
        row = table.get(identifier, [])
        status = row[2] if len(row) > 2 else "missing"
        allowed = {"OPEN", "SOURCE-OPEN", "PROPOSED"}
        if n == 6 and len(row) > 3 and "decided in P02" in row[3]:
            allowed.add("FIXED")
        errors += require(status in allowed, f"{identifier} future status {status}")
    return errors
def c_12(d):
    s2, s3 = section(d["DEC"], 2), section(d["DEC"], 3)
    decision_rows = [r for r in rows(s2) if re.fullmatch(r"DD-P01-\d\d", r[0])]
    errors = require(bool(decision_rows), "decisions §2 missing rows")
    numbers = [int(row[0][-2:]) for row in decision_rows]
    errors += require(numbers == list(range(1, len(numbers) + 1)),
                      "decisions §2 IDs not unique/consecutive")
    for row in decision_rows:
        errors += require(len(row) == 7, f"{row[0]} invalid cells")
        errors += require(len(row) == 7 and "DELEGATED-DEFAULT" in row[3],
                          f"{row[0]} missing DELEGATED-DEFAULT")
        errors += require(len(row) == 7 and all(row[i] for i in (2, 4, 5)),
                          f"{row[0]} missing options/reason/reference")
    conflicts = keyed(s3, "SC-")
    for n in SC:
        identifier = f"SC-{n:02}"
        row = conflicts.get(identifier, [])
        errors += require(len(row) >= 3 and bool(row[2]),
                          f"decisions §3 missing {identifier} resolution")
    return errors
CHECKS = [(f"C-{n:02}", name, globals()[f"c_{n:02}"]) for n, name in enumerate((
    "kickoff", "boundaries", "persistence", "file-storage", "auth", "rendering",
    "eu-hosting", "domain", "threat", "adrs", "register", "decisions"), 1)]
def replace(d, key, old, new):
    assert old in d[key], f"mutation source absent: {key}: {old}"
    d[key] = d[key].replace(old, new, 1)
def drop_section(d, key, n):
    d[key] = re.sub(rf"^## {n}\.[^\n]*\n.*?(?=^## |\Z)", "", d[key],
                    count=1, flags=re.M | re.S)
def change_row(d, key, identifier, cell, value):
    lines = d[key].splitlines(keepends=True)
    for i, line in enumerate(lines):
        row = [x.strip() for x in line.strip().strip("|").split("|")]
        if line.startswith("|") and row[0] == identifier:
            row[cell] = value
            lines[i] = "| " + " | ".join(row) + " |\n"
            d[key] = "".join(lines)
            return
    raise AssertionError(f"mutation row absent: {identifier}")
def mutate(d, name):
    if name == "N-01a": change_row(d, "KICK", "4", 2, "yes")
    elif name == "N-01b": drop_section(d, "KICK", 4)
    elif name == "N-02": replace(d, "PLAN", "F-BE-4", "removed")
    elif name == "N-03": d["ADR-004"] = re.sub("majority", "removed", d["ADR-004"], flags=re.I)
    elif name == "N-04": d["ADR-009"] = re.sub("private", "public", d["ADR-009"], flags=re.I)
    elif name == "N-05": d["ADR-038"] = re.sub(r"^- Status:.*\n", "", d["ADR-038"], count=1, flags=re.M)
    elif name == "N-06": d["ADR-010"] = re.sub(r"^\| G6 \|.*\n", "", d["ADR-010"], count=1, flags=re.M)
    elif name == "N-07": d["ADR-034"] = re.sub("Europe", "removed", d["ADR-034"], flags=re.I)
    elif name == "N-08": d["DOM"] = d["DOM"].replace("ContactItem", "RemovedEntity")
    elif name == "N-09a": d["THR"] = re.sub(r"^### 4\.3 Repudiation\n.*?(?=^### 4\.4)", "", d["THR"], flags=re.M | re.S)
    elif name == "N-09b": change_row(d, "THR", "T-SP-01", 6, "")
    elif name == "N-09c": replace(d, "THR", "- [x] STRIDE", "- [ ] STRIDE")
    elif name == "N-09d": change_row(d, "THR", "**Export endpoints**", 0, "Removed topic")
    elif name == "N-10a": replace(d, "ADR-016", "## Alternatives considered", "## Removed heading")
    elif name == "N-10b": replace(d, "PLAN", "ADR-016-trash-retention.md", "ADR-016-missing.md")
    elif name == "N-11a": change_row(d, "REG", "ADR-029", 2, "OPEN")
    elif name == "N-11b": change_row(d, "REG", "ADR-033", 3, "No link")
    elif name == "N-11c": change_row(d, "REG", "ADR-017", 2, "ACCEPTED")
    elif name == "N-11d": change_row(d, "REG", "ADR-029", 2, "REQUIRED")
    elif name == "N-12a": replace(d, "DEC", "`DELEGATED-DEFAULT`: 4 projects", "4 projects")
    elif name == "N-12b": d["DEC"] = re.sub(r"^\| SC-25 \|.*\n", "", d["DEC"], count=1, flags=re.M)
NEGATIVES = [
    (name, globals()[f"c_{int(name[2:4]):02}"])
    for name in ("N-01a", "N-01b", "N-02", "N-03", "N-04", "N-05", "N-06",
                 "N-07", "N-08", "N-09a", "N-09b", "N-09c", "N-09d", "N-10a", "N-10b",
                 "N-11a", "N-11b", "N-11c", "N-11d", "N-12a", "N-12b")]
def load():
    docs = {key: (ROOT / path).read_text(encoding="utf-8") if (ROOT / path).is_file() else ""
            for key, path in PATHS.items()}
    for row in rows(section(docs["PLAN"], 8)):
        if row and row[0] in ADR_IDS and len(row) > 2:
            match = re.search(r"`(ADR-[^`]+\.md)`", row[2])
            if match:
                filename = match.group(1)
                docs[row[0] + "_file"] = filename
                path = ROOT / "docs/blueprint/decisions" / filename
                docs[row[0]] = path.read_text(encoding="utf-8") if path.is_file() else ""
    return docs
def main():
    docs = load()
    failures = 0
    for label, name, check in CHECKS:
        errors = check(docs)
        failures += bool(errors)
        print(f"{'FAIL' if errors else 'PASS'} {label} {name}" +
              (": " + "; ".join(errors) if errors else ""))
    for label, check in NEGATIVES:
        changed = copy.deepcopy(docs)
        try:
            mutate(changed, label)
            errors = check(changed)
        except AssertionError as error:
            errors = []
            detail = str(error)
        else:
            detail = "check cannot fail" if not errors else ""
        failures += not bool(errors)
        print(f"{'PASS' if errors else 'FAIL'} {label} {check.__name__[2:]}" +
              (f": {detail}" if detail else ""))
    print(f"RESULT {'PASS' if not failures else 'FAIL'} checks={len(CHECKS)} "
          f"negatives={len(NEGATIVES)} failures={failures}")
    return bool(failures)
if __name__ == "__main__":
    sys.exit(main())
