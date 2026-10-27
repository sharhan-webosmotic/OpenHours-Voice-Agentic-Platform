"""Add back what markitdown drops, and place visual-pass placeholders.

Given the markitdown text and the source inventory, this module:
  * labels hidden slides and sheets,
  * adds chart titles, axis titles, connector relationships and SmartArt text,
  * inserts one VISUAL-PENDING placeholder per flagged unit, at that unit's
    position (slide, page, sheet, section, or DOCX figure),
  * appends an appendix with headers, footers, comments, footnotes, endnotes,
    text boxes, cell comments, merged ranges and formulas that are missing.

`unit_spans` is shared with verify_coverage.py so both agree on where each
unit lives in the Markdown.
"""

from __future__ import annotations

import re

from inv_common import chart_line, normalize

APPENDIX_MARK = "<!-- PIPELINE-APPENDIX -->"
PENDING_RE = re.compile(r"<!-- VISUAL-PENDING unit=(\S+)[^>]*-->")
VISUAL_RE = re.compile(r"<!-- VISUAL unit=(\S+)[^>]*-->.*?<!-- /VISUAL -->", re.S)
SLIDE_RE = re.compile(r"<!-- Slide number: (\d+) -->")
PAGE_RE = re.compile(r"<!-- Page number: (\d+) -->")
IMAGE_LINE_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
FENCE_RE = re.compile(r"^\s*(```|~~~)")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
SEGMENTED_TYPES = {"pptx", "pdf", "xlsx", "markdown"}


def placeholder(unit: dict) -> str:
    """Return the VISUAL-PENDING placeholder line for a flagged unit."""
    images = ",".join(unit.get("images") or []) or "none"
    line = f"<!-- VISUAL-PENDING unit={unit['id']} image={images} reason={','.join(unit['reasons'])}"
    if unit.get("render_note"):
        line += " note=" + re.sub(r"\s+", "-", unit["render_note"].strip())
    return line + " -->"


def _starts(lines: list[str], inv: dict) -> dict[str, int]:
    """Return the line index where each segmented unit begins in the Markdown."""
    ftype, units, starts = inv["type"], inv["units"], {}
    if ftype in ("pptx", "pdf"):
        rx = SLIDE_RE if ftype == "pptx" else PAGE_RE
        by_index = {u["index"]: u["id"] for u in units}
        for i, line in enumerate(lines):
            m = rx.search(line)
            if m and int(m.group(1)) in by_index:
                starts.setdefault(by_index[int(m.group(1))], i)
    elif ftype in ("xlsx", "markdown"):
        cursor, in_fence = 0, False
        heads = []
        for i, line in enumerate(lines):
            if FENCE_RE.match(line):
                in_fence = not in_fence
            m = None if in_fence else HEADING_RE.match(line)
            if m:
                heads.append((i, m.group(2).strip()))
        for unit in units:
            if ftype == "markdown" and unit["label"] == "(preamble)":
                starts[unit["id"]] = 0
                continue
            for k in range(cursor, len(heads)):
                if normalize(heads[k][1]) == normalize(unit["label"]):
                    starts[unit["id"]] = heads[k][0]
                    cursor = k + 1
                    break
    return starts


def unit_spans(md: str, inv: dict) -> dict[str, tuple[int, int]]:
    """Return {unit_id: (start_line, end_line)} for units that own a Markdown segment."""
    lines = md.splitlines()
    limit = next((i for i, ln in enumerate(lines) if ln.strip() == APPENDIX_MARK), len(lines))
    if inv["type"] not in SEGMENTED_TYPES:
        return {u["id"]: (0, limit) for u in inv["units"] if u["id"] in ("body", "image-1", "document")}
    starts = sorted((s, uid) for uid, s in _starts(lines[:limit], inv).items())
    spans = {}
    for k, (start, uid) in enumerate(starts):
        end = starts[k + 1][0] if k + 1 < len(starts) else limit
        spans[uid] = (start, end)
    return spans


def _segment_extras(unit: dict) -> list[str]:
    """Return the pipeline lines added inside one unit's segment."""
    out = [chart_line(c) for c in unit.get("charts", [])]
    edges = [e for e in unit.get("diagram", {}).get("edges", []) if e]
    if edges:
        out.append(
            "**Connectors (pipeline, inferred from the slide geometry, `--` means no arrowhead):** "
            + ", ".join(f"{e[0]} {e[2] if len(e) > 2 else '--'} {e[1]}" for e in edges)
        )
    for text in unit.get("smartart_text", []):
        out.append(f"**SmartArt text (pipeline):** {text}")
    if unit.get("blank"):
        out.append("_[blank page: no text and no images]_")
    if unit["needs_visual"]:
        out.append(placeholder(unit))
    return out


def _hidden_lines(unit: dict, kind: str) -> list[str]:
    """Return the hidden-unit label lines, or nothing for a visible unit."""
    if not unit.get("hidden"):
        return []
    return [f"<!-- HIDDEN unit={unit['id']} -->", f"_Hidden {kind}: not shown to viewers by default, content below is still part of the source._"]


def _insert_segments(lines: list[str], inv: dict) -> list[str]:
    """Insert hidden labels and segment extras into every segmented unit."""
    spans = unit_spans("\n".join(lines), inv)
    kind = {"pptx": "slide", "xlsx": "sheet", "pdf": "page", "markdown": "section"}[inv["type"]]
    by_id = {u["id"]: u for u in inv["units"]}
    for uid, (start, end) in sorted(spans.items(), key=lambda kv: -kv[1][0]):
        unit = by_id[uid]
        extras = _segment_extras(unit)
        tail = end
        while tail > start + 1 and not lines[tail - 1].strip():
            tail -= 1
        if extras:
            lines[tail:tail] = [""] + extras + [""]
        hidden = _hidden_lines(unit, kind)
        if hidden:
            lines[start + 1:start + 1] = hidden
    missing = [u for u in inv["units"] if u["id"] not in spans and (u["needs_visual"] or u.get("hidden"))]
    for unit in missing:
        lines += ["", f"<!-- Unit {unit['id']}: {unit['label']} (not located in the markitdown output) -->"]
        lines += _hidden_lines(unit, kind) + _segment_extras(unit)
    return lines


def _insert_docx_figures(lines: list[str], inv: dict) -> list[str]:
    """Place each DOCX figure placeholder after its image line or anchor paragraph."""
    figures = [u for u in inv["units"] if u["id"].startswith("figure-") and u["needs_visual"]]
    pictures = [u for u in figures if u.get("kind") == "picture"]
    image_lines = [i for i, ln in enumerate(lines) if IMAGE_LINE_RE.search(ln)]
    targets = []
    for unit in figures:
        at = None
        if unit.get("kind") == "picture" and len(image_lines) == len(pictures):
            at = image_lines[pictures.index(unit)]
        elif unit.get("anchor"):
            needle = normalize(unit["anchor"])[-40:]
            at = next((i for i, ln in enumerate(lines) if needle and needle in normalize(ln)), None)
        targets.append((len(lines) if at is None else at + 1, unit))
    for at, unit in sorted(targets, key=lambda t: -t[0]):
        lines[at:at] = ["", *[chart_line(c) for c in unit.get("charts", [])], placeholder(unit), ""]
    return lines


def _appendix(md: str, inv: dict) -> list[str]:
    """Return the appendix lines for document-level content missing from the md."""
    doc, body = inv.get("document", {}), normalize(md)
    sections: list[tuple[str, list[str]]] = []
    groups = {}
    for part in doc.get("parts", []):
        if part.get("probe") and part["probe"] in body and part["kind"] not in ("cell-comment",):
            continue
        title = {"header": "Headers and footers", "footer": "Headers and footers", "comment": "Comments",
                 "footnote": "Footnotes and endnotes", "endnote": "Footnotes and endnotes", "textbox": "Text boxes",
                 "cell-comment": "Cell comments"}.get(part["kind"], "Other parts")
        groups.setdefault(title, []).append(f"- {part.get('label', part['kind'])}: {part['text']}")
    sections += list(groups.items())
    if doc.get("merged_ranges"):
        sections.append(("Merged ranges", [f"- {m['sheet']}!{m['range']} merged, value: {m['value'] or '(empty)'}" for m in doc["merged_ranges"]]))
    if doc.get("formulas_count"):
        rows = [f"- {f['sheet']}!{f['cell']}: `{f['formula']}` (cached value: {f['cached'] if f['cached'] is not None else 'not cached'})" for f in doc["formulas"]]
        if doc["formulas_count"] > len(doc["formulas"]):
            rows.append(f"- ... {doc['formulas_count'] - len(doc['formulas'])} more formulas not listed")
        sections.append((f"Formulas ({doc['formulas_count']})", rows))
    if doc.get("remote_images"):
        sections.append(("Remote images (not fetched)", [f"- {r['section']}: {r['target']}" for r in doc["remote_images"]]))
    if not sections:
        return []
    out = ["", "", APPENDIX_MARK, "## Content markitdown does not capture (added by the pipeline)", ""]
    for title, rows in sections:
        out += [f"### {title}", "", *rows, ""]
    return out


def augment(md: str, inv: dict) -> str:
    """Return the Markdown with dropped content restored and placeholders placed."""
    lines = md.rstrip("\n").splitlines()
    if inv["type"] in SEGMENTED_TYPES:
        lines = _insert_segments(lines, inv)
    elif inv["type"] == "docx":
        lines = _insert_docx_figures(lines, inv)
    else:
        lines += [""] + [ln for u in inv["units"] if u["needs_visual"] for ln in _segment_extras(u)]
    text = "\n".join(lines)
    return text + "\n".join(_appendix(text, inv)) + "\n"


def harvest_visuals(md: str) -> dict[str, str]:
    """Return {unit_id: filled VISUAL block} from an earlier ingest of the same source."""
    return {m.group(1): m.group(0) for m in VISUAL_RE.finditer(md)}


def restore_visuals(md: str, blocks: dict[str, str]) -> str:
    """Replace pending placeholders with previously filled VISUAL blocks."""
    return PENDING_RE.sub(lambda m: blocks.get(m.group(1), m.group(0)), md)
