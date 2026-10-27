# Ballpark Quote Template (variant: ballpark)

> The short, readable quote for `AI_DOCS/planning/workscope.md` when the intake
> answer is **Ballpark**. Written AFTER the scope strategy card is answered and
> AFTER the estimate exists (order: scope strategy, estimate, this document).
> The full version is `WORKSCOPE-TEMPLATE.md` (variant: final).
>
> A ballpark wins the conversation, it does not referee delivery. It tells the
> client what they get first, what comes later, roughly what each costs, and
> what we need to know from them. Nothing else.

## Writing standard

1. **To the point.** One idea per sentence, one screen per section where possible.
2. **Plain English, no jargon.** "secure login", never "JWT". No framework,
   database, cloud or architecture names anywhere in a ballpark.
3. **Bold lead phrases.** Every list item opens with a bold lead of two to six
   words, the detail in plain text after it.
4. **Images over prose.** If a paragraph explains a flow, draw it instead.
5. **No technical challenges, hidden risks or payment schedule.** Every risk we
   see becomes a question in Section 5 that the client can answer (SKILL.md,
   Client-problem question rule). Payment is one short note.
6. House writing style: no em-dashes, no en-dashes, no semicolons in prose.

## Cover frontmatter

```yaml
---
title: "[Product]: Ballpark Quote"
subtitle: "[one line: what the product does and for whom]"
presented_to: "[Person], [Role], [Company]"
presented_by: "WebOsmotic Private Limited"
date: "14th October 2026"        # human form, never ISO
validity_days: 30
closing: "THANK YOU"
version: 1                       # bump on every revision, pass to --version
variant: ballpark                # read by check_workscope.py
---
```

Compatible with `docx-from-markdown --mode cover` (unknown keys such as
`variant` are ignored by the renderer).

## Sections

| # | Section | Always? | Content |
|---|---|---|---|
| 1 | Overview | Yes | Two or three sentences: what they want, for whom, and the outcome. The client's words, not ours |
| 2 | What We Will Build | Yes | `## MVP` first (or `## Full scope` in case A), then one `## Phase N: [name] *(tentative)*` per future phase. Numbered feature modules with a bold title and at most three nested bold-led points |
| 3 | How It Works | Yes | One to three images, a one-line caption under each |
| 4 | Estimated Investment | Yes | The release table, the fixed ballpark note verbatim, the payment note |
| 5 | Questions for You | Yes | Client-problem questions only, conflicts phrased as questions |
| 6+ | Milestone Outline, Assumptions, Out of Scope | Only when the intake asked | Short: a milestone list with week ranges, a few assumption lines, a short exclusion list |
| 6+ | Why WebOsmotic, Relevant Experience | Intake question 7 (default yes) | The fixed copy plus at most two case studies (see below) |

Future phases are omitted in case A. Optional sections keep the running
numbering after Section 5.

### Section 3 images

Draw with the `diagram-design` plugin into `AI_DOCS/planning/diagrams/`,
`slide-4x3` preset, `webosmotic` brand profile, six nodes or fewer with two- or
three-word names, exported with
`/diagram-design:export-diagram diagrams/<name>.html --png-only` (keep the
`.html`). Pick one to three:

1. **Overview** (`diagrams/overview.png`): who uses it and what the system connects to
2. **Main journey** (`diagrams/main-journey.png`): the primary user journey, as a User journey or Process diagram
3. **MVP vs future map** (`diagrams/release-map.png`): MVP features in one band, each future phase in its own band, marked tentative

### Section 4 cost

| Release | Commitment | Estimated cost |
|---|---|---|
| MVP | Committed | [currency][Committed hours x rate] |
| Phase 2: [name] | Tentative | [currency][Tentative hours x rate] *(tentative)* |

- **MVP figure:** the estimate's Committed (MVP) hours times the rate the
  operator states for this engagement. Ask for the rate, never assume it.
- **Future phase figures:** each release's Tentative hours times the same rate,
  labelled tentative, never added to the MVP figure. No blended total.
- **A range only if the client asked for one.** Otherwise one figure per row.
- **Never cut an essential** (`SCOPE-STRATEGY.md`) to lower the MVP figure.
- Then the fixed ballpark note, verbatim, as its own paragraph:

  This is a ballpark figure. The final scope, timeline and cost are confirmed once the discovery phase has covered every feature and challenge.

- Then `**Payment note:**` in one or two lines (for example "work starts on a
  kick-off payment, and the rest is split across the milestones agreed in the
  final scope"). Never a payment table or a dated schedule.

### Section 5 questions

Only questions that pass the client-problem rule in `SKILL.md`: the client can
answer without software knowledge, and the answer changes scope, cost or
feasibility. Every hidden challenge is rewritten into one of these. A conflict
between documents names both sources ("Your brief says 200 schools, the
September email says 20. Which should the first release plan for?").

### Why WebOsmotic and Relevant Experience (intake question 7)

The fixed "Why WebOsmotic" copy is reproduced VERBATIM from
`.claude/skills/docx-from-markdown/references/workscope-template.md` (Fixed
copy, Section 7), never rewritten and exempt from the humanization pass. In a
ballpark keep it short: the fixed copy plus at most two case studies in the
headerless Challenge / Solution / Result table, only projects actually
delivered, never invented. No material on file means skip and tell the
operator.

---

## Filled mini example (fictional client)

```markdown
---
title: "Penwise: Ballpark Quote"
subtitle: "Handwritten class notes on school tablets, shared with teachers"
presented_to: "Asha Rao, Founder, Penwise Learning"
presented_by: "WebOsmotic Private Limited"
date: "14th October 2026"
validity_days: 30
closing: "THANK YOU"
version: 1
variant: ballpark
---

# 1. Overview

Penwise wants students to write class notes by hand on pen tablets and have them reach their teacher the same day. The first goal is to prove this in two pilot schools before the spring term.

# 2. What We Will Build

## MVP

1. **Handwritten Notebook**
   - **Pen writing** with page tools and undo
   - **Offline notes** that sync when the tablet is back online
2. **Teacher View**
   - **Class inbox** of each student's notes by lesson
3. **Accounts and Schools**
   - **School login** for students and teachers, set up by an administrator

## Phase 2: Class Sharing *(tentative)*

1. **Shared Notes**
   - **Teacher handouts** pushed to every tablet in a class

# 3. How It Works

![Students write on tablets, notes sync to the teacher's class inbox](diagrams/main-journey.png)

![MVP features first, class sharing in Phase 2](diagrams/release-map.png)

# 4. Estimated Investment

| Release | Commitment | Estimated cost |
|---|---|---|
| MVP | Committed | USD 18,400 |
| Phase 2: Class Sharing | Tentative | USD 6,900 *(tentative)* |

This is a ballpark figure. The final scope, timeline and cost are confirmed once the discovery phase has covered every feature and challenge.

**Payment note:** work starts on a kick-off payment, and the rest is split across the milestones agreed in the final scope.

# 5. Questions for You

1. **Tablet operating system:** the tablets are built in China. Which operating system and version do they run?
2. **Test devices:** can we get two tablets for testing during the build?
3. **Pilot size:** your brief says 200 students, the September email says 60. Which number should the pilot plan for?
4. **School internet:** do classrooms have Wi-Fi, or will tablets often be offline for a whole day?
```

<!-- Version: 1.0.0 | 2026-10-14 | New ballpark variant (workscope 3.0.0): short client quote with releases (MVP committed, future phases tentative), one to three diagram-design images, the fixed ballpark note, a one or two line payment note, client-problem questions only, optional sections gated by the intake, Why WebOsmotic fixed copy referenced from docx-from-markdown. -->
