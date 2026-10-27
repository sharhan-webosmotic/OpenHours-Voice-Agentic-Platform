---
name: markdown-creator
description: "Generate well-structured Markdown documents that follow best practices: correct heading hierarchy, GitHub-flavored callouts, accessible links and images, fenced code blocks with language tags, sane tables, and folder-based splits. Use when the user asks for a Markdown file, doc, spec, runbook, or README-style page, or any skill needs to emit .md content for humans and agents. Also triggers on: 'write a markdown', 'create a markdown', 'format this as markdown', 'markdown runbook', 'markdown table'."
effort: medium
skip:
  - "create workscope"           # use /workscope — has its own output contract
  - "create tech spec"           # use /tech-specification
  - "write retrospective"        # use /retrospective
  - "document architecture"      # use /architecture
  - "regenerate CLAUDE.md"       # use /project-context
  - "generate PDF"               # use /pdf (consumes .md → .pdf)
  - "generate Word doc"          # use /docx
  - "generate Excel"             # use /xlsx
skill_id: SK-106
context_budget:
  load_kb: 30
  scope: task
version: 1.6.0
license: Proprietary
compatibility: "Claude Code 1.x"
allowed-tools: "Read Write Edit Grep Glob"
dependencies:
  required: []
  optional: [session-management, memory-protocol]
produces:
  - path: "<caller-specified>.md"
    consumers: [docx, docx-from-markdown, pdf, project-context, any-human-reader]
metadata:
  author: WebOsmotic Private Limited
  category: infrastructure
  patterns: [domain-specific]
  tags: [markdown, documentation, formatting, best-practices]
---

# /markdown-creator — Best-Practice Markdown Generator

> **Purpose**: Produce Markdown documents that render correctly on GitHub, GitLab, Bitbucket, VS Code preview, and common static-site generators; stay accessible and machine-parseable; and never grow past the point where humans or agents stop reading.
>
> **When to invoke**: Any time the user asks for a Markdown document, or another skill needs to emit `.md` content and does not have its own stricter output contract.
>
> **Output**: A file path chosen by the caller (this skill does not dictate where to write). The file is valid CommonMark + GFM, passes the checklist in this skill, and stays under the 300-line cap (or splits per the folder rule).

---

## Iron Laws

> [!CRITICAL]

```
1. Start every document with exactly one H1 (# Title). A second H1 confuses TOC
   generation and breaks the one-title-per-document convention every renderer assumes.
2. Progress heading levels one step at a time (H2 -> H3 -> H4, never a jump from H2
   straight to H4): a skipped level breaks the outline that screen readers and TOC
   tools build from heading depth.
3. Tag every fenced code block with its language: always ```bash, ```ts, ```json,
   never a bare ``` fence. The tag is what turns on syntax highlighting and lets
   tools extract the code correctly.
4. Write link text that names the destination, never "click here" or "this link":
   a reader scanning links out of context needs the words alone to know where they lead.
5. Wrap a URL as [descriptive text](url) or a reference-style link rather than pasting
   it raw into prose. A bare URL breaks the reading flow and gives screen-reader users
   no context.
6. Give every <img> or ![]() meaningful alt text (empty alt="" only for genuinely
   decorative images): alt text is what a screen reader announces in the image's place.
7. Keep every user-facing artifact (runbook, spec, milestone/epic plan, retrospective,
   proposal, README-style page) under ~300 lines. At the cap, split into a folder with
   index.md: a long single file breaks AI context windows and human reading.
   Reference / appendix material consulted by tools may exceed 300 lines when a single
   scannable file serves readers better.
8. Pick one emphasis style, **bold** or *italic*, and hold it file-wide. Mixing styles
   reads as inconsistency rather than intentional emphasis.
9. Keep every table's column count consistent across its header, separator, and data
   rows. Tables normally carry a header row; the one exception is the all-empty header
   (`| | |`) that marks a deliberately headerless table for DOCX conversion (see
   section 10).
10. ALWAYS end the file with exactly one trailing newline.
11. NEVER use an en-dash (–) anywhere. Rewrite the sentence to remove the need for it.
12. NEVER use an em-dash (—) anywhere. Replace with a comma, semicolon, or two sentences.
13. NEVER write numeric ranges with a dash. Write "8 to 10 weeks", not "8–10 weeks".
```

---

## Writing Style Rules

These rules apply to every line of prose and every label this skill emits. They exist to keep output readable, human, and consistent with the docx and docx-from-markdown skills.

### No dashes as separators or range markers

| Wrong | Right |
|---|---|
| `Weeks 8–10` | `Weeks 8 to 10` |
| `Phase 1–2` | `Phase 1 to 2` |
| `**Client layer** — five surfaces` | `**Client layer:** five surfaces` |
| `Auth, multi-tenancy — core platform` | `Auth and multi-tenancy form the core platform.` |
| `Deploy on Friday — check the runbook` | `Deploy on Friday. Check the runbook first.` |

**Rule:** If you reached for an en-dash or em-dash, stop and rewrite the sentence. A dash usually means two ideas that belong in two sentences, or a label that should use a colon.

### Prose and voice

Prose follows `rules/document-generation-rules.md`: the human writing standard, the banned-phrase list, and the Rule 7 validation pass before finalizing.

### Label separators

Use a colon after every bold lead-in label. Put the colon inside the bold span.

```markdown
<!-- Wrong -->
**Kick-off payment** — covers scope alignment and repo setup.

<!-- Right -->
**Kick-off payment:** covers scope alignment and repo setup.
```

### Verification before writing the file

Run this mental checklist on every paragraph:

- [ ] Zero en-dashes (`–`) and em-dashes (`—`) anywhere.
- [ ] Numeric ranges written as "X to Y", not "X–Y".
- [ ] Bold lead-in labels end with `:` inside the bold span.

---

## Pre-flight (before writing)

Per `rules/document-generation-rules.md` Rule 1, confirm ALL of the following in ONE batch before writing (skip anything already known from context, never infer silently):

1. **Purpose:** reference doc, how-to, runbook, spec, ADR, release notes, proposal, or general prose?
2. **Audience:** end user, developer, AI agent, mixed?
3. **Tone:** formal, plain business English, or direct technical?
4. **Target path:** e.g. `AI_DOCS/docs/setup.md`. Never invent one; confirm if unstated.
5. **Renderer:** GitHub (default), GitLab, VS Code preview, static-site (Docusaurus/MkDocs)? Affects callout syntax and Mermaid support.
6. **Size expectation:** single file, or multi-part (apply folder-split upfront)?
7. **Front-matter required?** YAML frontmatter for static-site generators (title, date, tags).

If the answer to (6) suggests the doc will exceed ~300 lines, **create the folder layout first**: don't write one long file then refactor.

---

## Structure checklist (apply every time)

### 1. Exactly one H1
The H1 is the document title. Everything else descends from it with H2, H3, H4. Stop at H4 unless the doc is a reference manual; deeper nesting is a smell.

### 2. TL;DR or Purpose block near the top
Under the H1, include a one-to-three-sentence summary so readers (and agents) can decide whether to keep reading.

### 3. Table of Contents (when >150 lines)
For docs 150+ lines, insert a TOC after the purpose block. Use GitHub-style slug anchors (`[Setup](#setup)`). Tools: generate with `markdown-toc` or hand-write and verify anchors match heading text.

### 4. Section ordering by reader priority
Order: Purpose → Prerequisites → Steps / Reference → Examples → Troubleshooting → References. Readers scan top-down; bury nothing load-bearing.

### 5. Sentence-case headings
`## Set up the database`, not `## Set Up The Database`. Exception: product names and acronyms.

### 6. Semantic callouts (GitHub-flavored)
Use GFM callouts for emphasis; they render as colored boxes on GitHub and degrade to blockquotes elsewhere.

```markdown
> [!NOTE]
> Background info, not critical to the flow.

> [!TIP]
> Non-obvious shortcut or optimization.

> [!IMPORTANT]
> Must-know for success — do not skip.

> [!WARNING]
> Risky action; read before proceeding.

> [!CAUTION]
> Destructive or irreversible action.
```

Full callout reference: `references/callouts.md`.

### 7. Fenced code blocks with language tags
Always tag the language: `bash`, `ts`, `tsx`, `py`, `json`, `yaml`, `sql`, `diff`, `md`, `mermaid`, `text`, `dockerfile`. This enables syntax highlighting and lets tools extract code.

Mermaid blocks MUST follow `rules/mermaid-rules.md` (quote labels with special characters, no bare lowercase `end`, validate in mermaid.live). A Mermaid block that does not render must fail loudly, never ship as a blank.

Example:

````markdown
```bash
bash upgrade.sh --auto
```
````

### 8. Links
- Inline for one-offs: `[GitHub docs](https://docs.github.com)`
- Reference-style for docs with many links to the same few destinations:

```markdown
See the [setup guide][setup] and [troubleshooting][ts].

[setup]: ./setup.md
[ts]: ./troubleshooting.md
```

- Write link text that makes sense read out of context, since a reader scanning a list of links (or a screen reader announcing them) sees only the text, never the surrounding sentence. Avoid `[click here](url)` or `[this](url)`, which say nothing on their own.
- For same-repo references, use relative paths (`./sibling.md`, `../other/doc.md`) so links survive rename.

### 9. Images

`![Alt text describing what the image conveys](./path/to/image.png)`. Decorative images use `![](path)` with empty alt (screen readers skip them).

**Diagrams come from the `diagram-design` plugin**, the framework's only diagram generator. It writes `diagrams/<name>.html` (the editable source, keep it) and `/diagram-design:export-diagram diagrams/<name>.html --png-only` exports the PNG you reference. Its PNG carries the diagram's own paper background, so one copy reads correctly in a light or dark Markdown viewer and on a white DOCX page. No second transparent copy is needed. Mermaid kept as source in working docs (`AI_DOCS/`) stays Mermaid under `rules/mermaid-rules.md`. When that diagram has to appear in a client document, redraw it with `/diagram-design:import-mermaid`.

**No redundant captions.** If the section heading immediately above the image already names the content, do not add an italic caption line below it. Add a caption only when the image appears mid-section with no nearby heading that describes it. This rule is the same in all three output skills (`markdown-creator`, `docx-from-markdown`, `docx`).

```markdown
<!-- Wrong — heading and caption say the same thing -->
## Milestone Delivery Model
![Milestone Delivery Model](images/milestone-timeline.png)
*Figure: Milestone Delivery Model*

<!-- Right — heading is sufficient -->
## Milestone Delivery Model
![Milestone delivery phases showing weeks 1 to 16](images/milestone-timeline.png)
```

### 9b. Diagram R&D pass (documents headed for DOCX or a client)

Before finalising a document, read it once asking which passage a reader is
more likely to understand as a picture than as prose. Promote a passage to a
diagram when it hits two or more of these, and on counter-intuition alone:

| Signal | What it looks like |
|---|---|
| Sequence | 4+ ordered steps, especially with a handoff, a wait state, or a loop back |
| Structure | 3+ named components with directional relationships, or layered tiers |
| Counter-intuition | A rule the reader will get wrong on first read. If a sentence needs "not X, but Y", draw it |

Do NOT draw a flat unordered list, a rows-with-status-and-owner grid (that is a
table), commercial terms, or a two-step sequence. Keep the prose either way: a
diagram sits beside the passage it illustrates, never replacing it. Two to four
diagrams in a typical document, because one per section signals nothing.

Generate with the `diagram-design` plugin into a `diagrams/` folder beside the
markdown, then export each to PNG. Full type lookup, the brand profile, and the
print-size math: `docx-from-markdown` SKILL.md, "Diagram R&D pass".

### 9c. Numbered blocks that carry a title (DOCX destination)

Write a titled item inside a numbered list as a **bold list item**, never as a
heading nested in the list:

```markdown
<!-- Wrong — renders as literal "###" characters in DOCX -->
1. ### Category Landing and Application Start
   - Feature point

<!-- Right -->
1. **Category Landing and Application Start**
   - Feature point
```

A markdown parser reads `1. ### Text` as a list item whose content begins with
`###`, so the hashes survive into the output as text.

### 10. Tables
- Always include a header row and the `|---|---|` separator.
- Align columns for readability in source view: `| left | center | right |` with `| :--- | :---: | ---: |`.
- Keep cells short; if a cell needs a paragraph, extract to a footnote or sub-section.
- **Let column content differ in length.** `/docx-from-markdown` sizes DOCX columns from the longest cell in each, so a one-word `Status` column beside two prose columns renders narrow instead of claiming an equal third and forcing tall rows. Write the natural content and let the converter size it.
- Use HTML `<br>` inside a cell only when a real line break is necessary — prefer splitting the row.
- **Headerless tables (DOCX destination):** when the markdown is destined for `/docx-from-markdown` and the table has no natural column headers (case studies, signature blocks, label/value facts), write an ALL-EMPTY header row (`| | |`). The converter then suppresses the dark header band. A 2-column headerless table whose first cells are all bold `**Labels**` renders with the brand label-column tint:
  ```markdown
  | | |
  |---|---|
  | **Challenge** | What problem the client faced. |
  | **Solution** | What was built. |
  | **Result** | The measurable outcome. |
  ```

### 11. Task lists
`- [ ] todo` and `- [x] done`. Renderable on GitHub as interactive checkboxes in issues/PRs.

### 12. Frontmatter (for static-site docs)
```yaml
---
title: Deployment runbook
date: 2026-04-22
tags: [ops, runbook]
description: Step-by-step deploy process for the staging and production clusters.
---
```

Keep frontmatter minimal; everything not consumed by the site generator is noise.

### 13. Trailing newline
Single `\n` at EOF. Editors that auto-append are fine; do not leave multiple blank lines at the end.

---

## 300-line cap + folder split

> [!IMPORTANT]
> This is a hard rule across the framework. Long single files break AI context windows and human reading. See also `/milestone-planning`, `/workscope`, `/milestone-validation`, `/retrospective`, `/feature-delivery` — all carry the same convention.

When the document would exceed ~300 lines, **always split into a folder**, never into sibling files at the parent level.

### Layout

```
<target-path>/
  index.md              # canonical entry point, ≤300 lines
  part-1-<slug>.md      # self-contained part, ≤300 lines
  part-2-<slug>.md
  ...
```

### index.md contents

- Document H1 + purpose
- Table of contents linking each part file with one-line summaries
- Any cross-cutting content (glossary, conventions) small enough to fit
- Back-links to upstream docs if this is a child of a larger doc tree

### Each part file

- Self-contained; does not rely on previously-read parts for context
- Starts with `> Part of [<Document Title>](./index.md)` back-link
- ≤300 lines
- Has its own H1 (the part title, e.g., `# M1 — Core flows`)

### Examples in the framework

- `/milestone-planning` → `AI_DOCS/planning/milestone-plan/{index.md,m0-*.md,m1-*.md,...}`
- `/workscope` → `AI_DOCS/planning/workscope/{index.md,milestones.md,deliverables.md,nfrs.md,...}`

---

## Anti-patterns (top offenders)

Full catalog with rationale in `references/anti-patterns.md`. Top of the "do not ship" list:

- Multiple H1s · skipped heading levels · bare URLs in prose · mystery-meat link text ("click here")
- Untagged code fences · images without alt text · accidentally headerless tables (deliberate `| | |` for DOCX is the exception) · tables used for layout
- Mixed emphasis styles · inconsistent list bullets · HTML soup instead of Markdown constructs
- Emoji as load-bearing content · TODO markers in shipped docs · missing trailing newline

---

## Examples

### Example 1 — User asks for a deployment runbook

**User says:** "Create a markdown runbook for deploying the staging cluster."

**Actions:**
1. Confirm target path (e.g. `AI_DOCS/docs/deploy-staging.md`) and audience (ops engineers).
2. Sketch headings: Purpose → Prerequisites → Steps → Rollback → Verification → Contacts.
3. Write with GFM callouts: `> [!WARNING]` for destructive steps, `> [!NOTE]` for context.
4. All shell blocks tagged ```bash. All file paths as inline code.
5. Table for environment variables (name / example / required).
6. Trailing newline; run the checklist at the end of this SKILL.md before handing off.

**Result:** A single file ~180 lines, passes the checklist, ready for human review.

### Example 2 — Another skill delegates markdown generation

**Skill X needs to emit `AI_DOCS/reports/<name>.md`:**

1. Skill X invokes `/markdown-creator` with the content outline.
2. `/markdown-creator` applies the checklist (headings, callouts, code fences, links).
3. If content would exceed 300 lines, folder-split is applied before write.
4. Skill X receives the final path (or folder) and wires it into its own output contract.

---

## Troubleshooting

### GitHub callouts are rendering as plain blockquotes

**Cause:** Older GitHub features, GitLab without GFM-compatible rendering, or static-site generators that don't implement GFM callouts.

**Solution:** Confirm target renderer during pre-flight. If GFM callouts aren't supported, fall back to labeled blockquotes:

```markdown
> **Warning:** Destructive action ahead.
```

### Table renders with misaligned columns on GitHub but aligned locally

**Cause:** Missing or malformed `|---|` separator row, or inconsistent pipe count per row.

**Solution:** Every row (header, separator, data) must have the same number of pipes. Editors that auto-format tables (VS Code "Markdown All in One") fix this on save.

### Code block shows no syntax highlighting

**Cause:** Missing language tag after the opening triple backtick, or a language the renderer doesn't know.

**Solution:** Use common language tags (`bash`, `ts`, `py`, `json`, `yaml`). For unknown languages, use `text` — explicit is better than implicit.

### File exceeds 300 lines and reviewer asks to split

**Cause:** Planned as one file; grew during writing.

**Solution:** Apply the folder split. Move the H1 + purpose + TOC to `index.md`; move each H2 section into a part file; update all inbound references to point to `index.md`.

---

## Inspect before handoff

When the deliverable embeds images or diagrams, open each PNG or SVG and confirm it is legible at the embed width, its text is spelled right, and the relative path resolves. Check the rendered structure too: heading levels, tables, callouts, the TOC. For DOCX output, the render step is `skills/docx-from-markdown/SKILL.md` workflow step 7. Handoff block per `rules/document-generation-rules.md` (Render, inspect, then hand off): Opened / Found and fixed / Please verify. Example Please verify items: names, numbers, whether each diagram shows what they expect.

---

## References

Internal (load on demand):

- `references/best-practices.md` — full rule book with rationale
- `references/callouts.md` — GFM callout catalog + renderer compatibility matrix
- `references/anti-patterns.md` — 20 failure modes with before/after examples
- `references/structure-patterns.md` — heading patterns per doc type (runbook, spec, ADR, reference, API docs)
- `templates/document.md` · `templates/technical-doc.md` · `templates/adr.md` — ready-to-copy skeletons

External: [CommonMark](https://spec.commonmark.org/) · [GitHub Flavored Markdown](https://github.github.com/gfm/) · [GitHub Alerts](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts)

<!-- Version: 1.4.0 | 2026-08-24 | Added 9b diagram R&D pass (promote a passage to a picture on sequence / structure / counter-intuition, with the do-not-draw list) and 9c bold-list-item rule for titled numbered blocks (1. ### Text leaks literal hashes into DOCX). Tables section notes that docx-from-markdown now sizes columns from content length. -->
<!-- Version: 1.5.0 | 2026-10-14 | Diagrams move to the diagram-design plugin (retired diagram-creator): one opaque-paper PNG serves both the Markdown viewer and DOCX, so the two-copy transparent/opaque rule is gone. Mermaid in AI_DOCS stays Mermaid and is redrawn via import-mermaid only for client documents. -->

<!-- Version: 1.5.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 1.6.0 | 2026-10-22 | Inspect before handoff for Markdown deliverables with embedded images -->
