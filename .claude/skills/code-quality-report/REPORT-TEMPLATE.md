# Report Template

> The fixed output shape for `code-quality-report`. Narrative sections become the DOCX. The findings
> register becomes the XLSX. Do not reorder: downstream conversion depends on this structure.

---

## Executive summary

```
Project:
Languages:
Files analysed:
Lines analysed:
Tests found:
Coverage:                    <percentage, or "Unable to verify: <blocker>">
Analysis date:
Analysis method:             static reading + N specialist agents; tooling that could not run listed below

BLOCKER findings:
CRITICAL findings:
MAJOR findings:
MINOR findings:
INFO findings:
Unable to verify:

Overall quality gate:        PASS / FAIL
Gate failed on:              <the specific conditions>
```

Follow the block with three to six paragraphs of narrative. Lead with the single most consequential
finding, in business terms rather than technical ones. If one finding is costing money or exposing data
today, it goes first regardless of its technical category.

State plainly what the system does well. A report that reads as uniformly negative is discounted by the
reader, and usually inaccurate.

## Summary table

| Category | Count | BLOCKER | CRITICAL | MAJOR | MINOR | INFO |
|---|---|---|---|---|---|---|
| Bugs / Reliability | | | | | | |
| Vulnerabilities | | | | | | |
| Security Hotspots | | | | | | |
| Code Smells / Maintainability | | | | | | |
| Duplication | | | | | | |
| Testing | | | | | | |
| Complexity | | | | | | |
| Dependencies | | | | | | |
| Configuration | | | | | | |
| **Total** | | | | | | |

## Method and evidence standard

State the three evidence grades. State the blockers. State how many scans were corrected by reading, and
warn the client what their own tooling will do against this repository.

## Quality gate

### New code

| Metric | Target | Actual | Status |
|---|---|---|---|
| Bugs | 0 | | |
| Vulnerabilities | 0 | | |
| Security hotspots reviewed | 100% | | |
| Coverage | >= 80% | | |
| Duplicated lines | <= 3% | | |
| Maintainability rating | A | | |
| Reliability rating | A | | |
| Security rating | A | | |

If there is no version-control history, "new code" cannot be isolated. Say so in every row rather than
reporting overall figures as if they were new-code figures.

### Overall code

Same table, overall. Mark any metric that requires tooling you could not run as Unable to verify, with
the blocker named.

## Findings

One entry per finding, in severity order:

```
ID:
Severity:
Category:
File:
Line:
Confirmed:               Verified / Indicated / Not Verifiable
Problem:
Why it matters:
Evidence:                what was read, and what it showed
Recommended fix:
Suggested code change:   only where it is short and unambiguous
Test required:
Quality gate impact:
```

## Cleared and rejected

Two tables. What a scanner would flag that is actually safe, and what was claimed during analysis and did
not survive verification. Each with the reason. This section prevents the same false positives being
re-investigated at every future review.

## Blockers

| # | Blocker | What it prevents | Cost to close | Findings affected |
|---|---|---|---|---|

Order by value-to-cost. Blockers that cost the client nothing and unblock a lot go first.

## Remediation plan

| Priority | Meaning |
|---|---|
| P0 | Must fix before release. Live exposure, active data loss, or a cost-free unblock |
| P1 | Fix immediately. High consequence, contained effort |
| P2 | Fix soon. Structural work with lasting payoff |
| P3 | Nice to improve. No urgency |

Priority reflects consequence against effort, not severity alone: a BLOCKER that takes ten minutes
outranks a CRITICAL that takes six weeks. State the effort for each.

Close with a "shortest path to the largest risk reduction" section naming the three or four items that
change the trajectory, as distinct from the many that merely improve things.

## Findings register (becomes the XLSX)

| ID | Problem | File | Line | What is expected | Severity | Category | Evidence | Effort | Status | Owner |
|---|---|---|---|---|---|---|---|---|---|---|

One row per actionable unit. Never one row for "26 files". Status defaults to Open. Owner is left blank
for the client.
