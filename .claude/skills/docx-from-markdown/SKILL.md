---
name: docx-from-markdown
description: "Convert a Markdown file (with YAML frontmatter) into a WebOsmotic-styled DOCX. ASKS which of two formats to use: the branded template (cover page, logo, title block, auto-updating TOC, then content) for client-facing docs, or a clean document that starts at the TOC but keeps the WebOsmotic chrome. Embeds PNG diagrams, styles code blocks, renders brand tables. Use for a Word document, client deliverable, workscope, proposal, or architecture brief in .docx. Also triggers on: 'convert markdown to docx', 'make this a Word doc', 'export to Word', 'workscope in docx'."
effort: medium
skip:
  - "edit an existing docx"            # use /docx (general-purpose docx tool)
  - "extract text from docx"           # use /docx
  - "convert docx to markdown"         # reverse direction; use /docx
  - "create a powerpoint"              # use /pptx
  - "create a spreadsheet"             # use /xlsx
  - "render a PDF"                     # use /pdf
skill_id: SK-143
context_budget:
  load_kb: 30
  scope: task
version: 3.14.0
license: Proprietary
compatibility: "Claude Code 1.x"
allowed-tools: "Read Write Edit Bash"
dependencies:
  required: []
  optional: [markdown-creator]
  plugins: [diagram-design@diagram-design]
produces:
  - path: "<caller-specified>.docx"
    consumers: [any-human-reader, client]
metadata:
  author: WebOsmotic Private Limited
  category: infrastructure
  patterns: [domain-specific]
  tags: [docx, word, markdown, conversion, client-deliverable, polished]
---

# /docx-from-markdown — WebOsmotic-styled DOCX from Markdown

> **Purpose**: Turn a well-structured Markdown source into a client-ready Word document that follows the official WebOsmotic master template ("Sample document formate.docx"). Branded cover page (optional), auto-updating TOC, brand headings, hairline-grid tables with the ink-navy header band, embedded diagrams, styled code blocks. The output is what you would send a client without apology.

## When to invoke

Use this skill when you have a Markdown file (typically prepared by `/markdown-creator`, `/workscope`, or written by hand) and you need a deliverable-grade `.docx`. Common cases:

- Workscope and budget proposals.
- Proposals and responses to client inquiries.
- Project timelines and plans.
- Architecture briefs, technical responses to a prospective client.
- Internal design documents reviewed in Word's track-changes mode.

Do NOT use this skill for:

- Editing an existing `.docx` that did not originate from this pipeline → use `/docx`.
- Extracting content from a `.docx` → use `/docx`.
- Round-trip conversion `.docx → .md → .docx` (style is lost) → use `/docx`.
- Slide decks → use `/pptx`. Spreadsheets → use `/xlsx`. PDFs → use `/pdf`.

## Output mode — ASK FIRST (mandatory)

Before generating ANY `.docx`, ASK the user which output format to use. Read
`templates/templates.yaml` for the live registry, then ask using its
`default_prompt`. The two modes:

1. **WebOsmotic template** (`--mode cover`) — the official branded document.
   Page 1 is the master cover: logo at the top, the title block, and the dark
   band at the foot of the page carrying the company name, location, date,
   the validity note, and "Presented to / Presented By". Page 2 is the Table
   of Contents. Content starts on page 3. Use for ANY client-facing document:
   workscope, proposal, inquiry response, timeline, brief.

2. **Clean formatted document** (`--mode plain`, default) — no cover page.
   The document opens directly on the Table of Contents, then content.
   Everything else is identical to the WebOsmotic template: watermark, header
   banner, copyright footer with page numbers, brand headings, tables,
   bullets, body colors. Use for internal docs and quick drafts.

Default suggestion when the context is a **client deliverable**: WebOsmotic
template. Otherwise: clean. Do NOT silently pick — ask once, then proceed.

This question doubles as the format item of the `rules/document-generation-rules.md`
Rule 1 intake gate, so no duplicate intake is asked when this skill runs.

### How to invoke each mode

```bash
# WebOsmotic template (branded cover page)
python scripts/md_to_docx.py <src.md> <out.docx> --mode cover

# Clean formatted document (starts at the TOC)
python scripts/md_to_docx.py <src.md> <out.docx> --mode plain

# Client deliverable with a numbered copy kept in a sibling versions/ folder
python scripts/md_to_docx.py <src.md> <out.docx> --mode cover --version <N>
```

`--version N` renders the un-versioned `<out.docx>` (always the latest) and then
copies it to `versions/<out-stem>-vN.docx` beside it, so every numbered build
the client may have seen stays recoverable. Use the frontmatter `version` as N.
`--no-archive` skips the copy.

Both modes render INTO prebuilt templates derived from the master:
`templates/wo-cover-template.docx` and `templates/wo-plain-template.docx`.
Never edit those two files by hand. The converter rebuilds them
automatically whenever the master or the builder script is newer (e.g.
right after a `git pull`); manual rebuild stays available via
`python scripts/build_wo_templates.py`.

## Cover frontmatter (cover mode)

```yaml
---
title: "AI Chatbot Platform: Workscope & Budget Proposal"  # cover title, required
subtitle: "Conversational AI for customer support"          # optional line under the title
presented_to: "Ray Johnson, Founder, RideIt"                # client name (also accepts recipient)
presented_by: "WebOsmotic Private Limited"                  # default if omitted
date: "5th June 2026"                                       # auto-stamps today if omitted
validity_days: 30                                           # "valid for N days" note, default 30
closing: "THANK YOU"                                        # optional: centred bold line at the very end
version: 1                                                  # optional: document version, pass to --version
---
```

`closing` renders as a centred, bold final paragraph (the approved ZENi5 work
scope ends on `THANK YOU`). Leave it out for documents that need no closing.

The converter fills the master's yellow placeholder runs (`[Workscope &
Budget Proposal]`, `Subtext [optional]`, `[Today]`, the two `[Client's
Name]` slots) and strips every yellow highlight. The cover band text is
duplicated inside the drawing's `mc:AlternateContent` fallback — the
converter replaces both copies automatically.

In plain mode the frontmatter is optional. Headings drive the TOC either way.

`presented_to` names the client's decision-maker as a person with role and
company (`"Gaddam Shivaganesh, CEO, ZENi5"` on the approved ZENi5 work scope).
`presented_by` is the person preparing the document where one is named, and
`"WebOsmotic Private Limited"` otherwise, which is what the ZENi5 cover carries.
Ask for both rather than guessing.

`COVER_TITLE_SPACE_BEFORE` (360 twips = 18pt = 24px) is added above the cover
title, which otherwise sits tight under the logo.

## Table of Contents — auto-updating

Both templates ship a real Word TOC field (`TOC \h \o "1-2"`) inside the
master's Contents SDT, plus `<w:updateFields w:val="true"/>` in
`word/settings.xml`. Word refreshes the TOC automatically when the document
opens (some Word versions show a one-time "this document contains fields"
notice — accept it). The converter also pre-renders the entry titles from
the markdown's H1/H2 headings so the TOC page never looks empty before that
first open. The "Table of Contents" heading itself carries `outlineLvl 9`
so it never lists itself.

## Style contract (what the converter produces)

Everything below comes from the master template and is applied automatically.

### Chrome (both modes, from the template parts)

- **Watermark**: faint WebOsmotic LOGO centered on every page after page 1.
- **Header banner**: top shapes + logo + "16+ years of Innovative Excellence".
- **Footer**: full-width rule, "© <year> WebOsmotic. All rights reserved."
  left, page number right. The year is stamped to the current year at
  generation time (footer text and `dc:creator`, which the footer binds to).
- **Page 1 is chrome-free** (`titlePg`): the cover (cover mode) or the TOC
  page (plain mode) shows no header/footer.
- **Page**: US Letter, 0.5 in margins all sides.

### Content styling

**Font rule: Calibri only.** The builder rewrites every Arial reference in
the master (heading styles, footer, theme fonts) to Calibri, so the whole
document renders in one family. The only exceptions are the Symbol bullet
glyph and Consolas inside fenced code blocks.

| Element | Treatment |
|---|---|
| Body paragraph | Calibri 11pt, color `#44515E` (style: Normal), **justified** (`BODY_ALIGN`) |
| `# H1` | style `Heading 1`: Calibri 15pt bold `#0F2A43`, flows continuously (no page break) |
| `## H2` | style `Heading 2`: Calibri 12pt bold `#2E75B6` |
| `### H3+` | style `Heading 3`: Calibri 11pt bold `#0F2A43` (added by the builder) |
| `**bold**` | bold, ink `#0F2A43` (the master's "Payment terms:" lead-label look) |
| `*italic*` | italic `#44515E` |
| `[link](url)` | `#0563C1` underline |
| `` `inline code` `` | Calibri (NOT mono), bold, ink `#0F2A43`, light shade `#F0F2F5` |
| Bullets `- ` | style `List Paragraph` + the brand Symbol bullet numbering, `#44515E`, indent per the list scale below |
| Numbered `1. ` | style `List Paragraph` + decimal numbering; every list restarts at 1; same indent scale |
| Blockquote `> ` | indented italic `#44515E` with a `#2E75B6` left-border accent |
| Table | see below |
| Fenced code | 1-cell table, fill `#EEF2F8`, thick `#0F2A43` left border, Consolas 9.5pt `#404040`, italic-grey language tag above |
| Image | centered at usable page width (~7.4 in), italic-grey caption from alt text |
| `---` rule | skipped (the chrome carries the visual rhythm) |

### Vertical rhythm (spacing contract — honor on every edit)

Block gaps come from a single 4pt scale declared as constants in the converter, so the
same relationship always gets the same gap. Heading spacing is left to the master's
brand styles and is never overridden from the script.

| Constant | Value | Used for |
|---|---|---|
| `SPACE_XS` | 4pt | inside a container (code cell, caption to figure) |
| `SPACE_SM` | 8pt | the standard block gap (matches the master's `Normal` after=160) |
| `SPACE_MD` | 12pt | a block deliberately separated from what precedes it |

Four rules the converter enforces, each fixing a defect that is invisible in markdown
and obvious in Word:

- **Lists collapse between siblings.** The master's `ListParagraph` has
  `before=120 after=120` and no `contextualSpacing`, so untreated bullets sit 12pt
  apart. `_collapse_within_list` adds `contextualSpacing` to every list paragraph.
- **No empty-paragraph spacers.** A bare `doc.add_paragraph()` costs a full empty text
  line plus 8pt plus the next block's `space_before`. Use `_add_spacer` (exact 2pt line).
- **Blocks bind to what follows.** `_keep_with_next` on every heading, code label,
  captioned figure, and table header band, so nothing strands at a page foot.
- **`pPr` child order is BLOCKING.** OOXML requires a fixed order and Word *silently
  drops* out-of-order properties rather than reporting them. Never
  `ppr.append(...)` — always `_ppr_insert(ppr, tag)`. `_assert_ppr_schema_order`
  raises during `convert()` if this regresses.

Full contract, rationale, and the verification snippet: `references/style-rules.md`
section 13 (spacing) and section 12 (block structure).

### Paragraph alignment (justified body prose)

Flowing body paragraphs are **justified**, so the right margin is flush and the
page reads like a printed proposal rather than a draft. The constant is
`BODY_ALIGN` in `md_to_docx.py`; set it to `WD_ALIGN_PARAGRAPH.LEFT` to return
to ragged-right for a document that wants it.

Justification is applied to body paragraphs ONLY. Headings, list items, table
cells, figure captions, and code blocks keep their natural alignment, because
their lines are short or narrow enough that stretching them opens visible
rivers of white space, which looks worse than a ragged edge.

### List indentation (the "too many tabs" contract)

The master's own numbering definitions place level-0 bullet text at 940 twips
and level-1 at 1660, which reads as a wide tab gap before every item and pushes
nested items a third of the way across the page. The converter therefore writes
a direct `w:ind` on every list paragraph, which outranks both the
`List Paragraph` style and the numbering definition:

| Level | Text starts at | Marker-to-text gap |
|---|---|---|
| 0 (top level) | 576 twips (0.40 in) | 360 twips (0.25 in) |
| 1 (sub-list) | 1080 twips (0.75 in) | 360 twips (0.25 in) |

**`LIST_HANGING` must clear the widest marker the list will use**, because it
doubles as the tab stop between marker and text. At 288 twips a two-digit
decimal fills the entire gap, so item 10 onward renders as `10.What is...` with
the text jammed against the number while items 1 to 9 look fine. 360 twips
clears two digits with a readable gap.

Constants: `LIST_LEFT_BASE`, `LIST_LEFT_STEP`, `LIST_HANGING`. One clear 0.35in
step per level is enough to read as subordinate without the wide tab gap the
master's own 0.65in/1.15in produces.

**Lane labels sit at the glyph column, not the text column.** A bold one-line
paragraph that heads a list (a milestone lane such as "Frontend", a component
name above its features) is indented to `LANE_LABEL_INDENT`, which is
`LIST_LEFT_BASE - LIST_HANGING`, and bound to what follows. Aligning it to
`LIST_LEFT_BASE` instead would push the label visibly further right than the
bullets it introduces, which reads backwards. A bold line with no list after it
is left alone, so a closing `**THANK YOU**` is not indented as if it headed
something.

**A lane label between two numbered groups does not end the list.** A themed
sub-heading inside a long numbered list (`**Product and configuration**` between
questions 5 and 6) is part of the list, not a break in it. Treating it as a
break restarts the numbering at 1 under every label, so "question 3" names three
different questions. `_ends_ordered_list` therefore defers to `_is_lane_label`.

**Ordered lists restart per block, not per item.** The active list id is
retired only when flush-left, non-blank content appears (`_ends_ordered_list`).
A numbered list survives its own children: the indented bullets and wrapped
lines belonging to the current item, plus the blank lines between items.
Retiring it on any non-numbered line gave every item its own restarting list,
so a numbered list with nested bullets rendered as **1. 1. 1. 1.** instead of
1, 2, 3, 4.

**Nested glyphs are normalised** (`_normalize_list_glyphs`), because the master
defines two levels that are unusable as shipped: the bullet abstractNum uses
Courier New lowercase `o` at level 1, which reads on the page as the letter o
rather than a bullet, and the decimal abstractNum defines levels 1 and 2 with
an EMPTY `lvlText`, so a nested numbered item renders with no number at all.
Level 1 becomes a Wingdings filled square and lower-letter numbering, level 2 a
Symbol hollow bullet and lower-roman. Level 0 is never touched: the brand
Symbol bullet and plain `%1.` are correct and must not drift.

The list roles must stay visually distinct in the output. The kind is chosen
by purpose in the Markdown (see `references/style-rules.md` section 8), and the
converter never swaps one kind for another:

- **Unordered list** (`- `): the brand Symbol bullet, at the `LIST_LEFT_BASE`
  geometry above.
- **Flat ordered list** (`1. ` items with no nested items): decimal at
  `FLAT_NUM_IND` (text 720, hanging 360 twips).
- **Grouped ordered list** (`1. **Group title**` items carrying nested `  - `
  bullets: feature modules, milestone lanes): decimal at the template's own
  indent, the number bold when the item leads with a bold label, and the nested
  bullets as the level-0 Symbol glyph under the parent's text (`SUB_BULLET_IND`,
  text 820, hanging 360). This is the house format of the approved ZENi5 work
  scope (ported in 3.12.0).
- **Sub-list under a bullet** (indented 2+ spaces under `- `): one indent step
  in, with the normalised level-1 glyph.

`_list_has_sub_items` decides flat vs grouped when the list opens: any indented
list item before the list ends makes it grouped. Wrapped continuation lines do
not count as the end of the list.

### Page breaks and the closing line

A standalone `\newpage` (or `\pagebreak`, or `<!-- pagebreak -->`) line forces
the next block onto a new page: a heading gets `pageBreakBefore`, any other
block an explicit break. The ZENi5 work scope uses it before `# 4. Flow Plan`
and `# 5. Milestones` so each starts at the top of a page. Use it sparingly:
the master otherwise flows sections continuously.

### Table style (master body-table spec)

- Full width (`tblW 5000 pct`), **column widths proportional to content**, fixed layout.
- Hairline grid: single 0.125pt borders, color `#C9D4DF`, every side of every cell.
- Header row: fill `#0F2A43`, white bold Calibri 10pt, repeats on page breaks (`tblHeader`).
- Body cells: Calibri 10pt `#44515E`, vertically centered.
- Cell padding: header 90/130 dxa, body 80/130 dxa (top-bottom/left-right).
- **Max 4 columns** — wider tables overflow the portrait page; split or transpose.

**Column widths follow content, not an even split.** Splitting evenly is what
makes rows tall: a one-word `Status` column holds a third of a three-column
table while the prose columns beside it wrap four lines deep. `_content_col_pcts`
measures the longest rendered cell per column (markdown syntax stripped, so
`**Status**` counts as six characters and a link counts as its label), damps it
with `sqrt` so the spread stays sane, then clamps into
`[COL_MIN_FRAC, COL_MAX_FRAC]` and renormalises to exactly 100%.

`w:tblLayout` is set to `fixed` so Word honours those widths instead of
re-autofitting and undoing the sizing.

Worked example, a three-column assumptions table:

| | Assumption | Status | Impact if wrong |
|---|---|---|---|
| Even split (old) | 33% | 33% | 33% |
| Content-sized (now) | 44% | 12% | 44% |

The `Status` column gave 21 points back to the two prose columns, which is
one to two fewer wrapped lines in every row.

The 2-column label-column case (`**Label**` in every first cell) keeps its
fixed master ratio and is not content-sized.

### Headerless tables (no dark band)

Not every table needs column headers (case studies, signature blocks,
label/value fact sheets). Mark those with an **all-empty header row** in the
markdown — the converter then renders no ink band at all:

```markdown
| | |
|---|---|
| **Challenge** | What problem the client faced. |
| **Solution** | What was built. |
| **Result** | The measurable outcome. |
```

Two flavors:

- **Plain headerless:** any column count; all rows render as body rows with
  the hairline grid.
- **Label-column (master case-study look):** exactly 2 columns AND every
  first cell a bold `**Label**` — the label column gets the `#EEF3F8` tint,
  bold ink text, and the master's ~24/76 width split automatically.

## Workscope / proposal body structure

When the document is a workscope, the markdown body follows the 12-section
ZENi5 structure that `/workscope` writes (`skills/workscope/WORKSCOPE-TEMPLATE.md`
is the spec). Render it with `--mode cover --version <N>`: the cover carries the
title, subtitle, presented-to and presented-by names, date and validity note,
the `\newpage` lines start Sections 4 and 5 on new pages, the flow and timeline
PNGs embed at full text width, and the `closing` line ends the document. The
fixed company copy (the verbatim "Why WebOsmotic" section, the case-study table
format, the Next Steps bullets, the Acceptance block) lives in
**`references/workscope-template.md`**. Both workscope versions pull those
sections from there when the workscope intake asks for them. For other
document types (inquiry response, timeline, brief) the body is free-form
markdown.

## Markdown source conventions

The input must follow these rules; violating them produces broken DOCX output:

### Headings

- `# H1` for numbered top sections (`# 1. Executive Summary`).
- `## H2` for sub-sections (`## 2.1 Background & Context`).
- `### H3` for deeper levels; never skip levels, never go below H3.
- **All H1 and H2 headings in Title Case.** Articles (`a`, `an`, `the`), short
  prepositions, and short conjunctions stay lowercase unless first or last word.

### Casing rules (general)

- **Code identifiers** keep source case: `tenant_id`, `ENROUTE_PICKUP`, `useEffect`.
- **Product names** spell themselves: `PostgreSQL`, `TimescaleDB`, `NestJS`, `Socket.IO`.
- **Acronyms** stay UPPER (`API`, `JWT`, `RBAC`).
- **Sentence-case body prose** — do not Title-Case mid-paragraph nouns.

### Separator convention (colon, not em-dash)

The em-dash (`—`) and en-dash (`–`) are forbidden. Use the **colon** for
labels and titles, the word `to` for ranges:

| Wrong | Right |
|---|---|
| `RideIt — Architecture Brief` | `RideIt: Architecture Brief` |
| `- **Rider app** — booking, history` | `- **Rider app:** booking, history` |
| `13–16 weeks` | `13 to 16 weeks` |

Write `**Label:**` (colon inside the bold span), not `**Label**:`.

Any connective prose this skill AUTHORS (a bridging sentence, a caption, a filled cover subtitle) follows `rules/document-generation-rules.md`. Converting an existing markdown source is verbatim-exempt per its Rule 8: the source text is reproduced, never rewritten for voice.

### Block structure (soft-wrap is honored)

Markdown soft-wrap semantics apply: **consecutive non-blank lines are ONE paragraph**,
and a blank line separates paragraphs. Wrap the source at whatever column suits the
editor. A paragraph spread over five lines renders as one DOCX paragraph, a wrapped
list item keeps its continuation lines inside the bullet, consecutive `> ` lines
become one blockquote, and a wrapped numbered item does not restart the numbering.

Separate blocks with a blank line. Two adjacent paragraphs with no blank line between
them are, correctly, a single paragraph.

### Paragraphs vs bullets

- **Paragraph** for flowing explanation (1 to 3 sentences).
- **Bulleted list** for 3+ parallel items; lead each bullet with a bold label
  and colon (`**Rider app:** booking, tracking, history`).
- **Numbered list** only for sequenced steps.
- **Table** for 2+ columns of comparable attributes.

### Tables

- GFM pipe tables only. Maximum 4 columns. No merged or nested cells.
- An all-empty header row (`| | |`) marks a deliberately headerless table
  (see "Headerless tables" above). Use it whenever column headers would be
  noise: case studies, signature blocks, label/value fact sheets.

### Code blocks

- Always fenced with a language tag (` ```ts `, ` ```sql `, ` ```bash `).
- Keep lines ≤ 90 characters so they do not wrap awkwardly.

### Diagram R&D pass (run before converting, every document)

Before running the converter, read the source once with a single question:
**which passage is a reader more likely to understand as a picture than as
prose?** A client reads a proposal once, usually at speed. A diagram survives
that reading. A nine-step numbered list often does not.

Score each candidate on three signals, and promote it to a diagram when it hits
two or more:

| Signal | What it looks like in the source |
|---|---|
| **Sequence** | 4+ ordered steps, especially with a handoff between actors, a wait state, or a loop back to an earlier step |
| **Structure** | 3+ named components with directional relationships (calls, stores in, notifies), or layered tiers |
| **Counter-intuition** | A rule the reader will get wrong on first read. This is the strongest signal on its own: if a sentence needs "not X, but Y" to be correct, draw it |

Type lookup, matched to the `diagram-design` plugin's visual types (it has 45,
these are the ones a proposal or brief usually needs):

| Source passage | diagram-design type |
|---|---|
| A step-by-step user or payment journey | Process, or User journey when it crosses touchpoints and emotions |
| Handoffs between named actors or systems over time | Sequence, or Swimlane when lanes are teams |
| System components, runtimes, hosting, integrations | Architecture (Deployment when the point is where it runs) |
| What the client runs today, before we touch it | IT current-state, then Architecture delta for the change |
| Status values a record moves through, especially with a return loop | State machine (lifecycle phase map pattern) |
| Branching decisions and their outcomes | Flowchart |
| Security or permission tiers stacked from outer to inner | Layer stack (compensating security layers pattern) |
| Sync path beside an async or background path | Data flow |
| Entities and their relationships | ER / data model |
| Phases on a calendar | Timeline or Gantt |

What NOT to draw, because a picture makes these worse rather than better:

- A flat list with no ordering and no relationships (deliverables, out-of-scope). Bullets are already the right shape.
- Anything with a status, an owner, and a date per row. That is a table.
- Commercial terms, assumptions, and legal wording. Prose carries the nuance a box would strip.
- A two-step sequence. Two boxes and an arrow is a picture of nothing.

Keep the prose. A diagram sits **beside** the passage it illustrates, never
replacing it: the reader who skims takes the picture, the reader who is signing
the contract takes the words. Generate each one with the `diagram-design`
plugin (the framework's only diagram generator) into a `diagrams/` folder next
to the markdown, export it to PNG, and reference the PNG relatively:

1. Ask `diagram-design` for the type above, with the `slide-4x3` size preset.
   It writes `diagrams/<name>.html` (HTML + inline SVG, the editable source:
   keep it beside the PNG so the diagram can be revised later).
2. Export: `/diagram-design:export-diagram diagrams/<name>.html --png-only`
   (scale 2, so a 2048px PNG). PNG export needs Playwright with Chromium in the
   Python 3.12 interpreter: `python3 -m pip install playwright` then
   `python3 -m playwright install chromium`. The export stops with the install
   instruction when it is missing. It never installs on its own.
3. Reference `![alt](diagrams/<name>.png)` in the markdown.

**Brand profile, once per machine.** The first diagram in a project hits the
plugin's style-guide gate. For WebOsmotic documents answer (d) paste tokens:
ink `#0F2A43`, accent `#2E75B6`, paper `#FFFFFF`, then save it as the profile
`webosmotic` so later projects answer (f) load saved profile. Profiles live in
`~/.diagram-design/profiles/` and survive plugin updates.

**Size the canvas against the 7.4in embed width.** The converter places images
at ~7.4in, so physical type size is `font_px / viewBox_width * 533pt`. The
default `doc-inline` preset (960 wide, 12px node names) lands at 6.7pt, which
is the unreadable-in-print defect v4.22.0 fixed. `slide-4x3` (1024 wide,
presentation ramp: 16px names, 12px labels) lands at 8.3pt names and 6.2pt
labels, the best the plugin's presets give at this width. So for a DOCX embed:
keep to six nodes or fewer, keep node names to two or three words, and drop
sublabels and arrow labels the adjacent prose already carries. Short labels are
the constraint that falls out of readable-at-print-size, not a style preference.
Step 7's rendered check is where an unreadable label gets caught.

Aim for two to four diagrams in a typical proposal. Every section having one
means none of them signals anything.

### Images and diagrams

- `![alt text](relative/path.png)` on its own line; alt text becomes the caption.
- Paths resolve relative to the markdown file's directory.
- Mermaid / PlantUML / ASCII art must be rendered to PNG **before** conversion,
  then referenced as an image. A Mermaid block goes through
  `/diagram-design:import-mermaid` (draw.io and Excalidraw sources have
  `import-drawio` and `import-excalidraw`), which redraws it as a
  `diagram-design` diagram in the `webosmotic` profile. Export that to PNG as
  in the Diagram R&D pass. PlantUML and ASCII art are redrawn by asking
  `diagram-design` for the matching type.
- Mermaid blocks MUST follow `rules/mermaid-rules.md` (quote labels with special characters, no bare lowercase `end`, validate in mermaid.live). A Mermaid block that does not render must fail loudly, never ship as a blank.

### Forbidden constructs (break DOCX rendering)

- Raw HTML (`<div>`, `<br>`, `<img>`).
- Mermaid / PlantUML fences left as source.
- Footnotes (`[^1]`), task-list checkboxes (`- [ ]`), reference-style links.

## Workflow

1. **Ask which output format** (see "Output mode — ASK FIRST"). Read
   `templates/templates.yaml`, present the two choices, note the mode.
2. **Read the source markdown** to confirm it has the needed frontmatter
   (cover mode: `title`, ideally `presented_to`) and follows the conventions
   above. For a workscope, read its frontmatter `variant:` and confirm the
   body follows the `workscope` skill's template for it: `BALLPARK-TEMPLATE.md`
   for a ballpark quote, `WORKSCOPE-TEMPLATE.md` for the final workscope. Fixed
   company copy is checked against `references/workscope-template.md`.
3. **Diagram R&D pass** (see the section above): read the source for sequence,
   structure, and counter-intuition candidates, generate the two to four that
   earn it via the `diagram-design` plugin into a `diagrams/` folder beside the
   markdown, export each to PNG,
   and reference each one relatively next to the prose it illustrates.
4. **Pre-conversion scan** for diagram source and forbidden constructs:
   ```bash
   grep -nE '<[a-zA-Z]|```mermaid|```plantuml|\[\^|^- \[[ x]\]' <source.md>
   ```
   Route mermaid hits through `/diagram-design:import-mermaid`, redraw
   plantuml hits with `diagram-design`, fix the rest.
5. **Run the converter**:
   ```bash
   python <path-to-skill>/scripts/md_to_docx.py <source.md> <output.docx> --mode cover
   # or --mode plain
   ```
   Or import it: `convert(src_path, out_path, mode="cover")`.
6. **Verify** the output:
   ```bash
   python -c "
   import zipfile
   z = zipfile.ZipFile('<output.docx>')
   xml = z.read('word/document.xml').decode('utf-8')
   assert 'yellow' not in xml, 'placeholder highlights leaked'
   assert '{{CONTENT}}' not in xml, 'content marker leaked'
   print('updateFields:', '<w:updateFields' in z.read('word/settings.xml').decode())
   print('Media files:', len([n for n in z.namelist() if n.startswith('word/media/')]))
   print('H1 entries:', xml.count('w:val=\"Heading1\"'))
   print('Tables:', xml.count('<w:tbl>'))
   "
   ```
7. **Look at the rendered pages (MANDATORY for any client deliverable).**
   The XML assertions in step 6 pass on documents that are visibly broken. Every
   formatting defect found in real use was found by rendering and looking, not
   by inspecting the XML: numbered lists restarting at 1 under every sub-heading,
   sub-bullets rendering as a literal Courier `o`, a two-digit number touching
   its text, a lane label indented further right than its own bullets, an
   arrowhead with the shaft bulging through it, diagram text at 6.5pt. None of
   those trip an assertion, and all of them are obvious in a picture.

   ```powershell
   # DOCX -> PDF via the installed Word, with fields (the TOC) refreshed
   $word = New-Object -ComObject Word.Application; $word.Visible = $false
   $doc = $word.Documents.Open($src, [ref]$false, [ref]$true)
   $doc.Fields.Update() | Out-Null
   $doc.SaveAs([ref]$pdf, [ref]17)
   $doc.Close([ref]$false); $word.Quit()
   ```

   ```python
   # PDF -> PNG per page, then actually read the images
   import pymupdf, pathlib
   d = pymupdf.open(pdf)
   out = pathlib.Path("_preview_pages"); out.mkdir(exist_ok=True)
   for i in range(d.page_count):
       d[i].get_pixmap(dpi=100).save(out / f"p{i+1:02d}.png")
   ```

   Read the cover, one dense list page, one table page, one diagram page, and
   the last content page at minimum. Delete the preview artifacts afterwards.

   **If the rebuild fails with `PermissionError`, the DOCX is open in Word.**
   Check with `Get-Process WINWORD` and ask the operator to close it, or build
   to a temporary filename. Never kill their Word process: it may hold unsaved
   work in other documents.

   **Inspect before handoff.** Step 7 is the inspection step, using the Word COM export and PyMuPDF render above (no separate script exists). Confirm in the render: TOC resolved with real page numbers, no clipped or overflowing tables, no blank pages, diagrams legible at 7.4in, cover fields correct. Fix and render again. Then hand off with the block from `rules/document-generation-rules.md` (Opened / Found and fixed / Please verify). Please verify items are what only the operator can judge: client name and cover fields, dates, amounts, scope claims, whether each diagram shows what they expect.

8. **Tell the user** the TOC updates itself when the file opens in Word
   (accept the one-time fields notice if Word shows it).

## Templates folder

| File | Role |
|---|---|
| `templates/webosmotic-master.docx` | Pristine copy of the official master, with the approved ZENi5 cover (title block position, subtitle spacing, wave graphic). Never rendered into directly. |
| `templates/archive/webosmotic-master-before-2026-09-08.docx` | The previous master, kept for comparison and rollback. Never rendered. |
| `templates/wo-cover-template.docx` | Generated: cover + TOC + `{{CONTENT}}` marker. Used by `--mode cover`. |
| `templates/wo-plain-template.docx` | Generated: TOC + `{{CONTENT}}` marker, no cover. Used by `--mode plain`. |
| `scripts/build_wo_templates.py` | Rebuilds both generated templates from the master. Run after the master changes. |
| `scripts/build_template.py` | Generic utility for deriving a `{{CONTENT}}` template from any finished DOCX (non-WebOsmotic brands). |

## Verification checklist

Before declaring a DOCX ready:

- [ ] Zero yellow highlights and zero `[bracketed]` placeholders in the output.
- [ ] Cover mode: title, date, Presented to / Presented By filled on the cover.
- [ ] Plain mode: the document opens on the "Table of Contents" heading.
- [ ] TOC SDT present with pre-rendered entries; `updateFields` set in settings.
- [ ] All H1/H2 titles in Title Case; identifiers and product names keep source casing.
- [ ] Body paragraphs are justified; headings, bullets, table cells and captions are not.
- [ ] List items sit at 0.25in (level 0) and 0.5in (level 1), with no wide tab gap before the text.
- [ ] Ordered, unordered, and sub-list items are each visually distinct.
- [ ] A numbered list with nested bullets counts 1, 2, 3, and each new block restarts at 1.
- [ ] A numbered list broken into themed groups keeps counting across the group labels.
- [ ] Two-digit list numbers have a visible gap before their text (`10. Text`, never `10.Text`).
- [ ] A lane label sits at its list's marker column, never further right than its own items.
- [ ] No sub-bullet renders as a literal Courier `o`, and no nested numbered item renders unnumbered.
- [ ] Embedded diagram text is readable at print size (see the sizing note below).
- [ ] Tables ≤ 4 columns with the `#0F2A43` header band and `#C9D4DF` hairline grid.
- [ ] Table columns are content-proportional, not an even split; no short column forcing tall rows.
- [ ] The diagram R&D pass ran; two to four diagrams earn their place and each sits beside the prose it illustrates.
- [ ] A diagram that carries its own title inside the image uses empty alt text (`![](path.png)`). A heading, an in-image title, and a caption all naming the same flow states it three times.
- [ ] **The rendered pages were opened and looked at**, not just asserted over.
- [ ] Code blocks show the ink left-border accent; images render at full width with captions.
- [ ] Zero em-dashes and zero en-dashes in the rendered document.
- [ ] Footer shows the current year.

## Output

- One `.docx` file at the caller-specified path.
- (Optional) A short verification report to stdout summarizing embedded media,
  heading count, and any warnings.

That's the deliverable. The DOCX is the artifact; the markdown source remains the canonical text.

<!-- Version: 3.9.0 | 2026-08-26 | List indents widened to 0.35in/0.70in (hanging 288) after the 0.25in/0.5in step read as no indentation at all. Lane labels (bold one-liners heading a list) indent to the glyph column via LANE_LABEL_INDENT and bind to what follows. COVER_TITLE_SPACE_BEFORE adds 24px above the cover title. Cover names documented as people, not companies. -->

<!-- Version: 3.10.0 | 2026-08-26 | LIST_HANGING 288 -> 360 twips: the hanging indent is also the marker-to-text tab stop, and 288 was narrower than a two-digit decimal, so items 10+ rendered as '10.Text'. LIST_LEFT_BASE 504 -> 576 to keep the marker column steady. A lane label between two numbered groups no longer ends the ordered list, so a themed question list counts 1..18 instead of restarting at each label. Lane labels hug the list they introduce (space_after 2pt). -->

<!-- Version: 3.11.0 | 2026-08-26 | Workflow step 7 makes visual verification mandatory for client deliverables: render DOCX -> PDF via Word COM -> PNG via PyMuPDF and READ the pages. Every formatting defect found in real use (per-item numbering restarts, Courier-o sub-bullets, two-digit numbers touching their text, lane labels indented past their own bullets, arrowheads bulging through shafts, 6.5pt diagram text) passed the XML assertions and was only visible in a picture. Documents the Word file-lock case and the empty-alt rule for self-titled diagrams. -->

<!-- Version: 3.12.0 | 2026-10-05 | Ported from the reference renderer that produced the approved ZENi5 work scope (its 3.2.0 to 3.6.1): the new master cover (old master archived at templates/archive/webosmotic-master-before-2026-09-08.docx), the template builder that prunes unreferenced media and drops the cover band from plain mode, the grouped and flat ordered-list formats with bold numbers and sub-bullets under the parent's text, standalone \newpage page breaks, the frontmatter closing line, and --version / --no-archive numbered copies in versions/. Kept from this lineage: soft-wrap, the vertical-rhythm contract (lists collapse between siblings), the pPr schema-order assertion, lane labels, glyph normalisation, and the unordered-list geometry. -->
<!-- Version: 3.13.0 | 2026-10-14 | Merged over the 3.12.0 ZENi5 renderer port. Diagrams now come from the diagram-design Claude Code plugin (diagram-creator retired): type lookup mapped to its visual types, generate-then-export-to-PNG procedure, webosmotic brand profile, Mermaid routed through import-mermaid, 7.4in sizing math for its viewBox presets (slide-4x3 for DOCX embeds). Workflow step 2 points at the workscope skill's 12-section WORKSCOPE-TEMPLATE.md. -->
<!-- Version: 3.13.1 | 2026-10-14 | Workscope check reads the variant (ballpark or final) and the matching workscope template. references/workscope-template.md is now the fixed-copy source only, since the 13-section variant was retired. -->

<!-- Version: 3.13.2 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 3.14.0 | 2026-10-22 | Step 7 now ends with the Opened / Found and fixed / Please verify handoff block -->
