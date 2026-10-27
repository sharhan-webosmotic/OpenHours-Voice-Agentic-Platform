# skill-lab

> Self-contained QA folder. Safe to delete — zero impact on `skills/` or running skills.

This folder validates the ADF framework itself. Use it to test that skill files and agent files meet structural, behavioral, and category standards.

## How to Run Tests

Use the `/skill-test` skill (in `skills/skill-test/`) from the parent `app-development-framework/` directory:

```
/skill-test static [skill-name | all]    — 7 structural checks
/skill-test spec [skill-name]            — 5 behavioral test cases
/skill-test category [skill-name | all]  — category rubric evaluation
/skill-test trigger [skill-name | all]   — 20 auto-trigger prompts (>=18/20 to pass)
/skill-test audit                        — full coverage dashboard
```

For the trigger mode at scale, prefer the shell runner (resumable, progress-tracked):
```
bash run-trigger-tests.sh --skill NAME    — one skill
bash run-trigger-tests.sh --all           — every skill with a .trigger.yaml
bash run-trigger-tests.sh --resume        — continue an interrupted run
```

To improve failing skills:
```
/skill-improve [skill-name]
```

To draft the 20-prompt trigger spec for a skill:
```
/skill-authoring draft-triggers [skill-name]    — one skill
/skill-authoring draft-triggers all             — every skill missing a .trigger.yaml
```

## Files in This Folder

| File | Purpose |
|------|---------|
| `catalog.yaml` | Master registry of all skills + agents with test tracking |
| `quality-rubric.md` | Category-specific PASS/WARN/FAIL metrics |
| `skills/[category]/[name].md` | Behavioral spec per skill (5 test cases) |
| `skills/[category]/[name].trigger.yaml` | Auto-trigger spec per skill (20 prompts) |
| `agents/[tier]/[name].md` | Behavioral spec per agent (5 test cases) |
| `templates/skill-test-spec.md` | Template for writing behavioral specs |
| `templates/trigger-spec.yaml` | Template for writing auto-trigger specs |
| `templates/agent-test-spec.md` | Template for writing new agent specs |
| `run-all-tests.sh` | Shell runner for static checks (zero tokens) |
| `run-trigger-tests.sh` | Shell runner for auto-trigger tests (resumable) |
| `results/` | Test run outputs (gitignored) |

## Writing Specs

### Behavioral specs (5 test cases — how a skill behaves once invoked)

1. Copy the appropriate template (`skill-test-spec.md` or `agent-test-spec.md`)
2. Fill in 5 test cases with: input scenario, expected behavior, assertions
3. Add an entry to `catalog.yaml` pointing to your spec file
4. Run `/skill-test spec [name]` to validate

### Auto-trigger specs (20 prompts — whether the skill is picked in the first place)

1. Copy `templates/trigger-spec.yaml` to `skills/[category]/[skill-name].trigger.yaml`
   — or run `/skill-authoring draft-triggers [skill-name]` to get a draft.
2. Fill in 20 prompts: 16 positives (6 direct, 4 paraphrase, 4 task-embedded, 2 context-based) + 4 negatives (3 sibling, 1 unrelated).
3. Mark `trigger_status: reviewed` in catalog.yaml once you've vetted the draft.
4. Run `bash run-trigger-tests.sh --skill [name]` to score. Pass = >=18/20.
5. If failing, run `/skill-improve [name]` — the fix almost always targets the frontmatter `description:` line, not the skill body.

## Priority for Writing Specs

1. `gate-enforcement` (controls all phase transitions)
2. `tech-specification`, `workscope` (highest daily use)
3. `audit`, `code-reviewer` agent (highest quality bar)
4. `team-security` (complex orchestration)
5. All remaining: register in catalog, write specs incrementally
