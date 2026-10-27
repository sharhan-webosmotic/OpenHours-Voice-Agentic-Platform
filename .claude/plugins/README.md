# ADF Plugin System

Plugins extend the app-development-framework with additional skills, hooks, agents, and rules — without forking core.

## ADF plugins vs native Claude Code plugins

This folder is the ADF plugin system: packs copied into `.claude/` by `/install-plugin`. Third-party tools that ship as native Claude Code plugins are NOT copied here. They are registered in `settings.template.json` under `extraKnownMarketplaces` (with `autoUpdate: true`) and `enabledPlugins`, so Claude Code installs them from their own marketplace and keeps them current. `upgrade.sh` adds new entries to existing projects without overwriting a project's own choice.

| Native plugin | Marketplace | Role in ADF |
|---|---|---|
| `diagram-design@diagram-design` | `cathrynlavery/diagram-design` | The only diagram generator (45 types, SVG/PNG export, Mermaid / draw.io / Excalidraw import) |

## Plugin types

| Type | What it adds | Directory |
|---|---|---|
| `skill-pack` | New skills (directories with `SKILL.md`) | `provides.skills` |
| `hook-pack` | New lifecycle hooks (bash scripts) | `provides.hooks` |
| `agent-pack` | New agents (markdown files) | `provides.agents` |
| `rule-pack` | New rule files (markdown) | `provides.rules` |
| composite | Any combination of the above | all of the above |

## Directory layout

```
plugins/
├── plugin.schema.yaml          # Manifest specification (this file's schema)
├── README.md                   # This file
├── official/                   # Bundled reference plugins (committed to ADF repo)
│   └── github-actions/
│       ├── plugin.yaml         # Required manifest
│       └── skills/
│           └── github-ci/
│               └── SKILL.md
└── user/                       # User-installed plugins (gitignored)
    └── .gitkeep
```

## Installing a plugin

**Via skill (recommended):**
```
/install-plugin github-actions         # from plugins/official/
/install-plugin path/to/my-plugin      # from any absolute/relative path
```

**Via script (direct):**
```bash
bash .claude/scripts/install-plugin.sh .claude/plugins/official/github-actions
```

The installer:
1. Reads `plugin.yaml`
2. Warns about missing required env vars (does not block install)
3. Copies `skills/*` → `.claude/skills/`
4. Copies `hooks/*` → `.claude/hooks/`
5. Copies `agents/*` → `.claude/agents/`
6. Copies `rules/*` → `.claude/rules/`
7. Merges new hook entries into `settings.local.json` (safe JSON merge, no duplicates). The file is created when it does not exist
8. Runs `post_install` script if specified
9. Records the install in `AI_DOCS/memory/plugins.md`

## Writing a plugin

### 1. Create the directory structure

```bash
mkdir -p .claude/plugins/user/my-plugin/skills/my-skill
```

### 2. Write the manifest

```yaml
# .claude/plugins/user/my-plugin/plugin.yaml
name: my-plugin
version: 1.0.0
description: "What my plugin does"
author: "Your Name"
compatibility: "ADF 4.x"

provides:
  skills: [my-skill]
  hooks: []
  agents: []
  rules: []

requires:
  env: [MY_API_KEY]   # Optional — warns user if not set
```

### 3. Add your skill

```
.claude/plugins/user/my-plugin/skills/my-skill/SKILL.md
```

Follow the standard ADF skill frontmatter format (see any existing skill for reference). Assign a skill_id starting from SK-200+ to avoid collisions with core skills.

### 4. Test locally

```bash
bash .claude/scripts/install-plugin.sh .claude/plugins/user/my-plugin
```

Verify:
- `.claude/skills/my-skill/` exists
- `AI_DOCS/memory/plugins.md` has an entry

### 5. Submit as official

To add your plugin to `plugins/official/`, open a PR to the ADF repository. The plugin will be reviewed for quality, security, and compatibility.

## Plugin hooks and framework upgrades

The installer registers a plugin's hooks in `.claude/settings.local.json`, not in `.claude/settings.json`. Every upgrade run (after each `git pull` in `.claude/`, or at session start when the settings template changed) resets the `hooks` object of `settings.json` to `settings.template.json`, so a hook registered there would be dropped at the next upgrade. Upgrades never touch `settings.local.json`, and Claude Code merges the hook entries of both files.

A plugin installed with an older installer has its hook entries in `settings.json`. Re-run the installer for that plugin once to register them in `settings.local.json`.

## Uninstalling a plugin

Manual only — the installer does not currently provide an uninstall command.
To remove: delete the copied directories from `.claude/skills/`, `.claude/hooks/`, `.claude/agents/`, `.claude/rules/`, and remove the hook entries from `settings.local.json` manually.

## Hook merge safety

When a plugin adds hooks, the installer merges them into `settings.local.json` using Python's `json` module (no `jq` dependency). The merge is idempotent: if an identical hook command already exists in the event array, it is not duplicated.

The hook schema is the same as core ADF hooks:
```json
{
  "//": "MY-HOOK: description",
  "matcher": "Edit|Write",
  "hooks": [{ "type": "command", "command": "bash .claude/hooks/my-hook.sh" }]
}
```
