---
name: code-quality-report
description: "Run a full SonarQube/SonarCloud-style static code analysis of a repository and produce a client-ready Markdown report (bugs, vulnerabilities, security hotspots, code smells, duplication, testing, complexity, dependencies, configuration, quality gate). Fans out to nine role-split specialist agents, reconciles their contradictions, and grades every finding by evidence. Use ONLY when a code quality run, code audit, static analysis, or SonarQube-style review is explicitly requested. Also triggers on: 'sonarqube analysis', 'sonarcloud report', 'static analysis', 'code quality run', 'code audit', 'quality gate', 'analyse the whole codebase for issues'."
effort: xhigh
skill_id: SK-167
version: 1.1.3
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# code-quality-report

> Produces a SonarQube-style analysis as Markdown, structured so it converts cleanly to XLSX (the
> findings register) and DOCX (the narrative report) afterwards.
>
> **Fires only on explicit request.** This is an expensive, many-agent run. It must never trigger from a
> generic "review this" or from `/do`'s normal build loop. The trigger is the user asking for a code
> quality run, a static analysis, a code audit, a SonarQube or SonarCloud report, or a quality gate.

---

## Rule 0: The evidence standard (BLOCKING, non-negotiable)

Every finding carries exactly one grade. This is the single most important rule in this skill, because
without it the report is indistinguishable from an automated scan and inherits its false-positive rate.

| Grade | Meaning |
|---|---|
| **Verified** | The specific file was opened and the behaviour read at a cited line |
| **Indicated** | A mechanical scan suggests it, and the underlying files have not each been read |
| **Not Verifiable** | Blocked by missing access or tooling, with the blocker named |

**A repository-wide count is Indicated, never Verified, until the underlying files have been read.**

This rule exists because it is repeatedly load-bearing. In a single real engagement on a 450k-line
Next.js codebase, five separate repository-wide scans produced findings that per-file reading refuted:

| Naive scan result | Reality after reading | Why the scan lied |
|---|---|---|
| 35, then 30, API routes with no authorization | 13, of which 10 correctly public | Routes authenticate via domain wrappers a base-helper grep does not match |
| Connection leak across 20+ files | None | Handles named `pgClient`, `neonClient`, not `client` |
| 9 unused dependencies | 1 | 8 loaded via dynamic `await import()` |
| 879 loose equality comparisons | 163, and correct | Regex over-match plus a deliberate `== null` idiom |
| "No HR mutation writes an audit entry" | False | The function was called 4x inside its own module |

Every one would have been reported as fact by a scanner. Report this pattern to the client explicitly
(see the report template's "expect false positives from your own tooling" section), because it tells them
what a commercial SAST run against their repo will do.

## Rule 1: Never invent

- Never invent a finding, a line number, a metric, or a coverage percentage.
- If coverage cannot be measured, write **"Unable to verify"** and state the blocker. Do not estimate.
- Never call something a vulnerability without evidence that user input reaches the sink.
- Distinguish confirmed from potential in every row.

## Rule 2: Record what you cleared, not only what you found

A report that only lists problems gives the reader no way to judge whether the problems are real.
Maintain a **Cleared / Do-not-re-raise** section for anything that looks like a defect to a scanner and is
not. Each entry states what was checked and why it is safe. This section is often the most useful part of
the report to an engineering team, because it saves them re-investigating the same false positives at
every future review.

---

## Phase 0: Recon (always, before any agent is dispatched)

Establish the ground truth the agents will need, and the constraints the report must declare.

```
1. Language, framework, package manager, versions (manifest + lockfile).
2. Scale: total lines by language, file counts per layer (routes/pages/components/lib), table count.
3. Existing quality tooling: is there a sonar-project.properties, .sonarcloud.properties, or a Sonar CI
   step? If a real Sonar report exists in the repo, READ IT and use it as evidence.
4. Test setup: runner, config file, test file count, test case count.
5. Config surface: tsconfig, eslint config, framework config, CI workflows, container/infra files.
6. Repo-supplied context: a CLAUDE.md, README, docs/, an incident or lessons log, an architecture doc,
   planning notes. These are gold. Read them.
7. BLOCKERS: record what cannot be run and why. Typically: node_modules absent (no tsc/eslint/coverage/
   knip/madge), no git history (no secret-history scan, no churn ranking), no runtime access, no database,
   no cloud console.
```

Declare the blockers in the report's method section. Never let a blocker silently become a missing
section.

### Phase 0.5: The incident-log pass (highest-value single technique)

If the repository contains any record of past defects (a `lessons.md`, an incident log, a postmortem
folder, dated fix notes, a CHANGELOG with bug entries), read it and then **trace each past defect forward
into the current code**.

For each historical defect: find the code that implements that logic today, and check whether the fix is
still present and whether a test locks it.

This technique has found a **live, unfixed instance of an already-fixed bug**: a filter that dropped
negative invoice lines was corrected in two sibling files, with a comment explaining why, and was never
corrected in the primary one. It was still shipping. No amount of generic scanning would have surfaced
that, because the code looked ordinary. Only the history made it visible.

Treat this pass as mandatory whenever such a record exists.

---

## Phase 1: Fan out to the role-split agents

Dispatch all applicable agents **in parallel, in a single message**. Each is defined in
`.claude/agents/cq-*.md`.

| Agent | Owns |
|---|---|
| `cq-bugs-reliability` | Runtime errors, null handling, logic errors, races, leaks, exception handling, edge cases, incorrect API usage |
| `cq-security-vulns` | Injection, XSS, CSRF, SSRF, path traversal, deserialization, secrets, weak crypto, authn/authz, data exposure |
| `cq-security-hotspots` | Security-SENSITIVE code needing human judgment, each with an exploitability verdict |
| `cq-complexity` | Cyclomatic, cognitive, nesting, long units, long parameter lists, coupling, god components |
| `cq-duplication` | Duplicated logic, forked components, divergent copies of one rule, re-export shims |
| `cq-dead-code` | Orphan files, unused exports, dead routes, unreachable code, unused dependencies |
| `cq-test-quality` | Existing test quality, weak assertions, flaky risk, missing edge and error paths, coverage facts |
| `cq-configuration` | Build config, type/lint config, CI/CD, container, infra, secrets handling, production risks |
| `cq-dependencies` | Outdated, vulnerable, unused, duplicate, risky, wrong-scope dependencies |

**Every dispatch prompt MUST include:**

1. The repo path and the language/framework.
2. The **blockers** (what tooling cannot run), so the agent does not claim to have run it.
3. A **"do NOT re-report"** list of everything already found, so agents do not duplicate each other or
   re-find what an earlier phase established.
4. The **method-discipline warning** verbatim: naive scans have produced false findings in this codebase;
   open every file before reporting; mark anything unconfirmed as UNCONFIRMED.
5. The **exact output table** required, so results merge without reformatting.
6. Any codebase-specific trap already discovered (dynamic imports, domain auth wrappers, non-standard
   handle naming, dead subtrees).

Point 6 compounds. Feed each round's discoveries into the next round's prompts.

---

## Phase 2: Reconcile (BLOCKING before the report is written)

Agent output is input, not truth. The lead performs three passes.

### 2.1 Re-verify every BLOCKER and CRITICAL personally

Open the cited file and confirm the claim before it enters the report. This is not optional. In practice
roughly one in ten agent findings does not survive it.

### 2.2 Resolve cross-agent contradictions

Agents disagree in effect rather than in words. The most common and most important case:

> **The dead-code agent proves that a file the security agent flagged is unreachable.**

That downgrades a Critical to a dead-code cleanup item. In a real run this happened to a Critical XSS
finding: the vulnerable component was reachable only through a chain that terminated in a component
nothing imported, behind a route that redirected to a tab that did not exist. Real defect, not
exploitable.

Always run the dead-code result against the vulnerability and bug results before finalising severities.

Other recurring reconciliations:
- A "swallowing catch" in a module with zero callers is dead code, not an error-handling defect.
- A duplicated component where only one copy is wired changes both the duplication severity and the
  security severity.

### 2.3 Reject what does not hold

Record rejections explicitly with the reason. A rejected claim that is not written down gets re-raised by
the next review. Rejections belong in the Cleared section alongside the false positives.

---

## Phase 3: Write the report

Use `REPORT-TEMPLATE.md`. Structure is fixed so downstream conversion is mechanical:

- **Narrative sections** convert to DOCX.
- **The findings register** (one row per finding, stable ID, file, line, severity, category, evidence
  grade) converts to XLSX as the working tracker.

Give every finding a stable ID of the form `<PREFIX>-NNN` so the XLSX and DOCX cross-reference and so a
later run can diff against this one.

### Expand findings to their actionable unit

A row saying "26 files render unsanitised HTML" cannot be assigned to anyone. Emit one row per file with
its own line number. The register is a work list, not a summary. Summaries belong in the narrative.

### Severity

Use the SonarQube scale: BLOCKER, CRITICAL, MAJOR, MINOR, INFO. Order by security impact, then
production/runtime impact, then data loss, then reliability, then maintainability, then performance, then
style.

Add an **Unable to verify** band for items blocked by access. They are real work items (someone must get
the access) and they disappear if they live only in a blockers appendix.

### Quality gate

Report the gate honestly. If coverage cannot be measured, the gate cannot pass on coverage, and the
correct status is **FAIL with the reason stated as unmeasurable**, not an invented percentage. Distinguish
new-code metrics from overall metrics; if there is no git history, new-code metrics are Unable to verify
and must say so.

---

## Phase 4: Hand off

### To client deliverables

If the engagement requires a **client-facing consulting package** (Platform Assessment Report,
Prioritized Recommendation Report, Implementation Roadmap, Technical Assessment Workbook) rather than a
technical report, hand off to the **`assessment-package`** skill. It takes this skill's findings register
as input, reconciles every total against the detail, synthesises risk themes and recommendations, and
produces the four documents with enforced traceability.

The division of labour: **this skill finds things. `assessment-package` explains them to a client.**

### To conversion

The report is Markdown. Conversion is a separate, explicit step:

- **XLSX**: the findings register. One sheet of findings, one summary sheet, one evidence-key sheet
  (grades plus the Cleared list), one blockers sheet. Colour-band severity. Freeze the header, add an
  autofilter, and leave Status and Owner columns blank for the client.
- **DOCX**: the narrative report via the `docx-from-markdown` skill.

Never generate the binaries as part of this skill. Produce the Markdown, confirm it, then convert.

---

## Output location

```
AI_DOCS/quality/code-quality/
  00-report.md                  the full narrative report
  01-findings-register.md       the table that becomes the XLSX
  02-cleared-and-rejected.md    false positives and rejected claims, with reasons
  03-blockers.md                what could not be assessed and what it would take
  agents/<agent>-raw.md         each agent's unedited output, for audit
```

Keeping the raw agent output matters: when a finding is later disputed, the chain from raw claim to
verified entry is the defence.

---

## Anti-patterns this skill exists to prevent

- Reporting a grep count as a finding.
- Inventing coverage because the report has a coverage field.
- Listing every occurrence of a pattern as separate vulnerabilities without checking reachability.
- Producing a wall of style complaints that buries the two findings that matter.
- Omitting a section because the tooling to fill it was unavailable, rather than declaring the gap.
- Reporting only problems, so the client cannot calibrate how much to trust the list.

<!-- v1.1.0 | 2026-08-11 | Added the Phase 4 hand-off to the assessment-package skill, which turns this skill's findings register into a client-facing consulting package. -->

<!-- Version: 1.1.3 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
