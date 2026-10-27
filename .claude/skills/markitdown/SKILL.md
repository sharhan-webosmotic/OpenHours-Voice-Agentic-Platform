---
name: markitdown
description: "Read ANY supported file or URL completely into Markdown: PDF, Word, Excel, PowerPoint, Markdown, images, audio, HTML, CSV/JSON/XML, ZIP, EPub, YouTube. Converts with markitdown, inventories the original, restores dropped parts (headers, comments, notes, hidden sheets), and has the model read every picture, chart, diagram and scanned page in a visual pass. A source counts as read only at COVERAGE: COMPLETE. Triggers on: 'ingest this file', 'read this document', 'extract text from', 'convert to markdown', 'what does this PDF say', 'summarize this file'."
effort: medium
next_skill: null
required_gate: null
skill_id: SK-049
context_budget:
  load_kb: 24
  scope: task
version: 2.1.0
dependencies:
  required: []
  optional: [pdf, docx, xlsx, pptx, codebase-migration]
produces:
  - path: "AI_DOCS/ingested/<type>/<basename>.md"
    consumers: [do, codebase-migration, requirement-finalization, any-llm]
  - path: "AI_DOCS/ingested/<type>/<basename>.inventory.json"
    consumers: [markitdown]
  - path: "AI_DOCS/ingested/<type>/<basename>.assets/"
    consumers: [markitdown]
license: "Source: github.com/microsoft/markitdown (MIT). Wrapper: Proprietary."
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
  category: document
  tags: [markitdown, ingest, convert, markdown, extraction, visual-pass, coverage, transcription]
skip:
  - "create a new PDF / Word / Excel / PowerPoint file (use pdf / docx / xlsx / pptx)"
  - "edit or manipulate an existing office file (use the matching format skill)"
  - "generate markdown from scratch (use markdown-creator)"
---

# /markitdown: complete reading of any file into Markdown

> **Global dependencies** (no local installs):
> - **Python 3.12+**, the framework floor (markitdown needs 3.10 or newer, `setup.sh`/`upgrade.sh` enforce 3.12). On Python 3.9 only the empty `0.0.1a1` placeholder installs and ingestion fails with a clear preflight message.
> - `pip install --upgrade "markitdown[all]"` pulls every converter plus python-pptx, python-docx, openpyxl, pdfplumber and pdfminer. The pipeline also uses `pypdfium2` and `Pillow` (both pulled by the same install on current releases).
> - **Optional, Windows only:** Microsoft Office (PowerPoint, Word, Excel). The inventory drives it through COM from a `powershell.exe -NoProfile` subprocess to render slides, Word pages and Excel sheets. Without Office (Mac, Linux, no install) the pipeline falls back to the embedded media and labels the unit `slide render unavailable` / `page render unavailable`.
> - `ffmpeg` + `exiftool`: optional, only for audio transcription and EXIF metadata.
>
> There is **no OCR engine**. Text inside images and scanned pages is read by the model in the visual pass (Step 2), never by a library.

## Why this skill is more than a converter

markitdown alone silently loses content. Proven on 0.1.6: text inside a slide picture became `![req.png](Picture2.jpg)`, a connector between two shapes lost the relationship, chart titles and axes vanished, a scanned PDF page became an empty string with no warning, and a DOCX image and page header were dropped. This skill wraps markitdown in a three-step pipeline so nothing is lost without a visible gap.

**A source is not "read" until `verify_coverage.py` prints `COVERAGE: COMPLETE`.** Before that, the ingested Markdown is a partial draft and must not be handed to downstream skills as if it were whole.

## When to invoke
- The user hands you a PDF / Word / Excel / PowerPoint / Markdown / image / audio / HTML / CSV / JSON / XML / ZIP / EPub / YouTube link and asks what is in it, to summarize it, or to use it as input.
- Another skill (`/do`, `codebase-migration`, `requirement-finalization`, an audit) needs the readable content of a document.

## Do NOT use for
- **Creating** office files: use `pdf`, `docx`, `xlsx`, `pptx`.
- **Editing / manipulating** an existing office file (merge, split, tracked changes, cell formulas): use the matching format skill.
- **Generating** Markdown from scratch: `markdown-creator`.

## Output contract

```
AI_DOCS/ingested/<type>/<basename>.md               the Markdown (read this)
AI_DOCS/ingested/<type>/<basename>.inventory.json   facts about the ORIGINAL file
AI_DOCS/ingested/<type>/<basename>.assets/          PNG renders of flagged units + media/
AI_DOCS/ingested/manifest.md                        one row per source, with Coverage
AI_DOCS/.temp/markitdown/                           scratch (Office PDFs), auto-deleted
```

`<type>` is one of `pdf`, `docx`, `pptx`, `xlsx`, `markdown`, `image`, `audio`, `html`, `data` (csv/json/xml), `zip`, `youtube`, `epub`.

Frontmatter of every `.md`:

```yaml
---
source: <original path or url>
type: pptx
tool: markitdown
sha256: <hash of source bytes>     # omitted for URLs
inventory: <basename>.inventory.json
visual_units: 2
ingested_at: 2026-10-14T10:30:00Z
---
```

Manifest columns: `| source | type | ingested .md | ingested_at | coverage |`. Coverage is `unverified` after ingest, then `complete` or `incomplete (<n> gaps)` after Step 3. Rows from before the column existed are migrated to `unverified` automatically.

**Idempotent.** Re-ingesting overwrites in place and updates (never duplicates) the manifest row. When the source bytes are unchanged, the cached inventory and renders are reused and every VISUAL block already filled is kept. Changed bytes discard old visual blocks, because they described a different file.

## Requirements intake convention

When the file is **client requirement material** (a brief, an RFP, meeting notes, a design export), save or copy the original into `AI_DOCS/requirements/` first and ingest from that path. `AI_DOCS/requirements/` holds originals in, `AI_DOCS/ingested/` holds conversions out, `manifest.md` joins the two. `requirement-finalization` reads only sources whose Coverage is `complete`.

## The workflow

### Step 1: ingest (conversion + inventory + placeholders)

```bash
python scripts/ingest.py AI_DOCS/requirements/deck.pptx
```

This one command:
1. Converts with markitdown (PDFs are page-segmented with the same pdfminer/pdfplumber engines, so each page gets a `<!-- Page number: N -->` marker).
2. Runs `scripts/inventory.py` on the **original** file: per unit (slide, page, sheet, Markdown section, DOCX figure) it records text size, tables (count and rows x cols), pictures, charts (title, type, axes), shape diagrams (groups, connectors, SmartArt), embedded objects, speaker notes and the hidden flag. Document level: headers, footers, comments, footnotes, endnotes, text boxes, hidden sheets, merged ranges, cell comments, formulas, linked images, embedded media.
3. Flags `needs_visual: true` with a reason for any unit holding a picture, chart, shape diagram, SmartArt, connector, embedded object, linked image, or a scanned PDF page (images present, under ~40 characters of text). Each flagged unit is rendered to a PNG with a long edge of about 1600 px in the assets folder.
4. Restores what markitdown drops:
   - DOCX: headers, footers, comments, footnotes, text boxes.
   - PPTX: hidden-slide labels, chart and axis titles, connector relationships inferred from slide geometry, SmartArt text.
   - XLSX: hidden-sheet labels, cell comments, merged ranges, formulas with cached values.

   Missing document parts go in an appendix after `<!-- PIPELINE-APPENDIX -->`.
5. Places one placeholder per flagged unit at that unit's position:

```
<!-- VISUAL-PENDING unit=slide-1 image=deck.assets/slide-001.png reason=picture -->
```

`image=` may list several comma-separated PNGs (a sheet that spans pages, plus its media). `image=none note=slide-render-unavailable` means no render was possible: the unit must still be resolved in Step 2, normally with an `[unreadable: ...]` statement.

### Step 2: visual pass (the model reads every flagged image)

For each `VISUAL-PENDING` block, the model opens every listed PNG with the **Read** tool and replaces the placeholder with a filled block:

```
<!-- VISUAL unit=slide-2 image=deck.assets/slide-002.png -->
**Visible text:** Customer | Payment Gateway | Role | Limit | Agent | $100
**Diagram:**
Customer -> Payment Gateway (pays via)
**Chart:** Title "Users", clustered column. X axis: quarter. Y axis: 0 to 6000. Q1 about 1200, Q2 about 5400.
**Meaning:** The customer pays through the gateway. Agents are limited to $100.
<!-- /VISUAL -->
```

Field rules:
- `**Visible text:**` (always): every word in reading order, verbatim, including numbers, currency, units, labels and legends. Separate visual lines with ` | `. Do not paraphrase or correct spelling.
- `**Diagram:**` (required when the reason includes `connector`, `group`, `smartart`, `shape` or `vector-drawing`): one line per relationship as `A -> B (label)`, using the exact node text. Use `A -- B` for an undirected line.
- `**Chart:**` (required when the reason includes `chart`): title, chart type, both axes, series, and the values read, marked as read off the image ("about 1200") unless printed.
- `**Meaning:**` (always): one or two lines on what the visual communicates.
- `[unreadable: <where>]` for anything not legible. **Never guess** a word or number. An honest `[unreadable]` is a pass. A guess is a defect.

**Dispatch it in read-only subagents, never inline.** Raw images must not enter the main context (`context-efficiency-rules.md`). Split the pending units into batches of about 10 and dispatch one read-only agent per batch with `model: sonnet` in the Agent call (never Haiku: verbatim transcription of requirement text is not a lookup task), all in one message so they run in parallel. Each agent receives the md path, its unit ids and image paths, plus the field rules above, Reads the PNGs, and returns ONLY the filled blocks. The orchestrator pastes each block over its placeholder (one Edit per block). For a source with one or two flagged units, a single agent is enough.

**Session-model validation (cost policy, v4.28.0).** Before `verify_coverage` counts a block, the session model re-reads the image itself for every unit whose block carries `[unreadable]`, or whose visible text carries money, dates, limits, quantities or IDs, and corrects the block where it differs. Cheap models transcribe, the session model signs off.

### Step 3: verify coverage

```bash
python scripts/verify_coverage.py AI_DOCS/ingested/pptx/deck.md
```

Prints PASS / FAIL / WARN lines, then `COVERAGE: COMPLETE` (exit 0) or `COVERAGE: INCOMPLETE (<n> gaps)` (exit 1), and writes the verdict to the manifest Coverage column. Checks:
- every unit appears, and its table count matches the source
- every flagged unit has a filled VISUAL block with the required fields, and no `VISUAL-PENDING` is left
- notes, headers, footers, comments, footnotes, text boxes and cell comments are present
- hidden units are labelled, merged ranges and formulas are listed
- no unit with source text or images is empty

- **COMPLETE**: hand the `.md` downstream.
- **INCOMPLETE**: do not reason over the file as if whole. Give the operator the FAIL lines as the gap list, fix what can be fixed (finish the visual pass, re-ingest a corrected source), and re-run verify.

## Quick reference

| Task | Command |
|------|---------|
| Ingest a file (Step 1) | `python scripts/ingest.py report.pdf` |
| Verify coverage (Step 3) | `python scripts/verify_coverage.py AI_DOCS/ingested/pdf/report.md` |
| Inventory only | `python scripts/inventory.py deck.pptx --out-dir AI_DOCS/ingested/pptx` |
| Re-render after an Office or script change | `python scripts/ingest.py deck.pptx --force-render` |
| Print raw markitdown output (no write, no pipeline) | `python scripts/ingest.py report.pdf --stdout` |
| Force a type | `python scripts/ingest.py weird.bin --type pdf` |
| Custom output root | `python scripts/ingest.py report.pdf --out-root AI_DOCS/ingested` |
| Ingest a URL / YouTube | `python scripts/ingest.py <url> --allow-network` |

## Safety

- **URLs and YouTube links are a Category-B external operation** (`ops-safety-rules.md`). `ingest.py` refuses network sources unless `--allow-network` is passed. Pass it only after warning the user and getting confirmation. URL sources get no inventory, so they stay `unverified`.
- Remote images linked from Markdown are recorded as WARN lines and never fetched.
- Local conversion is offline. Office COM jobs open files read-only, never save, call Quit on the app they started, release COM objects, and stop any Office process they spawned that is still alive. When PowerPoint is already open, only the job's own presentation is closed.

See `references/supported-formats.md` for the per-format table of what markitdown captures, what it drops, and what the pipeline adds.

<!-- Version: 2.0.0 | 2026-10-14 | complete-reading pipeline: inventory of the original, restored dropped parts, VISUAL-PENDING placeholders, model visual pass in read-only subagents, verify_coverage verdict in the manifest, removed the false OCR claim -->

<!-- Version: 2.0.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 2.1.0 | 2026-10-21 | Visual pass dispatched on Sonnet (never Haiku), and the session model re-reads units with [unreadable] or with money, dates, limits, quantities or IDs before coverage counts them. -->
