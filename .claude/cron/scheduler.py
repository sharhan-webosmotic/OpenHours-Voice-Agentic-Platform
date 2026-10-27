#!/usr/bin/env python3
"""ADF Cron Scheduler: manages scheduled tasks for app-development-framework.

Usage:
    python scheduler.py list                                         Print all jobs as a table
    python scheduler.py tick                                         Print due jobs (stdout injected by hook)
    python scheduler.py create --id X --prompt Y --schedule Nd      Create a job
    python scheduler.py enable ID                                    Enable a job
    python scheduler.py disable ID                                   Disable a job
    python scheduler.py delete ID                                    Remove a job
    python scheduler.py update-ran ID                               Set last_run_at=now, advance next_run_at
"""

# Keeps the "X | None" annotations below from being evaluated at import time, so
# the documented "python scheduler.py ..." commands also run on Python 3.7 to 3.9.
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JOBS_FILE = os.path.join(SCRIPT_DIR, "jobs.json")

DURATION_MAP = {
    "30m":   timedelta(minutes=30),
    "1h":    timedelta(hours=1),
    "2h":    timedelta(hours=2),
    "4h":    timedelta(hours=4),
    "6h":    timedelta(hours=6),
    "12h":   timedelta(hours=12),
    "1d":    timedelta(days=1),
    "2d":    timedelta(days=2),
    "3d":    timedelta(days=3),
    "7d":    timedelta(days=7),
    "14d":   timedelta(days=14),
    "30d":   timedelta(days=30),
    "daily":   timedelta(days=1),
    "weekly":  timedelta(days=7),
    "monthly": timedelta(days=30),
}


def parse_duration(schedule: str) -> timedelta:
    s = schedule.strip().lower()
    if s in DURATION_MAP:
        return DURATION_MAP[s]
    for unit, seconds in [("m", 60), ("h", 3600), ("d", 86400)]:
        if s.endswith(unit):
            try:
                return timedelta(seconds=int(s[:-1]) * seconds)
            except ValueError:
                pass
    raise ValueError(f"Unknown schedule format: {schedule!r}. Use: 30m, 2h, 1d, 7d, daily, weekly, monthly")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat().replace("+00:00", "Z")


def parse_iso(ts) -> datetime | None:
    if not ts:
        return None
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def load_jobs() -> dict:
    if not os.path.exists(JOBS_FILE):
        return {"version": "1.0", "jobs": []}
    with open(JOBS_FILE) as f:
        return json.load(f)


def save_jobs(data: dict):
    with open(JOBS_FILE, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def calculate_next_run(schedule: str, from_time: datetime | None = None) -> str:
    delta = parse_duration(schedule)
    base = from_time or now_utc()
    return (base + delta).isoformat().replace("+00:00", "Z")


def find_job(data: dict, job_id: str) -> dict | None:
    for j in data.get("jobs", []):
        if j["id"] == job_id:
            return j
    return None


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_list():
    data = load_jobs()
    jobs = data.get("jobs", [])
    if not jobs:
        print("No scheduled jobs. Add one with: python scheduler.py create --id X --prompt Y --schedule Nd")
        return
    hdr = f"{'ID':<32} {'EN':<4} {'SCHED':<8} {'NEXT RUN (UTC)':<26} PROMPT"
    print(hdr)
    print("-" * len(hdr))
    for j in jobs:
        enabled = "yes" if j.get("enabled") else "no"
        next_run = (j.get("next_run_at") or "(not set)")[:25]
        prompt = (j.get("prompt") or "")[:50]
        print(f"{j['id']:<32} {enabled:<4} {j['schedule']:<8} {next_run:<26} {prompt}")


def cmd_tick():
    data = load_jobs()
    now = now_utc()
    due = []
    for j in data.get("jobs", []):
        if not j.get("enabled"):
            continue
        next_run = parse_iso(j.get("next_run_at"))
        if next_run and now >= next_run:
            delta = now - next_run
            if delta.days > 0:
                overdue = f"overdue {delta.days}d"
            elif delta.seconds >= 3600:
                overdue = f"overdue {delta.seconds // 3600}h"
            else:
                overdue = "due now"
            due.append({**j, "_overdue": overdue})

    if not due:
        return  # silent — no output when nothing is due

    print("## Scheduled Tasks Due")
    print()
    for j in due:
        desc = f" - {j['description']}" if j.get("description") else ""
        print(f"- **{j['id']}** ({j['_overdue']}): `{j['prompt']}`{desc}")
    print()
    print("Execute each task above, then run `python .claude/cron/scheduler.py update-ran <id>` for each.")


def cmd_create(raw_args):
    p = argparse.ArgumentParser(prog="scheduler.py create", add_help=False)
    p.add_argument("--id", required=True, dest="job_id")
    p.add_argument("--prompt", required=True)
    p.add_argument("--schedule", required=True)
    p.add_argument("--description", default="")
    try:
        args = p.parse_args(raw_args)
    except SystemExit:
        sys.exit(1)

    try:
        parse_duration(args.schedule)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    data = load_jobs()
    if find_job(data, args.job_id):
        print(f"Error: job '{args.job_id}' already exists. Use enable/disable to toggle it.", file=sys.stderr)
        sys.exit(1)

    job = {
        "id": args.job_id,
        "prompt": args.prompt,
        "schedule": args.schedule,
        "description": args.description,
        "enabled": True,
        "last_run_at": None,
        "next_run_at": calculate_next_run(args.schedule),
        "created_at": now_iso(),
    }
    data["jobs"].append(job)
    save_jobs(data)
    print(f"Created '{args.job_id}': runs every {args.schedule}, first run at {job['next_run_at']}")


def cmd_enable(job_id: str):
    data = load_jobs()
    j = find_job(data, job_id)
    if not j:
        print(f"Error: job '{job_id}' not found", file=sys.stderr)
        sys.exit(1)
    j["enabled"] = True
    if not j.get("next_run_at"):
        j["next_run_at"] = calculate_next_run(j["schedule"])
    save_jobs(data)
    print(f"Enabled '{job_id}', next run: {j['next_run_at']}")


def cmd_disable(job_id: str):
    data = load_jobs()
    j = find_job(data, job_id)
    if not j:
        print(f"Error: job '{job_id}' not found", file=sys.stderr)
        sys.exit(1)
    j["enabled"] = False
    save_jobs(data)
    print(f"Disabled '{job_id}'")


def cmd_delete(job_id: str):
    data = load_jobs()
    before = len(data["jobs"])
    data["jobs"] = [j for j in data["jobs"] if j["id"] != job_id]
    if len(data["jobs"]) == before:
        print(f"Error: job '{job_id}' not found", file=sys.stderr)
        sys.exit(1)
    save_jobs(data)
    print(f"Deleted '{job_id}'")


def cmd_update_ran(job_id: str):
    data = load_jobs()
    j = find_job(data, job_id)
    if not j:
        print(f"Error: job '{job_id}' not found", file=sys.stderr)
        sys.exit(1)
    now = now_utc()
    j["last_run_at"] = now.isoformat().replace("+00:00", "Z")
    j["next_run_at"] = calculate_next_run(j["schedule"], now)
    save_jobs(data)
    print(f"Updated '{job_id}': last_ran=now, next_run={j['next_run_at']}")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    dispatch = {
        "list":       lambda: cmd_list(),
        "tick":       lambda: cmd_tick(),
        "create":     lambda: cmd_create(args),
        "enable":     lambda: cmd_enable(args[0]) if args else _need_id("enable"),
        "disable":    lambda: cmd_disable(args[0]) if args else _need_id("disable"),
        "delete":     lambda: cmd_delete(args[0]) if args else _need_id("delete"),
        "update-ran": lambda: cmd_update_ran(args[0]) if args else _need_id("update-ran"),
    }

    if cmd not in dispatch:
        print(f"Unknown command: {cmd!r}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)

    dispatch[cmd]()


def _need_id(cmd: str):
    print(f"Error: '{cmd}' requires a job ID", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
