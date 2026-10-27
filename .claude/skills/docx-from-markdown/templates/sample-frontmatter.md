# Sample frontmatter for /docx-from-markdown

Copy the block that matches the chosen output mode to the TOP of the source
markdown, then run the converter.

## WebOsmotic template (branded cover page)

The cover title, subtitle, recipient, presenter, date, and validity note are
the variable parts. The logo, watermark, header banner, footer, and brand
styles come from the template.

```yaml
---
title: "AI Chatbot Platform: Workscope & Budget Proposal"
subtitle: "Conversational AI for customer support"
presented_to: "Ray Johnson, Founder, RideIt"
presented_by: "WebOsmotic Private Limited"   # default if omitted
date: "5th June 2026"                        # auto-stamps today if omitted
validity_days: 30                            # default if omitted
---
```

Run:

```bash
python scripts/md_to_docx.py source.md out.docx --mode cover
```

## Clean formatted document (starts at the Table of Contents)

No cover page, so frontmatter is optional. Headings drive the TOC.

```yaml
---
title: "RideIt: Architecture Brief"   # kept for document metadata only
---
```

Run:

```bash
python scripts/md_to_docx.py source.md out.docx --mode plain
```

## Body conventions (both modes)

- `# 1. Section` becomes a top section (Calibri 15pt bold `#0F2A43`).
- `## 1.1 Sub-section` becomes a sub-heading (Calibri 12pt bold `#2E75B6`).
- Everything renders in Calibri only (Symbol bullets and Consolas code blocks excepted).
- Bullet labels use a **colon**, never an em-dash: `**Rider app:** booking, tracking`.
- Numeric ranges spelled with "to": `13 to 16 weeks`, never `13–16`.
- Diagrams are drawn with the diagram-design plugin, exported to PNG, and referenced as `![alt](images/x.png)`.
- Tables: max 4 columns; the converter applies the brand hairline-grid style
  with the `#0F2A43` header band automatically.
- Headerless tables: write an all-empty header row (`| | |`) to suppress the
  dark band. A 2-column headerless table with bold `**Labels**` in the first
  column gets the `#EEF3F8` label-column tint (case-study look).
- The TOC updates itself when the file opens in Word.
