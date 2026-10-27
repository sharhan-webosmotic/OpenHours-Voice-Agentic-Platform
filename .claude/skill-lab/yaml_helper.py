#!/usr/bin/env python3
"""yaml_helper.py — small CLI used by run-trigger-tests.sh.

Replaces the subset of yq operations the runner needs so the harness doesn't
require yq to be installed. Uses PyYAML (pip install pyyaml).

Commands:
  get-category     SKILL_NAME CATALOG_PATH
  list-skills      CATALOG_PATH
  count-status     STATUS CATALOG_PATH
  update-trigger   CATALOG_PATH SKILL_NAME SCORE STATUS DATE
  update-meta      CATALOG_PATH KEY VALUE
  prompts-count    SPEC_PATH
  read-prompt      SPEC_PATH INDEX FIELD
  progress-init    PROGRESS_PATH TIMESTAMP DATE
  progress-append  PROGRESS_PATH SKILL SCORE VERDICT DATE
  progress-has     PROGRESS_PATH SKILL DATE
"""
import json
import sys
from pathlib import Path

# Prefer ruamel.yaml — preserves comments and formatting on round-trip.
# Fall back to PyYAML if ruamel.yaml isn't installed (loses comments).
try:
    from ruamel.yaml import YAML
    _yaml = YAML()
    _yaml.preserve_quotes = True
    _yaml.width = 4096
    _yaml.indent(mapping=2, sequence=2, offset=0)
    _USING_RUAMEL = True

    def _load(path):
        with open(path, "r", encoding="utf-8") as f:
            return _yaml.load(f) or {}

    def _dump(path, data):
        # newline="\n": Windows text mode would otherwise rewrite the whole
        # catalog with CRLF on every scoring run (huge diffs, broken greps).
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            _yaml.dump(data, f)

except ImportError:
    try:
        import yaml
    except ImportError:
        sys.stderr.write("ERROR: install ruamel.yaml (preferred) or PyYAML:\n"
                         "       pip install ruamel.yaml\n")
        sys.exit(3)
    _USING_RUAMEL = False

    def _load(path):
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def _dump(path, data):
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True,
                           default_flow_style=False)


def cmd_get_category(skill_name, catalog_path):
    data = _load(catalog_path)
    for s in data.get("skills", []):
        if s.get("name") == skill_name:
            print(s.get("category", ""))
            return
    print("")


def cmd_list_skills(catalog_path):
    data = _load(catalog_path)
    for s in data.get("skills", []):
        name = s.get("name")
        if name:
            print(name)


def cmd_count_status(status, catalog_path):
    data = _load(catalog_path)
    n = sum(1 for s in data.get("skills", []) if s.get("trigger_status") == status)
    print(n)


def cmd_update_trigger(catalog_path, skill_name, score, status, date):
    data = _load(catalog_path)
    for s in data.get("skills", []):
        if s.get("name") == skill_name:
            s["trigger_last_score"] = int(score)
            s["trigger_status"] = status
            s["trigger_last_run"] = date
            break
    _dump(catalog_path, data)


def cmd_update_meta(catalog_path, key, value):
    data = _load(catalog_path)
    meta = data.setdefault("meta", {})
    # Try to coerce numeric-looking values
    try:
        meta[key] = int(value)
    except ValueError:
        meta[key] = value
    _dump(catalog_path, data)


def cmd_prompts_count(spec_path):
    data = _load(spec_path)
    print(len(data.get("prompts", [])))


def cmd_read_prompt(spec_path, index, field):
    data = _load(spec_path)
    prompts = data.get("prompts", [])
    idx = int(index)
    if idx < 0 or idx >= len(prompts):
        print("")
        return
    val = prompts[idx].get(field, "")
    if isinstance(val, bool):
        print("true" if val else "false")
    else:
        print(val)


def cmd_progress_init(progress_path, timestamp, date):
    data = {
        "run_started": timestamp,
        "date": date,
        "skills_completed": [],
        "last_skill": None,
    }
    with open(progress_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2)


def cmd_progress_append(progress_path, skill, score, verdict, date):
    try:
        with open(progress_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = {"skills_completed": [], "last_skill": None}
    data.setdefault("skills_completed", []).append(
        {"name": skill, "score": int(score), "verdict": verdict, "date": date}
    )
    data["last_skill"] = skill
    with open(progress_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2)


def cmd_progress_has(progress_path, skill, date):
    try:
        with open(progress_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print("no")
        return
    for entry in data.get("skills_completed", []):
        if entry.get("name") == skill and entry.get("date") == date:
            print("yes")
            return
    print("no")


COMMANDS = {
    "get-category": (cmd_get_category, 2),
    "list-skills": (cmd_list_skills, 1),
    "count-status": (cmd_count_status, 2),
    "update-trigger": (cmd_update_trigger, 5),
    "update-meta": (cmd_update_meta, 3),
    "prompts-count": (cmd_prompts_count, 1),
    "read-prompt": (cmd_read_prompt, 3),
    "progress-init": (cmd_progress_init, 3),
    "progress-append": (cmd_progress_append, 5),
    "progress-has": (cmd_progress_has, 3),
}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    cmd = sys.argv[1]
    if cmd not in COMMANDS:
        sys.stderr.write(f"Unknown command: {cmd}\n{__doc__}")
        sys.exit(2)
    fn, argc = COMMANDS[cmd]
    args = sys.argv[2:]
    if len(args) != argc:
        sys.stderr.write(f"{cmd} expects {argc} args, got {len(args)}\n")
        sys.exit(2)
    fn(*args)


if __name__ == "__main__":
    main()
