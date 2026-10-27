# DOCX Templates

This folder holds the WebOsmotic master document, the two generated
templates the converter renders into, and the registry (`templates.yaml`)
the skill reads to offer the user a choice of output format.

## Files

| File | What it is |
|---|---|
| `templates.yaml` | Registry the skill reads to ask "which format?" |
| `webosmotic-master.docx` | Pristine copy of the official master ("Sample document formate.docx"). The single source of truth for all styling. Never rendered into directly. |
| `wo-cover-template.docx` | GENERATED from the master: branded cover page + TOC + `{{CONTENT}}` marker. Used by `md_to_docx.py --mode cover`. |
| `wo-plain-template.docx` | GENERATED from the master: TOC + `{{CONTENT}}` marker, no cover page, full chrome kept. Used by `--mode plain`. |
| `sample-frontmatter.md` | Copy-paste frontmatter blocks per mode. |
| `../scripts/build_wo_templates.py` | Rebuilds both `wo-*` templates from the master. |
| `../scripts/build_template.py` | Generic utility: derives a `{{CONTENT}}` template from any finished branded `.docx` (non-WebOsmotic brands). |

## How template mode works

Each `wo-*` template is the master with its sample body removed. Constant
chrome rides along untouched: LOGO watermark on inner pages, header banner
("16+ years of Innovative Excellence"), the copyright footer with page
numbers, brand styles, numbering, and theme. The body holds only the cover
block (cover template), the "Table of Contents" heading + TOC field SDT, a
page break, and a single `{{CONTENT}}` placeholder before the final
`sectPr`.

At generation time `md_to_docx.py`:

1. Opens the template with `python-docx` (all chrome parts ride along).
2. Cover mode: fills the cover placeholders (title, subtitle, date,
   Presented to / Presented By, validity) from YAML frontmatter and strips
   the yellow placeholder highlights.
3. Pre-renders the TOC entries from the markdown's H1/H2 headings. The TOC
   stays a real Word field and refreshes automatically on open
   (`<w:updateFields w:val="true"/>` ships in the template settings).
4. Renders the body, applying brand styles **by name** (`Heading 1`,
   `Heading 2`, `Heading 3`, `List Paragraph`, `Quote`) plus the master's
   direct formatting for body color and tables.
5. Removes the `{{CONTENT}}` placeholder and stamps the footer year.

## Updating the master

When WebOsmotic ships a new master document:

1. Replace `webosmotic-master.docx` with the new file.
2. Done — `md_to_docx.py` detects that the master (or the builder script)
   is newer than the generated templates and rebuilds them automatically
   on the next conversion. Manual rebuild stays available:
   `python ../scripts/build_wo_templates.py`
3. Regenerate a test document in both modes and eyeball the cover, TOC,
   and one table page in Word.

After a `git pull` of the framework repo, the post-merge hook runs
`upgrade.sh --auto`, which mirrors all skills (scripts and templates
included) to `~/.claude/skills` via `scripts/sync-global-skills.sh`, so
live sessions pick up the new pipeline without manual copying.

Never hand-edit `wo-cover-template.docx` or `wo-plain-template.docx`; the
builder overwrites them.

## Brand style facts (from the master)

| Element | Value |
|---|---|
| Fonts | Calibri only (the builder rewrites all Arial refs, including the theme fonts; Symbol bullets and Consolas code blocks are the only exceptions) |
| Page | US Letter, 0.5 in margins, page 1 chrome-free (`titlePg`) |
| Body | Calibri 11pt `#44515E` |
| H1 | Calibri 15pt bold `#0F2A43` |
| H2 | Calibri 12pt bold `#2E75B6` |
| H3 | Calibri 11pt bold `#0F2A43` (added by the builder) |
| Bold labels | `#0F2A43` |
| Links | `#0563C1` underline |
| Tables | full-width, hairline `#C9D4DF` grid, header fill `#0F2A43`, white bold 10pt |
| Footer | "© <year> WebOsmotic. All rights reserved." + page number (year stamped at generation) |
