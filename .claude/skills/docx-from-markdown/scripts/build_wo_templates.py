"""Derive the two WebOsmotic generation templates from the master document.

Input  : templates/webosmotic-master.docx  (pristine copy of the official
         "Sample document formate.docx" proposal template)
Outputs: templates/wo-cover-template.docx  (cover page + TOC + {{CONTENT}})
         templates/wo-plain-template.docx  (TOC + {{CONTENT}}, no cover page,
                                            full chrome kept)

What the builder does, per template:
  1. Slices word/document.xml at the TOC: keeps the cover block (cover
     template only), the "Table of Contents" heading, and the TOC SDT.
     Drops all sample body content AND the page-break paragraph after the
     TOC (when the refreshed TOC exactly fills its page, that paragraph
     spills and produces a blank page; md_to_docx.py instead sets
     pageBreakBefore on the first content block).
  2. Inserts a single ``{{CONTENT}}`` marker paragraph before the trailing
     sectPr. md_to_docx.py renders markdown there and removes the marker.
  3. Adds ``<w:updateFields w:val="true"/>`` to word/settings.xml so Word
     refreshes the TOC field automatically when the document opens.
  4. Adds a ``Heading3`` paragraph style (the master only defines 1 and 2)
     so deep markdown nesting renders consistently.
  4b. Replaces every Arial font reference with Calibri (styles, body,
     headers, footer) so generated documents use Calibri only. Consolas
     stays for fenced code blocks (the one deliberate mono case).
  5. Pins ``outlineLvl 9`` on the "Table of Contents" heading paragraph so
     the heading keeps its Heading1 look but never lists itself inside the
     refreshed TOC.
  6. Strips the page-break run from the TOC heading in the plain template
     (there is no cover page before it).

All chrome (watermark header, banner, footer, theme, numbering) passes
through untouched. Media that only the dropped body referenced is pruned,
along with its relationships, so a master saved from a real document does
not leak that document's images into every render.

Run from the skill folder:
    python scripts/build_wo_templates.py
"""

from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path

from lxml import etree

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
MASTER = TEMPLATES_DIR / "webosmotic-master.docx"
OUT_COVER = TEMPLATES_DIR / "wo-cover-template.docx"
OUT_PLAIN = TEMPLATES_DIR / "wo-plain-template.docx"

CONTENT_MARKER_XML = (
    f'<w:p xmlns:w="{W}"><w:r><w:t>{{{{CONTENT}}}}</w:t></w:r></w:p>'
)

# Heading1 look-alike that the TOC ignores. `TOC \o "1-2"` collects by
# BUILT-IN heading style (outlineLvl alone does not exclude), so the cover
# band and the "Table of Contents" heading get this custom style instead.
H1_NO_TOC_STYLE_XML = (
    f'<w:style xmlns:w="{W}" w:type="paragraph" w:customStyle="1" '
    'w:styleId="Heading1NoToc">'
    '<w:name w:val="Heading 1 No TOC"/>'
    '<w:basedOn w:val="Heading1"/>'
    '<w:next w:val="Normal"/>'
    '<w:qFormat/>'
    '<w:pPr><w:outlineLvl w:val="9"/></w:pPr>'
    '</w:style>'
)

HEADING3_STYLE_XML = (
    f'<w:style xmlns:w="{W}" w:type="paragraph" w:styleId="Heading3">'
    '<w:name w:val="heading 3"/>'
    '<w:basedOn w:val="Normal"/>'
    '<w:next w:val="Normal"/>'
    '<w:uiPriority w:val="9"/>'
    '<w:unhideWhenUsed/>'
    '<w:qFormat/>'
    '<w:pPr>'
    '<w:keepNext/>'
    '<w:spacing w:before="180" w:after="80" w:line="240" w:lineRule="auto"/>'
    '<w:outlineLvl w:val="2"/>'
    '</w:pPr>'
    '<w:rPr>'
    '<w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>'
    '<w:b/><w:bCs/>'
    '<w:color w:val="0F2A43"/>'
    '<w:sz w:val="22"/><w:szCs w:val="22"/>'
    '<w:lang w:val="en-IN" w:eastAsia="en-IN"/>'
    '</w:rPr>'
    '</w:style>'
)

# Parts whose Arial references get rewritten to Calibri (user rule:
# generated documents are Calibri-only; Consolas stays for code blocks).
CALIBRI_ONLY_PARTS = (
    "word/document.xml",
    "word/styles.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/footer1.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
    # The theme's major AND minor latin fonts are Arial in the master, so
    # theme-resolved styles (TOC1/TOC2, TOCHeading, docDefaults) would fall
    # back to Arial without this.
    "word/theme/theme1.xml",
)

_ARIAL_ATTR_RE = re.compile(
    r'((?:w:ascii|w:hAnsi|w:eastAsia|w:cs|typeface)=")Arial(")'
)


def _calibri_only(data: bytes) -> bytes:
    """Rewrite every Arial font attribute to Calibri."""
    text = data.decode("utf-8")
    return _ARIAL_ATTR_RE.sub(r"\1Calibri\2", text).encode("utf-8")


def _para_text(p: etree._Element) -> str:
    return "".join(t.text or "" for t in p.iter(f"{{{W}}}t"))


def _exclude_from_toc(p: etree._Element) -> None:
    """Keep a Heading1-styled paragraph's look but drop it from the TOC.

    `TOC \\o "1-2"` collects by BUILT-IN heading style, so the paragraph is
    retagged to the custom Heading1NoToc style (basedOn Heading1, identical
    appearance, style-level outlineLvl 9). A direct outlineLvl 9 is added
    too (belt and braces for the `\\u` switch). Per the CT_PPr schema,
    w:outlineLvl must come BEFORE w:rPr."""
    ppr = p.find("w:pPr", NS)
    if ppr is None:
        ppr = etree.Element(f"{{{W}}}pPr")
        p.insert(0, ppr)
    pstyle = ppr.find("w:pStyle", NS)
    if pstyle is None:
        pstyle = etree.Element(f"{{{W}}}pStyle")
        ppr.insert(0, pstyle)
    pstyle.set(f"{{{W}}}val", "Heading1NoToc")
    if ppr.find("w:outlineLvl", NS) is not None:
        return
    lvl = etree.Element(f"{{{W}}}outlineLvl")
    lvl.set(f"{{{W}}}val", "9")
    rpr = ppr.find("w:rPr", NS)
    if rpr is not None:
        rpr.addprevious(lvl)
    else:
        ppr.append(lvl)


def _para_style(p: etree._Element) -> str:
    ps = p.find("w:pPr/w:pStyle", NS)
    return ps.get(f"{{{W}}}val") if ps is not None else ""


def _slice_document(doc_xml: bytes, *, keep_cover: bool) -> bytes:
    """Return document.xml with only chrome-relevant body elements kept."""
    root = etree.fromstring(doc_xml)
    body = root.find("w:body", NS)
    children = list(body)

    # Locate the TOC SDT (the only top-level w:sdt in the master).
    sdt_idx = next(
        i for i, el in enumerate(children)
        if etree.QName(el).localname == "sdt"
    )
    toc_heading = children[sdt_idx - 1]
    if "table of contents" not in _para_text(toc_heading).lower():
        raise RuntimeError(
            "Element before the TOC SDT is not the 'Table of Contents' "
            "heading. The master layout changed; update the builder."
        )
    sect_pr = children[-1]
    if etree.QName(sect_pr).localname != "sectPr":
        raise RuntimeError("Last body element is not sectPr.")

    keep: list[etree._Element] = []
    if keep_cover:
        cover = children[: sdt_idx - 1]
        # The cover band paragraph is Heading1-styled; without an override a
        # regenerated TOC lists it as an empty first entry. Pin it to body
        # outline level.
        for el in cover:
            if etree.QName(el).localname == "p" and _para_style(el) == "Heading1":
                _exclude_from_toc(el)
        keep.extend(cover)
    keep.append(toc_heading)
    keep.append(children[sdt_idx])

    # Rebuild the body.
    for el in children:
        body.remove(el)
    for el in keep:
        body.append(el)
    body.append(etree.fromstring(CONTENT_MARKER_XML))
    body.append(sect_pr)

    # Exclude the TOC heading from the TOC itself while keeping its look.
    _exclude_from_toc(toc_heading)

    if not keep_cover:
        # No cover page before the TOC: drop the leading page-break run(s).
        for br in toc_heading.findall(f".//{{{W}}}br"):
            if br.get(f"{{{W}}}type") == "page":
                run = br.getparent()
                run.getparent().remove(run)
        for lr in toc_heading.findall(f".//{{{W}}}lastRenderedPageBreak"):
            lr.getparent().remove(lr)
        # The master anchors the cover band (company name, location, date,
        # validity note) to the "Table of Contents" heading so it paints on
        # the cover page while the paragraph itself sits on the next one.
        # With no cover page the band lands on the TOC page instead, carrying
        # an unfilled [Today] placeholder that plain mode never substitutes.
        # Drop the shape; the heading text stays.
        # The shape lives in a run as mc:AlternateContent (a w:drawing in the
        # mc:Choice branch and a VML w:pict in the mc:Fallback branch), so the
        # whole run goes, not just the drawing.
        for run in list(toc_heading.findall(f".//{{{W}}}r")):
            if run.find(f".//{{{W}}}drawing") is None and run.find(f".//{{{W}}}pict") is None:
                continue
            run.getparent().remove(run)

    return etree.tostring(
        root, xml_declaration=True, encoding="UTF-8", standalone=True
    )


def _patch_settings(settings_xml: bytes) -> bytes:
    """Insert <w:updateFields w:val="true"/> at its schema position."""
    text = settings_xml.decode("utf-8")
    if "<w:updateFields" in text:
        return settings_xml
    update = f'<w:updateFields w:val="true"/>'
    # Schema order places updateFields just before hdrShapeDefaults /
    # footnotePr / endnotePr / compat. Insert before the first present.
    for anchor in ("<w:hdrShapeDefaults>", "<w:footnotePr>",
                   "<w:endnotePr>", "<w:compat>", "</w:settings>"):
        pos = text.find(anchor)
        if pos != -1:
            return (text[:pos] + update + text[pos:]).encode("utf-8")
    raise RuntimeError("settings.xml has no insertion anchor")


def _patch_styles(styles_xml: bytes) -> bytes:
    """Append the Heading3 and Heading1NoToc styles."""
    text = styles_xml.decode("utf-8")
    for style_xml, style_id in (
        (HEADING3_STYLE_XML, "Heading3"),
        (H1_NO_TOC_STYLE_XML, "Heading1NoToc"),
    ):
        if f'w:styleId="{style_id}"' in text:
            continue
        style = style_xml.replace(f' xmlns:w="{W}"', "", 1)
        text = text.replace("</w:styles>", style + "</w:styles>")
    return text.encode("utf-8")


def _prune_media(parts: dict[str, bytes]) -> list[str]:
    """Drop word/media parts that no kept XML part references, plus the image
    relationships that pointed at them. The master is a full document, so after
    the body is sliced away its body images would otherwise ride along as dead
    weight in every generated file. Returns the names removed."""
    import posixpath
    keep: set[str] = set()
    for rels_name in [n for n in parts if n.startswith("word/") and n.endswith(".rels")]:
        part_name = rels_name.replace("_rels/", "", 1)[: -len(".rels")]
        part_xml = parts.get(part_name, b"").decode("utf-8", "ignore")
        rels = etree.fromstring(parts[rels_name])
        changed = False
        for rel in list(rels):
            if "/image" not in rel.get("Type", ""):
                continue
            rid = rel.get("Id", "")
            target = posixpath.normpath(posixpath.join(posixpath.dirname(part_name), rel.get("Target", "")))
            if re.search(r'(?<![A-Za-z])(?:embed|id|link)="%s"' % re.escape(rid), part_xml):
                keep.add(target)
            else:
                rels.remove(rel)
                changed = True
        if changed:
            parts[rels_name] = etree.tostring(rels, xml_declaration=True, encoding="UTF-8", standalone=True)
    removed = [n for n in parts if n.startswith("word/media/") and n not in keep]
    for n in removed:
        del parts[n]
    return removed


def build(master: Path, out: Path, *, keep_cover: bool) -> None:
    zin = zipfile.ZipFile(master)
    infos = {item.filename: item for item in zin.infolist()}
    parts: dict[str, bytes] = {}
    for name in infos:
        data = zin.read(name)
        if name == "word/document.xml":
            data = _slice_document(data, keep_cover=keep_cover)
        elif name == "word/settings.xml":
            data = _patch_settings(data)
        elif name == "word/styles.xml":
            data = _patch_styles(data)
        if name in CALIBRI_ONLY_PARTS:
            data = _calibri_only(data)
        parts[name] = data
    removed = _prune_media(parts)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, data in parts.items():
            zout.writestr(infos[name], data)
    print(f"Wrote {out} ({out.stat().st_size} bytes) cover={keep_cover}"
          + (f", pruned {len(removed)} unreferenced media" if removed else ""))


def main() -> None:
    if not MASTER.exists():
        print(f"ERROR: master template not found: {MASTER}", file=sys.stderr)
        sys.exit(2)
    build(MASTER, OUT_COVER, keep_cover=True)
    build(MASTER, OUT_PLAIN, keep_cover=False)


if __name__ == "__main__":
    main()
