---
name: client-report-editing
version: 1.1.4
description: "Final editorial pass that turns a completed technical assessment into a client-facing document written like a senior engineer, not like generated text. Use after findings are locked and before delivery, on any DOCX/PDF narrative built from a findings register. Also triggers on 'make this report human', 'the report sounds like AI', 'editorial pass', 'tighten the report', 'client-ready version', 'senior engineer voice'. Do NOT use to change findings, severities or evidence: this is presentation only."
skill_id: SK-166
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# Client Report Editing

A presentation pass. The assessment is already done. You are the senior technical editor
preparing the final client-facing version.

## Hard boundaries (BLOCKING)

Never, in this pass:

- perform a new assessment or add findings
- change a finding ID, severity, evidence rating, file path, line number or verification status
- remove technical evidence to make prose flow better
- change meaning to suit a preferred phrasing

The register (XLSX/JSON) is the source of truth. The narrative document must end this pass
saying exactly what the register says. Run the consistency check in step 5 before finishing.

## The one principle

Write like a senior engineer explaining the situation to a client. State the fact, say why it
matters, move on.

> The QuickBooks connection endpoint does not require authentication.

not

> One of the most significant observations identified during the assessment relates to the
> authentication posture surrounding the QuickBooks connection workflow.

## 1. Banned language (grep for these)

Each phrase below is the tell that a paragraph was generated rather than written by
someone who did the work. Catch them on sight and rewrite the sentence around the
fact, rather than swapping in a synonym that keeps the same hollow shape.

**Hedge openers:** it is worth noting, it is important to note, it should be noted, it is
evident that, in this context, as part of this review.

**Assessment voice:** the assessment identified/revealed/found, the review identified, during
the assessment, the assessment team. The reader knows it is an assessment. Say "884 API
handlers were reviewed", not "the assessment reviewed 884 API handlers".

**Perspective framing:** from an architectural/security/operational perspective, in terms of.

**Empty verdicts:** this demonstrates/suggests/indicates/highlights/reinforces, the key
takeaway is, the overall picture is, this is a meaningful signal, this is encouraging, a
notable observation.

**Praise words:** genuinely good, genuinely strong, meaningful, notably, particularly
noteworthy, encouraging, commendable, well-positioned, robust, comprehensive, holistic,
strategic.

**Corporate verbs:** leverage, facilitate, enable, utilize, ensure (when a direct verb works).

**Opportunity framing:** a clear opportunity exists, there is an opportunity to, this
represents an opportunity.

**First person:** in our view, we believe, we feel, our recommendation, we would suggest,
from our experience. Confidence comes from evidence, not from voice.

**Meta-commentary:** the following section provides, the table below summarizes, this section
discusses, further details can be found in. Use headings and tables instead.

## 2. Structure per finding

Four beats, short:

1. **Problem** — what is wrong
2. **Evidence** — where it is, what proves it
3. **Impact** — why the client cares
4. **Recommendation** — the exact change

Assume a technically competent reader, and explain this application's specific problem,
not the general concept of authentication, RBAC, APIs, prompt injection, or technical debt.

## 3. Executive summary contract

500–800 words, readable in 2–3 minutes, in this order:

1. What the platform is
2. What is working
3. What needs attention now
4. What happens next

Open with what matters to the reader, not methodology, and include a number only when it
shows scale or proves a pattern rather than listing every statistic. Detailed counts belong
in the register and the summary table.

Answer plainly in the first two pages: what is this system, is it fundamentally usable, what
is working, what are the two or three biggest risks, does it need a rewrite, what happens next.
If no rewrite is needed, say so in those words.

## 4. Section discipline

Each section explains its own subject once. Security explains security. AI explains AI. The
roadmap says what to do. If a finding is already explained in detail, later sections reference
it in a clause, not a paragraph.

Suggested section shapes:

- **Security:** Authentication & Authorization / Input & Output Handling / Public Endpoints /
  Secrets & Credentials / Audit Logging. Per subsection: situation in one or two sentences,
  the findings that matter, the practical consequence.
- **AI:** open with the conclusion, then Prompt Injection / Tool Access / Output Handling /
  Cost Controls / Model Governance / What Is Working.
- **Technical risks:** Architecture / Reliability / Data / Integrations / Maintainability.
  Per subsection: current condition, consequence, priority. Not a second copy of Security.

Headings are short: "Authentication & Authorization", not "Authentication and Authorization
Assessment Findings".

## 5. Balance

The report must not read as an attack on the engineering team. Keep verified strengths, stated
as facts:

> All 755 tests pass and the project type-checks cleanly.
> Database queries are consistently parameterised; no SQL injection path was found.
> Webhook signature verification fails closed.

not

> The platform demonstrates an impressive level of engineering maturity.

Keep each positive to one or two sentences: expanding it into a paragraph starts to read
like padding.

## 6. Recommendations must be executable

Every recommendation names the change: a generic verb earns its place only when the exact
edit follows it.

| Do not write | Write |
|---|---|
| Improve authorization consistency | Move authorization into a shared policy layer and require every protected route to call it |
| Improve AI governance | Move model selection, token limits, timeouts and spend caps into the shared model wrapper |
| Enhance observability | Add error tracking, and record success or failure for every scheduled job |
| Increase test coverage | Add regression tests for the ledger balance invariant and the financial-access policy |

## 7. Sentence craft

Subject, action, consequence. Vary sentence length rather than making every sentence the
same shape, and delete any sentence that tells the reader nothing new.

Delete outright: "The platform is doing real work for the business." "These findings provide
valuable insight." "This creates a strong foundation." "The recommendations below provide a
clear path forward." "Taken together, these findings demonstrate."

## 8. Preserve precision

Keep exact routes, file paths, line numbers, counts, model names, security mechanisms, test
results and verification status. The goal is not a less technical report. It is the same
technical content, easier to read.

The DOCX is the narrative. The XLSX is the evidence register: shorten repetitive wording and
strip generated-sounding phrases there too, but never at the cost of evidence.

## 9. Verification before finishing (BLOCKING)

Read the whole document end to end and rewrite sentences as you go: a find-and-replace pass
alone will not fix a report that reads like it was assembled rather than written.

Then confirm mechanically:

- [ ] Banned-phrase grep returns zero hits in the narrative
- [ ] Finding IDs, counts and severities in the DOCX match the XLSX and JSON exactly
- [ ] Critical and High findings all still present
- [ ] Roadmap phases unchanged
- [ ] Every diagram, table and heading still renders (open the file, do not assume)
- [ ] Executive summary within 500–800 words
- [ ] No section repeats another section's explanation

### 9a. Format audit (run against the built file, not the generator)

Prose passing is not the same as the document being well formed. Open the DOCX and assert:

- [ ] Heading levels never skip a level; top-level sections numbered 1..N in order
- [ ] Sub-section numbers match their parent and increment without gaps
- [ ] No table has a blank header row, and no run is below 8pt (the print minimum)
- [ ] Figure captions ascend with no duplicate numbers, and every figure is embedded
- [ ] No em dash, en dash or stray semicolon survives in body text OR table cells
- [ ] Double spaces appear only where they are a deliberate separator, never in prose

Then render to PDF and assert against the rendered pages:

- [ ] No numbered heading stranded in the last 12% of a page with nothing after it
- [ ] No text or image crossing the text frame
- [ ] No text rendering below 8pt at final size

A check that fires on a deliberate convention (an `ID  Title` separator, a `···|···`
evidence column) is a false positive in the checker, not a defect in the document.
Narrow the check, do not "fix" the document to satisfy it.

### 9b. Register edits need a fact-preservation guard

When the same pass tightens the XLSX register, apply the edits through a validator that
REJECTS any rewrite which drops a file path, route or number present in the original, or
which introduces a banned phrase. Assert afterwards that IDs, severities, paths, lines and
verification statuses are byte-identical to the pre-edit register. Compressing connective
prose is the goal. Losing one cited line number is a defect.

Watch the guard for over-reach as carefully as the text: `highest-leverage` is the noun,
not the banned verb, and a legitimate use must not be rewritten to satisfy a regex.

### 9c. Numeric conflicts are surfaced, never smoothed

Independent editors reading different slices will surface the same number stated two ways.
Re-measure it yourself before acting. Then:

- A figure contradicted by direct measurement is corrected, and the correction is reported.
- A figure that is merely a different quantity (a detector's parsed-file count vs the source
  total) is left alone and labelled, not harmonised into a single number.
- A figure differing by rounding or by one, where the document already states it consistently,
  is left as the assessor measured it. Do not change three places on a ±1 delta from your own
  single re-count.

Never resolve a conflict by deleting the number.

## 10. The editor test

For every sentence, in order:

1. Would a senior engineer actually write this in a client report? If no, rewrite.
2. Can it be shorter without losing technical meaning? If yes, shorten.
3. Does it tell the reader something new? If no, delete.

The finished report should read as though an engineer spent days inside the codebase,
understood the system, found the real problems, verified them, and wrote down what the client
needs to know.
