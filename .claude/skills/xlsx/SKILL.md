---
name: xlsx
description: "Use this skill any time a spreadsheet file is the primary input or output: creating, reading, editing .xlsx/.xlsm/.csv/.tsv files, adding columns, computing formulas, formatting, charting, cleaning messy data, or converting between tabular formats. Also triggers on: 'Create spreadsheet', 'Create Excel', 'Edit xlsx', 'Excel file', 'CSV processing'."
effort: medium
next_skill: null
required_gate: null
skill_id: SK-XLSX
context_budget:
  load_kb: 30
  scope: task
version: 1.3.0
dependencies:
  required: []
  optional: []
license: "Source: github.com/anthropics/skills — Proprietary. See LICENSE.txt"
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# XLSX Creation, Editing, and Analysis

> **Global dependencies** (no local installs):
> - `pip install openpyxl pandas`
> - LibreOffice — for formula recalculation

## Reading content (ingest-first)
**To read or inspect a workbook's data for reasoning, ingest it through the `markitdown` skill first** — it renders each sheet as a Markdown table at `AI_DOCS/ingested/xlsx/<name>.md`:

```bash
python ../markitdown/scripts/ingest.py workbook.xlsx
```

A source is not read until `verify_coverage.py` prints `COVERAGE: COMPLETE`. Ingest flags every picture, chart, shape diagram and scanned page for the `markitdown` visual pass, which transcribes the text inside images and the diagram relationships. Run it, then:

```bash
python ../markitdown/scripts/verify_coverage.py AI_DOCS/ingested/xlsx/workbook.md
```

INCOMPLETE means content is missing (an unread image, a dropped header, a table that did not convert). Report the gap list instead of reasoning over a partial document. Hidden sheets, cell comments and merged ranges are added by ingest.

Use the openpyxl/pandas paths below for everything markitdown does not do: cell-level reads/writes, formula text (markitdown shows cached values, not the `=…` formulas), formatting, charts, and creating/editing workbooks.

## CRITICAL: Use Formulas, Not Hardcoded Values

**Always use Excel formulas instead of calculating values in Python and hardcoding them.** This ensures the spreadsheet remains dynamic and updateable.

```python
# WRONG - Hardcoding
total = df['Sales'].sum()
sheet['B10'] = total  # Hardcodes 5000

# CORRECT - Using Excel Formulas
sheet['B10'] = '=SUM(B2:B9)'
```

This applies to ALL calculations — totals, percentages, ratios, differences, etc.

## Requirements for All Excel Files

### Professional Font
- Use Arial or Times New Roman for all deliverables unless otherwise instructed

### Zero Formula Errors
- Every Excel file MUST be delivered with ZERO formula errors (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?)

### Preserve Existing Templates
- Study and EXACTLY match existing format when modifying files
- Existing template conventions ALWAYS override these guidelines

## Financial Model Standards

### Color Coding (Industry Standard)

| Color | Use For |
|-------|---------|
| **Blue text** (0,0,255) | Hardcoded inputs, scenario variables |
| **Black text** (0,0,0) | ALL formulas and calculations |
| **Green text** (0,128,0) | Links from other worksheets |
| **Red text** (255,0,0) | External links to other files |
| **Yellow background** (255,255,0) | Key assumptions needing attention |

### Number Formatting

- **Years**: Text strings ("2024" not "2,024")
- **Currency**: $#,##0; ALWAYS specify units in headers ("Revenue ($mm)")
- **Zeros**: Format as "-" including percentages
- **Percentages**: 0.0% format (one decimal)
- **Negative numbers**: Use parentheses (123) not minus -123

### Formula Rules

- Place ALL assumptions in separate assumption cells
- Use cell references instead of hardcoded values
- Document data sources for hardcoded values

## Reading and Analyzing Data

```python
import pandas as pd

df = pd.read_excel('file.xlsx')
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)

df.head()
df.info()
df.describe()

df.to_excel('output.xlsx', index=False)
```

## Creating New Excel Files

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active

sheet['A1'] = 'Hello'
sheet['B2'] = '=SUM(A1:A10)'

sheet['A1'].font = Font(bold=True, color='FF0000')
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')
sheet['A1'].alignment = Alignment(horizontal='center')

sheet.column_dimensions['A'].width = 20

wb.save('output.xlsx')
```

## Editing Existing Excel Files

```python
from openpyxl import load_workbook

wb = load_workbook('existing.xlsx')
sheet = wb.active

sheet['A1'] = 'New Value'
sheet.insert_rows(2)
sheet.delete_cols(3)

new_sheet = wb.create_sheet('NewSheet')
new_sheet['A1'] = 'Data'

wb.save('modified.xlsx')
```

## Formula Verification Checklist

- [ ] Test 2-3 sample references before building full model
- [ ] Confirm Excel columns match (column 64 = BL, not BK)
- [ ] Remember Excel rows are 1-indexed (DataFrame row 5 = Excel row 6)
- [ ] Check for null values with `pd.notna()`
- [ ] Check denominators before using `/` in formulas (#DIV/0!)
- [ ] Verify all cell references point to intended cells (#REF!)
- [ ] Use correct format for cross-sheet references (Sheet1!A1)
- [ ] Start small — test formulas on 2-3 cells before applying broadly

## Inspect before handoff (BLOCKING)

openpyxl writes formulas without cached values, and LibreOffice is absent here, so recalculate through Excel COM:

```powershell
$xl = New-Object -ComObject Excel.Application; $xl.Visible = $false; $xl.DisplayAlerts = $false
$wb = $xl.Workbooks.Open($path); $xl.CalculateFull()
foreach ($ws in $wb.Worksheets) { foreach ($c in $ws.UsedRange.Cells) { if ($c.Text -match '^#(REF|NAME|VALUE|N/A|DIV)') { "$($ws.Name)!$($c.Address()) $($c.Text)" } } }
$wb.Save(); $wb.Close(); $xl.Quit()
```

Read back the key totals and any validation sheet. Zero error cells is the bar. Fix and recalculate. Handoff block per `rules/document-generation-rules.md` (Render, inspect, then hand off): Opened / Found and fixed / Please verify. Opened names the sheets, formulas recalculated and the validation result. Example Please verify items: totals, assumptions, units, labels.

## Best Practices

### Library Selection
- **pandas**: Data analysis, bulk operations, simple data export
- **openpyxl**: Complex formatting, formulas, Excel-specific features

### Working with openpyxl
- Cell indices are 1-based (row=1, column=1 = cell A1)
- Use `data_only=True` to read calculated values
- **Warning**: If opened with `data_only=True` and saved, formulas are permanently lost
- Formulas are preserved but not evaluated — use LibreOffice to recalculate

### Code Style
- Write minimal, concise Python code
- Add comments to cells with complex formulas
- Document data sources for hardcoded values
<!-- Version: 1.2.0 | 2026-10-14 | Reading requires COVERAGE: COMPLETE: hidden sheets, cell comments, merged ranges, embedded images and charts are captured. -->

<!-- Version: 1.2.1 | 2026-10-21 | effort set per the v4.28.0 cost policy -->
<!-- Version: 1.3.0 | 2026-10-22 | Inspect before handoff: Excel COM recalculation and read-back, handoff block -->
