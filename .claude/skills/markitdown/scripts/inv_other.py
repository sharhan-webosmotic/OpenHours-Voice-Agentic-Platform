"""Coverage inventory for PDF, Markdown, image, and every other source type.

PDF: one unit per page. A page with images and under SCANNED_TEXT_THRESHOLD
characters of extractable text is treated as scanned. Pages with meaningful
pictures or dense vector drawing are flagged too. Flagged pages are rendered
with pypdfium2.

Markdown: one unit per heading section. Every linked local image is flagged
and copied (normalized) into the assets folder. Remote images are recorded but
never fetched (network is a Category-B operation).

Image: one unit, always flagged, because there is no OCR engine: the model
reads it in the visual pass.
"""

from __future__ import annotations

import re
from pathlib import Path

from inv_common import SCANNED_TEXT_THRESHOLD, flag, new_unit, snippet
from office_render import normalize_image, render_pdf_pages

MIN_PICTURE_PT = 48
VECTOR_CURVES_MIN = 5
VECTOR_LINES_MIN = 12
FENCE = re.compile(r"^\s*(```|~~~)")
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
MD_IMAGE = re.compile(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)|<img\b[^>]*\bsrc=[\"']([^\"']+)[\"']", re.I)
TABLE_SEP = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$")


def build_pdf(src: Path, ctx: dict) -> dict:
    """Inventory a PDF page by page and render flagged pages."""
    import pdfplumber

    units, parts = [], []
    with pdfplumber.open(str(src)) as pdf:
        for idx, page in enumerate(pdf.pages, 1):
            unit = new_unit(f"page-{idx}", idx, f"Page {idx}")
            text = (page.extract_text() or "").strip()
            unit["text_chars"] = len(text)
            tables = page.find_tables()
            unit["tables"] = [{"rows": len(t.rows), "cols": len(t.rows[0].cells) if t.rows else 0} for t in tables]
            unit["expect_md_tables"] = len(tables)
            big = [im for im in page.images if (im["x1"] - im["x0"]) >= MIN_PICTURE_PT and (im["bottom"] - im["top"]) >= MIN_PICTURE_PT]
            unit["pictures"] = len(big)
            if big and unit["text_chars"] < SCANNED_TEXT_THRESHOLD:
                flag(unit, "scanned")
            elif big:
                flag(unit, "picture")
            if len(page.curves) >= VECTOR_CURVES_MIN or (not tables and len(page.lines) + len(page.rects) >= VECTOR_LINES_MIN):
                flag(unit, "vector-drawing")
            unit["blank"] = not text and not page.images and not unit["needs_visual"]
            for annot in page.annots or []:
                contents = (annot.get("contents") or "").strip()
                if contents:
                    parts.append({"kind": "comment", "label": f"Annotation (page {idx})", "text": contents, "probe": snippet(contents)})
            page.close()
            units.append(unit)
    render = {"engine": "pypdfium2", "note": ""}
    flagged = {u["index"]: ctx["assets_dir"] / f"page-{u['index']:03d}.png" for u in units if u["needs_visual"]}
    if flagged and ctx["do_render"]:
        err = render_pdf_pages(src, flagged)
        if err:
            render = {"engine": "none", "note": f"page render unavailable: {err}"}
    for unit in units:
        if unit["needs_visual"]:
            png = flagged[unit["index"]]
            unit["images"] = [f"{ctx['rel']}/{png.name}"] if png.exists() else []
            if not unit["images"]:
                unit["render_note"] = "page render unavailable"
    return {"units": units, "document": {"parts": parts}, "render": render}


def md_sections(text: str) -> list[tuple[int, str, list[str]]]:
    """Split Markdown into (start_line, heading_text, lines) sections, fence-aware."""
    sections, current, in_fence = [], (0, "", []), False
    for i, line in enumerate(text.splitlines()):
        if FENCE.match(line):
            in_fence = not in_fence
        m = None if in_fence else HEADING.match(line)
        if m:
            if current[2] or current[1]:
                sections.append(current)
            current = (i, m.group(2).strip(), [])
        current[2].append(line)
    if current[2] or current[1]:
        sections.append(current)
    return sections


def build_md(src: Path, ctx: dict) -> dict:
    """Inventory a Markdown file by heading section and copy linked local images."""
    text = src.read_text(encoding="utf-8", errors="replace")
    units, remote = [], []
    for idx, (_start, heading, lines) in enumerate(md_sections(text), 1):
        unit = new_unit(f"section-{idx}", idx, heading or "(preamble)")
        body = "\n".join(lines)
        unit["text_chars"] = len(body.strip())
        unit["expect_md_tables"] = sum(1 for ln in lines if TABLE_SEP.match(ln))
        unit["tables"] = [{"rows": 0, "cols": 0}] * unit["expect_md_tables"]
        if heading:
            unit["probes"].append(snippet(heading))
        for k, m in enumerate(MD_IMAGE.finditer(body), 1):
            target = m.group(1) or m.group(2)
            unit["pictures"] += 1
            if re.match(r"^(https?:)?//", target) or target.startswith("data:"):
                remote.append({"section": unit["id"], "target": target[:120]})
                continue
            local = (src.parent / target).resolve()
            dest = ctx["assets_dir"] / f"section-{idx:03d}-img-{k:02d}.png"
            flag(unit, "linked-image")
            if local.exists() and normalize_image(local, dest) is None:
                unit["images"].append(f"{ctx['rel']}/{dest.name}")
            else:
                unit["render_note"] = f"linked image missing: {target}"
        units.append(unit)
    return {"units": units, "document": {"parts": [], "remote_images": remote}, "render": {"engine": "copy", "note": ""}}


def build_image(src: Path, ctx: dict) -> dict:
    """Inventory a standalone image: one unit, always read in the visual pass."""
    unit = new_unit("image-1", 1, src.name)
    unit["pictures"] = 1
    flag(unit, "image")
    dest = ctx["assets_dir"] / "image-001.png"
    err = normalize_image(src, dest)
    unit["images"] = [f"{ctx['rel']}/{dest.name}"] if err is None else []
    if err:
        unit["render_note"] = err
    return {"units": [unit], "document": {"parts": []}, "render": {"engine": "copy", "note": err or ""}}


def build_generic(src: Path, ctx: dict) -> dict:
    """Inventory any other type as a single document unit with no visual checks."""
    unit = new_unit("document", 1, src.name)
    try:
        unit["text_chars"] = src.stat().st_size
    except OSError:
        unit["text_chars"] = 0
    return {"units": [unit], "document": {"parts": []}, "render": {"engine": "none", "note": ""}}
