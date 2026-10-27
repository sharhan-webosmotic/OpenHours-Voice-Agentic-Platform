# WebOsmotic Style Reference (Tables, Colors, TOC)

> Extracted from [SKILL.md](SKILL.md) WebOsmotic Project Rules: the table style spec, the writing-style wrong/right examples, the color token table, and the TOC code snippet.

---

## Table Style Spec

| Requirement | Value |
|---|---|
| Width | `tblW 5000 pct` (full text width), columns split evenly or by content |
| Borders | single hairline `sz 1`, color `C9D4DF`, all four sides of every cell |
| Header row | fill `0F2A43`, white bold Calibri 10 pt, `tblHeader: true` for multi-page repeat |
| Header cell padding | top/bottom 90 dxa, left/right 130 dxa, vertically centered |
| Body cells | Calibri 10 pt color `44515E`, padding top/bottom 80 dxa, left/right 130 dxa, vertically centered |
| Max columns | 4 — split or transpose any wider table |
| Named styles | Do NOT use `GridTable4Accent1` or other built-in table styles — the master uses direct formatting |

## Writing Style: Wrong / Right Examples

| Wrong | Right |
|---|---|
| `Weeks 8–10` | `Weeks 8 to 10` |
| `Phase 1–2` | `Phase 1 to 2` |
| `**Client layer** — five surfaces` | `**Client layer:** five surfaces` |
| Mid-sentence `—` pause | Split into two sentences or use a comma |


## Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `TEXT_DARK` | `1A1A1A` | Primary headings, body text |
| `TEXT_MID` | `555555` | Meta labels (From, To, Date), secondary text |
| `RULE_COLOR` | `CCCCCC` | Horizontal rule borders |

## TOC Code Snippet

```js
const { TableOfContents } = require("docx");
new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-6" }),
new Paragraph({ children: [new PageBreak()] }),
```
