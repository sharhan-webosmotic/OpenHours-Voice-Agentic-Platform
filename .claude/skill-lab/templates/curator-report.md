# Skill Curator Report
Generated: {date} | Skills reviewed: {total_skills} | Agents reviewed: {total_agents}
Invocation data: {available|not available}

---

## Summary

| Grade | Count |
|---|---|
| HEALTHY | {n} |
| NEEDS_IMPROVEMENT | {n} |
| STALE | {n} |
| REDUNDANT pairs | {n} |

---

## Actions Required

### Critical — trigger score < 16 or never tested

| Skill ID | Name | Score | Issue | Specific fix |
|---|---|---|---|---|
| SK-NNN | skill-name | N/20 | issue description | fix recommendation |

### Improvements — score 16–17 or spec pending

| Skill ID | Name | Score | Spec? | Issue |
|---|---|---|---|---|
| SK-NNN | skill-name | N/20 | pending | issue description |

### Stale — untested 90+ days

| Skill ID | Name | Priority | Last run | Action |
|---|---|---|---|---|
| SK-NNN | skill-name | 3 | never | Run trigger test |

### Redundancy candidates

- SK-NNN **name-a** ↔ SK-NNN **name-b**: [overlap description]
  Recommendation: [merge / differentiate by adding X to description]

---

## Healthy Skills ({n})

- SK-NNN name
- SK-NNN name
