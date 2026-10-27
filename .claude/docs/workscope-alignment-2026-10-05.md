# Workscope Alignment with the ZENi5 Reference (2026-10-05)

> **Superseded in part (2026-10-14, v4.24.0 and v4.25.0):** `diagram-creator` and its workscope kit (`ws_kit.py`, archetypes 6 and 7) were retired. Workscope flow and timeline images now come from the `diagram-design` Claude Code plugin, and workscope moved to 2.9.0. The diagram rows below are kept as the record of what was aligned on 2026-10-05.

This document exists so that the reviewer of this framework change can see what
the reference setup in `D:\Requirement` has, what our `.claude` lacked, what was
ported, and what was deliberately left out or kept as ours, before committing.

Reference output: `D:\Requirement\clients\zeni5\Outcome\ZENi5-Workscope.pdf`
(22 pages, Word 2019 export), built from `ZENi5-Workscope.md` (382 lines,
frontmatter `version: 36`, dated 8th September 2026) in the same folder, with
images and their generator scripts under `Outcome\images\`.

Paths below: `REF` = `D:\Requirement\.claude`, `OURS` =
`D:\Projects\Project-Management-v4\.claude`, `CLIENT` =
`D:\Requirement\clients\zeni5\Outcome`.

---

## 1. Inventory of workscope-related material in D:\Requirement

| Area | Path | Status vs ours (before this change) |
|---|---|---|
| Workscope skill | `REF\skills\workscope\SKILL.md` (2.6.0) | Ours 2.5.1. Ref adds only the list-kind-by-purpose rule and `discovery` as an optional dependency |
| Workscope template | `REF\skills\workscope\WORKSCOPE-TEMPLATE.md` | Ref adds rule 3 (list kinds) and numbered lanes. Still says "durations relative, never dated" and "Questions and Concerns", which the ZENi5 output itself does not follow |
| Other workscope files | `REF\skills\workscope\{HIDDEN-CHALLENGES, REFERENCE-LIBRARY, FIGMA-ANALYSIS, STACK-PERSISTENCE, TECH-OPTIONS, WORKSCOPE-TEMPLATE-13SECTION}.md` | Byte-identical to ours |
| DOCX renderer | `REF\skills\docx-from-markdown\scripts\md_to_docx.py` (3.6.1 lineage) | Divergent fork. See Section 4 |
| Template builder | `REF\skills\docx-from-markdown\scripts\build_wo_templates.py` | Strict superset of ours (media pruning, plain-mode cover band removal) |
| Master template | `REF\skills\docx-from-markdown\templates\webosmotic-master.docx` (627 KB, ZENi5 cover) | Ours was the older master (270 KB), identical to `REF\...\templates\archive\webosmotic-master-before-2026-09-08.docx` |
| Generated templates | `REF\...\templates\wo-cover-template.docx`, `wo-plain-template.docx` | Differed from ours (built from the old master) |
| DOCX style rules | `REF\skills\docx-from-markdown\references\style-rules.md` | Ref rewrites Section 8 (list kind by purpose). Ours has Sections 12 and 13 (soft-wrap, vertical rhythm) that ref lacks |
| DOCX skill doc | `REF\skills\docx-from-markdown\SKILL.md` (3.6.1) | Divergent fork of ours (3.11.0) |
| DOCX workscope reference | `REF\skills\docx-from-markdown\references\workscope-template.md` | Older 13-section spec. Ours is a superset |
| Diagram helpers | `REF\skills\diagram-creator\scripts\diagram_helpers.py` | Ours is newer (cleaner arrowheads) |
| Diagram skill doc | `REF\skills\diagram-creator\SKILL.md` (1.6.0) | Ours 1.7.0 is newer, but ref changed the DOCX default background to transparent (approved on ZENi5) |
| Mermaid renderer | `REF\skills\diagram-creator\scripts\mermaid_render.py`, `assets\mermaid.min.js` (3.3 MB) | Not in ours. Not referenced by any ref skill doc, not on the workscope path |
| Timeline scratch script | `REF\skills\diagram-creator\scripts\tmp\generate_phase1_timeline.py` | Another client's (ComplyHQ) one-off script |
| ZENi5 image generators | `CLIENT\images\make_diagrams.py`, `make_ws_diagrams.py`, `make_ws_timeline.py` | Produced `ws-flow-*.png` and `ws-milestone-timeline.png`. Client-specific, hardcoded `sys.path` to `REF` |
| Estimation | `REF\skills\estimation\` (5.6.0) | Ours 5.4.0. Ref adds an undocumented 5.5.0 (no margin rows in the workbook) and 5.6.0 (Feature by lane sheet, `scripts\feature_lane_matrix.py`) |
| Workspace conventions | `REF\templates\workspace\CLAUDE.md`, `REF\templates\workspace\clients\README.md` | Sales-workspace layout (`Outcome\`, `versions\`, `CHANGELOG.md`, sent means frozen) |
| Rules folder | none | `REF` has no `rules\` folder. No document-generation, writing-style, or branding rule exists there |

---

## 2. The ZENi5 structure (what "consistent" means)

**Cover** (`--mode cover`): WebOsmotic logo, title "ZENi5: MVP Work Scope"
(Calibri Bold 41pt, `#434343`), italic subtitle, "Presented to" (person, role,
company) and "Presented By" (company) in blue labels, the dark wave band with
company name, "Bangalore, India | USA", the date, and the italic validity note.
Then an auto TOC page. Every body page carries the header logo, "16+ years of
Innovative Excellence", the watermark, and the footer "© 2026 WebOsmotic. All
rights reserved." with the page number.

**Sections and headings**:

1. `# 1. Overview`: two paragraphs, ends by naming the source documents with versions
2. `# 2. User Roles and Features`: lead-in, then a 3-column table (Role, Who they are, What they can do in this release)
3. `# 3. Features Breakdown`: one `##` per surface (mobile app, web, school dashboard, operations console, Backend Platform last), each a numbered list of bold modules with nested bullets
4. `\newpage` then `# 4. Flow Plan: Step-by-Step Workflow`: a colour-legend paragraph, then `## Flow A..D` per role, each an image then one summary paragraph
5. `\newpage` then `# 5. Milestones`: an H3 commencement line tied to the kick-off payment, then per milestone `## Milestone N: Name`, `### Tentative Duration: weeks A to B, <dates>[, alongside Milestone N]`, and numbered bold lanes (`Discovery and Setup`, `Design`, `Frontend`, `Backend`, `QA and Testing`, `Deployment`) with 2-space nested bullets, always ending with `Deliverables on completion`. Closes with `**Total estimated duration:**` (weeks and days, launch day and date, outside date, parallel workstreams)
6. `# 6. Milestone and Payment`: table (Milestone, Description, Weeks and days, Dates) with a bold Total row, the timeline image, then bold-label paragraphs: Basis of the timeline, Total estimated cost (`₹XXX`), Payment schedule (20 percent at kick-off, 16 percent per milestone), a payment table (Payment, Trigger, Share, Due) with a bold Total row, Payment note, Third-party charges
7. `# 7. Technology Stack`: flat numbered list with bold labels, no lead-in
8. `# 8. Deliverables`: one lead-in sentence, then a plain numbered list
9. `# 9. Out of Scope`: ten numbered items
10. `# 10. Future Scope`: lead-in, numbered bold-label items, the fixed "not planned, not estimated" sentence as a plain paragraph
11. `# 11. Client Responsibilities`: five numbered bold-label items
12. `# 12. General Notes`: six numbered notes, then `## Assumptions Made for This Scope` with sixteen numbered bold-lead assumptions

Closing: centred bold "THANK YOU" from the frontmatter `closing:` field.

**Images**: four role-owned flow images (`ws-flow-school/parent/student/ops.png`,
1600 px, transparent, cards coloured by who acts, legend under the title) in
Section 4, and one milestone Gantt (`ws-milestone-timeline.png`) in Section 6.
No other images.

**Tone and length**: plain business English, specific nouns, third person for
the client, first person plural for WebOsmotic, about 380 Markdown lines, 22
pages.

---

## 3. Gaps that made our output differ from ZENi5 (before this change)

| # | Gap | Source of the reference behaviour | Effect on our output |
|---|---|---|---|
| G1 | Old master cover | `REF\...\templates\webosmotic-master.docx` | Cover title block, subtitle spacing, and wave graphic differ |
| G2 | No `\newpage` support | `REF\...\md_to_docx.py` 3.6.0 | Literal `\newpage` paragraph, Sections 4 and 5 do not start a page |
| G3 | No `closing:` frontmatter | `REF\...\md_to_docx.py` 3.5.2 | No "THANK YOU" line |
| G4 | List geometry | `REF\...\md_to_docx.py` 3.5.1 | Our lane and module numbers sat at a different indent, numbers not bold, sub-bullets not under the parent's text |
| G5 | No numbered copies | `REF\...\md_to_docx.py` `archive_version` | No `versions\<name>-vN.docx` trail |
| G6 | Plain mode cover band leak and dead media | `REF\...\build_wo_templates.py` | Plain renders carried an unfilled `[Today]` band, templates carried unused images |
| G7 | Milestones relative and undated, no Deliverables lane | `CLIENT\ZENi5-Workscope.md` Section 5 | Our template forbade dates and the lane |
| G8 | Section 6 was an hours and cost table | `CLIENT\ZENi5-Workscope.md` Section 6 | No weeks, days, dates, timeline image, or percentage payment schedule |
| G9 | Section 12 was Questions and Concerns | `CLIENT\ZENi5-Workscope.md` Section 12 | ZENi5 uses General Notes plus Assumptions Made for This Scope |
| G10 | Section 7 lead-in and Section 8 bold component lines | `CLIENT\ZENi5-Workscope.md` Sections 7 and 8 | ZENi5 has no lead-in and plain numbered deliverables |
| G11 | DOCX diagrams on opaque grey | `REF\skills\diagram-creator\SKILL.md` version note 2026-09-08 | ZENi5 images are transparent |
| G12 | No role-owned flow or timeline generator | `CLIENT\images\make_ws_diagrams.py`, `make_ws_timeline.py` | Nothing in our skills produced the ZENi5 images |
| G13 | 300-line split rule | `OURS\skills\workscope\SKILL.md` | A ZENi5-sized workscope would be split into a folder the renderer does not assemble |
| G14 | Skill said "Markdown only, job ends at workscope.md" | `OURS\skills\workscope\SKILL.md` | No explicit DOCX or PDF render path in the workscope run |
| G15 | Stale section numbers in our SKILL.md (Technology Stack as Section 6, "4.1", "12.2", "Investment section") | `OURS\skills\workscope\SKILL.md` | Contradicted our own 12-section template |

---

## 4. What was ported or changed in OURS

| File | Version | Change |
|---|---|---|
| `skills/docx-from-markdown/templates/webosmotic-master.docx` | binary | Replaced with the ZENi5 master from `REF` (G1). Byte-identical to `REF` |
| `skills/docx-from-markdown/templates/archive/webosmotic-master-before-2026-09-08.docx` | new | Our previous master, kept (same bytes as `REF`'s archive copy) |
| `skills/docx-from-markdown/templates/wo-cover-template.docx`, `wo-plain-template.docx` | binary | Rebuilt with the ported builder. Byte-identical to `REF` |
| `skills/docx-from-markdown/scripts/build_wo_templates.py` | script | Replaced with `REF`'s copy (G6). It is a strict superset of ours, so nothing of ours is lost |
| `skills/docx-from-markdown/scripts/md_to_docx.py` | script | Merged, not replaced (G2 to G5): `\newpage` handling, `closing:` line, grouped and flat ordered-list geometry with bold numbers and sub-bullets under the parent's text, `--version` and `--no-archive`. All our lineage features kept (soft-wrap, vertical rhythm, pPr schema-order assertion, lane labels, glyph normalisation, content-sized columns) |
| `skills/docx-from-markdown/SKILL.md` | 3.11.0 to 3.12.0 | Documents the above, the closing and version frontmatter, the ZENi5 cover names, and the workscope render command |
| `skills/docx-from-markdown/references/style-rules.md` | note added | Section 8 rewritten to the list-kind-by-purpose rule (written without semicolons) |
| `skills/diagram-creator/scripts/workscope/ws_kit.py` | new | Data-driven kit from the ZENi5 generators with client content removed: `rows_diagram`, `lanes_diagram`, `milestone_timeline` (G12) |
| `skills/diagram-creator/scripts/workscope/example_workscope.py` | new | Every kit call with neutral placeholder content |
| `skills/diagram-creator/SKILL.md` | 1.7.0 to 1.8.0 | Transparent default for DOCX (G11), the kit, the workscope images section |
| `skills/diagram-creator/references/archetypes.md` | content | Archetypes 6 (role-owned flow) and 7 (milestone timeline) |
| `skills/workscope/WORKSCOPE-TEMPLATE.md` | rewritten | The ZENi5 structure, section by section (G7 to G10, G13) |
| `skills/workscope/SKILL.md` | 2.5.1 to 2.6.0 | Uses the template, the kit, and the renderer explicitly, the single-file rule, dated milestones, General Notes, Q34 and Q35 collect dates and payment split, stale section numbers fixed (G13 to G15) |
| `skills/workscope/REFERENCE-LIBRARY.md` | note added | ZENi5 as the current reference, read in place and never copied into this repo |
| `skills/milestone-planning/SKILL.md` | 1.5.2 to 1.6.0 | Internal milestones map to the approved workscope's dated milestones, which the workscope skill owns |

No rule file under `rules/` was edited.

### Verification

- `ZENi5-Workscope.md` rendered with our merged renderer (`--mode cover --version 36`), exported to PDF through Word, and compared page by page with the reference PDF: same cover, TOC, section order, page breaks before Sections 4 and 5, numbered lanes with bold numbers and sub-bullets under the text, flat numbered lists, tables, images, and the centred THANK YOU. The `versions\` copy was written.
- Our render is 20 pages against the reference's 22. See C3.
- The kit reproduced `ws-milestone-timeline.png` and `ws-flow-school.png` from ZENi5's own data with no fit warnings. The only visible differences: the reserve label reads "11 Dec to 22 Dec" instead of "11 to 22 Dec", and the first marker drops the word "by".
- Regression renders of three of our own Markdown files in plain mode pass the pPr schema-order assertion.

---

## 5. What our files said before (replaced text, kept here for the record)

From `OURS\skills\workscope\WORKSCOPE-TEMPLATE.md` and `SKILL.md` (2.5.1), now
superseded:

- Milestone durations were "relative, never dated" ("5 to 6 weeks from Milestone 1 Completion"), lanes were bullets (2.5.1) and had no Deliverables lane, and a milestone carried "timeline and features, nothing else".
- Section 6 was `| Milestone | Description | Hours | Cost |` with Hourly Rate, Payment terms, Validity, and Basis lines.
- Section 7 opened with "WebOsmotic works across 50+ modern AI and software stacks, testing and benchmarking new technologies continuously."
- Section 8 lines were `**[Component] ([technology]):** [purpose]`.
- Section 9 was five to nine bullets. Section 11 was bullets.
- Section 12 was "Questions and Concerns": themed questions, Concerns as recommendations awaiting agreement, then assumptions that change the estimate.
- Critical rules 6 to 8 asked for assumption rows with status, a "QA & Deployments" module in every application block, and fixed copy for "Section 7 and 12.2" (numbers from the 13-section variant).
- A workscope over 300 lines was split into `AI_DOCS/planning/workscope/`.
- The diagram pass wrote to `AI_DOCS/planning/diagrams/`. Images now go to `AI_DOCS/planning/images/`, the folder name ZENi5 uses.

From `OURS\skills\docx-from-markdown\scripts\md_to_docx.py` 3.11.0: every
numbered item used the `LIST_LEFT_BASE` geometry (text 576, hanging 360) with a
plain number. Unordered lists keep that geometry.

From `OURS\skills\diagram-creator\SKILL.md` 1.7.0: DOCX diagrams defaulted to
opaque `GREY_BG`.

---

## 6. Conflicts, kept as ours and recorded

| # | Conflict | What ZENi5 or REF does | What we kept | Why |
|---|---|---|---|---|
| C1 | Semicolons in prose | ZENi5 prose uses semicolons throughout (e.g. "The student has a card but no app; the student profile...") | `rules/writing-style-rules.md` Rule 4: no semicolons in prose, no em-dashes or en-dashes | Our always-on rule. The template says to write two sentences where ZENi5 used a semicolon |
| C2 | Silent assumptions | ZENi5 states sixteen assumptions and no open questions | Assumptions only when confirmed, plus an `## Open Questions` subsection while any question is unanswered, removed before sending | Our discovery discipline (never invent an answer). The sent document still matches ZENi5 |
| C3 | Spacing between list items | ZENi5 keeps the master's 6pt before and after on every list item (22 pages) | Our vertical-rhythm contract (`style-rules.md` Section 13, Rule 2): list items collapse between siblings (20 pages) | Existing rule of ours. To match ZENi5 page for page, remove `_collapse_within_list` from `add_bullet` and `add_number` in `md_to_docx.py`. That is a decision for the operator |
| C4 | Unordered list indent | REF renders `- ` lists at the template indent (940) | Our 3.9.0 and 3.10.0 geometry (576, hanging 216) | Existing decision of ours. ZENi5 has no top-level unordered list, so its output is unaffected |
| C5 | Closing spacer | REF adds an empty paragraph before the closing line | `space_before` of 20pt on the closing paragraph | Our rhythm contract bans empty spacer paragraphs |
| C6 | REF template text vs ZENi5 output | REF's own `WORKSCOPE-TEMPLATE.md` still says relative durations and Questions and Concerns | Followed the ZENi5 output | The task names the PDF as "how the workscope should be" |
| C7 | `presented_by` | ZENi5 uses the company | A named person where the operator gives one, otherwise the company | Our 2.3.0 guidance from earlier delivered documents. Both are allowed |

---

## 7. Not ported, or gaps not closed

| # | Item | Reason |
|---|---|---|
| N1 | `REF\skills\estimation\` 5.5.0 and 5.6.0 (`scripts\feature_lane_matrix.py`, `build_workbook.py`, `EXCEL-FORMAT.md`, SKILL.md) | Not on the workscope output path, and 5.5.0 removes the margin rows from every workbook, a behaviour change the operator should decide on separately. `REF` is a clean superset of our 5.4.0, so porting is a copy of four files when wanted |
| N2 | `REF\skills\diagram-creator\scripts\mermaid_render.py` and `assets\mermaid.min.js` | Unreferenced by any `REF` skill doc and not used by the workscope. Needs Playwright and Chromium, which are not installed here (`import playwright` fails) |
| N3 | `REF\skills\diagram-creator\scripts\tmp\generate_phase1_timeline.py` | Another client's one-off script. The kit's `milestone_timeline` replaces it |
| N4 | The ZENi5 generator scripts and images themselves | Client material. The kit carries the layouts without the content. The parent and student flows used bespoke layouts (a three-entry column, an approve or decline branch) that the kit does not generalise: build those with the kit's primitives (`label_box`, `draw_row`, `arrow`) in the project script |
| N5 | `REF\templates\workspace\` conventions (`Outcome\`, `CHANGELOG.md`, sent means frozen) | Sales-workspace layout, not this framework's `AI_DOCS` layout. The `--version` flag gives the same numbered-copy trail beside `AI_DOCS/planning/workscope.docx` |
| N6 | `REF\skills\docx-from-markdown\references\workscope-template.md` | Older than ours |
| N7 | `REF\skills\workscope\SKILL.md` adds `discovery` as an optional dependency | There is no `discovery` skill in our registry |

### External dependencies the ported pieces rely on

- **Fonts**: `diagram_helpers.font` loads `C:/Windows/Fonts/calibri.ttf`, `calibrib.ttf`, and `consola.ttf`. The kit fails without them on macOS or Linux unless Calibri is installed at that path.
- **Python packages**: `python-docx`, `lxml`, and `Pillow` (present here). PyMuPDF for the page check (present).
- **Microsoft Word**: the DOCX to PDF export and the TOC page numbers rely on Word COM (`docx-from-markdown` workflow step 7). LibreOffice is not installed here.
- **The master template** must stay at `skills/docx-from-markdown/templates/webosmotic-master.docx`. The converter rebuilds the `wo-*` templates automatically when the master or the builder is newer.

---

## 8. How a future `/do` workscope run picks this up

1. `/do` Phase 0 invokes `/workscope`. Its SKILL.md (2.6.0) makes reading `WORKSCOPE-TEMPLATE.md` mandatory before drafting, and the template is now the ZENi5 structure.
2. Discovery Q34 and Q35 collect the kick-off, launch, and outside dates and the payment split, which the dated Sections 5 and 6 need.
3. Phase 3 fixes the day plan first, writes Sections 5 and 6 from it, then builds the images with `skills/diagram-creator/scripts/workscope/ws_kit.py` into `AI_DOCS/planning/images/`.
4. Post-generation step 6 renders `AI_DOCS/planning/workscope.docx` with `docx-from-markdown --mode cover --version <N>`, which now uses the ZENi5 master, page breaks, list formats, and closing line, keeps `versions/workscope-vN.docx`, and is followed by the PDF page check.
5. `milestone-planning` (1.6.0) later maps the internal milestones onto the workscope's dated milestones instead of inventing its own client dates.

Pre-existing staged changes in this repo that are NOT part of this work:
`scheduled_tasks.lock` (added) and `scripts/progress-eta.sh` (modified).
