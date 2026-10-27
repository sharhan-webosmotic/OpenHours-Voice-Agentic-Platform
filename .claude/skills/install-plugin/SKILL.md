---
name: install-plugin
description: "Install or list ADF plugins. Install mode copies skills, hooks, agents, and rules from a plugin directory into .claude/. List mode shows installed plugins and available official plugins. Triggers on: 'install plugin', 'add plugin', 'install extension', 'install github-actions plugin', 'add a plugin to ADF', 'extend ADF with', 'install official plugin', 'list plugins', 'show plugins', 'what plugins are installed', 'which plugins do I have', 'available plugins', 'show installed extensions', 'plugin registry'."
effort: medium
next_skill: null
required_gate: null
skill_id: SK-136
context_budget:
  load_kb: 5
  scope: session
version: 1.1.0
dependencies:
  required: []
  optional: []
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: meta
  user_facing: true
---

# Install Plugin

> **Purpose**: Install an ADF plugin into the current project, or list installed and available plugins
> **Audience**: End user
> **Trigger**: User wants to install or add a plugin, or to see which plugins are installed or available

---

## Modes

| Mode | Triggered by | What it does |
|---|---|---|
| `install` (default) | "install plugin", "add plugin", a plugin name | Resolves the path, runs the installer, reports the result |
| `list` | "list plugins", "show plugins", "what plugins are installed", `/install-plugin list` | Read-only. Shows installed and available official plugins |

`list` replaces the retired `list-plugins` skill (v4.32.0).

---

## Mode: install

### What it does

1. Resolves the plugin path (official, user, or absolute)
2. Runs `scripts/install-plugin.sh <path>`
3. Reports what was installed

### Path resolution

| Input | Resolved path |
|---|---|
| `github-actions` | `.claude/plugins/official/github-actions` |
| `user/my-plugin` | `.claude/plugins/user/my-plugin` |
| Absolute path | Used as-is |

### Step-by-step

1. Parse the plugin name from the user's request
2. Resolve to a full path using the table above
3. Verify `plugin.yaml` exists at the resolved path
4. Run: `bash .claude/scripts/install-plugin.sh <resolved-path>`
5. Display the output to the user
6. If install succeeded, run `list` mode to show the updated plugin registry

### Available official plugins

- `github-actions`: GitHub Actions CI/CD workflow generator

### Example usage

- `/install-plugin github-actions` installs the github-actions plugin
- `/install-plugin user/my-custom-plugin` installs a locally created plugin

---

## Mode: list

Read-only. Shows installed plugins and available official plugins.

### Step-by-step

1. Check if `AI_DOCS/memory/plugins.md` exists
   - If yes: read and display it as a table of installed plugins
   - If no: report "No plugins installed yet"

2. List available official plugins from `plugins/official/` directory
   - Read each `plugin.yaml` to get name, version, description
   - Show as a table: Name | Version | Description | Status (installed/available)

3. Summarize: how many installed, how many available

### Output format

```
## Installed Plugins
| Plugin | Version | Installed | Skills | Hooks |
|---|---|---|---|---|
| github-actions | 1.0.0 | 2026-05-13 | github-ci | none |

## Available Official Plugins
| Plugin | Version | Description |
|---|---|---|
| github-actions | 1.0.0 | GitHub Actions CI/CD workflow generator |

Use `/install-plugin <name>` to install any available plugin.
```

---

Skill install-plugin complete. Memory updated.
Checkpoint: install mode updates AI_DOCS/memory/plugins.md, list mode is read-only, safe to compact.

<!-- Version: 1.0.4 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 1.1.0 | 2026-10-22 | v4.32.0: list-plugins merged in as `list` mode, next_skill cleared since list is now a mode of this skill -->
