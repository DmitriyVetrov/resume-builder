#!/usr/bin/env python3
"""Token-usage log for phase runs. Hook for SubagentStop and Stop.

SubagentStop: sums `usage` over the finished subagent's own transcript.
Stop: sums `usage` over the main-session transcript (cumulative snapshot per turn).

Appends one JSON line per event to <project transcript dir>/usage/usage-log.ndjson,
next to the session transcripts and outside the repository, so the log does not
show up in phase scope diffs. Only ids, model names and token counts are written,
never message content. Always exits 0: a logging failure must not block an agent.

Reading the log: for a subagent take the latest row per agent_id, for the main
session the latest row per session_id (rows are cumulative snapshots).
"""
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

FIELDS = ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
PHASE = re.compile(r"\bP(\d{2})\b")


def wait_until_stable(path, timeout=3.0, step=0.4):
    # Transcripts are flushed asynchronously; wait for the size to stop changing.
    last = -1
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        size = path.stat().st_size
        if size == last:
            return
        last = size
        time.sleep(step)


def sum_usage(path):
    # A message is repeated once per content block; keep the final copy per message id.
    best = {}
    first = last = None
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            ts = d.get("timestamp")
            if ts:
                first = first or ts
                last = ts
            m = d.get("message")
            if not isinstance(m, dict) or m.get("role") != "assistant" or not m.get("usage"):
                continue
            key = m.get("id") or d.get("uuid")
            u = m["usage"]
            if key not in best or (u.get("output_tokens") or 0) >= (best[key][0].get("output_tokens") or 0):
                best[key] = (u, m.get("model"))
    totals = dict.fromkeys(FIELDS, 0)
    models = {}
    for u, model in best.values():
        models[model] = models.get(model, 0) + 1
        for f in FIELDS:
            totals[f] += u.get(f) or 0
    return totals, models, len(best), first, last


def first_prompt_phase(path):
    with path.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            m = d.get("message")
            if not isinstance(m, dict) or m.get("role") != "user":
                continue
            content = m.get("content")
            if isinstance(content, list):
                content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            hit = PHASE.search(content) if isinstance(content, str) else None
            return f"P{hit.group(1)}" if hit else None
    return None


def subagent_fields(data, path):
    desc = ""
    try:
        desc = json.loads(path.with_suffix(".meta.json").read_text(encoding="utf-8")).get("description") or ""
    except (OSError, ValueError):
        pass
    hit = PHASE.search(desc)
    phase = f"P{hit.group(1)}" if hit else first_prompt_phase(path)
    return {"agent_id": data.get("agent_id"), "agent_type": data.get("agent_type"),
            "description": desc, "phase": phase}


def build_row(data, event):
    key = "agent_transcript_path" if event == "SubagentStop" else "transcript_path"
    path = Path(data[key]).expanduser()
    wait_until_stable(path)
    totals, models, calls, first, last = sum_usage(path)
    row = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "event": event, "session_id": data.get("session_id")}
    if event == "SubagentStop":
        row.update(subagent_fields(data, path))
    row.update(calls=calls, models=models, **totals, first_ts=first, last_ts=last, transcript=str(path))
    return row


def main():
    data = json.load(sys.stdin)
    event = data.get("hook_event_name")
    if event not in ("SubagentStop", "Stop") or not data.get("transcript_path"):
        return
    try:
        row = build_row(data, event)
    except Exception as exc:  # keep a trace of failures without ever blocking the agent
        row = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), "event": "error",
               "hook_event": event, "session_id": data.get("session_id"),
               "error": f"{type(exc).__name__}: {exc}"}
    log = Path(data["transcript_path"]).expanduser().parent / "usage" / "usage-log.ndjson"
    log.parent.mkdir(exist_ok=True)
    with log.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
