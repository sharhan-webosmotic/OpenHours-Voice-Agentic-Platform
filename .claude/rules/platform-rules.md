---
paths:
  - "**/*.sh"
  - "hooks/**"
  - ".claude/hooks/**"
---

# Platform Command Rules

Applies on a non-Unix shell (primarily Windows / Git Bash).
Loaded conditionally by `/skill-router`.

## Shell environment assumptions

On Windows, the framework assumes **Git Bash** (MinGW) or **WSL** is available. PowerShell is a secondary fallback, but scripts are bash-first.

## Paths

- Always use forward slashes `/` — Git Bash and WSL accept them transparently
- Never use backslashes `\` in command arguments even on Windows
- Quote paths with spaces: `"/c/Program Files/..."`

## Null device

- Use `/dev/null` always (works on Git Bash)
- Never use `NUL` or `nul` — bash interprets them as literal filenames

## Environment variables

- Use `$VAR` syntax — not `%VAR%`
- In npm scripts that set env vars, use `cross-env` (Windows-safe)

## Command aliases

| Unix | Windows fallback |
|---|---|
| `which` | `type -p` (POSIX); `where` only in cmd.exe |
| `cat` | `cat` (Git Bash has it) — do not use `type` |
| `ls` | `ls` (Git Bash has it) — do not use `dir` |
| `grep` | `grep` (Git Bash has it) — do not use `findstr` |
| `rm -rf dir/` | Prefer `rimraf` in npm scripts for cross-platform safety |
| `cp -r` | `cp -r` in Git Bash |
| `sed -i` | Requires `''` suffix on BSD sed; Git Bash GNU sed does not. Prefer `sed` without `-i` piped to file rewrite |

## Shebang

- Scripts should start with `#!/usr/bin/env bash` — resolves via PATH on all platforms
- Never use `#!/bin/bash` directly — may not exist on Windows

## Line endings

- Commit scripts with LF endings (`.gitattributes` enforces `eol=lf` on `*.sh`)
- Windows Git Bash tolerates both, but `\r\n` breaks hash-bangs

## Banned in framework scripts

- `dir` — use `ls`
- `type FILE` — use `cat FILE`
- `del` — use `rm`
- `copy` — use `cp`
- `move` — use `mv`
- `start` — use appropriate script invocation
- CRLF line endings in any `.sh` file

## Framework scripts requiring special attention

- `setup.sh`: runs on all platforms
- `hooks/*.sh` — must be bash-compatible; PowerShell invocation uses `bash hook.sh` via settings.json
- `skill-lab/*.sh` — executed as-is; same constraints

## Claude Code settings consideration

On Windows, `settings.json` hook entries should use: `"command": "bash hooks/foo.sh"` rather than `"./hooks/foo.sh"` to ensure bash resolves the script.
<!-- Version: +paths | 2026-08-06 | paths: scoping added (v4.18.0 rules-loading redesign): no session-start autoload; loads when matching files are touched or a skill reads it explicitly -->
<!-- Version: 1.0.1 | 2026-10-05 | Removed two references to AI_DOCS/memory/platform.md: nothing in the framework writes or reads that file, so the rule now simply applies on a non-Unix shell and setup.sh is no longer said to write it -->
