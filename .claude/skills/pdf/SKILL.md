---
name: pdf
skill_id: SK-048
allowed-tools: Read Write Edit Grep Glob Bash
description: "Read, extract, merge, split, rotate, watermark, and create PDF files. Fill PDF forms, encrypt/decrypt, extract images, OCR scanned PDFs. Use when working with .pdf files or producing PDF documents."
effort: medium
license: Proprietary. LICENSE.txt has complete terms
version: 1.4.0
context_budget:
  load_kb: 20
  scope: task
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

## Overview
This guide covers essential PDF processing operations using Python libraries and command-line tools.

## Reading content (ingest-first)
**To read or analyze a PDF's text for reasoning, ingest it through the `markitdown` skill first** — it converts the PDF to a clean Markdown artifact at `AI_DOCS/ingested/pdf/<name>.md`, which you then read:

```bash
python ../markitdown/scripts/ingest.py document.pdf
```

A source is not read until `verify_coverage.py` prints `COVERAGE: COMPLETE`. Ingest flags every picture, chart, shape diagram and scanned page for the `markitdown` visual pass, which transcribes the text inside images and the diagram relationships. Run it, then:

```bash
python ../markitdown/scripts/verify_coverage.py AI_DOCS/ingested/pdf/document.md
```

INCOMPLETE means content is missing (an unread image, a dropped header, a table that did not convert). Report the gap list instead of reasoning over a partial document. A scanned page converts to an empty string without this pass.

Fall back to the libraries below only for what markitdown does not do well:
- **pdfplumber** — precise table extraction and layout-sensitive text.
- **pytesseract** — when you need fine OCR control over scanned pages.

All the operations below (merge, split, rotate, watermark, forms, encrypt, create) are **format operations** markitdown does not perform — keep using these libraries for them.

## Quick Start
```python
from pypdf import PdfReader, PdfWriter

# Read a PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# Extract text
text = ""
for page in reader.pages:
    text += page.extract_text()
```

### pypdf - Basic Operations
#### Merge PDFs
```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
```

#### Split PDF
```python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```

#### Extract Metadata
```python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"Title: {meta.title}")
print(f"Author: {meta.author}")
print(f"Subject: {meta.subject}")
print(f"Creator: {meta.creator}")
```

#### Rotate Pages
```python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # Rotate 90 degrees clockwise
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
```

### pdfplumber - Text and Table Extraction
#### Extract Text with Layout
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```

#### Extract Tables
```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"Table {j+1} on page {i+1}:")
            for row in table:
                print(row)
```

#### Advanced Table Extraction
```python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:  # Check if table is not empty
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

# Combine all tables
if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```

### reportlab - Create PDFs
#### Basic PDF Creation
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter

# Add text
c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "This is a PDF created with reportlab")

# Add a line
c.line(100, height - 140, 400, height - 140)

# Save
c.save()
```

#### Create PDF with Multiple Pages
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

# Add content
title = Paragraph("Report Title", styles['Title'])
story.append(title)
story.append(Spacer(1, 12))

body = Paragraph("This is the body of the report. " * 20, styles['Normal'])
story.append(body)
story.append(PageBreak())

# Page 2
story.append(Paragraph("Page 2", styles['Heading1']))
story.append(Paragraph("Content for page 2", styles['Normal']))

# Build PDF
doc.build(story)
```

#### Subscripts and Superscripts

**IMPORTANT**: Never use Unicode subscript/superscript characters (₀₁₂₃₄₅₆₇₈₉, ⁰¹²³⁴⁵⁶⁷⁸⁹) in ReportLab PDFs. The built-in fonts do not include these glyphs, causing them to render as solid black boxes.

Instead, use ReportLab's XML markup tags in Paragraph objects:
```python
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

styles = getSampleStyleSheet()

# Subscripts: use <sub> tag
chemical = Paragraph("H<sub>2</sub>O", styles['Normal'])

# Superscripts: use <super> tag
squared = Paragraph("x<super>2</super> + y<super>2</super>", styles['Normal'])
```

For canvas-drawn text (not Paragraph objects), manually adjust font the size and position rather than using Unicode subscripts/superscripts.

### pdftotext (poppler-utils)
```bash
# Extract text
pdftotext input.pdf output.txt

# Extract text preserving layout
pdftotext -layout input.pdf output.txt

# Extract specific pages
pdftotext -f 1 -l 5 input.pdf output.txt  # Pages 1-5
```

### qpdf
```bash
# Merge PDFs
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf

# Split pages
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf
qpdf input.pdf --pages . 6-10 -- pages6-10.pdf

# Rotate pages
qpdf input.pdf output.pdf --rotate=+90:1  # Rotate page 1 by 90 degrees

# Remove password
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf
```

### pdftk (if available)
```bash
# Merge
pdftk file1.pdf file2.pdf cat output merged.pdf

# Split
pdftk input.pdf burst

# Rotate
pdftk input.pdf rotate 1east output rotated.pdf
```

### Extract Text from Scanned PDFs
```python
# Requires: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

# Convert PDF to images
images = convert_from_path('scanned.pdf')

# OCR each page
text = ""
for i, image in enumerate(images):
    text += f"Page {i+1}:\n"
    text += pytesseract.image_to_string(image)
    text += "\n\n"

print(text)
```

### Add Watermark
```python
from pypdf import PdfReader, PdfWriter

# Create watermark (or load existing)
watermark = PdfReader("watermark.pdf").pages[0]

# Apply to all pages
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
```

### Extract Images
```bash
# Using pdfimages (poppler-utils)
pdfimages -j input.pdf output_prefix

# This extracts all images as output_prefix-000.jpg, output_prefix-001.jpg, etc.
```

### Password Protection
```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

# Add password
writer.encrypt("userpassword", "ownerpassword")

with open("encrypted.pdf", "wb") as output:
    writer.write(output)
```

## Quick Reference
| Task | Best Tool | Command/Code |
|------|-----------|--------------|
| Merge PDFs | pypdf | `writer.add_page(page)` |
| Split PDFs | pypdf | One page per file |
| Extract text | pdfplumber | `page.extract_text()` |
| Extract tables | pdfplumber | `page.extract_tables()` |
| Create PDFs | reportlab | Canvas or Platypus |
| Command line merge | qpdf | `qpdf --empty --pages ...` |
| OCR scanned PDFs | pytesseract | Convert to image first |
| Fill PDF forms | pypdf | `reader.get_fields()` + `writer.update_page_form_field_values()` |

## Inspect before handoff (BLOCKING)

For a PDF you created or modified, render every page and look at each one (PyMuPDF in Python 3.9, or `pypdfium2` in Python 3.12):

```python
import pymupdf
d = pymupdf.open(pdf)
for i in range(d.page_count): d[i].get_pixmap(dpi=100).save(f"AI_DOCS/.temp/p{i+1:02d}.png")
```

Look for: text running off the page, overlapping or clipped table cells, missing glyphs or fonts, blank pages, wrong page order, misplaced watermark or form fields. Fix and render again. Handoff block per `rules/document-generation-rules.md` (Render, inspect, then hand off): Opened / Found and fixed / Please verify. Example Please verify items: names, figures, dates, page order.

## Next Steps
- For JavaScript PDF manipulation, use `pdf-lib` (`npm install -g pdf-lib`)
- For form-filling: use pypdf's `update_page_form_field_values()` or pdf-lib's `PDFDocument.load()` + `getForm()`
- For advanced text extraction with layout: use `pypdfium2`
<!-- Version: 1.3.0 | 2026-10-14 | Reading requires the markitdown visual pass and COVERAGE: COMPLETE (scanned pages converted to empty text silently). -->

<!-- Version: 1.3.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 1.4.0 | 2026-10-22 | Inspect before handoff: render every produced page, handoff block -->
