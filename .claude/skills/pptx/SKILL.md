---
name: pptx
description: "Use this skill any time a .pptx file is involved: creating slide decks, pitch decks, presentations, reading/parsing/extracting text from .pptx files, editing or updating existing presentations, combining or splitting slide files, working with templates, layouts, speaker notes, or comments. Also triggers on: 'Create presentation', 'Create slides', 'Create deck', 'Edit pptx', 'PowerPoint'."
effort: medium
next_skill: null
required_gate: null
skill_id: SK-PPTX
context_budget:
  load_kb: 30
  scope: task
version: 1.4.0
dependencies:
  required: []
  optional: [design-discovery, design-tokens, design-screens]
license: "Source: github.com/anthropics/skills — Proprietary. See LICENSE.txt"
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# PPTX Creation, Editing, and Analysis

> **Global dependencies** (no local installs):
> - `pip install --upgrade "markitdown[all]"` — text extraction (always pull the latest markitdown; shared with the `markitdown` ingest skill)
> - `pip install Pillow` — thumbnail grids
> - `npm install -g pptxgenjs` — creating from scratch
> - LibreOffice (`soffice`) — PDF conversion
> - Poppler (`pdftoppm`) — PDF to images

## Quick Reference

| Task | Guide |
|------|-------|
| Read/analyze content | `python ../markitdown/scripts/ingest.py presentation.pptx` → `AI_DOCS/ingested/pptx/` |
| Edit or create from template | Unpack → manipulate slides → edit content → clean → pack |
| Create from scratch | Use pptxgenjs (globally installed) |

## Reading Content

Ingest through the shared `markitdown` skill so the readable Markdown lands under the standard `AI_DOCS/ingested/pptx/` convention:

```bash
python ../markitdown/scripts/ingest.py presentation.pptx
```

A source is not read until `verify_coverage.py` prints `COVERAGE: COMPLETE`. Ingest flags every picture, chart, shape diagram and scanned page for the `markitdown` visual pass, which transcribes the text inside images and the diagram relationships. Run it, then:

```bash
python ../markitdown/scripts/verify_coverage.py AI_DOCS/ingested/pptx/presentation.md
```

INCOMPLETE means content is missing (an unread image, a dropped header, a table that did not convert). Report the gap list instead of reasoning over a partial document.

(A one-off `python -m markitdown presentation.pptx` returns slide text only: it drops the text inside pictures and the arrows of shape diagrams, so never use it to read a client deck.)

## Intake gate (ask first, MANDATORY when creating a deck)

Before creating any deck, ask ONE batch per `rules/document-generation-rules.md` Rule 1, skipping anything already evident from the request:

1. **Purpose**: what should the audience decide or do after this deck?
2. **Audience**: who is in the room (client executive, client technical, internal team, investors)?
3. **Tone**: formal, plain business English, or direct technical?
4. **Deck context and length**: presented live, sent as a document, or a leave-behind? Roughly how many slides?

Slide copy (titles, bullets, speaker notes) follows `rules/document-generation-rules.md`: one idea per slide, concrete claims, no banned phrases. Layout mechanics, palettes, and the QA render loop below are exempt. Reading, parsing, or editing an existing deck needs no intake.

## Design Ideas

**Don't create boring slides.** Plain bullets on a white background won't impress anyone.

### Before Starting

- **Pick a bold, content-informed color palette**: The palette should feel designed for THIS topic.
- **Dominance over equality**: One color should dominate (60-70% visual weight), with 1-2 supporting tones and one sharp accent.
- **Dark/light contrast**: Dark backgrounds for title + conclusion slides, light for content ("sandwich" structure).
- **Commit to a visual motif**: Pick ONE distinctive element and repeat it.

### Color Palettes

| Theme | Primary | Secondary | Accent |
|-------|---------|-----------|--------|
| **Midnight Executive** | `1E2761` (navy) | `CADCFC` (ice blue) | `FFFFFF` (white) |
| **Forest & Moss** | `2C5F2D` (forest) | `97BC62` (moss) | `F5F5F5` (cream) |
| **Coral Energy** | `F96167` (coral) | `F9E795` (gold) | `2F3C7E` (navy) |
| **Warm Terracotta** | `B85042` (terracotta) | `E7E8D1` (sand) | `A7BEAE` (sage) |
| **Ocean Gradient** | `065A82` (deep blue) | `1C7293` (teal) | `21295C` (midnight) |
| **Charcoal Minimal** | `36454F` (charcoal) | `F2F2F2` (off-white) | `212121` (black) |
| **Teal Trust** | `028090` (teal) | `00A896` (seafoam) | `02C39A` (mint) |
| **Berry & Cream** | `6D2E46` (berry) | `A26769` (dusty rose) | `ECE2D0` (cream) |
| **Sage Calm** | `84B59F` (sage) | `69A297` (eucalyptus) | `50808E` (slate) |
| **Cherry Bold** | `990011` (cherry) | `FCF6F5` (off-white) | `2F3C7E` (navy) |

### For Each Slide

**Every slide needs a visual element** — image, chart, icon, or shape. Text-only slides are forgettable.

**Layout options:**
- Two-column (text left, illustration on right)
- Icon + text rows (icon in colored circle, bold header, description below)
- 2x2 or 2x3 grid (image on one side, grid of content blocks on other)
- Half-bleed image (full left or right side) with content overlay

**Data display:**
- Large stat callouts (big numbers 60-72pt with small labels below)
- Comparison columns (before/after, pros/cons, side-by-side options)
- Timeline or process flow (numbered steps, arrows)

### Typography

| Header Font | Body Font |
|-------------|-----------|
| Georgia | Calibri |
| Arial Black | Arial |
| Calibri | Calibri Light |
| Cambria | Calibri |
| Trebuchet MS | Calibri |
| Impact | Arial |
| Palatino | Garamond |
| Consolas | Calibri |

| Element | Size |
|---------|------|
| Slide title | 36-44pt bold |
| Section header | 20-24pt bold |
| Body text | 14-16pt |
| Captions | 10-12pt muted |

### Spacing

- 0.5" minimum margins
- 0.3-0.5" between content blocks
- Leave breathing room — don't fill every inch

### Design habits that read as strong, not default

- Vary the layout across slides (columns, cards, callouts) rather than repeating the same one, so the deck does not feel templated.
- Left-align paragraphs and lists, reserving centered text for titles: centered body copy is harder to scan.
- Push titles to 36pt or larger for real size contrast against body text.
- Choose colors that reflect the specific topic rather than defaulting to blue.
- Give every slide a visual element (image, icon, chart) rather than leaving it text-only: text-only slides are forgettable.
- Let type weight and whitespace carry the title, not a decorative rule underneath. Accent lines under titles are a hallmark of AI-generated slides.

## QA (Required)

### Content QA

```bash
python ../markitdown/scripts/ingest.py output.pptx --stdout
python ../markitdown/scripts/ingest.py output.pptx --stdout | grep -iE "xxxx|lorem|ipsum|this.*(page|slide).*layout"
```

### Visual QA

Convert slides to images, then inspect for overlapping elements, text overflow, low contrast, misalignment. The intermediate PDF and slide images are per-project scratch, not deliverables: write them under `AI_DOCS/.temp/` (create it if missing) rather than the current directory.

```bash
python ../docx/scripts/office/soffice.py --headless --convert-to pdf --outdir AI_DOCS/.temp output.pptx
pdftoppm -jpeg -r 150 AI_DOCS/.temp/output.pdf AI_DOCS/.temp/slide
```

### Inspect before handoff (BLOCKING)

The `soffice` command above needs LibreOffice, which this machine lacks. Export every slide through PowerPoint COM, then read each PNG:

```powershell
$pp = New-Object -ComObject PowerPoint.Application
$pres = $pp.Presentations.Open($src, $true, $false, $false)
$pres.Export($outDir, "PNG", 1280, 720); $pres.Close(); $pp.Quit()
```

Look for: text overflowing its box, overlapping shapes, clipped images, unreadable chart axes, low contrast, leftover placeholder text. Fix and re-export. Handoff block per `rules/document-generation-rules.md` (Render, inspect, then hand off): Opened / Found and fixed / Please verify. Example Please verify items: names, figures, dates, claims on each slide, the story order.

### Verification Loop

1. Generate slides → Convert to images → Inspect
2. List issues found
3. Fix issues
4. Re-verify affected slides
5. Repeat until full pass reveals no new issues

**Do not declare success until you've completed at least one fix-and-verify cycle.**
<!-- Version: 1.3.0 | 2026-10-14 | Reading a deck requires the markitdown visual pass and COVERAGE: COMPLETE: pictures, charts and shape diagrams were silently dropped by plain conversion. -->

<!-- Version: 1.3.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 1.4.0 | 2026-10-22 | Inspect before handoff: render every slide via PowerPoint COM (no LibreOffice here), handoff block -->
