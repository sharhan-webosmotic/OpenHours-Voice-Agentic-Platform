# Workscope Document Template (MANDATORY)

> The section-by-section content spec for `AI_DOCS/planning/workscope.md`.
> The **12-section structure below is the default** for every workscope. It is
> the structure of the approved ZENi5 MVP work scope (8 September 2026, version
> 36, 22 pages rendered), which supersedes the earlier shape derived from the
> Resolve IQ, QRSound, Progress Dialog, Meeting Bot, and Nichiren documents.
> Where this file and an older delivered workscope disagree, this file wins.
>
> This is the **final** variant (`variant: final`): the full work scope that
> referees delivery. The short client quote is `BALLPARK-TEMPLATE.md`
> (`variant: ballpark`). The retired 13-section commercial variant is folded in
> here: its investment table and payment terms now live in Section 6, its
> "Why WebOsmotic", "Relevant Experience", "Next Steps" and "Acceptance" blocks
> are optional sections (see "Extending the structure").
>
> **Releases.** The scope strategy (`SCOPE-STRATEGY.md`) decides the releases
> before drafting. Sections 3, 5 and 8 carry only the **Committed** release
> (the MVP in cases B and C, the full scope in case A). Every Tentative future
> phase is a priced block in Section 10 and a tentative row in the Section 6
> investment table, never a milestone in Section 5.
>
> Eight rules govern the whole document:
>
> 1. **Show it as a picture wherever a picture is clearer.** Each role's journey
>    is one image with a summary paragraph beneath (Section 4), and the milestone
>    plan is one Timeline or Gantt image (Section 6). Every image comes from the
>    `diagram-design` plugin (`slide-4x3` preset, `webosmotic` brand profile),
>    exported to PNG into `AI_DOCS/planning/diagrams/` with its `.html` source
>    kept beside it.
> 2. **Say a thing once.** A note that belongs to Features lives in Features. A
>    commercial term lives in Milestone and Payment. Cross-reference by section
>    number ("listed in Section 10") instead of restating.
> 3. **A list carries its kind by purpose.** Ordered (`1. `) when the order
>    means something or the reader points at items by number: feature modules,
>    milestone lanes, technology stack, deliverables, out of scope, future scope,
>    client responsibilities, general notes, and assumptions. Nested bullets
>    (three spaces then `- ` under a feature module, two spaces then `- ` under a
>    milestone lane) for the work items under a numbered group. Unordered (`- `)
>    only for a plain set of items. `docx-from-markdown` 3.12.0 renders each kind
>    in its own fixed format.
> 4. **Plain business English, house writing style.** No em-dashes or en-dashes,
>    and no semicolons in prose (`rules/writing-style-rules.md`). Where two
>    clauses want a semicolon, write two sentences.
> 5. **Highlight so the reader can scan (operator rule, 7 October 2026).** A
>    work scope is read in a meeting, by someone skimming for what they get.
>    - **Every list item opens with a bold lead phrase**, in every list of
>      Sections 3, 5, 8, 9, 10, 11 and 12, nested items included: the subject
>      the reader scans for, then the detail in plain text.
>      `**Pen writing** through the manufacturer's stylus software, with palm rejection`.
>      A label and its detail take a colon inside the bold: `**Tablet app:** reader, notebook, sync`.
>    - **The lead is a complete noun phrase of two to six words**, never cut
>      mid-phrase and never ending on a preposition or article
>      (`**Pen writing** through`, not `**Pen writing through the**`), and
>      never the whole item.
>    - **Italic marks a qualifier that changes when or whether an item
>      applies**: release or phase tags *(from Phase 2)*, *(optional)*,
>      *(client supplies)*. Italic is never used for emphasis of a sentence.
>    - **In prose, bold only the line the reader must not miss**: each Flow
>      paragraph's `**The rule that must not be missed:**`, each milestone's
>      `**Accepted when:**` label, and the Section 6 labels
>      (`**Basis of the timeline:**`, `**Total estimated cost:**`,
>      `**Payment schedule:**`, `**Payment note:**`, `**Third-party charges**`).
>    - **In tables, bold only the Total row.** No underline, no colour, no bold
>      italic.
>    `scripts/check_workscope.py` checks all of this before rendering.
> 6. **Payments: kick-off plus equal round shares (operator rule).** The
>    kick-off share is at least 10 percent, and the rest is split equally over
>    the milestones in a round number (10, 15, 20, 25, 30). Pick the kick-off so
>    the split comes out round: 3 milestones 10 + 3 x 30 or 25 + 3 x 25,
>    4 milestones 20 + 4 x 20, 5 milestones 25 + 5 x 15, 6 milestones 10 + 6 x 15,
>    7 milestones 30 + 7 x 10. Ask only if the client has stated other terms.
> 7. **Team plan only for resource-based work (operator rule).** A fixed-scope
>    work scope carries no team plan and no per-person hours. A resource-based
>    engagement adds a `Team Composition` section: one row per role, the
>    skills that role is chosen for and why this project needs them (for
>    example "Senior Android developer: manufacturer pen SDK integration and
>    E-Ink rendering"), and never hours, rates or cost per person.
> 8. **Every milestone has a measurable completion condition.** One
>    `**Accepted when:**` line per milestone names the observable evidence the
>    client checks to accept it. That condition is what the milestone payment
>    rests on, so it is never an internal task.

---

## Cover frontmatter

```yaml
---
title: "[Product]: [Release] Work Scope"          # e.g. "Acme: MVP Work Scope"
subtitle: "[one-line description of the product and the release]"
presented_to: "[Person], [Role], [Company]"       # the decision-maker, as a person
presented_by: "[Person]" or "WebOsmotic Private Limited"
date: "8th September 2026"                        # human form, printed verbatim on the cover
validity_days: 30
closing: "THANK YOU"                              # centred bold line at the end of the document
version: 1                                        # bump on every revision, pass to --version
variant: final                                    # read by check_workscope.py
---
```

`presented_to` names the decision-maker with role and company. `presented_by`
is a named WebOsmotic person where the operator gives one, otherwise the
company (the ZENi5 cover uses the company). Ask for both. Write `date` in the
human form, never ISO. Do not repeat the title or the names as a body block:
the cover carries them.

---

## The 12 sections

Headings carry their numbers in the text: `# 1. Overview`. All H1 and H2 in
Title Case. A standalone `\newpage` line goes immediately before `# 4.` and
before `# 5.` so the Flow Plan and the Milestones each start on a new page.
Nowhere else.

### Section 1: Overview

Two paragraphs.

1. What the product is, who it serves, what the customer gets, and how they
   arrive (one paragraph, concrete nouns, no adjectives doing the work).
2. What this document covers: the release, the surfaces and capabilities in
   scope listed in one sentence, the non-functional posture the build is held
   to (data residency, encryption, compliance READINESS), and the sources:
   "The scope is based on [document name (version)] and [document name
   (version)]. Later releases are listed in Section 10."

### Section 2: User Roles and Features

A one or two sentence lead-in naming how many roles are live in this release
and what is being built now for a role that arrives later. Then:

```markdown
| Role | Who they are | What they can do in this release |
|---|---|---|
| [Role] | [one line: who this person is] | [one sentence listing what they do, comma-separated, ending with any explicit "never" boundary] |
```

A role with no screen of its own still gets a row when its data model or
permissions are built now. That is what shows a later release is additive.

### Section 3: Features Breakdown

One `## [Surface] ([Platform])` block per surface, in this order: client-facing
apps first, then their web counterpart, then partner or admin dashboards, then
the internal operations console, then `## Backend Platform` last. Each block is
a grouped ordered list:

```markdown
## Customer Mobile App (iOS and Android)

1. **[Feature module]**
   - **[Capability lead phrase]** [the detail, one line, plain English]
   - **[Capability lead phrase]** [the detail] *(from Phase 2)*
2. **[Next module]**
   - **[Label]:** [the detail]
```

- **Bold titles inside numbered items, never `### headings`.** `1. ### Name` renders as literal `###` characters in the DOCX.
- The numbering restarts at 1 in each surface block.
- **Name modules the way the estimate names features.** When an estimate
  exists, each module title matches an Included estimate feature, so
  `check_workscope.py --estimate` can pair them.
- Each sub-bullet is one capability a reader could test, opening with a bold
  lead phrase (rule 5). Name the boundary where it matters ("never sees
  balances", "masked on screen and never stored readable").
- `## Backend Platform` lists the services in plain terms (identity and consent,
  ledger, notifications, audit), so the client sees what is built behind the screens.
- No "QA and Deployments" module. QA and deployment live in the final milestone
  (Section 5) and in Deliverables (Section 8).
- Locked or future features that appear as placeholders in the UI are described
  once here and point to Section 10.

### Section 4: Flow Plan: Step-by-Step Workflow

```markdown
\newpage

# 4. Flow Plan: Step-by-Step Workflow

[One paragraph explaining the colour code: each image is owned by one role, and
every step is coloured by the person who acts ([colour] for [role], [colour] for
[role], [colour] for [role]), as the legend under each title shows. Neutral
outlined steps are system steps where no person acts.]

## Flow A: [Role or Journey Name]

![[caption: what the role does]](diagrams/flow-[role].png)

[One paragraph, four to eight sentences: who acts in this flow and who else
appears on the image, the sequence in prose, the boundaries, and the one rule
that must not be missed, stated plainly ("The rule that must not be missed:
...").]
```

- One flow per role that acts, lettered A, B, C, D in the order of Section 2.
- The image comes first, the paragraph beneath it. No numbered step lists: the
  image carries the sequence, the paragraph carries the meaning.
- Generate each image with the `diagram-design` plugin: a User journey (or
  swimlane) diagram when the flow crosses touchpoints, a Process diagram otherwise, a Sequence
  diagram when the handoff between actors is the point. `slide-4x3` preset,
  `webosmotic` profile, six nodes or fewer with short names. Export with
  `/diagram-design:export-diagram diagrams/flow-<role>.html --png-only` and
  keep the `.html` beside the `.png` in `AI_DOCS/planning/diagrams/`.
- Colour each step by the role that acts, one colour per role across every
  image, with a legend under each title, so the colour-code paragraph above
  reads true for all of them.

### Section 5: Milestones

```markdown
\newpage

# 5. Milestones

### Tentative commencement date: [Weekday DD Month YYYY]. Milestone 1 starts as soon as the kick-off payment is received, and that receipt confirms the date.

## Milestone 1: Discovery and Architecture

### Tentative Duration: weeks 1 to 2, [DD] to [DD Month YYYY]

1. **Discovery and Setup**
  - **[Work item lead]** [detail]
2. **Design**
  - **[Work item lead]** [detail]
3. **Backend**
  - **[Surface or service]:** [what is built]
4. **Deliverables on completion**
  - **[Artefact]** [handed over at the end of this milestone]

**Accepted when:** [observable evidence the client can check, for example "the client signs off the dated roadmap, the architecture, and the findings register in a review call"]

## Milestone 2: [Name]

### Tentative Duration: weeks 3 to 6, [DD Month] to [DD Month][, alongside Milestone N]

1. **Frontend**
  - **[Surface]:** [what is built]
2. **Backend**
  - **[Services]** [what is built]
3. **Deliverables on completion**
  - **[Artefact]** [test build, environment, demo, release notes, test report, documentation]

**Accepted when:** [for example "a customer books and pays on the staging build, and the booking appears on the vendor dashboard"]

**Total estimated duration:** [N weeks and D days] from [Weekday DD Month YYYY] to launch on day [N], [Weekday DD Month YYYY], with [Weekday DD Month YYYY] (day [M]) as the outside date. [Which milestones run in parallel workstreams.] [Pointer to the day-by-day plan if one exists.]
```

- **Dated, tentative, and anchored to the kick-off.** Every duration names its
  week range and its calendar dates. The commencement line states that the
  dates move with the kick-off payment. When no commencement date is known yet,
  write `### Tentative commencement date: to be confirmed on sign-off.` and give
  durations as week ranges only ("weeks 3 to 6 from commencement"). Never a dash
  in a range: "weeks 3 to 6", "14 to 27 September".
- **Lanes are a grouped ordered list**, numbering restarting at 1 in each
  milestone, lane name in bold, work items as nested bullets.
- **Lane names:** `Discovery and Setup`, `Design`, `Frontend`, `Backend`,
  `QA and Testing`, `Deployment`. Use only the lanes that milestone has.
- **Every milestone ends with a `Deliverables on completion` lane**: the
  artefacts the client receives and accepts, which is what triggers that
  milestone's payment in Section 6. Name artefacts, not activities (test build,
  environment on staging, milestone demo, release notes, test report, API
  documentation, a named report).
- **Every milestone then carries one `**Accepted when:**` line** (rule 8): the
  observable evidence the client checks against those deliverables. One
  condition on the line. When a milestone genuinely has two, put the label on
  its own line and two short bold-led bullets beneath it, never more. Write
  what the client can see or do ("a customer books and pays on the staging
  build"), never an internal task ("backend module complete"). The final
  milestone's line names the production launch evidence (live store listing,
  production URL serving real traffic, signed test and security reports).
- **Milestone 1 is Discovery and Architecture.** Its Discovery lane covers the
  dated roadmap, flows and architecture, the partner or integration map, a
  findings register of unknowns (owner, date, effect on the plan), a decisions
  register, and the feature-level backlog with the firm estimate for the later
  milestones. State what discovery does NOT obtain (third-party approvals,
  contracts, sandbox credentials are the client's).
- **The final milestone is QA, pilot or launch.** Its QA lane names the specific
  failure cases exercised, not just "testing". Its deliverables include the
  test, security, and load reports, the production environment, the store
  listings where apps ship, and the handover pack "on the final payment".
- **Parallel workstreams are allowed and shown**: a milestone that overlaps
  another says so in its duration line ("alongside Milestone 2"), and the
  timeline image shows the overlap.
- **No prose paragraph inside a milestone.** Narrative restates Features
  Breakdown and is where a scope document starts contradicting itself. The
  `Accepted when` line is a condition, not a narrative.
- Cost and usage-charge notes do NOT go here. They belong in Section 6.

### Section 6: Milestone and Payment

```markdown
# 6. Milestone and Payment

| Milestone | Description | Weeks and days | Dates, [YYYY] |
|---|---|---|---|
| Milestone 1 | Discovery and Architecture | Weeks 1 to 2, days 1 to 14 | 14 to 27 Sep |
| Milestone N | [name] | Weeks A to B, days X to Y | [DD Mon] to [DD Mon] |
| **Total** | Launch on day [N], days [N+1] to [M] in reserve | **[N] days to launch, [M] to the outside date** | **Launch [Ddd DD Mon], outside date [Ddd DD Mon]** |

![Milestone timeline across the [N]-day plan, with the launch marker and the reserve to [date]](diagrams/milestone-timeline.png)

**Basis of the timeline:** [what the dates are anchored to, that they move day for day with the actual kick-off, that final dates are confirmed after Milestone 1 discovery, which milestones run in parallel and how the team is staffed, and how a late partner or dependency affects only its own lane, with the buffer weeks named.]

**Investment:**

| Release | Commitment | Basis | Amount |
|---|---|---|---|
| MVP | Committed | [Committed hours] hours at [currency][rate] per hour | [currency]XXX |
| Phase 2: [name] | Tentative | [Tentative hours] hours at [currency][rate] per hour | [currency]XXX *(tentative)* |
| **Total committed** | Committed | MVP only | **[currency]XXX** |

**Total estimated cost:** [currency]XXX for building the release described in this document. The payment schedule below applies to this amount. Future phases in Section 10 are tentative, are not part of this amount, and are confirmed in a separate scope before any of them starts.

**Currency and taxes:** amounts are in [currency], exclusive of [applicable taxes].

**Payment schedule:** [P] percent at kick-off and [Q] percent on the delivery of each milestone, which adds up to 100 percent over the [N] milestones. [P is at least 10 and Q is a round number: rule 6.]

| Payment | Trigger | Share | Due, [YYYY] |
|---|---|---|---|
| Payment 1 | Kick-off, on sign-off | [P]% | [Ddd DD Mon] |
| Payment 2 | Milestone 1 accepted: [name] | [Q]% | by [Ddd DD Mon] |
| **Total** | [N+1] payments | **100%** | |

**Payment note:** the kick-off payment is invoiced on sign-off and is due before work begins, and its receipt confirms the commencement date and starts Milestone 1. Each milestone payment is invoiced when that milestone's deliverables are submitted and its acceptance condition in Section 5 is met, on the date shown or the actual delivery date if it moves. Source code is shared on completion of the final milestone payment.

**Third-party charges** ([the services by name]) are billed to [Client] directly. A change in scope changes the estimate.
```

- The table carries **weeks, day ranges, and dates**, not hours or cost per
  milestone. The cost is one total line.
- The timeline image is a `diagram-design` Timeline diagram (or a Gantt diagram
  when parallel milestones overlap and the overlap is the point), drawn from
  the same day ranges as the table so the two cannot disagree. Export it with
  `/diagram-design:export-diagram diagrams/milestone-timeline.html --png-only`
  and keep the `.html` beside the `.png`. When the commencement date is still
  to be confirmed, draw it with week numbers and day numbers only, no calendar
  dates.
- Amounts are `XXX` placeholders (with the client's currency symbol) or
  estimation-sourced on the operator's opt-in. There is no third option.
- **Investment table (from the retired 13-section variant, now with
  releases).** The committed row is the estimate's Committed (MVP) hours times
  the hourly rate the operator states. Each future phase row is that release's
  Tentative hours times the same rate, labelled tentative. The `Total committed`
  row never includes a Tentative row. A blended figure, if ever shown, is
  labelled "Committed + tentative (not a commitment)". In case A there is one
  row (`Full scope`, Committed) and no tentative rows. A cost range appears
  only when the client asked for one. Never cut an essential
  (`SCOPE-STRATEGY.md`) to lower the committed number.
- **Standing notes** go to Section 12 (General Notes), not here: the estimate
  is scope-based and revisited if scope changes, out-of-scope work is quoted
  separately, third-party fees are billed to the client.
- The payment schedule applies to the committed amount only.
- The percentages must add to exactly 100, with the kick-off share at least
  10 percent and every milestone share equal and round (rule 6). Each payment
  row's due date is the last working day of its milestone, or "by the end of
  week N" when the commencement date is not yet confirmed.

### Section 7: Technology Stack

A flat ordered list with bold labels, one line per layer, no lead-in sentence:

```markdown
1. **Mobile:** [framework] (iOS and Android)
2. **Frontend (web):** [framework] for [which surfaces]
3. **Backend:** [framework] with [API style]
4. **Database:** [engine and hosting] for [what], [cache] for [what]
5. **Storage:** [service and region] for [what]
6. **[Integration category]:** [provider], [how it is used]
7. **Infrastructure:** [region, compute, queueing, CDN, WAF, IaC, CI]
```

Integrations each get their own line (payments, messaging, identity checks,
insurance, card programme). A short justification paragraph follows only when a
stack choice costs the client real money and needs a reason. An Architecture
diagram from `diagram-design` belongs here only when three or more components
have directional relationships the list cannot show. Versions are
LTS-verified at selection time, never written from memory.

### Section 8: Deliverables

```markdown
# 8. Deliverables

Each milestone closes with the deliverables listed under it in Section 5. The complete set at handover:

1. **[App]** published to [stores]
2. **[Web surfaces]** deployed
3. **[Backend]** with [key services]
4. **Integrations** configured in sandbox and production: [list]
5. **[Cloud] infrastructure** in [region] with monitoring, alerting, and backups, defined as code
6. **Screen flows and visual designs** for every surface
7. **Infrastructure, integration, and operations documentation**
8. **[Security or compliance report]**, where the build is regulated
9. **Admin credentials, source code, and handover pack**
```

Numbered items, each opening with the bold name of the component (rule 5). If
Section 7 names a component, Section 8 accounts for it.

### Section 9: Out of Scope

A flat ordered list, eight to ten items, each one sentence plus where needed a
short second sentence on what WebOsmotic does instead ("We build to readiness
and supply the evidence"). Only what WebOsmotic does not do on any engagement,
plus the release-specific exclusions a client would otherwise assume:

1. **Compliance certification and audit** (name the standards). We build to readiness and supply the evidence. Certification sits with the client's auditor
2. **Licences, registrations, and regulatory approvals** the business needs. We build to readiness and integrate with the licensed partner
3. **Partner commercial agreements** (name the partners)
4. **Platform and third-party charges**, including hosting and infrastructure, billed to the client directly
5. **Domains, accounts, and subscriptions:** purchase or creation of domains, cloud accounts, developer accounts, and third-party subscriptions. We guide the setup
6. **Legal documents:** terms, privacy notice, consent texts, data processing agreements. Counsel owns these, and we supply the system behaviour they describe
7. **Content production** (marketing, education, catalogue content)
8. **A public website** or landing page, when none is in scope
9. **Anything not described here**, and everything listed under Future Scope

The Out of Scope vs Future Scope test: **would WebOsmotic ever do this for the
client?** No, never (certification, platform fees, legal drafting) means Out of
Scope. Yes, just not in this release, means Future Scope.

### Section 10: Future Scope

```markdown
# 10. Future Scope

These features are not part of this release. [Where they surface in the product now, e.g. as locked tiles with a preview and a notify-me action.]

## Phase 2: [Name] *(tentative)*

Estimated at [currency]XXX *(tentative)*, [N] hours at the Section 6 rate.

1. **[Feature module]:** [what it covers, one line]
2. **[Feature module]:** [one line]

Future phases are tentative estimates for planning only. They are not part of the committed cost and are confirmed in a separate scope before any of them starts.

## Not Yet Planned

1. **[Capability group]:** [what it covers, one line]

Items in Future Scope are not planned, not estimated, and not covered by the current scope or cost. A separate scope will be required and agreed before any of them is implemented.
```

- **One `## Phase N: [Name] *(tentative)*` block per Tentative release** in
  cases B and C, each with its tentative figure (Tentative hours times the
  Section 6 rate) and its feature modules. Each module matches an Included
  estimate feature in a Tentative milestone. Omit the phase blocks in case A.
- **`## Not Yet Planned`** holds what the client wants but no phase covers (a
  Deferred estimate feature). Its closing sentence is fixed copy, written as a
  plain paragraph, and so is the future-phases sentence above it.
- A tentative feature is never in Sections 3, 5 or 8, and a committed feature
  is never here.

### Section 11: Client Responsibilities

A flat ordered list, five items or fewer, bold-labelled:

1. **Partner and account access:** [the services by name]. Where an account does not exist yet, we will guide you through the setup
2. **Brand assets and content:** [logo, guidelines, legal texts from counsel, catalogue content]
3. **A named product owner** with authority to decide, and timely answers on the open product decisions and the assumptions in Section 12
4. **Counsel and compliance sign-off** on [the regulated items]
5. **Operating the platform after launch:** [the operational duties the client keeps]

### Section 12: General Notes

```markdown
# 12. General Notes

1. **Third-party usage charges:** [where they are incurred and the budget-alert recommendation]
2. **Partner sandbox testing:** [testing against partner sandboxes, and the testing plan agreed before the milestone that needs it]
3. **Partner API limits:** [features that depend on a third party are built to what its API supports, and what happens when it does not]
4. **Indicative timeline:** the timeline in Section 6 is indicative. Discovery in Milestone 1 converts it into a firm plan and a feature-level estimate. A change in scope after that is handled as a change request.
5. **Support after handover:** post-handover support, enhancements, and change requests are handled on a time-and-materials basis.
6. **Future enhancements:** enhancements beyond this release, listed in Section 10, are separately scoped and agreed.

## Assumptions Made for This Scope

1. **[Assumption stated as a fact the scope rests on]:** [what it means for the build, and what changes if it is wrong]
2. **[Next assumption]** [...]
```

- Notes are numbered and short. Notes 4 to 6 are standard and kept unless the
  engagement model differs.
- **Assumptions** are the commercial protection: each one is a bold lead
  sentence followed by its consequence ("if the programme insists on one, that
  is a change"). Order them highest-consequence first. Record only assumptions
  the operator or the client has confirmed. Never invent one silently.
- **No assumption silently becomes a requirement.** Every unresolved question
  is listed in the draft review note (below), tied to the assumption or section
  it decides. An assumption that rests on an unanswered question is marked
  unconfirmed in that note until the client answers it.
- **Open questions are not hidden in assumptions.** While any discovery
  question is unanswered, add `## Open Questions` after the assumptions as a
  numbered list, grouped under bold theme labels. A version with open questions
  is a draft. Remove the subsection once every question is answered and folded
  into the document, before the version is sent.
- **Keep only valid questions.** Before each version, check every open question
  against the latest client answers and the scope: drop one the client has
  answered or the document no longer depends on, drop internal questions the
  client should not be asked (cover details, our own staffing or pricing, which
  stay in the review note only), and tie each remaining question to the
  assumption or section it decides ("decides assumption 6").
- A recommended standard the requirement does not state (an accessibility
  target, a compliance posture, a security control) is stated as an assumption
  awaiting the client's agreement, never asserted in the document's own voice.

---

## Draft review note (operator-facing, never sent)

`AI_DOCS/planning/workscope-review-note.md`, rewritten for every version and
shown in chat with the draft:

```markdown
# Workscope Review Note: version [N]

## Unresolved Questions

1. **[Question]:** decides [assumption 3 / Section 5 Milestone 2]. Asked [date], owner [client contact].

## Unconfirmed Assumptions

1. **[Assumption 3 lead]:** rests on question 1. Not yet a requirement.

## Estimate Cross-Check

[The REVIEW lines from check_workscope.py --estimate and how each was resolved, or "no estimate yet".]

## Internal Questions

[Cover details, staffing, pricing: questions for the operator, never for the client.]
```

The client copy is sent only when Unresolved Questions and Unconfirmed
Assumptions are both empty and the `## Open Questions` subsection is gone.

---

## Length and tone

- The ZENi5 work scope runs about 380 Markdown lines and 22 rendered pages for a
  five-milestone regulated platform. Keep it in ONE file: the DOCX renderer
  converts a single Markdown file, and the 300-line split rule in SKILL.md does
  not apply to the workscope.
- Third person for the client by name ("ZENi5 supplies content"), first person
  plural for WebOsmotic ("We build to readiness").
- Specific nouns over adjectives. Every sentence should be one a reader could
  hold the delivery to.

## Rendering

```bash
python3 .claude/skills/workscope/scripts/check_workscope.py AI_DOCS/planning/workscope.md
python .claude/skills/docx-from-markdown/scripts/md_to_docx.py \
  AI_DOCS/planning/workscope.md AI_DOCS/planning/workscope.docx --mode cover --version <N>
```

`workscope.docx` is always the latest render. `--version <N>` (the frontmatter
`version`) also keeps an immutable copy at
`AI_DOCS/planning/versions/workscope-v<N>.docx`, so every version sent stays on
disk. Images are referenced relative to the Markdown
(`diagrams/*.png` beside `workscope.md`). Then render DOCX to PDF and read the
pages (`docx-from-markdown` workflow step 7) before the document goes to the
client.

---

## Extending the structure

After generating the twelve sections, ask once whether the document needs any of:

| Optional section | When it earns its place |
|---|---|
| Why WebOsmotic | A new client who has not seen WebOsmotic credentials before |
| Relevant Experience | Real case-study material exists on file. Never invent one |
| Team Composition | Resource-based engagements only (rule 7): roles, the skills each is chosen for, and why the project needs them, never hours or cost per person. Never in a fixed-scope work scope |
| Research and Development | Items needing genuine research, explicitly excluded from the quotation (the QRSound pattern) |
| Acceptance / signature block | A fixed-scope engagement signed off on this document (the signature table in `docx-from-markdown/references/workscope-template.md`, Section 13) |
| Validity and Next Steps | The proposal needs a validity line ("This proposal is valid for [N] days from the date on the cover page", matching `validity_days`) and the fixed Next Steps bullets plus call to action |

**Why WebOsmotic and Relevant Experience are controlled by intake question 7**
(final default: yes), not by this ask. "Why WebOsmotic" is fixed company copy,
reproduced VERBATIM from
`.claude/skills/docx-from-markdown/references/workscope-template.md` (Fixed
copy, Section 7), never rewritten and exempt from the humanization pass
(document-generation-rules Rule 8 carve-out). Relevant Experience carries 2 to
4 case studies closest to the client's industry, problem or technology, in the
headerless Challenge / Solution / Result table from the same reference, ONLY
projects actually delivered, from material the operator provides or company
records on file. Never invent one: with no material, skip the section and tell
the operator why. The Next Steps bullets and call to action are fixed copy from
the same file (Section 12.2) and are reproduced verbatim. Optional sections are
appended after Section 12 with running numbers.

<!-- Version: 2026-10-05 | Rebuilt around the approved ZENi5 MVP work scope (8 September 2026, v36): dated milestones with a Deliverables on completion lane, weeks/days/dates milestone table with a timeline image and a kick-off plus per-milestone percentage payment schedule, role-owned flow images, General Notes with Assumptions Made for This Scope, frontmatter closing line, \newpage before Sections 4 and 5. Superseded rules are listed in .claude/docs/workscope-alignment-2026-10-05.md. -->
<!-- Version: 2026-10-07 | Operator rules added as rules 5 to 7: reading emphasis (bold lead phrase on every list item, italic qualifiers, bold only the must-not-miss line in prose and the Total row in tables), payments as kick-off of at least 10 percent plus equal round shares, team plan only for resource-based work. Deliverables now bold-led. Open questions kept only when still valid. Undated timeline for a commencement date to be confirmed. Checked by scripts/check_workscope.py. -->
<!-- Version: 2026-10-14 | Ported into ADF (workscope 2.8.0). Images come from the diagram-design plugin into AI_DOCS/planning/diagrams/ (role flows as User journey, Process or Sequence, milestone plan as Timeline or Gantt). Rule 8 and one Accepted when line per milestone. Draft review note lists every unresolved question. Out of Scope and General Notes examples now bold-led to pass the checker. -->
<!-- Version: 2026-10-14 | Merge with origin/main (workscope 2.9.0): the upgraded md_to_docx.py supports them again, so restored the frontmatter closing: "THANK YOU" key (replacing the body THANK YOU line), the standalone \newpage before # 4. and # 5., and rendering with --version N into workscope.docx plus versions/workscope-v<N>.docx. Restored the colour-code paragraph for per-role journey images, adapted to diagram-design images under AI_DOCS/planning/diagrams/. -->
<!-- Version: 3.0.0 | 2026-10-14 | Final variant (variant: final frontmatter key). Releases: Sections 3, 5 and 8 carry the Committed release only, Tentative future phases are priced blocks in Section 10. Section 6 gains the investment table and currency line folded in from the retired 13-section variant (Committed hours x rate, Tentative hours x the same rate, labelled tentative, never in the committed total). Why WebOsmotic and Relevant Experience gated by intake question 7, Validity, Next Steps and Acceptance kept as optional sections, fixed copy referenced from docx-from-markdown/references/workscope-template.md. WORKSCOPE-TEMPLATE-13SECTION.md removed. -->
