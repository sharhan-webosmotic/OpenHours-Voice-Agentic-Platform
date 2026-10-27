# markitdown: supported formats, what is captured, what is dropped

Reference for the `markitdown` skill. The type folder is created under
`AI_DOCS/ingested/`. "markitdown captures" and "markitdown drops" were tested
on markitdown 0.1.6 with Python 3.12. "Pipeline adds" is what `ingest.py`,
`inventory.py` and the model visual pass restore. A source is read only when
`verify_coverage.py` prints `COVERAGE: COMPLETE`.

## Per-format coverage

| Type folder | Sources | markitdown captures | markitdown drops | Pipeline adds |
|-------------|---------|---------------------|------------------|---------------|
| `pptx` | `.pptx`, `.ppt` | Slide text in shape order, tables, chart data as a table, speaker notes, slide number markers | Text inside pictures (only `![name](file)` survives), connector relationships, chart titles and axis titles, SmartArt text, the hidden-slide flag, slide comments | Per-slide inventory, `<!-- HIDDEN -->` label, chart and axis title line, `A -> B` connector lines inferred from connection ids or geometry, SmartArt text, slide comments. Every slide with a picture, chart, connector, group, SmartArt or embedded object is rendered via PowerPoint COM and read in the visual pass |
| `docx` | `.docx`, `.doc` | Body paragraphs, headings, lists, tables. Footnotes may appear as a trailing list (not verified on every file) | Images (a truncated `data:` link remains), page headers and footers, comments, text boxes, charts, SmartArt, shapes, embedded objects. Tracked changes are flattened to final text | Headers, footers, comments, footnotes, endnotes and text boxes in the appendix when missing. One unit per figure: pictures use the extracted media, charts/SmartArt/shapes use the Word COM page render. Each is read in the visual pass. Use the `docx` skill (`pandoc --track-changes`) for change marks |
| `xlsx` | `.xlsx`, `.xlsm`, `.xls` | One Markdown table per sheet (hidden sheets included, unlabelled). Formulas appear as cached values, or `NaN` when the file was never calculated | Hidden-sheet flag, cell comments, merged ranges (shown as `Unnamed: n` columns), formula text, embedded images, charts | `<!-- HIDDEN -->` label per hidden sheet, cell comments, merged ranges, every formula with its cached value, chart title and axis titles. Sheets with images or charts are exported via Excel COM (fit to one page wide) and read in the visual pass, which also recovers values Excel computes |
| `pdf` | `.pdf` | Born-digital text, form-style tables (via pdfplumber) | Everything on scanned pages (empty output, no warning), text inside embedded pictures, vector diagrams, annotations, page boundaries | Page markers per page, pdfplumber tables per page, annotation text. Scanned pages (images, under ~40 chars of text), pages with meaningful pictures and pages with dense vector drawing are rendered via pypdfium2 and read in the visual pass. Blank pages are labelled `[blank page]` |
| `markdown` | `.md`, `.markdown` | The text as is | Content of linked images | One unit per heading section. Each linked local image is copied into the assets folder and read in the visual pass. Remote images are listed and never fetched |
| `image` | `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.tiff`, `.webp` | EXIF metadata only (with `exiftool`). There is no OCR engine: no text is extracted | All visible text and meaning | Always one flagged unit, normalized to a long edge of about 1600 px and read in the visual pass |
| `data` | `.csv`, `.tsv`, `.json`, `.xml` | CSV/TSV as a Markdown table, JSON/XML as readable text | Nothing material | Single-unit inventory (empty output fails verify) |
| `audio` | `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg` | EXIF metadata plus speech transcription (requires `ffmpeg`) | Anything the engine cannot transcribe | Single-unit inventory, so an empty transcript fails verify instead of passing silently |
| `html` | `.html`, `.htm`, plain web URLs | Main text, links, tables. Boilerplate (nav, ads) may survive | Images | Local files get a single-unit inventory. URLs are a network op and stay `unverified` |
| `zip` | `.zip` | Each member converted, combined into `zip/<archive>.md` | Per-member coverage | Single-unit inventory. For full coverage, extract the archive and ingest each member |
| `youtube` | `youtube.com/...`, `youtu.be/...` URLs | Transcript plus metadata. **Network op**, requires `--allow-network` | Visual content of the video | None (no local file to inventory) |
| `epub` | `.epub` | Chapters concatenated into one document | Images | Single-unit inventory |

## Rendering engines

| Source | Engine | Without it |
|--------|--------|------------|
| PPTX slides | PowerPoint COM, `Slide.Export` to PNG | Embedded media of the slide is used. A slide with only a chart or shapes gets `image=none note=slide-render-unavailable` |
| DOCX pages | Word COM `ExportAsFixedFormat` to PDF, then pypdfium2 | Pictures still use their media. Charts and shapes get `page render unavailable` |
| XLSX sheets | Excel COM `ExportAsFixedFormat` per sheet, then pypdfium2 (up to 3 pages) | Embedded images are used. Charts get `sheet render unavailable` |
| PDF pages | pypdfium2 | `page render unavailable` |

COM is driven from a `powershell.exe -NoProfile` subprocess (no pywin32). Every
job opens read-only, never saves, quits the app it started, releases COM
objects, and stops any Office process it spawned. A unit marked unavailable
must still be resolved in the visual pass, usually with `[unreadable: ...]`.

## Network sources (Category B)

`http(s)` and YouTube URLs are external operations under `ops-safety-rules.md`.
`scripts/ingest.py` refuses them unless `--allow-network` is supplied. Warn the
user and get a "yes" before passing that flag.

## Type override

When extension-based detection is wrong (for example an extensionless file),
pass `--type <folder>` to force the destination type, for example
`python scripts/ingest.py dump --type pdf`.

## Optional backends

markitdown can delegate PDF and image extraction to **Azure Document
Intelligence** for OCR. It is not wired in. A project that opts in records it in
`stack.md` and passes the endpoint through `MarkItDown(docintel_endpoint=...)`.
The visual pass and coverage verification still apply.
