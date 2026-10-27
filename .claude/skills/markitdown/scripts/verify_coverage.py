"""Verify that an ingested Markdown file covers everything in its source.

Compares <basename>.inventory.json (built from the ORIGINAL file) with the
ingested .md and prints one PASS / FAIL / WARN line per check, then a verdict:

    COVERAGE: COMPLETE                 exit 0
    COVERAGE: INCOMPLETE (<n> gaps)    exit 1

Checks: every unit appears, table counts per unit, every flagged unit has a
filled VISUAL block (no VISUAL-PENDING left, required fields present), notes /
headers / footers / comments / footnotes / text boxes / cell comments present,
hidden units labelled, merged ranges and formulas listed, and no unit with
source text or images renders as empty output.

Writes the verdict into the Coverage column of AI_DOCS/ingested/manifest.md.

Usage:
    python scripts/verify_coverage.py AI_DOCS/ingested/pptx/deck.md
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from augment import APPENDIX_MARK, PENDING_RE, VISUAL_RE, unit_spans
from inv_common import VISUAL_DIAGRAM_REASONS, normalize
from manifest import set_coverage

TABLE_SEP = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$")
COMMENT = re.compile(r"<!--.*?-->", re.S)
FIELD = re.compile(r"\*\*(Visible text|Diagram|Chart|Meaning):\*\*\s*(.*?)(?=\n\*\*[A-Z][A-Za-z ]+:\*\*|\Z)", re.S)


def _split_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Return (frontmatter fields, body) of an ingested Markdown file."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fields = {}
    for line in text[3:end].splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip()
    return fields, text[end + 4:].lstrip("\n")


def _check_block(block: str, unit: dict) -> list[str]:
    """Return the problems with one filled VISUAL block (empty list when valid)."""
    inner = re.sub(r"^<!-- VISUAL[^>]*-->|<!-- /VISUAL -->$", "", block.strip()).strip()
    fields = {k: v.strip() for k, v in FIELD.findall(inner)}
    problems = [f"missing **{k}:**" for k in ("Visible text", "Meaning") if not fields.get(k)]
    reasons = set(unit.get("reasons", []))
    if "chart" in reasons and not fields.get("Chart"):
        problems.append("chart unit without **Chart:**")
    if reasons & VISUAL_DIAGRAM_REASONS and not fields.get("Diagram"):
        problems.append("diagram unit without **Diagram:**")
    return problems


def verify(md_path: Path) -> tuple[int, list[str], dict[str, str]]:
    """Run every coverage check. Returns (gap_count, report_lines, frontmatter)."""
    text = md_path.read_text(encoding="utf-8")
    front, body = _split_frontmatter(text)
    report: list[str] = []
    gaps = 0

    def result(ok: bool, msg: str) -> None:
        nonlocal gaps
        report.append(("PASS " if ok else "FAIL ") + msg)
        gaps += 0 if ok else 1

    inv_name = front.get("inventory")
    inv_path = md_path.parent / inv_name if inv_name else None
    if inv_path is None or not inv_path.exists():
        result(False, "inventory file missing: re-run ingest.py without --no-inventory")
        return gaps, report, front
    inv = json.loads(inv_path.read_text(encoding="utf-8"))
    lines = body.splitlines()
    spans = unit_spans(body, inv)
    blocks = {m.group(1): m.group(0) for m in VISUAL_RE.finditer(body)}
    pending = {m.group(1) for m in PENDING_RE.finditer(body)}
    segmented = inv["type"] in ("pptx", "pdf", "xlsx", "markdown")
    if inv.get("render", {}).get("note"):
        report.append(f"WARN render: {inv['render']['note']}")

    for unit in inv["units"]:
        uid = unit["id"]
        span = spans.get(uid)
        if segmented or uid in ("body", "image-1", "document"):
            result(span is not None, f"{uid} ({unit['label']}) present in the md")
        seg = "\n".join(lines[span[0]:span[1]]) if span else ""
        seg_plain = VISUAL_RE.sub("", seg)
        if unit.get("expect_md_tables"):
            found = sum(1 for ln in seg_plain.splitlines() if TABLE_SEP.match(ln))
            result(found >= unit["expect_md_tables"], f"{uid} tables: source {unit['expect_md_tables']}, md {found}")
        if unit["needs_visual"]:
            if uid in pending:
                result(False, f"{uid} visual pass not done (VISUAL-PENDING, reason {','.join(unit['reasons'])})")
            elif uid not in blocks:
                result(False, f"{uid} needs a VISUAL block (reason {','.join(unit['reasons'])}) and none was found")
            else:
                problems = _check_block(blocks[uid], unit)
                result(not problems, f"{uid} VISUAL block filled" + (f": {'; '.join(problems)}" if problems else ""))
            if unit.get("render_note"):
                report.append(f"WARN {uid}: {unit['render_note']}")
        for probe in unit.get("probes", []):
            result(probe in normalize(seg), f"{uid} carries '{probe[:40]}'")
        if unit.get("hidden"):
            result(f"<!-- HIDDEN unit={uid} -->" in body, f"{uid} labelled hidden")
        if span and (unit["text_chars"] or unit["pictures"] or unit["needs_visual"]):
            residue = COMMENT.sub("", seg_plain)
            has_output = bool(residue.strip()) or uid in blocks
            result(has_output, f"{uid} has output (text or a visual block)")

    doc = inv.get("document", {})
    norm_body = normalize(body)
    for part in doc.get("parts", []):
        result(part["probe"] in norm_body, f"{part.get('label', part['kind'])} text present")
    if doc.get("merged_ranges"):
        result("### Merged ranges" in body, f"{len(doc['merged_ranges'])} merged range(s) listed")
    if doc.get("formulas_count"):
        result("### Formulas (" in body, f"{doc['formulas_count']} formula(s) listed")
    for remote in doc.get("remote_images", []):
        report.append(f"WARN {remote['section']}: remote image not fetched ({remote['target']})")
    orphans = pending - {u["id"] for u in inv["units"]}
    for uid in sorted(orphans):
        result(False, f"orphan VISUAL-PENDING for unknown unit {uid}")
    if APPENDIX_MARK not in body and (doc.get("parts") or doc.get("merged_ranges") or doc.get("formulas_count")):
        report.append("WARN no pipeline appendix found: every part matched inline")
    return gaps, report, front


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify an ingested .md covers its source")
    parser.add_argument("md", help="Path to AI_DOCS/ingested/<type>/<basename>.md")
    parser.add_argument("--no-manifest", action="store_true", help="Do not update the manifest Coverage column")
    args = parser.parse_args()
    path = Path(args.md)
    if not path.exists():
        print(f"Error: file not found: {args.md}")
        raise SystemExit(1)
    gap_count, lines_out, fm = verify(path)
    print("\n".join(lines_out))
    verdict = "COVERAGE: COMPLETE" if gap_count == 0 else f"COVERAGE: INCOMPLETE ({gap_count} gaps)"
    print(verdict)
    if not args.no_manifest and fm.get("source"):
        cell = "complete" if gap_count == 0 else f"incomplete ({gap_count} gaps)"
        if not set_coverage(path.parent.parent / "manifest.md", fm["source"], cell):
            print("WARN manifest row not found, Coverage column not updated")
    raise SystemExit(0 if gap_count == 0 else 1)
