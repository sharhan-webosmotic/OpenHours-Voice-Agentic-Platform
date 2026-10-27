---
name: requirement-finalization
description: "Reconcile every client-shared source in AI_DOCS/requirements/ into ONE finalized requirements baseline. Detects conflicts, version drift, gaps, and duplicate decisions across documents, surfaces each as a decision card with options and a recommended default, logs every answer, and writes AI_DOCS/planning/requirements-baseline.md with per-requirement source traceability. Input is strictly the requirements folder: no external sources, no invented facts. Use when client documents disagree or multiple requirement sources exist, before workscope. Also triggers on: 'finalize requirements', 'requirements conflict', 'merge requirement documents', 'requirements baseline', 'the client docs disagree'."
effort: xhigh
next_skill: workscope
required_gate: null
skill_id: SK-163
context_budget:
  load_kb: 30
  scope: task
version: 1.3.0
dependencies:
  required: [session-management]
  optional: [markitdown, workscope, prd-generation]
license: Proprietary
compatibility: "Claude Code 1.x"
consumes:
  - path: "AI_DOCS/requirements/"
  - path: "AI_DOCS/ingested/manifest.md"
  - path: "AI_DOCS/ingested/"
produces:
  - path: "AI_DOCS/planning/requirements-baseline.md"
    consumers: [workscope, tech-specification, estimation, prd-generation, project-brief]
skip:
  - "create a workscope or proposal (use workscope)"
  - "estimate effort or hours (use estimation)"
  - "just ingest or read one file (use markitdown)"
  - "mid-project scope change against an approved baseline (use change-request)"
metadata:
  author: WebOsmotic Private Limited
  category: sdlc
  tags: [requirements, reconciliation, baseline, planning]
---

# Requirement Finalization

Turn a folder of client documents that do not fully agree into one finalized
requirements baseline the rest of the pipeline can trust. Every statement in the
output traces to a source. Every conflict between sources was decided by a
person, on the record. Nothing was invented.

Prose in the output follows `rules/document-generation-rules.md`. The document
structure below is skill-mandated, and the purpose and audience are fixed by
this skill (an internal planning baseline read by the team and by downstream
skills), so the Rule 1 intake gate is pre-satisfied.

## The no-external-sources contract (BLOCKING)

Only two inputs are admissible:

1. The raw sources in `AI_DOCS/requirements/`.
2. Their markdown conversions in `AI_DOCS/ingested/` (via `manifest.md`).

No web search. No competitor knowledge. No domain experience presented as a
client fact. If the sources do not answer a question, the answer is an open
item or a decision card, never an assumption written as a requirement. The one
exception: you may use general knowledge to EXPLAIN a conflict's consequences
on a decision card ("these two payment gateways differ in INR settlement"), and
that explanation is labeled as context, not as a client statement. A gap you
think the client needs filled may be offered only as a `Proposed` row (Phase 1),
never as a requirement.

## Phase 0: Source inventory

1. Read Memory Protocol global files (per `memory-protocol`, scope `task`).
2. If a root-level `requirement.md` exists, move it to
   `AI_DOCS/requirements/requirement.md`, announce the move, and append a
   migration note to `AI_DOCS/memory/decision-log.md`.
3. List `AI_DOCS/requirements/`. If it is missing or empty, STOP and ask the
   user to place the client material there (or paste it, in which case save the
   paste as `AI_DOCS/requirements/<topic>-brief.md` first).
4. Read `AI_DOCS/ingested/manifest.md`. Ingest any requirements file that has
   no manifest row via the `markitdown` skill. Never read a raw binary directly.
   Check each row's Coverage column. A source counts as read only at
   `COMPLETE`. For `INCOMPLETE` or `unverified`, run the markitdown visual pass
   and `verify_coverage.py` first. If a gap remains (an unreadable image, a
   page that will not render), record the source as `partial` in the inventory
   and add a High-impact Open question naming the unread unit, because a
   requirement inside an unread image is still a requirement.
4a. **Capture expiring sources FIRST.** If the client states or implies that
   access to any source is temporary, conditional, or outside our control (a
   shared link they will revoke, a portal invite, a trial account, "I will take
   this down later"), capture that source into `AI_DOCS/requirements/` in full
   BEFORE extracting from any other source, and before planning against it.
   Capture the structure, the vocabularies, and the stated conventions, never a
   verbatim copy of incidental content, and separate explicitly what the product
   needs from what merely happens to be in the document. The plan then cites the
   capture, never the expiring source.

   The failure this prevents is specific: the natural order is to plan first and
   consult the reference while building, which loses the source at exactly the
   moment the detailed questions arrive.
4b. **Declare precedence when two sources describe the same requirement space.**
   A reporter's tracker and an operator's restatement of it are the common pair,
   and they routinely disagree in substance rather than wording, because the
   operator has superseded the reporter's suggested remedy with a decision.
   State once, in writing, which source is authoritative and why. Then record
   what the NON-authoritative source uniquely contributes, because it is usually
   the reproduction detail and sometimes the actual root cause, both of which the
   authoritative summary compresses away. Both are needed, for different things,
   and neither substitutes for the other. Building from the wrong one produces
   work that is defensible and wrong.
5. Print the inventory table and get a nod before proceeding:

```
| ID | File | Type | Date | Ingested path | Coverage |
|----|------|------|------|---------------|----------|
| S1 | client-brief.pdf | pdf | 2026-05-12 | AI_DOCS/ingested/pdf/client-brief.md | COMPLETE |
| S2 | figma-export.png | image | 2026-05-20 | AI_DOCS/ingested/image/figma-export.md | COMPLETE |
| S3 | call-notes.md | md | 2026-06-02 | (native markdown, linked images checked) | COMPLETE |
```

Date is the document's own date when stated, else the file's timestamp, and it
matters: supersession reasoning in Phase 2 depends on it.

## Phase 1: Requirement extraction

Walk every source and extract numbered requirement statements:

- `R-001`, `R-002`, ... in one global sequence across all sources.
- Each statement carries its source references: `S1 p.4`, `S3`, or `S2 screen 3`.
  A statement supported by several sources lists them all.
- Classify each: `functional`, `nfr`, `constraint`, or `decision` (a choice the
  client already made, like a named gateway or stack).
- Tag each with its **Basis** (mandatory, downstream skills read it):

| Basis | Meaning | Must carry |
|-------|---------|------------|
| `Verified` | Stated by a source, or settled by a decision card | Source ref (`S1 p.4`) or decision ref (`C-03`/`D-03`) |
| `Assumption` | Inferred, not stated, needed to proceed | Reason, and the role who must confirm it |
| `Open` | Depends on an unanswered question | Clarification log ref (`Q-NN`) |
| `Proposed` | Suggested by the AI or the team, in no source | Reason, and `needs client confirmation` |

- Keep the client's own wording where it is precise. Tighten it where it is
  vague, and keep the original phrase in the source ref so the tightening is
  checkable.

Save filtering and judgment for Phase 2. Extraction is complete only once every
source has been walked end to end. For a large source set, extract per source
and keep running notes so a compaction never loses the walked portion.

## Phase 1b: Business understanding and completeness pass

**Business understanding.** Draft five lines from the sources only, each with a
source ref or the tag `Missing`: problem (and why now), objective with a
measurable outcome, users and approvers, current process, future process. A
`Missing` line becomes a clarification question (Phase 3). Exit test: the
requirement can be explained in plain language without repeating the brief.

**Completeness matrix.** For each feature or flow, mark every dimension
`Defined`, `Partial`, or `Missing`, citing `R-NNN` for Defined and Partial:

| Feature / flow | Trigger + actor | Inputs | Processing rules | Outputs | Business rules | Edge cases | NFRs |
|----------------|-----------------|--------|------------------|---------|----------------|------------|------|

Edge cases means missing, invalid, duplicate, delayed, and conflicting data. A
cell is `Defined` only when the sources cover the normal flow and the exception
flow. Every `Missing` or `Partial` cell either becomes a `Q-NN` clarification
or is closed by an `Assumption` row with a confirmer. Estimation reads this
matrix to see what is unknown, so never upgrade a cell to look complete.

## Phase 2: Misalignment detection

Cross-check the full `R-NNN` set and build the Conflict and Ambiguity Register.
Six classes, checked in order:

| Class | What it looks like |
|-------|--------------------|
| Direct contradiction | Two sources state incompatible requirements (Stripe vs Razorpay, 3 roles vs 5 roles). |
| Version drift | A newer source restates an older one with changes. Likely supersession, still confirmed, never assumed. |
| Scope mismatch | A feature is in one source's scope and absent from, or excluded by, another. |
| Terminology collision | One word, two meanings across sources ("vendor" as supplier vs as marketplace seller). |
| Silent gap | A requirement implies flows no source covers (payments with no refund flow, roles with no admin management). Gaps become open items or cards, not invented requirements. |
| Duplicate with delta | Two sources describe the same feature with small differences that change the build (10 MB vs 25 MB upload cap). |

Each register entry gets an ID (`C-01`, `C-02`, ...), the class, the involved
`R-NNN` statements, and a one-line consequence (why the difference changes the
build, the cost, or the scope).

## Phase 3: Decision cards (HARD GATE)

Every register entry becomes a decision card. All of them. An obvious
supersession still gets a card, stated as a confirmation ("S3 is newer and
supersedes S1 on this point: confirm?"). Nothing is resolved silently.

- Batches of at most 5 cards per message, grouped by module.
- Wait for answers. A silent card is re-asked, never quietly resolved.
- Every answer is appended to the register and to
  `AI_DOCS/memory/decision-log.md` immediately (compaction safety).
- Bulk answers are first-class: `all A`, `A except C-04 B`.

Card format:

```
[Conflict] C-03 | Payments | direct contradiction            card 3 of 7
WHAT THE SOURCES SAY
  S1 client-brief.pdf (2026-05-12, p.4): "checkout is handled via Stripe"
  S3 call-notes.md (2026-06-02): "client prefers Razorpay for INR settlement"
WHY IT MATTERS
  Settlement currency, payout flow, and PCI scope all change with this choice.
OPTIONS
  A. Stripe: follows the written brief. Weaker INR settlement.
  B. Razorpay: follows the newer client statement. INR-native.
     (recommended: latest client word, and users are India-based per S1 p.2)
  C. Both, phased: Stripe at launch, Razorpay fast-follow. Adds scope.
  D. Park it: logged OPEN, blocks payment scope until the client answers.
Answer A/B/C/D, or state your own resolution.
```

Exactly one option is marked recommended, with the reason drawn from the
sources. "Park it" is always available: a parked item records an owner (who
will get the answer) and what it blocks.

The gate: the baseline is not generated while any card is unanswered and not
explicitly parked.

**Clarification log.** Every parked card, `Missing` business-understanding
line, and unclosed `Missing`/`Partial` completeness cell becomes a `Q-NN` entry.
Questions the operator cannot answer (most client-side facts) are logged, not
forced. Sort by impact, High first:

Each `Q-NN` uses the `/ask` 2.0.0 shape (`skills/ask/SKILL.md`), so a reader
never meets a bare "item 5" question. Any inline question this skill asks uses
the same block: `Read`, `Wording`, `Conflict`, `Question`, and options with the
recommended answer first.

| Field | Rule |
|-------|------|
| Read | Source document and location (`S1 p.4`, file path, section or row). Mandatory. |
| Wording | The text at issue, quoted verbatim from the source. |
| Conflict or Gap | The requirement (`R-NNN`) or business-understanding cell it blocks, and why. |
| Question | One sentence ending in `?`. |
| Recommended answer | The answer we suggest, with a one-line reason drawn from the sources. |
| Impact | `High` / `Medium` / `Low` on scope, cost, or schedule. High means the answer can change the build or the price materially. |
| Decision owner | A role (`client product owner`, `client finance`, `our tech lead`), never an invented name. |
| Status | `Open`, `Answered` (with answer and date), or `Qualified` (proceeding on a named assumption, with the `R-NNN` that carries it). |

## Phase 4: Generate the baseline

Write `AI_DOCS/planning/requirements-baseline.md`:

```
# Requirements Baseline: <project>
Status: FINALIZED <date> | Sources: N | Conflicts resolved: N | Parked: N
Readiness: <verdict from Section 9>

## Business understanding
(unnumbered block at the top: problem | objective + measurable outcome |
users and approvers | current process | future process, each with a source
ref or Missing)

## 1. Source inventory
(the Phase 0 table)

## 2. Finalized requirements
(grouped by module: R-NNN | statement | type | basis | refs / confirmer | status)
basis is Verified, Assumption, Open, or Proposed (Phase 1).
status is one of: confirmed (sources agree), decided (a card resolved it,
ref C-NN), assumed (basis Assumption), pending (basis Open or Proposed)

## 3. Conflict and ambiguity register
(C-NN | class | what conflicted | sources | resolution | decided by | date)

## 4. Decision log
(D-NN | question asked | options presented | answer given | why)

## 5. Open items: clarification log
(Q-NN | read (source + location) | wording (quoted) | conflict or gap |
question | recommended answer + reason | impact | owner role | blocks |
status | answer + date), sorted High impact first

## 6. Out-of-scope signals
(exclusions the sources themselves state, ready for the workscope's
Out of Scope section)

## 7. Contract statement
One short paragraph: this baseline was built strictly from the sources in
Section 1. Nothing external was added as fact. Anything the sources do not
answer appears in Section 5, or in Section 2 tagged Assumption or Proposed.

## 8. Completeness matrix
(the Phase 1b table, one row per feature or flow)

## 9. Readiness verdict
One of:
- Ready to scope: no Open High-impact Q-NN, no Assumption or Proposed row in a
  High-impact area.
- Ready with qualified assumptions: no Open High-impact Q-NN, but scope rests
  on listed Assumption or Qualified rows (list their IDs). Workscope and
  estimation must carry each into their assumptions section.
- Not ready: list every Open High-impact Q-NN. Workscope and estimation stop
  or proceed only as an explicitly labeled draft.
```

**Downstream contract.** Only `Verified` rows are requirements. `Assumption`
rows enter a workscope or estimate only as stated assumptions. `Proposed` rows
enter only as options awaiting client confirmation. `Open` rows are risks or
contingency, never scope. Consuming skills check Section 9 before proceeding.
Sections 1 to 7 keep their pre-1.1.0 numbers so existing downstream references stay valid.

Over 300 lines, split per the framework rule: `requirements-baseline/index.md`
(status header, source inventory, register summary, links) plus
`part-1-requirements.md`, `part-2-registers.md`.

## Phase 5: Sign-off and handoff

Ask one question: "Is this baseline final? Downstream skills (workscope, tech
spec, estimation) will treat it as the requirements source of truth." On yes,
update `session-state.md` and offer `/workscope` (its Phase 0 pre-fills
discovery from this baseline, so the client is not re-asked what their own
documents already answer).

```
Skill requirement-finalization complete. Memory updated.
Checkpoint: AI_DOCS/planning/requirements-baseline.md, decision-log.md, safe to compact.

Handing off to: workscope

Summary of what was decided:
- <headline resolutions, one line each>
```

Re-running this skill after new sources arrive is normal: re-inventory, extract
only the new sources, re-run detection against the existing baseline, card only
the NEW conflicts, and bump the baseline with an appended change note. A
baseline that downstream skills have consumed is never silently rewritten.

## Critical rules

1. NEVER resolve a conflict silently, even an obvious supersession. State it
   and get the nod.
2. NEVER merge by averaging ("about 15 MB" from a 10 vs 25 conflict is a bug,
   not a resolution).
3. NEVER let an assumption or a proposal become a requirement silently. Every
   `R-NNN` carries a Basis tag, and only `Verified` counts as a requirement.
4. Every `Verified` row carries a source or decision ref. An `Assumption` or
   `Proposed` row carries its reason and confirmer instead. A row with neither
   does not go in Section 2.
5. Parked items and Q-NN entries carry an owner role, an impact, and what they
   block. A list with no owners is a stall, not a plan.
6. NEVER mark a completeness cell `Defined` or the verdict `Ready to scope` to
   look finished. An honest `Not ready` is a valid, useful output.

## Troubleshooting

- **The folder has one clean source and no conflicts.** Say so, skip Phase 3,
  and produce a thin baseline (extraction + empty registers). Even one source
  benefits from numbered, traceable statements.
- **A file will not ingest** (corrupt, unsupported). List it in the inventory
  with status `unreadable`, ask the user for a replacement, and do not guess
  its contents.
- **The user answers "both" to an either/or card.** Both is option C territory:
  re-present the card with the phasing and cost consequence spelled out, and
  let them pick with the trade-off visible.
- **Sources arrive mid-flow.** Finish the current card batch, then restart from
  Phase 0 step 4 for the new files only.

<!-- Version: 1.1.0 | 2026-10-14 | playbook gap close: Basis tags (Verified/Assumption/Open/Proposed), Phase 1b business understanding + completeness matrix, impact-ranked clarification log, readiness verdict, downstream contract -->
<!-- Version: 1.2.0 | 2026-10-14 | Source inventory carries a Coverage column. Only COMPLETE sources count as read, and an unread unit becomes a High-impact Open question. -->

<!-- Version: 1.2.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 1.3.0 | 2026-10-22 | Q-NN clarification log uses the /ask 2.0.0 shape: Read, Wording, Conflict or Gap, Question, recommended answer -->
