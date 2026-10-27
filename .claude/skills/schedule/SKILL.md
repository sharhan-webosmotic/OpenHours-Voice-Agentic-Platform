---
name: schedule
description: "Manage ADF scheduled tasks: create, list, enable, disable, and run recurring automations such as security audits, drift checks, and skill curation. Triggers on: 'add a schedule', 'schedule a task', 'create a cron job', 'automate recurring task', 'list scheduled jobs', 'enable scheduled', 'disable scheduled', 'run scheduled task', 'set up weekly audit', 'set up daily check', 'what jobs are scheduled', 'show cron jobs'."
effort: medium
next_skill: null
required_gate: null
skill_id: SK-135
context_budget:
  load_kb: 5
  scope: session
version: 1.0.6
dependencies:
  required: []
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: utility
  user_facing: true
---

# Schedule — ADF Cron Manager

> **Purpose**: Manage recurring automated tasks for the project
> **Audience**: End user
> **Trigger**: User wants to schedule, list, enable, or manage recurring automated tasks

---

## Commands

| Command | Action |
|---|---|
| `/schedule list` | Show all scheduled jobs with status |
| `/schedule add "<prompt>" every <interval> [as <id>]` | Create a new job |
| `/schedule enable <id>` | Enable a disabled job |
| `/schedule disable <id>` | Disable a job without deleting it |
| `/schedule delete <id>` | Permanently remove a job |
| `/schedule run <id>` | Execute a job immediately and reset its timer |

## Supported interval formats

| Format | Meaning |
|---|---|
| `30m` | Every 30 minutes |
| `2h`, `6h`, `12h` | Every N hours |
| `1d`, `daily` | Every day |
| `7d`, `weekly` | Every week |
| `14d` | Every 2 weeks |
| `30d`, `monthly` | Every month |

## Built-in jobs (ship disabled — enable when ready)

| ID | Prompt | Interval |
|---|---|---|
| `weekly-security-audit` | `/audit` | `7d` |
| `daily-drift-check` | `bash .claude/hooks/drift-detector.sh` | `1d` |
| `weekly-skill-curator` | `/skill-curator` | `7d` |

A prompt is either a slash command or a shell command. Drift detection is a hook script, not a skill, so `daily-drift-check` runs that script directly.

---

## How jobs fire

On `SessionStart`, `hooks/cron-tick.sh` checks `cron/jobs.json` for enabled jobs where `next_run_at <= now`. If any are due, it injects a `## Scheduled Tasks Due` block into the session context.

Rate limit: the hook fires at most once every 50 minutes to prevent repeated triggers during quick session restarts.

## Execution protocol (when `## Scheduled Tasks Due` appears at session start)

1. Acknowledge: "Running scheduled task: `<id>`"
2. Execute the listed prompt
3. After completion, run: `python .claude/cron/scheduler.py update-ran <id>`
4. Proceed — no user confirmation needed for enabled scheduled tasks

---

## Step-by-step procedures

### Adding a job

1. Parse the request for: prompt, interval, optional ID
2. Generate an ID if not provided: kebab-case slug from the prompt (e.g., `daily-security-check`)
3. Run: `python .claude/cron/scheduler.py create --id <id> --prompt "<prompt>" --schedule <interval> [--description "<desc>"]`
4. Confirm: "Scheduled `<id>` — runs `<prompt>` every `<interval>`. First run at `<next_run_at>`."

### Listing jobs

1. Run: `python .claude/cron/scheduler.py list`
2. Display the output as a readable table
3. Note which jobs are enabled vs. disabled

### Running a job immediately

1. Execute the job's prompt directly
2. Run: `python .claude/cron/scheduler.py update-ran <id>`
3. Report: "Ran `<id>`. Next scheduled: `<next_run_at>`."

### Enabling / disabling

Run: `python .claude/cron/scheduler.py enable <id>` or `disable <id>`

When enabling a job that was never run before, a `next_run_at` is calculated automatically (now + interval).

---

Skill schedule complete. Memory updated.
Checkpoint: cron/jobs.json, safe to compact.

<!-- Version: 1.0.6 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
