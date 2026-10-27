---
name: assessment-package
description: "Turn raw technical assessment findings into a complete client-ready consulting package: Platform Assessment Report, Prioritized Recommendation Report, Implementation Roadmap, and a Technical Assessment Workbook. Reconciles all totals against the detailed findings before writing a word, builds every summary programmatically so it cannot go stale, and enforces traceability from findings through risks and recommendations to roadmap phases and blockers. Use when a discovery or assessment engagement needs its client deliverables produced. Also triggers on 'assessment report package', 'client deliverable package', 'turn findings into a report', 'platform assessment report', 'prioritized recommendation report', 'implementation roadmap', 'consulting deliverable from findings'."
effort: xhigh
skill_id: SK-165
version: 1.2.0
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# assessment-package

> Converts a findings register into a Principal-Architect-grade consulting deliverable package.
>
> **This is the deliverable half.** The analysis half is `code-quality-report`, which produces the
> findings. This skill assumes findings already exist, in a workbook or a structured markdown register.
>
> **Fires only when deliverables are explicitly requested.** It is expensive and it produces
> client-facing documents. Never trigger it from a generic "write this up".

---

## Rule 0: Reconcile before writing a single word (BLOCKING)

**Never trust a summary sheet.** Compute every total from the detailed findings and diff it against
whatever the source claims.

This rule exists because it has already caught a real failure: a workbook whose total said 199 while its
severity block summed to **132**, a shortfall of 67 findings, because the block was written at one point
and never refreshed as findings were appended. The type block was worse: it omitted two categories
entirely and **overstated** a third, so it was not even a subset of an earlier state.

Had the reports been written from that summary, every headline number in a client deliverable would have
been wrong.

Full protocol: `RECONCILIATION.md`. The short version:

```
1. Read the DETAIL sheet, not the summary. Recompute severity, type, area, status, effort.
2. Diff every computed total against every stated total. Record each delta.
3. Check integrity: duplicate IDs, gaps in the ID sequence, blank required fields.
4. If a discrepancy exists: use the computed figure, and DOCUMENT the discrepancy in a
   dedicated reconciliation sheet. Never silently correct it.
5. Only then begin writing.
```

**Do not hide discrepancies.** A client who later finds one you quietly fixed will distrust the whole
package. A client who reads your reconciliation sheet will trust it more.

## Rule 1: Build every summary programmatically (BLOCKING)

The stale-summary failure above happened because a human-maintained block drifted from machine-maintained
data. The fix is structural: **generate the workbook with a script, so every count is computed at build
time and cannot drift.**

Never hand-type a total into a deliverable. Compute it, then quote the computed value.

## Rule 2: Severity is not priority

| Concept | Definition |
|---|---|
| **Severity** | How serious the finding is in isolation. Set during assessment |
| **Priority** | How urgently to sequence it, accounting for effort, dependency, and implementation impact |

These must be allowed to diverge, and the report should show at least two or three worked examples where
they do, so the reader understands the model is deliberate rather than sloppy. Typical divergences:

- A Critical fixed in ten minutes outranks a Critical needing six weeks.
- A Medium that unblocks eight other items outranks a High that unblocks nothing.
- A Critical whose remediation depends on a gate that does not exist yet is sequenced *after* the gate.

## Rule 3: Distinguish the five object types

Never collapse these. The whole package's credibility rests on the distinction.

| Object | Definition | Lives in |
|---|---|---|
| **Finding** | An observed fact about the code, with a file, a line, and an evidence grade | Workbook |
| **Risk** | A business or technical consequence, usually arising from several findings | Report, Section: Top Risks |
| **Recommendation** | An action that addresses one or more findings | Recommendation Report |
| **Roadmap item** | A recommendation placed in a phase with dependencies and exit criteria | Roadmap |
| **Blocker** | Something preventing assessment or remediation, usually client-side | Roadmap and Workbook |

Many findings collapse into one risk. Many findings collapse into one recommendation. One recommendation
can span several phases.

## Rule 4: Refuse to assert what you did not verify

The most valuable sentence in an assessment package is often "we could not verify this, and here is what
it would take". Write it plainly.

**Never:**

- Invent a coverage percentage. If the runner could not execute, write "Unable to verify" and name the
  blocker.
- Claim a dependency is vulnerable if the audit did not run.
- Claim a cloud configuration was verified if console access was unavailable. Mark that section
  **partial by access, not by effort**, and say so in the section itself rather than only in an appendix.
- Claim an AI control exists or is absent without evidence.
- Present the engagement as a penetration test, compliance audit, or production validation unless it was
  one. State explicitly what it is *not*, in the methodology section.

**Never fabricate per-finding business impact.** With hundreds of findings, individual impact statements
become invention. Put impact at the **risk theme** level where it can be reasoned about, and use a
severity-band statement in the register.

## Rule 5: Include what you cleared

A report that only lists problems gives the reader no way to calibrate. Maintain a **Cleared and
Rejected** section covering:

- Findings a scanner would raise that are actually safe, with the reason.
- Claims made during analysis that did not survive verification, including your own.
- Findings downgraded by reachability analysis.
- Configuration and controls verified as correctly implemented.

This section frequently becomes the most useful part of the package to the client's engineering team,
because it stops them re-investigating the same false positives at every future review.

**Include your own corrections.** If a draft asserted something wrong and it was caught, record it. It
demonstrates the method worked.

---

## Phase 0: Intake

Establish these before anything else. Ask in ONE batch, skipping whatever the source already answers.

```
1. Source of findings: workbook path, or markdown register path.
2. Client name, platform name, version, engagement dates.
3. The engagement's original scope of work (verbatim if available). Deliverables are
   graded against it, and any scope item that could not be completed must be named.
4. Audience: technical leadership only, engineering only, or both (usually both).
5. Output format: markdown only, or markdown plus DOCX and XLSX.
6. Any compliance regime in scope. If none, say so explicitly in the report.
```

**Security assessment engagements:** when the engagement is a security assessment and no findings register exists yet, produce one first with `deep-security-audit` (profile `standard` or `deep` per the engagement scope). Use its verified `findings.json` (confirmed records with severity, `needs_validation` records as open questions) as the findings source. Rejected records never enter the client package, and reproduction payloads stay in the gitignored run directory, never in a deliverable.

Then read the source and run `RECONCILIATION.md` in full.

---

## Phase 1: Synthesis (before writing)

Four synthesis passes. Each can be delegated to its agent, and each must complete before the reports are
drafted, because the reports reference their output by ID.

| Pass | Agent | Produces |
|---|---|---|
| Reconciliation | `ap-data-reconciler` | Validated totals plus a discrepancy register |
| Risk themes | `ap-risk-synthesist` | Roughly 10 risk themes, each citing its findings |
| Recommendations | `ap-recommendation-architect` | Recommendations with priority, effort, dependencies, findings |
| Roadmap | `ap-roadmap-planner` | Phases with objectives, dependencies, exit criteria, blockers |

**Order matters.** Risks depend on validated counts. Recommendations depend on risks. The roadmap depends
on recommendations and their dependency graph.

### Risk synthesis guidance

Aim for **8 to 12 themes**, not the top N findings. A good theme:

- Groups findings that share a consequence, not a category.
- States technical impact and business impact separately.
- Names its supporting finding IDs.
- Leads with anything currently causing harm without an attacker. **Live financial or data-integrity
  defects outrank externally reachable security findings in the ordering**, because they are already
  happening.

### Recommendation guidance

Aim for **20 to 40 recommendations** from a few hundred findings. Each carries: the problem, related
finding IDs, the reason, expected outcome, priority, effort, dependencies, and the risk of deferring.

Group Medium and Low findings into collective recommendations rather than one each. Say so explicitly, so
the reader knows the omission is deliberate.

---

## Phase 2: The four deliverables

### File 01: Platform Assessment Report

The primary client-facing document. It **summarises and explains**; it never dumps the findings.

Required sections, in order: Executive Summary, Platform Snapshot, Scope and Methodology, Current
Architecture, Primary Workflows, Data Flows, Security, RBAC, Database and Data, API and Backend,
Frontend, Infrastructure, AI and LLM (where applicable), Testing and Quality, Technical Debt, Key
Strengths, Top Risks, Implementation Readiness, Conclusion, Assumptions and Limitations.

The Executive Summary must answer, explicitly: **should implementation proceed now, or should remediation
come first?** Give a direct answer with reasons. An assessment that will not answer this has not done its
job.

It must also list **the decisions the client needs to make**, distinguished from the tasks the engineering
team needs to do. Those are different audiences and different actions.

### File 02: Prioritized Recommendation Report

Recommendations by category, with a matrix, plus a work-classification section: quick wins, foundational
work, major architectural work, security remediation, what can run in parallel, what must be sequential,
what can be deferred.

The parallel-versus-sequential analysis is what makes the roadmap credible. Derive it from real
dependencies, not from intuition.

### File 03: Implementation Roadmap

Phases with objective, work items citing recommendation and finding IDs, dependencies, expected outcome,
exit criteria, risks, parallelism, and prerequisites. Plus a dedicated **Implementation Blockers**
section.

Exit criteria must be **observable**. "Authorization is improved" is not an exit criterion. "Signed out,
the connect URL redirects to sign-in" is.

State plainly whether the plan requires a development freeze. Usually it should not, and saying so
removes a common objection.

### File 04: Technical Assessment Workbook

Generated by script. Sheets:

```
1  Executive Summary        11 Data/Schema Findings
2  Detailed Findings        12 Testing Findings
3  Severity Summary         13 Blockers
4  Type Summary             14 Roadmap (rec -> phase -> findings)
5  Area Summary             15 Evidence Key (incl. cleared and rejected)
6  Status Summary           16 Assumptions and Limitations
7  Security Findings        17 Data Quality and Reconciliation
8  RBAC Findings
9  AI/LLM Findings
10 Architecture Findings
```

Adjust the category sheets to the domains the findings actually contain. Do not create an empty sheet to
match this list.

**Detailed Findings retains every original row and column.** Add derived columns (finding title, impact
band, recommendation ID, priority, roadmap phase, risk theme) rather than replacing anything.

---

## Phase 3: Editorial pass, then validate before delivering (BLOCKING)

### Step 1: Editorial pass (final narrative pass)

Once the three report drafts exist and the findings are locked, dispatch the `report-editor` agent on each
narrative document (files 01, 02, 03). It applies the editorial discipline described in the
`client-report-editing` skill: senior-engineer voice, no generated-text tells, plain statements of what was
and was not verified. It is presentation only. It never changes a finding, a severity, an evidence grade, a
file path, a line number or a computed total, and it returns rewritten prose for you to apply (it is
read-only). Run the editorial pass BEFORE the validation checklist below, because the validation re-checks
every total and every cited ID against the register and so catches any slip the edit introduced.

### Step 2: Validate

Run these programmatically, not by eye:

```
[ ] Every total in every document matches the computed value from the detail sheet.
[ ] Every Critical and High finding maps to a specific recommendation (not a collective bucket).
[ ] Every risk theme cites at least one finding ID that exists.
[ ] Every roadmap item cites a recommendation that exists.
[ ] Every blocker cites affected findings that exist.
[ ] No duplicate or missing finding IDs.
[ ] No blank required field in the register.
[ ] Discrepancies found in Phase 0 appear in the reconciliation sheet.
[ ] Every "Unable to verify" names its blocker.
[ ] Style: no em-dashes or en-dashes, no banned phrases (`document-generation-rules.md`).
[ ] Tables destined for DOCX are at most 4 columns.
```

A failure on the second item is the most common. When a Critical falls into a collective bucket, map it
explicitly rather than leaving it.

---

## Phase 4: Conversion

Markdown is canonical. Convert only after the validation gate passes.

- **DOCX**: via `docx-from-markdown`, cover mode for client-facing. Prepare a DOCX-ready variant if the
  canonical markdown has tables wider than four columns or sentence-case headings. Keep both.
- **XLSX**: the workbook is already XLSX by construction.

Close the workbook in Excel before any regeneration, or the write is refused.

---

## Output location

```
AI_DOCS/deliverables/final-package/
  01-platform-assessment-report.md
  02-prioritized-recommendation-report.md
  03-implementation-roadmap.md
  04-technical-assessment-workbook.xlsx
  (plus DOCX variants when requested)
```

---

## Anti-patterns this skill prevents

- Quoting a summary figure without recomputing it.
- Dumping every finding into the main report.
- Mapping severity directly to priority.
- Inventing coverage, impact, or vulnerability claims to fill a required field.
- Presenting a source-code review as a penetration test or compliance audit.
- Reporting only problems, so the client cannot calibrate the list.
- Silently correcting a discrepancy instead of documenting it.
- Producing four documents whose numbers disagree with one another.

<!-- Version: 1.0.4 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 1.1.0 | 2026-10-22 | security assessment engagements source their findings register from deep-security-audit (SK-169) -->
<!-- Version: 1.2.0 | 2026-10-22 | v4.32.0: Phase 3 now dispatches the report-editor agent as the editorial pass described by client-report-editing, before the validation checklist -->
