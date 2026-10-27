"""Convert any supported file (or URL) to Markdown via Microsoft markitdown.

Lands the result under AI_DOCS/ingested/<type>/<basename>.md with YAML
frontmatter, and upserts a row in AI_DOCS/ingested/manifest.md so downstream
skills and the LLM reason over a clean Markdown artifact instead of the binary.

Complete-reading pipeline (local files): after conversion, ingest runs the
coverage inventory on the ORIGINAL file (inventory.py), restores what
markitdown drops (headers, footers, comments, footnotes, text boxes, hidden
labels, chart and axis titles, connector relationships, cell comments, merged
ranges, formulas), and places one VISUAL-PENDING placeholder per flagged unit.
The model then fills those in the visual pass and verify_coverage.py decides
whether the source is COMPLETE. PDFs are page-segmented with the same
pdfminer/pdfplumber engines markitdown uses, so each page gets a marker.

Idempotent: re-ingesting overwrites in place, updates (never duplicates) the
manifest row, and, when the source bytes are unchanged, keeps every VISUAL
block already filled by an earlier visual pass.

Follows the framework script convention: argparse + an `if __name__` block,
and an internal (result, message) return pair for consistent error handling.

Network sources (http/https/YouTube) are a Category-B external operation
(ops-safety-rules.md): they are refused unless --allow-network is passed,
which the caller supplies only after the user has confirmed.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from augment import augment, harvest_visuals, restore_visuals
from inventory import build_inventory, sha256_file
from manifest import upsert
from source_types import EXT_TYPE_MAP, detect_type, is_url

__all__ = ["EXT_TYPE_MAP", "detect_type", "ingest", "is_url"]


def _require_markitdown() -> None:
    """Raise RuntimeError with guidance when markitdown cannot run here.

    markitdown requires Python 3.10+ (the framework standardizes on 3.12). On
    Python 3.9 only the empty `0.0.1a1` placeholder installs, which has no
    MarkItDown class.
    """
    if sys.version_info < (3, 10):
        raise RuntimeError(
            f"markitdown requires Python 3.10+ - this interpreter is "
            f"{sys.version_info.major}.{sys.version_info.minor}. "
            "Install Python 3.12 (re-run the framework setup.sh) and try again."
        )
    hint = 'markitdown is not installed. Run: python -m pip install --upgrade "markitdown[all]"'
    try:
        import markitdown
    except ImportError as exc:
        raise RuntimeError(hint) from exc
    if not hasattr(markitdown, "MarkItDown"):
        raise RuntimeError(hint)


def _md_table(rows: list[list]) -> str:
    """Render a pdfplumber table (list of rows) as a Markdown table."""
    rows = [["" if c is None else str(c).replace("\n", " ") for c in r] for r in rows if r]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    out = ["| " + " | ".join(rows[0]) + " |", "|" + "|".join(["---"] * width) + "|"]
    return "\n".join(out + ["| " + " | ".join(r) + " |" for r in rows[1:]])


def _convert_pdf(source: str) -> str:
    """Convert a PDF page by page with markitdown's engines, one marker per page."""
    import pdfplumber
    from pdfminer.high_level import extract_pages
    from pdfminer.layout import LTTextContainer

    try:
        from markitdown.converters._pdf_converter import _extract_form_content_from_words as form_content
    except ImportError:
        form_content = None
    plain = [
        "".join(el.get_text() for el in layout if isinstance(el, LTTextContainer)).strip()
        for layout in extract_pages(source)
    ]
    chunks = []
    with pdfplumber.open(source) as pdf:
        for i, page in enumerate(pdf.pages):
            content = form_content(page) if form_content else None
            if content is None:
                tables = [_md_table(t) for t in page.extract_tables() if t]
                content = "\n\n".join([plain[i] if i < len(plain) else ""] + [t for t in tables if t])
            chunks.append(f"<!-- Page number: {i + 1} -->\n{content.strip()}")
            page.close()
    return "\n\n".join(chunks) + "\n"


def _convert(source: str, ftype: str) -> str:
    """Convert source to Markdown text (markitdown API, page-segmented for PDF)."""
    _require_markitdown()
    if ftype == "pdf" and not is_url(source):
        return _convert_pdf(source)
    from markitdown import MarkItDown

    return MarkItDown().convert(source).text_content


def _frontmatter(source: str, ftype: str, sha: str | None, extra: dict[str, str]) -> tuple[str, str]:
    """Build the YAML frontmatter block and return (block, iso_timestamp)."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = ["---", f"source: {source}", f"type: {ftype}", "tool: markitdown"]
    if sha is not None:
        lines.append(f"sha256: {sha}")
    lines += [f"{k}: {v}" for k, v in extra.items()]
    lines += [f"ingested_at: {now}", "---", ""]
    return "\n".join(lines), now


def _previous_visuals(out_path: Path, sha: str | None) -> dict[str, str]:
    """Return filled VISUAL blocks from an earlier ingest of identical source bytes."""
    if sha is None or not out_path.exists():
        return {}
    old = out_path.read_text(encoding="utf-8")
    m = re.search(r"^sha256: (\S+)$", old, re.M)
    return harvest_visuals(old) if m and m.group(1) == sha else {}


def ingest(
    source: str,
    out_root: str = "AI_DOCS/ingested",
    type_override: str | None = None,
    to_stdout: bool = False,
    allow_network: bool = False,
    run_inventory: bool = True,
    force_render: bool = False,
) -> tuple[Path | None, str]:
    """Convert source to Markdown and persist it under AI_DOCS/ingested.

    Returns (output_path, message). output_path is None on --stdout or error.
    """
    source_is_url = is_url(source)
    if source_is_url and not allow_network:
        return None, (
            "Error: network source refused. Fetching a URL is an external "
            "operation, re-run with --allow-network after user confirmation."
        )
    if not source_is_url and not Path(source).exists():
        return None, f"Error: file not found: {source}"

    ftype = type_override or detect_type(source)
    try:
        markdown = _convert(source, ftype)
    except Exception as exc:
        return None, f"Error: conversion failed: {exc}"
    if to_stdout:
        return None, markdown

    sha = None if source_is_url else sha256_file(Path(source))
    basename = Path(urlparse(source).path if source_is_url else source).stem or "source"
    out_dir = Path(out_root) / ftype
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{basename}.md"

    extra, visual_count = {}, 0
    if run_inventory and not source_is_url:
        temp_root = Path(out_root).parent / ".temp" / "markitdown"
        inv, inv_path = build_inventory(source, out_dir, ftype, temp_root, force=force_render)
        markdown = augment(markdown, inv)
        visual_count = len(inv["visual_units"])
        extra = {"inventory": inv_path.name, "visual_units": str(visual_count)}
    previous = _previous_visuals(out_path, sha)
    if previous:
        markdown = restore_visuals(markdown, previous)

    front, when = _frontmatter(source, ftype, sha, extra)
    out_path.write_text(front + markdown, encoding="utf-8")
    upsert(Path(out_root) / "manifest.md", source, ftype, out_path, when)
    message = f"Ingested {source} -> {out_path.as_posix()}"
    if extra:
        pending = len(re.findall(r"<!-- VISUAL-PENDING ", markdown))
        step = "visual pass, then verify_coverage.py" if pending else "verify_coverage.py"
        message += f" ({visual_count} unit(s) flagged for the visual pass, {pending} pending). Next: {step}"
    return out_path, message


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert a file or URL to Markdown under AI_DOCS/ingested/"
    )
    parser.add_argument("source", help="Path to a file, or a URL")
    parser.add_argument("--type", dest="type_override", help="Override the detected type")
    parser.add_argument(
        "--out-root", default="AI_DOCS/ingested", help="Output root (default AI_DOCS/ingested)"
    )
    parser.add_argument(
        "--stdout", action="store_true", help="Print raw markitdown output to stdout instead of writing"
    )
    parser.add_argument(
        "--allow-network",
        action="store_true",
        help="Permit fetching http(s)/YouTube URLs (external op, confirm first)",
    )
    parser.add_argument("--no-inventory", action="store_true", help="Skip the coverage inventory (not recommended)")
    parser.add_argument("--force-render", action="store_true", help="Rebuild the inventory and re-render assets")
    args = parser.parse_args()

    out, message = ingest(
        args.source,
        out_root=args.out_root,
        type_override=args.type_override,
        to_stdout=args.stdout,
        allow_network=args.allow_network,
        run_inventory=not args.no_inventory,
        force_render=args.force_render,
    )
    print(message)
    if isinstance(message, str) and message.startswith("Error"):
        raise SystemExit(1)
