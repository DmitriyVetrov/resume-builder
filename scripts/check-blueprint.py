from pathlib import Path

root = Path(__file__).resolve().parents[1]

# ADR-051: the eight pipeline roles are retired; phase-coordinator stays a read-only
# gate checker and the external review runs from .claude/review-prompt.md via codex review.
AGENTS = ["phase-coordinator"]
COMMANDS = ["blueprint-status", "phase", "review-phase", "close-phase"]
BLUEPRINT = [
    "PROJECT-CHARTER.md", "DECISION-REGISTER.md", "ARCHITECTURE.md", "AGENT-WORKFLOW.md",
    "PHASE-GATES.md", "REPOSITORY-STRUCTURE.md", "TEST-STRATEGY.md", "TRACEABILITY.md",
    "decisions/README.md", "templates/codex-task.md",
]
# ADR-051 S-7: kickoff.md, dependencies.md and implementation/*-tasks.md are no longer
# required; closed phases P00-P05 keep the copies they already have.
PHASE_ARTIFACTS = [
    "PHASE.md", "PHASE-STATUS.md", "acceptance-criteria.md", "decisions.md",
    "qa-report.md", "architecture/phase-plan.md", "tests/test-plan.md", "tests/test-results.md",
    "review/code-review.md",
]

required = ["CLAUDE.md", "README.md", "contracts/openapi/README.md", ".claude/review-prompt.md",
            "docs/source/TECHNICAL-SPEC.md", "docs/source/README.md", "docs/phases/README.md"]
required += [f".claude/agents/{a}.md" for a in AGENTS]
required += [f".claude/commands/{c}.md" for c in COMMANDS]
required += [f"docs/blueprint/{b}" for b in BLUEPRINT]

phases = [f"P{i:02d}" for i in range(16)]
required += [f"docs/phases/{p}/{a}" for p in phases for a in PHASE_ARTIFACTS]

missing = [p for p in required if not (root / p).exists()]

# Every agent file must pin model and effort.
unpinned = []
for a in AGENTS:
    f = root / f".claude/agents/{a}.md"
    if f.exists():
        head = f.read_text(encoding="utf-8").split("---")[1]
        if "\nmodel:" not in head or "\neffort:" not in head:
            unpinned.append(a)

extra_phases = sorted(p.parent.name for p in (root / "docs/phases").glob("P*/PHASE.md")
                      if p.parent.name not in phases)

print(f"Blueprint root: {root}")
print(f"Checked {len(required)} required files, {len(AGENTS)} agents")
problems = False
if missing:
    print("Missing:", *missing, sep="\n- ")
    problems = True
if unpinned:
    print("Agents without model/effort:", *unpinned, sep="\n- ")
    problems = True
if extra_phases:
    print("Unexpected phases:", *extra_phases, sep="\n- ")
    problems = True
if problems:
    raise SystemExit(1)
print("Blueprint structure OK")
