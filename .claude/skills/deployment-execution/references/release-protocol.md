# Git Release Protocol

> Extracted from [SKILL.md](SKILL.md) — Git merge/tag protocol, SemVer rules, and hotfix procedures.

---

> [!CRITICAL]
> A deployment without the corresponding Git merge and tag is incomplete.
> `main` must always reflect exactly what is live in production.
> **The AI provides these commands. The user runs them.**

## Milestone Deployment (Staging → Develop)

When a milestone completes QA and is ready for staging, provide the user with:

```bash
# Run these commands manually to merge the milestone into develop

# 1. Merge milestone branch into develop
git checkout develop
git pull origin develop
git merge --no-ff milestone-[N] -m "feat(M[N]): merge milestone-[N] — [Milestone Name] complete"
git push origin develop

# 2. Tag the milestone completion
git tag -a v0.[N].0 -m "Milestone [N] complete: [Milestone Name]"
git push origin --tags
```

Ask the user to confirm when done, then update `AI_DOCS/memory/project-context.md`.

## Production Release (Develop → Main)

When `develop` is stable and approved, provide the user with:

```bash
# Run these commands manually to release to production

# 1. Merge develop into main
git checkout main
git pull origin main
git merge --no-ff develop -m "release: v[X.Y.Z] — [release summary]"
git push origin main

# 2. Tag the production release
git tag -a v[X.Y.Z] -m "Release v[X.Y.Z]: [summary of changes]"
git push origin --tags
```

## SemVer Rules

- `v1.0.0` — First production release
- `v1.1.0` — New milestone/feature set added
- `v1.1.1` — Hotfix (critical bug on production)
- `v2.0.0` — Major breaking change

## After User Confirms Release: Update Memory

Write to `AI_DOCS/memory/project-context.md` under `## Git State`:
```
- Last Tag: v[X.Y.Z]
- Last Production Deploy: [YYYY-MM-DD]
- main: v[X.Y.Z] (deployed)
```

Then run `claude-md` skill to sync CLAUDE.md with new state.

## Hotfix Protocol

If a critical bug is found on production, provide the user with:

```bash
# Run these commands manually for hotfix

git checkout main
git checkout -b fix/hotfix-[description]
# make the fix, commit it
git commit -m "fix: [description] — hotfix for v[X.Y.Z]"
git push origin fix/hotfix-[description]
# Create PR → main → merge after review → tag v[X.Y.Z+1]
# Then backport to develop:
git checkout develop
git merge --no-ff fix/hotfix-[description]
git push origin develop
```
