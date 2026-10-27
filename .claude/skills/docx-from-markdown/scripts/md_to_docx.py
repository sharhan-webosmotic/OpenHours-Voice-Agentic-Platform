"""Convert Markdown (+ YAML frontmatter) into a WebOsmotic-styled DOCX.

Every document renders INTO one of the two prebuilt WebOsmotic templates
derived from the official master ("Sample document formate.docx"):

  --mode cover  -> templates/wo-cover-template.docx
                   branded cover page (logo, title block, dark band with
                   Presented to / Presented By), then TOC, then content.
  --mode plain  -> templates/wo-plain-template.docx
                   no cover page: the document opens on the Table of
                   Contents. Full chrome stays (watermark, header banner,
                   copyright footer with page numbers).

Both templates carry the brand styles, so this converter applies styles by
NAME (Heading 1/2/3, List Paragraph, Quote) and adds the direct formatting
the master uses for body text and tables:

  body text  #44515E      bold lead labels  #0F2A43
  links      #0563C1      table header fill #0F2A43 (white bold 10pt)
  table borders #C9D4DF   guidance grey     #8A97A4

The TOC is a real Word TOC field. The templates ship with
<w:updateFields w:val="true"/> so Word refreshes it on open, and this
converter pre-renders the entry titles so the page never looks empty.

Markdown subset handled: ATX headings, paragraphs with **bold**, *italic*,
`inline code`, [text](url), GFM pipe tables, bullet (-/*) and numbered
lists (2 levels), fenced code blocks, blockquotes (>), standalone images,
horizontal rules (skipped).

Usage:
    python scripts/md_to_docx.py src.md out.docx --mode cover
    python scripts/md_to_docx.py src.md out.docx              # plain mode
"""

from __future__ import annotations

import math
import re
import shutil
import sys
from datetime import date as _date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
TEMPLATE_BY_MODE = {
    "cover": TEMPLATES_DIR / "wo-cover-template.docx",
    "plain": TEMPLATES_DIR / "wo-plain-template.docx",
}

# --- Brand palette (hex, no #) ---------------------------------------------
BODY_HEX = "44515E"      # body / table-body text
INK_HEX = "0F2A43"       # bold labels, H1, table header fill
LINK_HEX = "0563C1"      # hyperlink blue
BORDER_HEX = "C9D4DF"    # table grid lines
CODE_FILL_HEX = "EEF2F8"
CODE_TEXT_HEX = "404040"
INLINE_CODE_FILL_HEX = "F0F2F5"

BODY_RGB = RGBColor(0x44, 0x51, 0x5E)
INK_RGB = RGBColor(0x0F, 0x2A, 0x43)
LINK_RGB = RGBColor(0x05, 0x63, 0xC1)
CODE_TEXT_RGB = RGBColor(0x40, 0x40, 0x40)

# --- Body paragraph alignment ----------------------------------------------
# Flowing body prose is justified so the right margin is flush, which is what
# a printed proposal is expected to look like. Deliberately NOT applied to
# headings, list items, table cells, code, or captions: justifying a short or
# narrow line stretches the word gaps into visible rivers, which looks worse
# than a ragged edge. Set to WD_ALIGN_PARAGRAPH.LEFT to go back to ragged-right.
BODY_ALIGN = WD_ALIGN_PARAGRAPH.JUSTIFY

# --- List indentation (twips; 1440 = 1 inch) --------------------------------
# The master's own numbering defs place level-0 bullet text at 940 twips and
# level-1 at 1660, which reads as a wide tab gap before every list item and
# pushes nested items a third of the way across the page. These values are
# applied directly to each list paragraph (direct w:ind outranks both the
# style and the numbering definition), giving a deliberate 0.25in step per
# level and a tight glyph-to-text gap.
LIST_LEFT_BASE = 576     # level-0 text starts 0.40in in
LIST_LEFT_STEP = 504     # each nested level adds another 0.35in (level 1 = 0.75in)
# The hanging indent doubles as the tab stop between the marker and the text, so
# it must clear the marker the list actually uses, and the two marker kinds are
# nowhere near the same width. A two-digit decimal ("10.") needs 360 twips or
# the text butts straight up against the number. A bullet glyph is a fraction of
# that, and given the same 360 it reads as a tab rather than a bullet. So the
# gap is per format, with text landing at LIST_LEFT_BASE either way.
BULLET_HANGING = 216     # 0.15in, sized to the Symbol bullet glyph
NUMBER_HANGING = 360     # 0.25in, clears a two-digit decimal
LIST_HANGING = NUMBER_HANGING   # widest of the two; lane labels align to it
LIST_MAX_LEVEL = 2       # deepest nesting the converter emits

# A lane or component label (a bold one-line paragraph that heads a list, such
# as "Frontend" above a milestone's work items) sits at the list's GLYPH column,
# not its text column. A list item's w:left is where its text starts, with the
# bullet hanging back by LIST_HANGING, so aligning a label to LIST_LEFT_BASE
# would push it visibly further right than the bullets it introduces.
LANE_LABEL_INDENT = LIST_LEFT_BASE - LIST_HANGING

# Ordered-list geometry from the approved ZENi5 work scope (ported 3.12.0 from
# the reference renderer's 3.5.1). The author picks the list kind by purpose in
# the Markdown, and each ordered kind has one house format:
#   ordered '1. ' flat            decimal, text 720 / hanging 360 twips
#   ordered '1. ' with sub-items  decimal at the template's own indent (no
#                                 direct w:ind), number bold when the item
#                                 leads with a bold label
#   '  - ' under a numbered item  brand Symbol bullet with the glyph under the
#                                 parent's text, text 820 / hanging 360
# Unordered lists keep the LIST_LEFT_BASE geometry above (3.9.0 / 3.10.0).
FLAT_NUM_IND = (720, 360)
SUB_BULLET_IND = (820, 360)

# Closing line (frontmatter `closing:`, e.g. "THANK YOU"): centred, bold, with
# room above it instead of an empty spacer paragraph.
CLOSING_SPACE_BEFORE = Pt(20)

# Lines that force the next block onto a new page.
PAGE_BREAK_LINES = ("\\newpage", "\\pagebreak", "<!-- pagebreak -->")

# Breathing room above the cover title, in twips. 360 twips = 18pt = 24px at
# the usual 96dpi, which is what "24px of space above the title" asks for.
COVER_TITLE_SPACE_BEFORE = 360

# --- Table column sizing ----------------------------------------------------
# Column widths follow content length instead of splitting evenly, so a
# one-word "Status" column stops claiming the same share as a 110-character
# prose column and forcing it to wrap into tall rows. sqrt damping keeps the
# spread sane: a 100-char column gets more room than a 10-char one, but not
# ten times more, because long text wraps and short text cannot.
COL_MIN_FRAC = 0.10      # no column narrower than 10% of the table
COL_MAX_FRAC = 0.60      # no column wider than 60%

# Resolved at runtime so add_picture can find relative image paths.
_SOURCE_DIR: Path | None = None

# Usable text width in inches for embedded images, recomputed per run from
# the template's page width minus margins (master uses 0.5" margins).
_IMAGE_WIDTH_IN: float = 7.4

# Numbering ids resolved from the template's numbering.xml per run.
_BULLET_NUM_ID: int | None = None
_NUMBERING_ROOT = None  # lxml element of word/numbering.xml
_DECIMAL_ABSTRACT_ID: int | None = None


# ---------------------------------------------------------------------------
# Inline span parsing — **bold**, *italic*, `code`, [text](url)
# ---------------------------------------------------------------------------

INLINE_RE = re.compile(
    r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))",
)


def _shade_run(run, hex_color: str) -> None:
    """Apply a background shade to a Run via raw OOXML (``w:shd``)."""
    rpr = run._element.get_or_add_rPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    rpr.append(shd)


def add_inline_runs(paragraph, text: str, *, body_color: bool = True) -> None:
    """Append runs honoring inline emphasis tokens, in brand colors.

    With ``body_color=True`` (default, body paragraphs / lists / cells):
    plain and italic runs are #44515E, bold runs are #0F2A43 (the master's
    "Payment terms:" lead-label pattern). Headings pass ``body_color=False``
    so the paragraph style's own color stays in charge.
    """
    for piece in INLINE_RE.split(text):
        if not piece:
            continue
        if piece.startswith("**") and piece.endswith("**"):
            run = paragraph.add_run(piece[2:-2])
            run.bold = True
            if body_color:
                run.font.color.rgb = INK_RGB
        elif piece.startswith("*") and piece.endswith("*"):
            run = paragraph.add_run(piece[1:-1])
            run.italic = True
            if body_color:
                run.font.color.rgb = BODY_RGB
        elif piece.startswith("`") and piece.endswith("`"):
            run = paragraph.add_run(piece[1:-1])
            # NOT monospace — body font for typographic unity, ink color,
            # light shade so identifiers stay visible.
            run.bold = True
            run.font.color.rgb = INK_RGB
            _shade_run(run, INLINE_CODE_FILL_HEX)
        elif piece.startswith("[") and "](" in piece and piece.endswith(")"):
            label, _url = piece[1:-1].split("](", 1)
            run = paragraph.add_run(label)
            run.font.color.rgb = LINK_RGB
            run.underline = True
        else:
            run = paragraph.add_run(piece)
            if body_color:
                run.font.color.rgb = BODY_RGB


# ---------------------------------------------------------------------------
# Frontmatter
# ---------------------------------------------------------------------------

def parse_frontmatter(lines: list[str]) -> tuple[dict[str, str], int]:
    # Strip UTF-8 BOM (﻿) that Windows tools (PowerShell, Notepad) may prepend.
    if lines:
        lines[0] = lines[0].lstrip("﻿")
    if not lines or lines[0].strip() != "---":
        return {}, 0
    meta: dict[str, str] = {}
    i = 1
    while i < len(lines) and lines[i].strip() != "---":
        line = lines[i]
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip().strip('"').strip("'")
        i += 1
    return meta, i + 1


# ---------------------------------------------------------------------------
# Date helper
# ---------------------------------------------------------------------------

def _auto_date() -> str:
    """Return today's date formatted as '29th May 2026'."""
    today = _date.today()
    day = today.day
    suffix = (
        "th" if 11 <= day <= 13
        else {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    )
    return today.strftime(f"{day}{suffix} %B %Y")


# ---------------------------------------------------------------------------
# Cover page fill (cover mode)
# ---------------------------------------------------------------------------

def _iter_paragraphs(root) -> list:
    """All w:p elements under root, including text boxes inside drawings
    (the cover band text lives in wps:txbx > w:txbxContent > w:p, and is
    duplicated in the mc:AlternateContent fallback branch)."""
    return root.findall(".//" + qn("w:p"))


def _replace_spanning(paragraph, old: str, new: str) -> bool:
    """Replace `old` even when it spans several runs of `paragraph`.

    The first overlapping run receives the replacement text, subsequent
    overlapping runs keep their tails. Yellow placeholder highlights on
    touched runs are removed. Returns True when a replacement happened."""
    runs = [r for r in paragraph.findall(qn("w:r")) if r.find(qn("w:t")) is not None]
    texts = [r.find(qn("w:t")).text or "" for r in runs]
    joined = "".join(texts)
    start = joined.find(old)
    if start == -1:
        return False
    end = start + len(old)

    pos = 0
    replaced = False
    for run, text in zip(runs, texts):
        run_start, run_end = pos, pos + len(text)
        pos = run_end
        if run_end <= start or run_start >= end:
            continue
        t = run.find(qn("w:t"))
        head = text[: max(0, start - run_start)]
        tail = text[max(0, min(len(text), end - run_start)):]
        if not replaced:
            t.text = head + new + tail
            replaced = True
        else:
            t.text = head + tail
        t.set(qn("xml:space"), "preserve")
        rpr = run.find(qn("w:rPr"))
        if rpr is not None:
            for hl in rpr.findall(qn("w:highlight")):
                rpr.remove(hl)
    return True


def _replace_everywhere(root, old: str, new: str) -> int:
    """Run _replace_spanning over every paragraph (covers the duplicated
    AlternateContent branches). Returns the number of replacements."""
    count = 0
    for p in _iter_paragraphs(root):
        # A paragraph may contain the placeholder twice in pathological
        # cases; loop until exhausted.
        while _replace_spanning(p, old, new):
            count += 1
    return count


def _space_above_cover_title(body, title: str) -> None:
    """Add COVER_TITLE_SPACE_BEFORE above the cover title paragraph.

    The title sits tight under the logo in the master. Applied after the
    placeholder has been replaced, so the paragraph is found by its final text,
    and applied to every copy because the cover band's text is duplicated
    inside the drawing's mc:AlternateContent fallback."""
    needle = (title or "").strip()
    if not needle:
        return
    for p in _iter_paragraphs(body):
        text = "".join(t.text or "" for t in p.findall(".//" + qn("w:t")))
        if needle not in text:
            continue
        spacing = _ppr_insert(p.get_or_add_pPr(), "spacing")
        spacing.set(qn("w:before"), str(COVER_TITLE_SPACE_BEFORE))


def _fill_cover(doc: Document, meta: dict[str, str]) -> None:
    """Fill the master cover placeholders from frontmatter.

    Placeholders in wo-cover-template.docx (duplicated in the drawing
    fallback branch, so replacements run document-wide):
      [Workscope & Budget Proposal]  -> title
      Subtext [optional]             -> subtitle (or empty)
      [Today]                        -> date frontmatter or today
      [Client's Name] after "Presented to" -> presented_to / recipient
      [Client's Name] after "Presented By" -> presented_by
                                        (default WebOsmotic Private Limited)
      "valid for 30 days"            -> validity_days override
    """
    body = doc.element.body
    title = meta.get("title", "Document")
    subtitle = meta.get("subtitle", "")
    doc_date = meta.get("date") or _auto_date()
    presented_to = meta.get("presented_to") or meta.get("recipient") or ""
    presented_by = meta.get("presented_by") or "WebOsmotic Private Limited"

    _replace_everywhere(body, "[Workscope & Budget Proposal]", title)
    _replace_everywhere(body, "Subtext [optional]", subtitle)
    _replace_everywhere(body, "[Today]", doc_date)
    _space_above_cover_title(body, title)

    if meta.get("validity_days"):
        days = str(meta["validity_days"]).strip()
        for p in _iter_paragraphs(body):
            for t in p.findall(".//" + qn("w:t")):
                if t.text and "valid for" in t.text:
                    t.text = re.sub(r"valid for \d+", f"valid for {days}", t.text)

    # 'Presented to' and 'Presented By' both use a [Client's Name]
    # placeholder. Walk runs in document order, tracking the last label.
    placeholders = ("[Client’s Name]", "[Client's Name]")
    last_label = ""
    for p in _iter_paragraphs(body):
        for r in p.findall(qn("w:r")):
            t = r.find(qn("w:t"))
            if t is None or not t.text:
                continue
            if "Presented to" in t.text:
                last_label = "to"
            elif "Presented By" in t.text:
                last_label = "by"
            elif t.text.strip() in placeholders:
                value = presented_to if last_label == "to" else presented_by
                t.text = value
                rpr = r.find(qn("w:rPr"))
                if rpr is not None:
                    for hl in rpr.findall(qn("w:highlight")):
                        rpr.remove(hl)


def _strip_yellow_highlights(doc: Document) -> None:
    """Remove any leftover yellow placeholder highlights (e.g. the blank
    spacer run in the cover table that is never filled)."""
    for hl in doc.element.body.findall(".//" + qn("w:highlight")):
        if hl.get(qn("w:val")) == "yellow":
            hl.getparent().remove(hl)


def _strip_casestudy_cover_fields(doc: Document) -> None:
    """For case study documents: blank the 'Presented to', 'Presented By',
    and 'valid for N days' text from the cover band.  Those fields are
    client-proposal-specific and must not appear in portfolio case studies.
    Uses iter() (not findall) so runs nested inside w:ins / w:hyperlink /
    w:smartTag are reached.  Paragraphs are kept so the band layout is
    undisturbed; only the text content is cleared."""
    _STRIP = ("Presented to", "Presented By", "valid for")
    for t in doc.element.body.iter(qn("w:t")):
        if t.text and any(phrase in t.text for phrase in _STRIP):
            t.text = ""


# ---------------------------------------------------------------------------
# TOC pre-render
# ---------------------------------------------------------------------------

def _toc_entry_paragraph(style_id: str, text: str):
    """Build one cached TOC entry paragraph (dot-leader tab, no page no.)."""
    p = OxmlElement("w:p")
    ppr = OxmlElement("w:pPr")
    pstyle = OxmlElement("w:pStyle")
    pstyle.set(qn("w:val"), style_id)
    ppr.append(pstyle)
    tabs = OxmlElement("w:tabs")
    tab = OxmlElement("w:tab")
    tab.set(qn("w:val"), "right")
    tab.set(qn("w:leader"), "dot")
    tab.set(qn("w:pos"), "10710")
    tabs.append(tab)
    ppr.append(tabs)
    spacing = OxmlElement("w:spacing")
    spacing.set(qn("w:after"), "0")
    spacing.set(qn("w:line"), "276")
    spacing.set(qn("w:lineRule"), "auto")
    ppr.append(spacing)
    p.append(ppr)
    run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    fonts = OxmlElement("w:rFonts")
    for attr in ("w:ascii", "w:hAnsi", "w:cs"):
        fonts.set(qn(attr), "Calibri")
    rpr.append(fonts)
    noproof = OxmlElement("w:noProof")
    rpr.append(noproof)
    run.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    t.set(qn("xml:space"), "preserve")
    run.append(t)
    p.append(run)
    tabrun = OxmlElement("w:r")
    tabel = OxmlElement("w:tab")
    tabrun.append(tabel)
    p.append(tabrun)
    return p


def _fld_run(kind: str, instr: str | None = None):
    run = OxmlElement("w:r")
    if kind == "instr":
        el = OxmlElement("w:instrText")
        el.set(qn("xml:space"), "preserve")
        el.text = instr
    else:
        el = OxmlElement("w:fldChar")
        el.set(qn("w:fldCharType"), kind)
    run.append(el)
    return run


def _prerender_toc(doc: Document, headings: list[tuple[int, str]]) -> None:
    """Replace the template TOC SDT's cached content with entries built
    from the markdown's H1/H2 headings. The field instruction
    (TOC \\h \\o "1-2") is preserved, so Word's update-on-open recomputes
    real hyperlinked entries and page numbers."""
    body = doc.element.body
    sdt = body.find(qn("w:sdt"))
    if sdt is None:
        return
    content = sdt.find(qn("w:sdtContent"))
    if content is None:
        return
    for child in list(content):
        content.remove(child)

    entries = [(lvl, text) for lvl, text in headings if lvl in (1, 2)]
    if not entries:
        entries = [(1, "No headings found — add # / ## sections.")]

    paragraphs = []
    for lvl, text in entries:
        paragraphs.append(_toc_entry_paragraph(f"TOC{lvl}", text))

    # Field begin + instruction + separate live at the START of the first
    # entry paragraph. The field END gets its OWN tiny paragraph carrying
    # pageBreakBefore: when Word refreshes the TOC it replaces everything
    # between separate and end but KEEPS this paragraph's pPr, so the
    # residual paragraph keeps forcing content onto the next page with no
    # blank-page risk (an explicit page-break paragraph after the SDT
    # produces a blank page whenever the refreshed TOC fills its page).
    first = paragraphs[0]
    anchor = first.find(qn("w:pPr"))
    insert_at = list(first).index(anchor) + 1
    for offset, run in enumerate((
        _fld_run("begin"),
        _fld_run("instr", 'TOC \\h \\o "1-2"'),
        _fld_run("separate"),
    )):
        first.insert(insert_at + offset, run)

    end_p = OxmlElement("w:p")
    end_ppr = OxmlElement("w:pPr")
    end_ppr.append(OxmlElement("w:pageBreakBefore"))
    end_spacing = OxmlElement("w:spacing")
    end_spacing.set(qn("w:after"), "0")
    end_spacing.set(qn("w:line"), "20")
    end_spacing.set(qn("w:lineRule"), "exact")
    end_ppr.append(end_spacing)
    end_p.append(end_ppr)
    end_p.append(_fld_run("end"))
    paragraphs.append(end_p)

    for p in paragraphs:
        content.append(p)


def _scan_headings(body_lines: list[str]) -> list[tuple[int, str]]:
    """Collect (level, text) for ATX headings outside code fences."""
    headings: list[tuple[int, str]] = []
    in_fence = False
    for line in body_lines:
        if CODE_FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        stripped = line.strip()
        if stripped.startswith("#"):
            level = len(stripped) - len(stripped.lstrip("#"))
            text = stripped[level:].strip()
            if text:
                headings.append((level, text))
    return headings


# ---------------------------------------------------------------------------
# Numbering resolution (bullets / ordered lists)
# ---------------------------------------------------------------------------

def _resolve_numbering(doc: Document) -> None:
    """Find a bullet numId and the decimal abstractNum in the template's
    numbering part, so list paragraphs hook into the brand list defs."""
    global _BULLET_NUM_ID, _NUMBERING_ROOT, _DECIMAL_ABSTRACT_ID
    _BULLET_NUM_ID = None
    _NUMBERING_ROOT = None
    _DECIMAL_ABSTRACT_ID = None
    try:
        numbering = doc.part.numbering_part.element
    except (AttributeError, KeyError, NotImplementedError):
        return
    _NUMBERING_ROOT = numbering

    # Per abstractNum: lvl-0 format and how many bullet levels it defines.
    fmt_by_abstract: dict[str, str] = {}
    depth_by_abstract: dict[str, int] = {}
    for an in numbering.findall(qn("w:abstractNum")):
        aid = an.get(qn("w:abstractNumId"))
        lvls = an.findall(qn("w:lvl"))
        if not lvls:
            continue
        numfmt = lvls[0].find(qn("w:numFmt"))
        if numfmt is not None:
            fmt_by_abstract[aid] = numfmt.get(qn("w:val"))
        depth_by_abstract[aid] = len(lvls)

    # Pick the cleanest bullet num: no lvlOverride (overrides exist for
    # restarted lists, not the brand bullet), deepest level coverage.
    best_score = (-1, -1)
    for num in numbering.findall(qn("w:num")):
        ref = num.find(qn("w:abstractNumId"))
        if ref is None:
            continue
        aid = ref.get(qn("w:val"))
        if fmt_by_abstract.get(aid) != "bullet":
            continue
        num_id = int(num.get(qn("w:numId")))
        no_override = 0 if num.findall(qn("w:lvlOverride")) else 1
        score = (no_override, depth_by_abstract.get(aid, 0))
        if score > best_score:
            best_score = score
            _BULLET_NUM_ID = num_id

    for aid, fmt in fmt_by_abstract.items():
        if fmt == "decimal":
            _DECIMAL_ABSTRACT_ID = int(aid)
            break


def _normalize_list_glyphs() -> None:
    """Give nested list levels a glyph that reads as a bullet and a number.

    Two defects in the master's numbering definitions, both invisible until a
    document actually nests a list:

    1. The bullet abstractNum uses Courier New lowercase ``o`` at level 1.
       On the page that reads as the letter o, not a bullet, so a sub-list
       looks like a typo rather than a level.
    2. The decimal abstractNum defines levels 1 and 2 with an EMPTY
       ``lvlText``, so a nested numbered item renders with no number at all.

    Level 0 is left exactly as the master defines it: the brand Symbol bullet
    and the plain ``%1.`` decimal are correct and must not drift."""
    if _NUMBERING_ROOT is None:
        return

    def _lvl(an, ilvl: int):
        for lvl in an.findall(qn("w:lvl")):
            if lvl.get(qn("w:ilvl")) == str(ilvl):
                return lvl
        return None

    def _set(lvl, *, fmt: str, text: str, face: str | None) -> None:
        numfmt = lvl.find(qn("w:numFmt"))
        if numfmt is None:
            numfmt = OxmlElement("w:numFmt")
            lvl.insert(0, numfmt)
        numfmt.set(qn("w:val"), fmt)
        lvltext = lvl.find(qn("w:lvlText"))
        if lvltext is None:
            lvltext = OxmlElement("w:lvlText")
            numfmt.addnext(lvltext)
        lvltext.set(qn("w:val"), text)
        if face is None:
            return
        rpr = lvl.find(qn("w:rPr"))
        if rpr is None:
            rpr = OxmlElement("w:rPr")
            lvl.append(rpr)
        rfonts = rpr.find(qn("w:rFonts"))
        if rfonts is None:
            rfonts = OxmlElement("w:rFonts")
            rpr.insert(0, rfonts)
        for attr in ("w:ascii", "w:hAnsi", "w:cs"):
            rfonts.set(qn(attr), face)

    for an in _NUMBERING_ROOT.findall(qn("w:abstractNum")):
        lvls = an.findall(qn("w:lvl"))
        if not lvls:
            continue
        first = lvls[0].find(qn("w:numFmt"))
        kind = first.get(qn("w:val")) if first is not None else None

        if kind == "bullet":
            lvl1 = _lvl(an, 1)
            if lvl1 is not None:                      # Wingdings small filled square
                _set(lvl1, fmt="bullet", text="", face="Wingdings")
            lvl2 = _lvl(an, 2)
            if lvl2 is not None:                      # Symbol hollow bullet
                _set(lvl2, fmt="bullet", text="", face="Symbol")

        elif kind == "decimal":
            for ilvl, (fmt, text) in enumerate(
                ((None, None), ("lowerLetter", "%2."), ("lowerRoman", "%3.")),
            ):
                if fmt is None:
                    continue
                lvl = _lvl(an, ilvl)
                if lvl is None:
                    continue
                existing = lvl.find(qn("w:lvlText"))
                if existing is None or not (existing.get(qn("w:val")) or "").strip():
                    _set(lvl, fmt=fmt, text=text, face=None)


def _new_decimal_num_id() -> int | None:
    """Allocate a fresh w:num for an ordered-list block with a
    startOverride so every list restarts at 1."""
    if _NUMBERING_ROOT is None or _DECIMAL_ABSTRACT_ID is None:
        return None
    existing = [
        int(n.get(qn("w:numId")))
        for n in _NUMBERING_ROOT.findall(qn("w:num"))
    ]
    new_id = max(existing, default=0) + 1
    num = OxmlElement("w:num")
    num.set(qn("w:numId"), str(new_id))
    ref = OxmlElement("w:abstractNumId")
    ref.set(qn("w:val"), str(_DECIMAL_ABSTRACT_ID))
    num.append(ref)
    override = OxmlElement("w:lvlOverride")
    override.set(qn("w:ilvl"), "0")
    start = OxmlElement("w:startOverride")
    start.set(qn("w:val"), "1")
    override.append(start)
    num.append(override)
    nums = _NUMBERING_ROOT.findall(qn("w:num"))
    if nums:
        nums[-1].addnext(num)
    else:
        _NUMBERING_ROOT.append(num)
    return new_id


def _apply_list_format(
    p,
    *,
    num_id: int,
    level: int,
    hanging: int = LIST_HANGING,
    ind: tuple[int, int] | None = None,
    template_indent: bool = False,
    bold_number: bool = False,
) -> None:
    """Attach numbering and line spacing to a list paragraph.

    Every child goes in via _ppr_insert so this stays schema-ordered no matter
    what else has already been set on the paragraph. Raw ``ppr.append`` here
    used to place numPr and spacing AFTER a previously inserted
    contextualSpacing, which Word treats as a corrupt pPr and silently repairs
    (dropping the properties, restoring the double-gapped list).

    before/after are deliberately left to the ListParagraph style so
    _collapse_within_list can collapse them between siblings.

    Indent: ``ind`` (left, hanging) sets an explicit geometry,
    ``template_indent`` leaves the numbering definition's own indent in force
    (the grouped ordered list of the ZENi5 house format), and otherwise the
    LIST_LEFT_BASE geometry applies. ``bold_number`` bolds the list number,
    which Word draws in the paragraph mark's character format."""
    ppr = p._p.get_or_add_pPr()
    numpr = _ppr_insert(ppr, "numPr")
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), str(level))
    numpr.append(ilvl)
    numid = OxmlElement("w:numId")
    numid.set(qn("w:val"), str(num_id))
    numpr.append(numid)
    spacing = _ppr_insert(ppr, "spacing")
    spacing.set(qn("w:line"), "276")
    spacing.set(qn("w:lineRule"), "auto")
    # Direct indent, so neither the ListParagraph style nor the numbering
    # definition's own w:ind can reintroduce the master's wide tab gap.
    if not template_indent:
        ind_el = _ppr_insert(ppr, "ind")
        if ind is not None:
            ind_el.set(qn("w:left"), str(ind[0]))
            ind_el.set(qn("w:hanging"), str(ind[1]))
        else:
            ind_el.set(qn("w:left"), str(LIST_LEFT_BASE + LIST_LEFT_STEP * level))
            ind_el.set(qn("w:hanging"), str(hanging))
    if bold_number:
        mark = _ppr_insert(ppr, "rPr")
        if mark.find(qn("w:b")) is None:
            mark.append(OxmlElement("w:b"))


# ---------------------------------------------------------------------------
# Block rendering
# ---------------------------------------------------------------------------

CODE_FENCE = re.compile(r"^```(\w*)\s*$")
TABLE_ALIGN = re.compile(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")
IMAGE_LINE = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$")


def _style_or_none(doc: Document, *names: str):
    """Return the first style NAME that exists in the doc, else None."""
    available = {s.name for s in doc.styles if s.name}
    for n in names:
        if n in available:
            return n
    return None


# --- Vertical rhythm -------------------------------------------------------
# One 4pt base grid. Every block gap is a step on it, so the same relationship
# always gets the same value. SPACE_SM equals the master's Normal
# spacing after=160 twips, which keeps script-set gaps in step with the
# template's own paragraph rhythm instead of drifting 2pt either side of it.
SPACE_XS = Pt(4)    # inside a container (code cell padding)
SPACE_SM = Pt(8)    # the standard block gap
SPACE_MD = Pt(12)   # a block deliberately separated from what precedes it

# CT_PPr child order per the OOXML schema. Appending out of order produces a
# file Word repairs on open (silently dropping the offending property), so
# every raw pPr child goes in through _ppr_insert.
_PPR_ORDER = (
    "pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr",
    "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs",
    "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct",
    "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd",
    "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents",
    "suppressOverlap", "jc", "textDirection", "textAlignment",
    "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr",
    "pPrChange",
)


def _ppr_insert(ppr, tag: str):
    """Insert (or return the existing) pPr child at its schema position.

    Returns the element so the caller can set attributes on it."""
    existing = ppr.find(qn(f"w:{tag}"))
    if existing is not None:
        return existing
    el = OxmlElement(f"w:{tag}")
    try:
        rank = _PPR_ORDER.index(tag)
    except ValueError:
        ppr.append(el)
        return el
    for child in ppr:
        child_tag = child.tag.split("}")[-1]
        child_rank = (
            _PPR_ORDER.index(child_tag) if child_tag in _PPR_ORDER else len(_PPR_ORDER)
        )
        if child_rank > rank:
            child.addprevious(el)
            return el
    ppr.append(el)
    return el


def _ends_ordered_list(line: str) -> bool:
    """True when `line` closes an ordered list rather than continuing it.

    A numbered list survives its own children: the indented bullets, wrapped
    lines, and sub-paragraphs belonging to the current item, plus the blank
    lines between items. Resetting the active numId on ANY non-numbered line
    (the original behaviour) handed every item its own restarting list, so a
    numbered list with nested bullets rendered as "1." over and over instead
    of 1, 2, 3. Only flush-left, non-blank content genuinely ends the list."""
    if not line.strip():
        return False                                  # blank line: list continues
    if len(line) - len(line.lstrip(" ")) >= 2:
        return False                                  # indented child content
    return True


def _starts_block(body: list[str], i: int) -> bool:
    """True when body[i] opens a new block rather than continuing the current one.

    Markdown soft-wrap means consecutive non-blank lines are ONE paragraph. This
    is the test that decides where a wrapped block actually ends."""
    line = body[i]
    stripped = line.strip()
    if not stripped or stripped == "---" or stripped in PAGE_BREAK_LINES:
        return True
    if stripped.startswith("#") or stripped.startswith(">"):
        return True
    if CODE_FENCE.match(line) or IMAGE_LINE.match(stripped):
        return True
    if re.match(r"^(\s*)([-*])\s+", line) or re.match(r"^(\s*)\d+\.\s+", line):
        return True
    if (
        "|" in stripped
        and i + 1 < len(body)
        and TABLE_ALIGN.match(body[i + 1].strip())
    ):
        return True
    return False


def _gather_wrapped(body: list[str], i: int, *, first: str | None = None) -> tuple[str, int]:
    """Join a soft-wrapped block into one string. Returns (text, next_index).

    Without this every wrapped source line became its own DOCX paragraph (or,
    for a wrapped list item, a body paragraph that dropped out of the list),
    which is what produced the stubby paragraphs, the spurious gaps between
    them, and the broken bullets.

    ``first`` supplies the opening line already stripped of its list marker."""
    parts = [first if first is not None else body[i].strip()]
    j = i + 1
    while j < len(body) and not _starts_block(body, j):
        parts.append(body[j].strip())
        j += 1
    return " ".join(p for p in parts if p), j


def _assert_ppr_schema_order(doc: Document) -> None:
    """Fail the build if any pPr has its children out of schema order.

    Word does not report this. It silently "repairs" the paragraph by dropping
    the offending properties, so the file opens looking subtly wrong (lists
    double-gapped, headings unbound) with nothing to point at. Catching it here
    turns an invisible formatting regression into a build error.

    Any future edit that reaches for a raw ``ppr.append`` instead of
    _ppr_insert trips this."""
    offenders: list[str] = []
    for ppr in doc.element.body.iter(qn("w:pPr")):
        ranks = []
        tags = []
        for child in ppr:
            tag = child.tag.split("}")[-1]
            if tag in _PPR_ORDER:
                ranks.append(_PPR_ORDER.index(tag))
                tags.append(tag)
        if ranks != sorted(ranks):
            offenders.append(" > ".join(tags))
    if offenders:
        shown = "\n  ".join(sorted(set(offenders))[:5])
        raise RuntimeError(
            f"{len(offenders)} paragraph(s) have out-of-order pPr children. "
            "Word would silently drop these properties. Use _ppr_insert "
            f"instead of ppr.append.\n  {shown}"
        )


def _keep_with_next(p) -> None:
    """Bind a paragraph to the one after it, and stop it splitting mid-block.

    Without this a heading can be the last line on a page while its content
    starts on the next, and a code label can separate from its code."""
    ppr = p._p.get_or_add_pPr()
    _ppr_insert(ppr, "keepNext")
    _ppr_insert(ppr, "keepLines")


def _collapse_within_list(p) -> None:
    """Suppress the ListParagraph style's before/after spacing BETWEEN items of
    the same list, while keeping it before the first item and after the last.

    The master's ListParagraph carries before=120 after=120 and no
    contextualSpacing, so without this every pair of adjacent bullets is 12pt
    apart and a list reads as a stack of separate paragraphs."""
    ppr = p._p.get_or_add_pPr()
    _ppr_insert(ppr, "contextualSpacing")


def _add_spacer(doc: Document) -> None:
    """Deterministic gap after a table or code block.

    A bare ``doc.add_paragraph()`` inherits Normal, so it contributes a full
    ~12pt empty text line PLUS 8pt after, and the next block then adds its own
    space_before. Pinning the line height to an exact 2pt makes the gap the
    single SPACE_SM step instead."""
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = SPACE_SM
    pf.line_spacing = Pt(2)  # exact: removes the empty line's own height


def add_page_break(doc: Document) -> None:
    p = doc.add_paragraph()
    run = p.add_run()
    run.add_break(WD_BREAK.PAGE)


def add_heading(doc: Document, level: int, text: str, *, page_break: bool = False) -> None:
    """Heading styled by NAME so the template's styles.xml drives color and
    font (H1 Arial 15pt #0F2A43, H2 Arial 12pt #2E75B6, H3 Arial 11pt).
    The master flows sections continuously; ``page_break`` (set by a
    standalone ``\\newpage`` line before the heading) starts it on a new page."""
    style_name = {1: "Heading 1", 2: "Heading 2"}.get(level, "Heading 3")
    p = doc.add_paragraph()
    name = _style_or_none(doc, style_name, "Heading 1")
    if name:
        p.style = doc.styles[name]
    _keep_with_next(p)
    if page_break:
        _ppr_insert(p._p.get_or_add_pPr(), "pageBreakBefore")
    add_inline_runs(p, text, body_color=False)


def add_paragraph(doc: Document, text: str, *, lane_label: bool = False) -> None:
    """Flowing body prose, justified per BODY_ALIGN.

    Only this block type is justified. List items, table cells, captions, and
    code keep their natural alignment because their lines are short or narrow
    enough that stretching them opens visible rivers of white space.

    ``lane_label`` marks a bold one-line paragraph that heads a list (a
    milestone lane such as "Frontend", a component name above its features).
    It is indented to the list's own level and bound to what follows, so the
    label and its items read as one block instead of two unrelated ones."""
    p = doc.add_paragraph()
    if lane_label:
        ind = _ppr_insert(p._p.get_or_add_pPr(), "ind")
        ind.set(qn("w:left"), str(LANE_LABEL_INDENT))
        # Hug the list it introduces. Left at the Normal style's 8pt after,
        # the label floats midway between its own items and the block above,
        # so it reads as a stray line rather than a heading for what follows.
        pf = p.paragraph_format
        pf.space_before = SPACE_MD
        pf.space_after = Pt(2)
        _keep_with_next(p)
    else:
        p.paragraph_format.alignment = BODY_ALIGN
    add_inline_runs(p, text)


LANE_LABEL_RE = re.compile(r"^\*\*[^*]+\*\*:?$")


def _is_lane_label(text: str, body: list[str], next_i: int) -> bool:
    """True when `text` is a bold-only line that introduces a list.

    Requiring a list to follow is what stops a standalone bold line (a closing
    "**THANK YOU**", a bold pull-quote) from being indented as if it headed
    something."""
    if not LANE_LABEL_RE.match(text.strip()):
        return False
    for j in range(next_i, min(next_i + 3, len(body))):
        line = body[j]
        if not line.strip():
            continue
        return bool(re.match(r"^(\s*)([-*])\s+", line) or re.match(r"^(\s*)\d+\.\s+", line))
    return False


def add_quote(doc: Document, text: str) -> None:
    """Blockquote: indented italic body text with a blue left-border accent.

    The master's own `Quote` style is white 13pt (made for the dark cover
    band), so it is unusable for body blockquotes."""
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Pt(18)
    pf.space_before = SPACE_SM
    pf.space_after = SPACE_SM
    ppr = p._p.get_or_add_pPr()
    pbdr = _ppr_insert(ppr, "pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "12")
    left.set(qn("w:space"), "8")
    left.set(qn("w:color"), "2E75B6")
    pbdr.append(left)
    add_inline_runs(p, text)
    for run in p.runs:
        run.italic = True


_LIST_ITEM = re.compile(r"^(?:[-*]|\d+\.)\s+")


def _list_has_sub_items(body: list[str], start: int) -> bool:
    """True when the ordered list opening at body[start] carries an indented
    list item ('  - ' or '  1. ') before the list ends.

    Soft-wrapped continuation lines (indented, no marker) are skipped rather
    than read as the end of the list. A flush-left line that is not a numbered
    item ends the scan."""
    for raw in body[start:]:
        stripped = raw.strip()
        if not stripped:
            continue
        indented = len(raw) - len(raw.lstrip(" ")) >= 2
        if _LIST_ITEM.match(stripped):
            if indented:
                return True
            if not re.match(r"^\d+\.\s+", stripped):
                return False
            continue
        if not indented:
            return False
    return False


def add_bullet(doc: Document, text: str, level: int, *, under_number: bool = False) -> None:
    """Bullet item. A nested bullet under a numbered item (``under_number``)
    uses the level-0 brand Symbol glyph aligned under the parent's text
    (SUB_BULLET_IND), the ZENi5 house format for feature modules and
    milestone lanes."""
    name = _style_or_none(doc, "List Paragraph")
    p = doc.add_paragraph(style=name) if name else doc.add_paragraph()
    _collapse_within_list(p)
    if _BULLET_NUM_ID is not None:
        if level >= 1 and under_number:
            _apply_list_format(p, num_id=_BULLET_NUM_ID, level=0, ind=SUB_BULLET_IND)
        else:
            _apply_list_format(p, num_id=_BULLET_NUM_ID, level=level, hanging=BULLET_HANGING)
        add_inline_runs(p, text)
    else:
        add_inline_runs(p, ("•  " if level == 0 else "–  ") + text)


def add_number(doc: Document, text: str, level: int, num_id: int | None, *, flat: bool = False) -> None:
    """Numbered item. A flat list (no sub-items) uses FLAT_NUM_IND. A grouped
    list (items carrying nested bullets) keeps the template indent. Either way
    the number is bold when the item leads with a bold label."""
    name = _style_or_none(doc, "List Paragraph")
    p = doc.add_paragraph(style=name) if name else doc.add_paragraph()
    _collapse_within_list(p)
    if num_id is not None:
        _apply_list_format(
            p,
            num_id=num_id,
            level=level,
            ind=FLAT_NUM_IND if flat else None,
            template_indent=not flat,
            bold_number=text.lstrip().startswith("**"),
        )
    add_inline_runs(p, text)


# ---- Tables ----------------------------------------------------------------

def split_cells(line: str) -> list[str]:
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    cells: list[str] = []
    buf = ""
    i = 0
    while i < len(stripped):
        ch = stripped[i]
        if ch == "\\" and i + 1 < len(stripped) and stripped[i + 1] == "|":
            buf += "|"
            i += 2
            continue
        if ch == "|":
            cells.append(buf.strip())
            buf = ""
        else:
            buf += ch
        i += 1
    cells.append(buf.strip())
    return cells


def _set_cell_margins(cell, *, top: int, right: int, bottom: int, left: int) -> None:
    """Inner cell padding in twentieths of a point (dxa)."""
    tc_pr = cell._tc.get_or_add_tcPr()
    for prior in tc_pr.findall(qn("w:tcMar")):
        tc_pr.remove(prior)
    tc_mar = OxmlElement("w:tcMar")
    for side, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:w"), str(val))
        el.set(qn("w:type"), "dxa")
        tc_mar.append(el)
    tc_pr.append(tc_mar)


def _set_cell_borders(cell) -> None:
    """Single 0.125pt #C9D4DF border on all four sides (master spec)."""
    tc_pr = cell._tc.get_or_add_tcPr()
    for prior in tc_pr.findall(qn("w:tcBorders")):
        tc_pr.remove(prior)
    borders = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "1")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), BORDER_HEX)
        borders.append(el)
    tc_pr.append(borders)


def _set_cell_fill(cell, hex_color: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def _set_cell_valign_center(cell) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    valign = OxmlElement("w:vAlign")
    valign.set(qn("w:val"), "center")
    tc_pr.append(valign)


def _set_cell_width_pct(cell, pct_5000: int) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    for prior in tc_pr.findall(qn("w:tcW")):
        tc_pr.remove(prior)
    tcw = OxmlElement("w:tcW")
    tcw.set(qn("w:w"), str(pct_5000))
    tcw.set(qn("w:type"), "pct")
    tc_pr.append(tcw)


def _set_table_props(table) -> None:
    """Full-width pct table with #C9D4DF grid (master body-table spec)."""
    tbl = table._tbl
    tblPr = tbl.find(qn("w:tblPr"))
    if tblPr is None:
        tblPr = OxmlElement("w:tblPr")
        tbl.insert(0, tblPr)
    for tag in ("w:tblW", "w:tblBorders", "w:tblCellMar", "w:tblStyle", "w:tblLayout"):
        for el in tblPr.findall(qn(tag)):
            tblPr.remove(el)
    tblw = OxmlElement("w:tblW")
    tblw.set(qn("w:w"), "5000")
    tblw.set(qn("w:type"), "pct")
    tblPr.append(tblw)
    borders = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "1")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), BORDER_HEX)
        borders.append(el)
    tblPr.append(borders)
    # Fixed layout, so Word honours the per-column widths instead of
    # re-autofitting them to content and undoing the sizing above.
    # (tblPr child order is fixed by the schema: tblW, tblBorders, tblLayout,
    # tblCellMar.)
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tblPr.append(layout)
    cellmar = OxmlElement("w:tblCellMar")
    for side in ("left", "right"):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:w"), "10")
        el.set(qn("w:type"), "dxa")
        cellmar.append(el)
    tblPr.append(cellmar)


def _mark_repeat_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tr_pr.append(tbl_header)


BOLD_LABEL_RE = re.compile(r"^\*\*[^*]+\*\*:?$")
LABEL_FILL_HEX = "EEF3F8"  # master's label-column tint (case-study tables)

_MD_MARKUP_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)|[*`_]")


def _plain_len(cell: str) -> int:
    """Rendered character count, ignoring markdown syntax.

    ``**Status**`` is six visible characters, not ten, and a link renders as
    its label rather than its URL. Measuring the raw source would hand width
    to whichever column happened to use the most markup."""
    return len(_MD_MARKUP_RE.sub(lambda m: m.group(1) or "", cell).strip())


def _content_col_pcts(header: list[str], body: list[list[str]], ncols: int) -> list[int]:
    """Column widths in fiftieths of a percent, proportional to content.

    Even splitting is what makes rows tall: a one-word column holds a third of
    a three-column table while the prose columns beside it wrap four lines
    deep. Width here follows the longest cell in each column, damped by sqrt
    so the spread stays sane (long text wraps, short text cannot), then
    clamped into [COL_MIN_FRAC, COL_MAX_FRAC] and renormalised to exactly
    100%."""
    longest = [1] * ncols
    for row in [header] + body:
        for j in range(min(len(row), ncols)):
            longest[j] = max(longest[j], _plain_len(row[j]))

    damped = [math.sqrt(w) for w in longest]
    total = sum(damped) or 1.0
    fracs = [d / total for d in damped]

    # Clamp, then push the residual onto whichever columns are still free to
    # move. Iterated because clamping one column can shove another past a bound.
    lo, hi = COL_MIN_FRAC, min(COL_MAX_FRAC, 1.0)
    if ncols * lo > 1.0:                       # too many columns to honour the floor
        lo = 1.0 / ncols
    for _ in range(8):
        fracs = [min(max(f, lo), hi) for f in fracs]
        residual = 1.0 - sum(fracs)
        if abs(residual) < 1e-6:
            break
        movable = [
            j for j, f in enumerate(fracs)
            if (residual > 0 and f < hi) or (residual < 0 and f > lo)
        ]
        if not movable:
            break
        share = residual / len(movable)
        for j in movable:
            fracs[j] += share

    pcts = [int(round(f * 5000)) for f in fracs]
    pcts[-1] += 5000 - sum(pcts)               # absorb rounding drift
    return pcts


def add_table(doc: Document, rows: list[str]) -> None:
    """Master-spec table: full width, hairline #C9D4DF grid, #0F2A43 header
    band with white bold 10pt text, #44515E 10pt body cells.

    Headerless tables: an all-empty header row (``| | |``) suppresses the
    ink band entirely. When such a table has 2 columns and every first
    cell is a bold ``**Label**``, the label column gets the master's
    case-study treatment: #EEF3F8 tint, bold ink text, ~24/76 width split."""
    header = split_cells(rows[0])
    has_header = any(c.strip() for c in header)
    body = [split_cells(line) for line in rows[2:]]
    ncols = max(len(header), max((len(r) for r in body), default=0))
    if ncols == 0 or not body and not has_header:
        return

    label_column = (
        not has_header
        and ncols == 2
        and bool(body)
        and all(r and BOLD_LABEL_RE.match(r[0].strip()) for r in body)
    )
    if label_column:
        col_pcts = [1175, 3825]  # master case-study ratio
    else:
        col_pcts = _content_col_pcts(header, body, ncols)

    n_rows = (1 if has_header else 0) + len(body)
    table = doc.add_table(rows=n_rows, cols=ncols)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _set_table_props(table)

    # ---- Header row (only when the header has content) ----------------------
    if has_header:
        _mark_repeat_header(table.rows[0])
        for j in range(ncols):
            cell = table.rows[0].cells[j]
            cell.text = ""
            _set_cell_width_pct(cell, col_pcts[j])
            _set_cell_borders(cell)
            _set_cell_fill(cell, INK_HEX)
            _set_cell_margins(cell, top=90, right=130, bottom=90, left=130)
            _set_cell_valign_center(cell)
            para = cell.paragraphs[0]
            para.paragraph_format.space_before = Pt(0)
            para.paragraph_format.space_after = Pt(0)
            para.paragraph_format.line_spacing = 1.1
            # Keeps a header band from being the last thing on a page.
            _keep_with_next(para)
            add_inline_runs(para, header[j] if j < len(header) else "",
                            body_color=False)
            for run in para.runs:
                run.bold = True
                run.font.size = Pt(10)
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    # ---- Body rows ---------------------------------------------------------
    start = 1 if has_header else 0
    for i, body_row in enumerate(body, start=start):
        for j in range(ncols):
            cell = table.rows[i].cells[j]
            cell.text = ""
            _set_cell_width_pct(cell, col_pcts[j])
            _set_cell_borders(cell)
            if label_column and j == 0:
                _set_cell_fill(cell, LABEL_FILL_HEX)
            _set_cell_margins(cell, top=80, right=130, bottom=80, left=130)
            _set_cell_valign_center(cell)
            para = cell.paragraphs[0]
            pf_spacing = para.paragraph_format
            pf_spacing.space_before = Pt(0)
            pf_spacing.space_after = Pt(0)
            pf_spacing.line_spacing = 1.1
            add_inline_runs(para, body_row[j] if j < len(body_row) else "")
            for run in para.runs:
                if run.font.size is None:
                    run.font.size = Pt(10)

    _add_spacer(doc)


# ---- Code blocks -----------------------------------------------------------

def _add_code_cell_borders(cell) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for side, sz, color in (
        ("top", 4, BORDER_HEX),
        ("left", 24, INK_HEX),
        ("bottom", 4, BORDER_HEX),
        ("right", 4, BORDER_HEX),
    ):
        el = OxmlElement(f"w:{side}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(sz))
        el.set(qn("w:color"), color)
        borders.append(el)
    tc_pr.append(borders)


def add_code_block(doc: Document, code: str, language: str) -> None:
    if language:
        lbl = doc.add_paragraph()
        lbl.paragraph_format.space_before = SPACE_MD
        lbl.paragraph_format.space_after = Pt(0)
        # The language tag is meaningless detached from its block.
        _keep_with_next(lbl)
        lrun = lbl.add_run(language.lower())
        lrun.italic = True
        lrun.font.size = Pt(9)
        lrun.font.color.rgb = RGBColor(0x8A, 0x97, 0xA4)

    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    _set_table_props(table)
    cell = table.rows[0].cells[0]
    _set_cell_fill(cell, CODE_FILL_HEX)
    _add_code_cell_borders(cell)
    _set_cell_margins(cell, top=80, right=130, bottom=80, left=130)

    cell.text = ""
    para = cell.paragraphs[0]
    para.paragraph_format.space_before = SPACE_XS
    para.paragraph_format.space_after = SPACE_XS
    para.paragraph_format.left_indent = Pt(6)
    # Code lines are one paragraph joined by breaks, so this is the leading
    # BETWEEN lines. Exact 12pt on a 9.5pt font scans as a block; inheriting
    # Normal's 1.08 auto leaves it too airy to read as code.
    para.paragraph_format.line_spacing = Pt(12)

    lines = code.split("\n")
    if lines and lines[-1] == "":
        lines = lines[:-1]
    for i, line in enumerate(lines):
        if i > 0:
            run = para.add_run()
            run.add_break()
        run = para.add_run(line if line else " ")
        run.font.name = "Consolas"
        run.font.size = Pt(9.5)
        run.font.color.rgb = CODE_TEXT_RGB
        rpr = run._element.get_or_add_rPr()
        rfonts = rpr.find(qn("w:rFonts"))
        if rfonts is None:
            rfonts = OxmlElement("w:rFonts")
            rpr.append(rfonts)
        rfonts.set(qn("w:ascii"), "Consolas")
        rfonts.set(qn("w:hAnsi"), "Consolas")
        rfonts.set(qn("w:cs"), "Consolas")

    _add_spacer(doc)


# ---- Images ----------------------------------------------------------------

def add_image(doc: Document, alt: str, image_path: str) -> None:
    """Embed an image, centered, at a width that fits the page."""
    if _SOURCE_DIR is None:
        raise RuntimeError("_SOURCE_DIR not set; can't resolve image path")
    resolved = (_SOURCE_DIR / image_path).resolve()
    if not resolved.exists():
        print(f"WARN: image not found: {resolved}")
        p = doc.add_paragraph()
        run = p.add_run(f"[missing image: {alt}]")
        run.italic = True
        run.font.color.rgb = RGBColor(0xAA, 0x00, 0x00)
        return
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = SPACE_MD
    p.paragraph_format.space_after = Pt(0) if alt else SPACE_SM
    if alt:
        # A caption on the next page from its figure is worse than no caption.
        _keep_with_next(p)
    run = p.add_run()
    run.add_picture(str(resolved), width=Inches(_IMAGE_WIDTH_IN))
    if alt:
        cap = doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.space_before = SPACE_XS
        cap.paragraph_format.space_after = SPACE_SM
        cr = cap.add_run(alt)
        cr.italic = True
        cr.font.size = Pt(10)
        cr.font.color.rgb = RGBColor(0x8A, 0x97, 0xA4)


# ---------------------------------------------------------------------------
# Template plumbing
# ---------------------------------------------------------------------------

def _remove_content_marker(doc: Document) -> None:
    """Delete the {{CONTENT}} placeholder paragraph the template carries.
    Appended content lands AFTER the marker but BEFORE the trailing sectPr.
    The page break before the content comes from the TOC's field-end
    paragraph (see _prerender_toc), so nothing else is needed here."""
    for p in doc.paragraphs:
        if p.text.strip() == "{{CONTENT}}":
            p._element.getparent().remove(p._element)
            return


def _set_image_width_from_section(doc: Document) -> None:
    """Usable image width = page width minus margins, minus a hair so
    images never kiss the margin edge."""
    global _IMAGE_WIDTH_IN
    try:
        sec = doc.sections[0]
        usable_emu = sec.page_width - sec.left_margin - sec.right_margin
        _IMAGE_WIDTH_IN = max(4.0, round(usable_emu / 914400, 2) - 0.1)
    except Exception:
        _IMAGE_WIDTH_IN = 6.5


def _stamp_year(doc: Document) -> None:
    """Refresh the copyright year in the footer and in dc:creator (the
    footer's left cell is an SDT data-bound to the creator property)."""
    year = _date.today().year
    notice = f"© {year} WebOsmotic. All rights reserved."
    doc.core_properties.author = notice
    for rel in doc.part.rels.values():
        if rel.reltype.endswith("/footer") or rel.reltype.endswith("/header"):
            for t in rel.target_part.element.iter(qn("w:t")):
                if t.text and "©" in t.text:
                    t.text = re.sub(r"©\s*\d{4}", f"© {year}", t.text)


# ---------------------------------------------------------------------------
# Main conversion
# ---------------------------------------------------------------------------

def _ensure_templates_fresh() -> None:
    """Rebuild the generated wo-* templates when the master document or the
    builder script is newer than they are (e.g. a `git pull` just shipped a
    new master). Every skill trigger self-heals; no manual rebuild step."""
    master = TEMPLATES_DIR / "webosmotic-master.docx"
    builder = Path(__file__).resolve().parent / "build_wo_templates.py"
    if not master.exists() or not builder.exists():
        return
    src_mtime = max(master.stat().st_mtime, builder.stat().st_mtime)
    stale = any(
        (not t.exists()) or t.stat().st_mtime < src_mtime
        for t in TEMPLATE_BY_MODE.values()
    )
    if not stale:
        return
    import importlib.util
    spec = importlib.util.spec_from_file_location("build_wo_templates", builder)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.main()
    print("Rebuilt wo-* templates (master/builder was newer than the generated templates).")


def convert(
    src_path: Path,
    out_path: Path,
    *,
    mode: str = "plain",
    template: Path | None = None,
) -> None:
    global _SOURCE_DIR
    _SOURCE_DIR = src_path.parent.resolve()
    raw = src_path.read_text(encoding="utf-8")
    lines = raw.split("\n")

    meta, start = parse_frontmatter(lines)
    body = lines[start:]

    # Case studies: skip the H1 title, inline metadata (bold key: value lines),
    # blockquotes, and any blank lines that precede the first ## section.
    # That pre-content lives on the cover page; rendering it again would
    # produce a duplicate heading and stray metadata on page 3.
    if str(meta.get("case_study", "")).lower() in ("true", "yes", "1"):
        try:
            first_section = next(
                i for i, l in enumerate(body) if l.startswith("## ")
            )
            body = body[first_section:]
        except StopIteration:
            pass

    if template is None:
        _ensure_templates_fresh()
    tpl = template or TEMPLATE_BY_MODE.get(mode)
    if tpl is None or not Path(tpl).exists():
        raise FileNotFoundError(
            f"Template for mode '{mode}' not found: {tpl}. "
            "Run scripts/build_wo_templates.py first."
        )

    doc = Document(str(tpl))
    _set_image_width_from_section(doc)
    _resolve_numbering(doc)
    _normalize_list_glyphs()

    if mode == "cover":
        _fill_cover(doc, meta)
        if str(meta.get("case_study", "")).lower() in ("true", "yes", "1"):
            _strip_casestudy_cover_fields(doc)

    _prerender_toc(doc, _scan_headings(body))

    i = 0
    active_ordered_num: int | None = None
    active_ordered_flat = False  # the running ordered list has no sub-items
    pending_break = False  # set by a standalone \newpage line, consumed by the next block
    while i < len(body):
        line = body[i]
        stripped = line.strip()

        is_numbered = bool(re.match(r"^(\s*)\d+\.\s+", line))
        if (
            not is_numbered
            and _ends_ordered_list(line)
            # A lane label between two numbered groups is a sub-heading INSIDE
            # the list, not the end of it. Without this, a question list broken
            # into themed groups restarts at 1 under every label instead of
            # running 1..N, so "question 3" names three different questions.
            and not _is_lane_label(line.strip(), body, i + 1)
        ):
            active_ordered_num = None

        # Horizontal rule — skip (the chrome carries the visual rhythm).
        if stripped == "---":
            i += 1
            continue

        if not stripped:
            i += 1
            continue

        if stripped in PAGE_BREAK_LINES:
            active_ordered_num = None
            pending_break = True
            i += 1
            continue
        if pending_break and not stripped.startswith("#"):
            add_page_break(doc)
            pending_break = False

        m = IMAGE_LINE.match(stripped)
        if m:
            add_image(doc, m.group(1), m.group(2))
            i += 1
            continue

        m = CODE_FENCE.match(line)
        if m:
            language = m.group(1)
            i += 1
            buf: list[str] = []
            while i < len(body) and not CODE_FENCE.match(body[i]):
                buf.append(body[i])
                i += 1
            i += 1  # skip closing fence
            add_code_block(doc, "\n".join(buf), language)
            continue

        if stripped.startswith("#"):
            level = len(stripped) - len(stripped.lstrip("#"))
            add_heading(doc, level, stripped[level:].strip(), page_break=pending_break)
            pending_break = False
            i += 1
            continue

        if "|" in stripped and i + 1 < len(body) and TABLE_ALIGN.match(body[i + 1].strip()):
            rows = [line, body[i + 1]]
            j = i + 2
            while j < len(body) and body[j].strip().startswith("|"):
                rows.append(body[j])
                j += 1
            add_table(doc, rows)
            i = j
            continue

        if stripped.startswith(">"):
            # Consecutive "> " lines are ONE blockquote, not one per line.
            quote_parts = []
            while i < len(body) and body[i].strip().startswith(">"):
                quote_parts.append(body[i].strip().lstrip("> ").strip())
                i += 1
            add_quote(doc, " ".join(p for p in quote_parts if p))
            continue

        if re.match(r"^(\s*)([-*])\s+", line):
            indent = len(line) - len(line.lstrip(" "))
            level = 1 if indent >= 2 else 0
            first = re.sub(r"^(\s*)([-*])\s+", "", line).strip()
            text, i = _gather_wrapped(body, i, first=first)
            add_bullet(doc, text, level, under_number=(active_ordered_num is not None))
            continue

        if is_numbered:
            indent = len(line) - len(line.lstrip(" "))
            level = 1 if indent >= 2 else 0
            if active_ordered_num is None and level == 0:
                active_ordered_num = _new_decimal_num_id()
                active_ordered_flat = not _list_has_sub_items(body, i)
            first = re.sub(r"^(\s*)\d+\.\s+", "", line).strip()
            text, i = _gather_wrapped(body, i, first=first)
            add_number(doc, text, level, active_ordered_num, flat=active_ordered_flat)
            continue

        text, i = _gather_wrapped(body, i)
        add_paragraph(doc, text, lane_label=_is_lane_label(text, body, i))

    closing = str(meta.get("closing", "")).strip()
    if closing:
        # House closing line (frontmatter `closing:`), centred and bold, from
        # the approved ZENi5 work scope. Room above comes from space_before,
        # never from an empty spacer paragraph.
        cp = doc.add_paragraph()
        cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cp.paragraph_format.space_before = CLOSING_SPACE_BEFORE
        cp.add_run(closing).bold = True

    _remove_content_marker(doc)
    _strip_yellow_highlights(doc)
    _stamp_year(doc)
    _assert_ppr_schema_order(doc)

    doc.save(out_path)
    print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)  [mode={mode}]")


def _next_version(versions_dir: Path, stem: str, suffix: str) -> int:
    """Highest existing <stem>-v<N><suffix> in versions_dir, plus one (>=1)."""
    nums = []
    if versions_dir.exists():
        pat = re.compile(re.escape(stem) + r"-v(\d+)" + re.escape(suffix) + r"$")
        for p in versions_dir.glob(f"{stem}-v*{suffix}"):
            m = pat.search(p.name)
            if m:
                nums.append(int(m.group(1)))
    return (max(nums) + 1) if nums else 1


def archive_version(output: Path, version: int | None = None) -> Path:
    """Keep an immutable, version-numbered copy of the just-rendered file in a
    sibling versions/ folder, so the un-versioned ``output`` is always the
    latest while every numbered build is preserved (ported 3.12.0).

    version: explicit number (recommended, matching the document's frontmatter
    ``version`` or its changelog). If None, uses max-existing + 1. The copy is
    named ``<name>-v<N>.<ext>``."""
    output = Path(output)
    versions_dir = output.parent / "versions"
    versions_dir.mkdir(parents=True, exist_ok=True)
    n = version if version is not None else _next_version(versions_dir, output.stem, output.suffix)
    dest = versions_dir / f"{output.stem}-v{n}{output.suffix}"
    shutil.copy2(output, dest)
    print(f"Archived: {dest}  (v{n})")
    return dest


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description=(
            "Convert a Markdown file (+ YAML frontmatter) into a "
            "WebOsmotic-styled DOCX."
        ),
    )
    parser.add_argument("source", help="Source .md path")
    parser.add_argument("output", help="Output .docx path")
    parser.add_argument(
        "--mode",
        choices=("cover", "plain"),
        default="plain",
        help=(
            "cover = WebOsmotic template with branded cover page; "
            "plain = starts at the Table of Contents (same chrome). "
            "Default: plain."
        ),
    )
    parser.add_argument(
        "--template",
        default=None,
        help="Override the template .docx (advanced; defaults per --mode).",
    )
    parser.add_argument(
        "--version",
        type=int,
        default=None,
        help=(
            "Keep an immutable numbered copy in versions/<name>-v<N>.docx after "
            "rendering the un-versioned latest."
        ),
    )
    parser.add_argument(
        "--no-archive",
        action="store_true",
        help="Render the latest only and skip the numbered versions/ copy.",
    )
    args = parser.parse_args()

    src_arg = Path(args.source).resolve()
    out_arg = Path(args.output).resolve()
    if not src_arg.exists():
        print(f"ERROR: source markdown not found: {src_arg}", file=sys.stderr)
        sys.exit(2)
    tmpl = None
    if args.template:
        tmpl = Path(args.template).resolve()
        if not tmpl.exists():
            print(f"ERROR: template not found: {tmpl}", file=sys.stderr)
            sys.exit(2)
    out_arg.parent.mkdir(parents=True, exist_ok=True)
    convert(src_arg, out_arg, mode=args.mode, template=tmpl)
    if args.version is not None and not args.no_archive:
        archive_version(out_arg, version=args.version)
