"""XLSX coverage inventory: one unit per worksheet.

Records cell text, hidden state, merged ranges, cell comments, formulas (with
cached values), and the pictures and charts anchored on each sheet. Pictures
and charts are flagged. Flagged sheets are rendered through Excel COM (sheet
to PDF, then page images), falling back to the embedded media when COM is
unavailable.
"""

from __future__ import annotations

import posixpath
import re
import zipfile
from pathlib import Path

from inv_common import chart_info, flag, new_unit, snippet
from office_render import export_xlsx_sheets, normalize_image, render_pdf_pages

MAX_PAGES_PER_SHEET = 3
MAX_LISTED_FORMULAS = 500


def _rels(z: zipfile.ZipFile, part: str) -> list[tuple[str, str]]:
    """Return (type, resolved target) pairs for a package part's relationships."""
    rels_path = posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")
    if rels_path not in z.namelist():
        return []
    xml = z.read(rels_path).decode("utf-8", "ignore")
    out = []
    for tag in re.findall(r"<Relationship\b[^>]*>", xml):
        rtype = re.search(r'Type="([^"]*)"', tag)
        target = re.search(r'Target="([^"]*)"', tag)
        if not rtype or not target or 'TargetMode="External"' in tag:
            continue
        t = target.group(1)
        resolved = t.lstrip("/") if t.startswith("/") else posixpath.normpath(posixpath.join(posixpath.dirname(part), t))
        out.append((rtype.group(1).rsplit("/", 1)[-1], resolved))
    return out


def _sheet_drawings(src: Path) -> list[dict]:
    """Return per-worksheet charts and image blobs, in workbook sheet order."""
    out = []
    with zipfile.ZipFile(src) as z:
        workbook = z.read("xl/workbook.xml").decode("utf-8", "ignore")
        wb_rels = {}
        rels_xml = z.read("xl/_rels/workbook.xml.rels").decode("utf-8", "ignore")
        for tag in re.findall(r"<Relationship\b[^>]*>", rels_xml):
            rid = re.search(r'Id="([^"]*)"', tag).group(1)
            wb_rels[rid] = tag
        for sheet_tag in re.findall(r"<sheet\b[^>]*>", workbook):
            rid = re.search(r'r:id="([^"]*)"', sheet_tag)
            entry = {"charts": [], "images": []}
            target = re.search(r'Target="([^"]*)"', wb_rels.get(rid.group(1) if rid else "", ""))
            if target and "worksheet" in wb_rels[rid.group(1)]:
                t = target.group(1)
                part = t.lstrip("/") if t.startswith("/") else posixpath.normpath(posixpath.join("xl", t))
                for rtype, drawing in _rels(z, part):
                    if rtype != "drawing":
                        continue
                    for dtype, item in _rels(z, drawing):
                        if dtype == "chart" and item in z.namelist():
                            entry["charts"].append(chart_info(z.read(item)))
                        elif dtype == "image" and item in z.namelist():
                            entry["images"].append(z.read(item))
                out.append(entry)
    return out


def build(src: Path, ctx: dict) -> dict:
    """Inventory an XLSX and render flagged sheets. Returns {units, document, render}."""
    import openpyxl

    wb = openpyxl.load_workbook(str(src))
    cached = openpyxl.load_workbook(str(src), data_only=True)
    drawings = _sheet_drawings(src)
    units, parts, merged, formulas = [], [], [], []
    for idx, ws in enumerate(wb.worksheets, 1):
        unit = new_unit(f"sheet-{idx}", idx, ws.title)
        unit["hidden"] = ws.sheet_state != "visible"
        has_value = False
        for row in ws.iter_rows():
            for cell in row:
                if cell.value is None:
                    continue
                has_value = True
                unit["text_chars"] += len(str(cell.value))
                if cell.data_type == "f":
                    value = cached[ws.title][cell.coordinate].value
                    formulas.append({"sheet": ws.title, "cell": cell.coordinate, "formula": str(cell.value), "cached": value})
                if cell.comment is not None:
                    text = cell.comment.text.strip()
                    parts.append({"kind": "cell-comment", "label": f"{ws.title}!{cell.coordinate} ({cell.comment.author or 'unknown'})",
                                  "text": text, "probe": snippet(text)})
        for rng in ws.merged_cells.ranges:
            top = ws.cell(rng.min_row, rng.min_col).value
            merged.append({"sheet": ws.title, "range": str(rng), "value": "" if top is None else str(top)})
        unit["tables"] = [{"rows": ws.max_row, "cols": ws.max_column}] if has_value else []
        unit["expect_md_tables"] = 1 if has_value else 0
        drawing = drawings[idx - 1] if idx - 1 < len(drawings) else {"charts": [], "images": []}
        unit["charts"] = drawing["charts"]
        unit["pictures"] = len(drawing["images"])
        if unit["pictures"]:
            flag(unit, "picture")
        if unit["charts"]:
            flag(unit, "chart")
        units.append(unit)

    render = {"engine": "none", "note": ""}
    flagged = [u for u in units if u["needs_visual"]]
    pdfs = {}
    if flagged and ctx["do_render"]:
        pdfs, err = export_xlsx_sheets(src, [u["label"] for u in flagged], ctx["temp_dir"])
        render = {"engine": "excel-com+pypdfium2", "note": ""} if not err else {"engine": "media-fallback", "note": f"sheet render unavailable: {err}"}
    for unit in flagged:
        pdf = pdfs.get(unit["label"])
        if pdf is not None:
            dests = {n: ctx["assets_dir"] / f"sheet-{unit['index']:03d}-p{n}.png" for n in range(1, MAX_PAGES_PER_SHEET + 1)}
            render_pdf_pages(pdf, dests)
            unit["images"] = [f"{ctx['rel']}/{d.name}" for d in dests.values() if d.exists()]
        for k, blob in enumerate(drawings[unit["index"] - 1]["images"], 1):
            dest = ctx["assets_dir"] / f"sheet-{unit['index']:03d}-media-{k:02d}.png"
            if normalize_image(blob, dest) is None:
                unit["images"].append(f"{ctx['rel']}/{dest.name}")
        if not unit["images"]:
            unit["render_note"] = "sheet render unavailable"
    document = {
        "parts": parts,
        "hidden_units": [u["id"] for u in units if u["hidden"]],
        "merged_ranges": merged,
        "formulas_count": len(formulas),
        "formulas": formulas[:MAX_LISTED_FORMULAS],
    }
    return {"units": units, "document": document, "render": render}
