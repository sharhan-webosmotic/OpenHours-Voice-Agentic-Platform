---
description: Skill versioning rules — enforces semver version bump on every SKILL.md modification
paths:
  - "**/.claude/skills/**"
  - "**/skills/*/SKILL.md"
  - "**/SKILL.md"
---

# Skill Versioning Rules

## Version Bump (MANDATORY on every edit)

1. **Every SKILL.md has a `version:` field in frontmatter** — format: `version: X.Y.Z` (semver)

2. **When you edit ANY SKILL.md, you MUST bump the version**:
   - **PATCH** (1.0.0 → 1.0.1): Fix typos, fix broken references, update wording
   - **MINOR** (1.0.0 → 1.1.0): Add new section, add rules integration, enhance content
   - **MAJOR** (1.0.0 → 2.0.0): Restructure skill, change workflow, merge/split skills

3. **The version bump happens in the SAME edit** — not in a separate commit

4. **If editing multiple skills in one session**, bump each one individually

5. **Never skip the version bump** — even for "small" changes

## How to Apply

When editing a SKILL.md:
```yaml
# Before
version: 1.0.0

# After fixing a typo
version: 1.0.1

# After adding a new section
version: 1.1.0

# After major restructure
version: 2.0.0
```

## Rule Files (.claude/rules/)

6. **Rule files also have implicit versions** — when editing any rule file, add a comment at the bottom:
   ```
   <!-- Version: 1.0.1 | [date] | [what changed] -->
   ```

<!-- Version: 1.0.1 | 2026-08-05 | Rule 6 example footer switched from em-dash separators to pipe separators so the example itself complies with the no-dash writing-style rule -->
