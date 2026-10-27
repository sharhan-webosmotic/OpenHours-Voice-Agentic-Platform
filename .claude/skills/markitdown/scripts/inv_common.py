"""Shared helpers for the markitdown coverage inventory.

A unit is one readable region of a source (a slide, a page, a sheet, a
Markdown section, a DOCX figure). Every per-format inventory builds units with
`new_unit` so the shape stays identical for ingest.py and verify_coverage.py.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
}

SCANNED_TEXT_THRESHOLD = 40
SNIPPET_LEN = 80
VISUAL_DIAGRAM_REASONS = {"connector", "group", "smartart", "shape", "vector-drawing"}


def new_unit(uid: str, index: int, label: str) -> dict:
    """Return an empty unit record with every field the pipeline reads."""
    return {
        "id": uid,
        "index": index,
        "label": label,
        "text_chars": 0,
        "tables": [],
        "expect_md_tables": 0,
        "pictures": 0,
        "charts": [],
        "diagram": {"groups": 0, "connectors": 0, "smartart": 0, "edges": []},
        "embedded_objects": 0,
        "notes": "",
        "hidden": False,
        "blank": False,
        "needs_visual": False,
        "reasons": [],
        "images": [],
        "probes": [],
    }


def flag(unit: dict, reason: str) -> None:
    """Mark a unit as needing the model visual pass for the given reason."""
    unit["needs_visual"] = True
    if reason not in unit["reasons"]:
        unit["reasons"].append(reason)


def normalize(text: str) -> str:
    """Collapse whitespace and strip Markdown escapes so text can be matched."""
    text = re.sub(r"[\\*_`]", "", text or "")
    return re.sub(r"\s+", " ", text).strip().lower()


def snippet(text: str) -> str:
    """Return the matchable leading snippet of a piece of text."""
    return normalize(text)[:SNIPPET_LEN]


def chart_info(xml_bytes: bytes) -> dict:
    """Parse a DrawingML chart part into title, type, axis titles, and series."""
    info = {"title": "", "type": "", "axes": [], "series": []}
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return info
    chart = root.find("c:chart", NS)
    if chart is None:
        return info
    title = chart.find("c:title", NS)
    if title is not None:
        info["title"] = "".join(t.text or "" for t in title.iter(f"{{{NS['a']}}}t")).strip()
    plot = chart.find("c:plotArea", NS)
    if plot is None:
        return info
    for child in plot:
        tag = child.tag.split("}")[-1]
        if tag.endswith("Chart") and not info["type"]:
            info["type"] = tag
        if tag in ("catAx", "valAx", "dateAx", "serAx"):
            ax_title = child.find("c:title", NS)
            if ax_title is not None:
                text = "".join(t.text or "" for t in ax_title.iter(f"{{{NS['a']}}}t")).strip()
                if text:
                    info["axes"].append(f"{tag}: {text}")
    for ser in plot.iter(f"{{{NS['c']}}}ser"):
        name = ser.find("c:tx", NS)
        label = ""
        if name is not None:
            label = "".join(v.text or "" for v in name.iter(f"{{{NS['c']}}}v")).strip()
        val = ser.find("c:val", NS)
        points = len(list(val.iter(f"{{{NS['c']}}}pt"))) if val is not None else 0
        info["series"].append({"name": label, "points": points})
    return info


def chart_line(chart: dict) -> str:
    """Format a parsed chart record as one Markdown line for the md body."""
    parts = [f'title "{chart["title"]}"' if chart.get("title") else "no title"]
    if chart.get("type"):
        parts.append(f"type {chart['type']}")
    parts += chart.get("axes", [])
    names = [s["name"] for s in chart.get("series", []) if s.get("name")]
    if names:
        parts.append("series " + ", ".join(names))
    return "**Chart (pipeline):** " + ", ".join(parts)
