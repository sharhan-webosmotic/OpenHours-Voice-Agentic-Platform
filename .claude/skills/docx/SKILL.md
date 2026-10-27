---
name: docx
skill_id: SK-147
allowed-tools: Read Write Edit Grep Glob Bash
description: "Create, read, edit, and manipulate Word documents (.docx files). Generate professional documents with tables of contents, headings, page numbers. Use when working with .docx files, Word documents, or producing formatted reports."
effort: medium
license: Proprietary. LICENSE.txt has complete terms
version: 1.10.0
context_budget:
  load_kb: 20
  scope: task
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

## Overview
A .docx file is a ZIP archive containing XML files.

## Scratch working directory
Unpacked XML trees and intermediate PDFs/images generated while editing a document are per-project scratch, not deliverables. Put them under `AI_DOCS/.temp/` in the caller's project (create it if missing) rather than a bare relative folder in the current directory. `AI_DOCS/.temp/` is gitignored and safe to delete between runs.

## Reading content (ingest-first)
**To read or analyze a .docx's content for reasoning, ingest it through the `markitdown` skill first** — it lands a clean Markdown artifact at `AI_DOCS/ingested/docx/<name>.md`:

```bash
python ../markitdown/scripts/ingest.py document.docx
```

A source is not read until `verify_coverage.py` prints `COVERAGE: COMPLETE`. Ingest flags every picture, chart, shape diagram and scanned page for the `markitdown` visual pass, which transcribes the text inside images and the diagram relationships. Run it, then:

```bash
python ../markitdown/scripts/verify_coverage.py AI_DOCS/ingested/docx/document.md
```

INCOMPLETE means content is missing (an unread image, a dropped header, a table that did not convert). Report the gap list instead of reasoning over a partial document. Headers, footers, comments and footnotes are added by ingest, since plain conversion drops them.

Fall back to the native paths below only when markitdown is insufficient:
- **`pandoc --track-changes=all`** — when you need the tracked-change marks preserved.
- **`office/unpack.py`** — when you need raw XML for structural editing.

## Quick Reference
| Task | Approach |
|------|----------|
| Read/analyze content | `markitdown` ingest (primary) · `pandoc`/unpack for tracked-changes & raw XML |
| Create new document | Use `docx-js` - see Creating New Documents below |
| Edit existing document | Unpack → edit XML → repack - see Editing Existing Documents below |

### Converting .doc to .docx
Legacy `.doc` files must be converted before editing:

```bash
python scripts/office/soffice.py --headless --convert-to docx document.doc
```

### Reading Content
```bash
# Text extraction with tracked changes
pandoc --track-changes=all document.docx -o output.md

# Raw XML access
python scripts/office/unpack.py document.docx AI_DOCS/.temp/unpacked/
```

### Converting to Images
```bash
python scripts/office/soffice.py --headless --convert-to pdf --outdir AI_DOCS/.temp document.docx
pdftoppm -jpeg -r 150 AI_DOCS/.temp/document.pdf AI_DOCS/.temp/page
```

### Accepting Tracked Changes
To produce a clean document with all tracked changes accepted (requires LibreOffice):

```bash
python scripts/accept_changes.py input.docx output.docx
```

---

Generate .docx files with JavaScript, then validate: `npm install -g docx`, then `python scripts/office/validate.py doc.docx`. If validation fails, unpack, fix the XML, and repack.

Read `DOCX-JS-REFERENCE.md` before writing any docx-js generation code, it covers the require/Setup boilerplate, page size (US Letter vs A4, landscape), style overrides for headings, lists, the vertical-rhythm spacing contract, tables, images, page breaks, hyperlinks, footnotes, tab stops, multi-column layouts, table of contents, headers/footers, and the critical-rules checklist.

---

**Follow all 3 steps in order.**

### Step 1: Unpack
```bash
python scripts/office/unpack.py document.docx AI_DOCS/.temp/unpacked/
```
Extracts XML, pretty-prints, merges adjacent runs, and converts smart quotes to XML entities (`&#x201C;` etc.) so they survive editing. Use `--merge-runs false` to skip run merging.

### Step 2: Edit XML
Edit files in `AI_DOCS/.temp/unpacked/word/`. See XML Reference below for patterns.

**Use "Claude" as the author** for tracked changes and comments, unless the user explicitly requests use of a different name.

**Use the Edit tool directly for string replacement. Do not write Python scripts.** Scripts introduce unnecessary complexity. The Edit tool shows exactly what is being replaced.

**CRITICAL: Use smart quotes for new content.** When adding text with apostrophes or quotes, use XML entities to produce smart quotes:
```xml
<!-- Use these entities for professional typography -->
<w:t>Here&#x2019;s a quote: &#x201C;Hello&#x201D;</w:t>
```
| Entity | Character |
|--------|-----------|
| `&#x2018;` | ' (left single) |
| `&#x2019;` | ' (right single / apostrophe) |
| `&#x201C;` | " (left double) |
| `&#x201D;` | " (right double) |

**Adding comments:** Edit the XML directly in `unpacked/word/comments.xml`. Add comment entries with unique IDs, then add markers in `document.xml` (see Comments in XML Reference below).
Then add markers to document.xml (see Comments in XML Reference).

### Step 3: Pack
```bash
python scripts/office/pack.py AI_DOCS/.temp/unpacked/ output.docx --original document.docx
```
Validates with auto-repair, condenses XML, and creates DOCX. Use `--validate false` to skip.

**Auto-repair will fix:**
- `durableId` >= 0x7FFFFFFF (regenerates valid ID)
- Missing `xml:space="preserve"` on `<w:t>` with whitespace

**Auto-repair won't fix:**
- Malformed XML, invalid element nesting, missing relationships, schema violations

### Common Pitfalls
- **Replace entire `<w:r>` elements**: When adding tracked changes, replace the whole `<w:r>...\</w:r>` block with `<w:del>...<w:ins>...` as siblings. Don't inject tracked change tags inside a run.
- **Preserve `<w:rPr>` formatting**: Copy the original run's `<w:rPr>` block into your tracked change runs to maintain bold, font size, etc.

---

See [XML-REFERENCE.md](XML-REFERENCE.md) for OOXML patterns (schema compliance, tracked changes, comments, images XML).

---

- **pandoc**: Text extraction
- **docx**: `npm install -g docx` (new documents)
- **LibreOffice**: PDF conversion (auto-configured for sandboxed environments via `scripts/office/soffice.py`)
- **Poppler**: `pdftoppm` for images

---

## Inspect before handoff (BLOCKING)

LibreOffice is absent on this machine, so render through Word (same export as `skills/docx-from-markdown/SKILL.md` workflow step 7), then render pages with PyMuPDF and look at each one:

```powershell
$word = New-Object -ComObject Word.Application; $word.Visible = $false
$doc = $word.Documents.Open($src, [ref]$false, [ref]$true)
$doc.Fields.Update() | Out-Null; $doc.SaveAs([ref]$pdf, [ref]17)
$doc.Close([ref]$false); $word.Quit()
```
```python
import pymupdf  # Python 3.9
d = pymupdf.open(pdf)
for i in range(d.page_count): d[i].get_pixmap(dpi=100).save(f"AI_DOCS/.temp/p{i+1:02d}.png")
```

Look for: overflowing or clipped tables, a TOC that did not resolve, blank pages, wrong fonts, cut-off images, missing headers or footers. Fix, rebuild, render again. If Word holds the file lock, ask the operator to close it, never kill Word. Handoff block per `rules/document-generation-rules.md` (Render, inspect, then hand off): Opened / Found and fixed / Please verify. Example Please verify items: client and person names, dates, totals, whether each diagram shows the intended flow.

## WebOsmotic Project Rules (Applied to All DOCX Generation)

These rules are enforced on every document generated for or by WebOsmotic. They override any conflicting defaults above.

### Brand Name
- Company name is always **WebOsmotic** — capital W, capital O. Never "WebOsmotic", "WebOsmotic", or "Web Osmotic".
- In JS generation scripts, always use a constant: `const COMPANY = "WebOsmotic Private Limited";`
- Before delivery, grep the DOCX XML for `WebOsmotic` (lowercase O) — must return zero matches.

### Template Selection Gate (REQUIRED before any DOCX generation)
Generating a NEW document from markdown is the `docx-from-markdown` skill's job — route there. It asks the user which of the two official formats to use:
> - **WebOsmotic Template** (`--mode cover`) — branded cover page (logo, title block, Presented to / Presented By band), auto-updating TOC, then content. Use for any client-facing document: workscope, proposal, inquiry response, timeline. For workscope/proposal bodies follow the official 12-section structure in `docx-from-markdown/references/workscope-template.md`.
> - **Clean Formatted Document** (`--mode plain`) — no cover page, opens on the Table of Contents, same WebOsmotic chrome (watermark, header banner, copyright footer) and styling. Suitable for internal docs.

Both render into templates generated from `docx-from-markdown/templates/webosmotic-master.docx`. The delivered file must contain zero yellow highlights and zero bracketed placeholders. This skill (`/docx`) only edits documents that already exist.

### Table Style Rule (REQUIRED for all WebOsmotic tables)
Every table in a WebOsmotic client-facing DOCX must follow the official master spec (`webosmotic-master.docx`, the `docx-from-markdown` skill standard): direct-formatted, full width, hairline grid, ink-navy header band. Read `WEBOSMOTIC-STYLE-REFERENCE.md` before formatting any WebOsmotic table for the exact width/border/padding spec.

### Writing Style and Punctuation Rules

These rules apply to every paragraph, label, and table cell written into a WebOsmotic DOCX (JS-generated or XML-edited). Prose discipline (voice, banned phrases, the validation pass) lives in `rules/document-generation-rules.md`, shared with every document skill. The mechanical punctuation subset is kept here because it is verified against the rendered XML.

When authoring a document from scratch, the `rules/document-generation-rules.md` Rule 1 intake gate applies (purpose, audience, tone, format in one batch). Read, edit, merge, split, and format operations are mechanical, exempt.

**No en-dashes or em-dashes: rewrite the sentence instead.** Read `WEBOSMOTIC-STYLE-REFERENCE.md` for the wrong/right rewrite examples.

**Rules:**
- En-dash (`–`) is forbidden everywhere. Rewrite the phrase that needed it.
- Em-dash (`—`) is forbidden everywhere. Use a comma, semicolon, or period.
- Numeric ranges use the word "to": `8 to 10 weeks`, `Phase 1 to 2`.
- Bold lead-in labels end with a colon inside the bold span: `**Label:**` not `**Label**:`.
- Hyphens in compound modifiers are fine: `multi-tenant`, `per-tenant`, `sub-10 ms`.

**Humanized language:** follow the human writing standard and banned-phrase list in `rules/document-generation-rules.md` (Rules 4, 5, and the Rule 7 validation pass).

**Pre-delivery check:** grep the final document XML for `–` (en-dash U+2013) and `—` (em-dash U+2014). Both must return zero matches.

```bash
python -c "
import zipfile
z = zipfile.ZipFile('output.docx')
xml = z.read('word/document.xml').decode('utf-8')
print('En-dashes:', xml.count('–'))
print('Em-dashes:', xml.count('—'))
"
```

### Color Rule: Black / Dark-Gray Only
All heading and body text colors are restricted to the TEXT_DARK / TEXT_MID / RULE_COLOR tokens. Read `WEBOSMOTIC-STYLE-REFERENCE.md` for the exact hex values and usage.

Never use blue, navy, red, orange, or any brand accent color on text or heading runs.
Rule line borders must be `CCCCCC` (light gray), not any blue variant.

### TOC Rule
- Always include `TableOfContents` as the first content page (after the cover page break).
- Every heading paragraph style MUST include `outlineLevel` (0 for H1, 1 for H2, etc.) — without it the TOC field finds nothing.
- Add `new Paragraph({ children: [new PageBreak()] })` immediately after the TOC element.
- Remind the user to press F9 (or right-click → Update Field) on first open.

Read `WEBOSMOTIC-STYLE-REFERENCE.md` for the exact `TableOfContents` + `PageBreak` code snippet.

### Cover Page: Reuse Reference Template (WebOsmotic Template only)
docx-js cannot reproduce the complex `<wp:anchor>` drawing groups and VML shapes on the branded cover. Read `WEBOSMOTIC-BRANDING-REFERENCE.md` before building or editing a cover page: it has the unpack/edit-text/pack procedure and the "Presented to" line-break XML pattern.

### Watermark Injection (WebOsmotic Template only)
Read `WEBOSMOTIC-BRANDING-REFERENCE.md` before injecting the WebOsmotic watermark into a generated DOCX: it has the asset paths and the 5-step unpack/copy-assets/replace-header/relink/repack procedure.

### No Redundant Image Captions
Do not add a caption paragraph immediately below (or above) an image if the surrounding section heading already names the content. Only add a caption when the image appears mid-paragraph, without a nearby heading describing it. Read `WEBOSMOTIC-BRANDING-REFERENCE.md` for the wrong/right code example.

### Diagram-First Approach
For any section describing architecture layers, state machines, data flows, or pipelines, draw the diagram with the `diagram-design` plugin **before** writing the text description, export it with `/diagram-design:export-diagram <file>.html --png-only`, and embed the PNG immediately before the corresponding text block.

- `diagram-design` is the framework's only diagram generator (45 types, Mermaid / draw.io / Excalidraw import). Mermaid CLI is not installed on Windows, so a Mermaid source goes through `/diagram-design:import-mermaid`, never a Mermaid renderer.
- Type choice, the `webosmotic` brand profile, and the print-size math for a 7.4in embed live in `docx-from-markdown` SKILL.md, "Diagram R&D pass".

Read `VISUALS-REFERENCE.md` before finalizing any document containing diagrams, flowcharts, or images: it covers connector clarity, image placement, content-duplication avoidance, and the pre-delivery visual quality checklist.

<!-- Version: 1.6.0 | 2026-08-06 | progressive disclosure: reference blocks moved to supporting files (v4.18.0 structural pass); no content deleted -->
<!-- Version: 1.7.0 | 2026-08-20 | scratch working directory: unpacked XML trees and intermediate PDFs/images redirected from bare relative folders to AI_DOCS/.temp/ -->
<!-- Version: 1.8.0 | 2026-10-14 | Diagram-First Approach now uses the diagram-design plugin (Pillow-based diagram-creator retired). -->
<!-- Version: 1.9.0 | 2026-10-14 | Reading requires the markitdown visual pass and COVERAGE: COMPLETE (images and page headers were dropped by plain conversion). -->

<!-- Version: 1.9.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 1.10.0 | 2026-10-22 | Inspect before handoff step added (render and read every page, handoff block) -->
