"""Build the coverage inventory of an ORIGINAL source file.

Opens the source directly (not the markitdown output) and writes, beside the
ingested Markdown:

    <basename>.inventory.json   per-unit facts plus document-level parts
    <basename>.assets/          PNG renders of every flagged unit, plus
                                assets/media/ with the raw embedded media

A unit (slide, page, sheet, Markdown section, DOCX figure) is flagged
`needs_visual: true` with reasons when it holds a picture, a chart, a shape
diagram, SmartArt, a connector, an embedded object, or (PDF) a scanned page.
Flagged units get a PNG with a long edge of about 1600 px for the model visual
pass described in SKILL.md.

Idempotent: when an inventory for the same source bytes exists and its images
are present, it is reused without re-rendering unless --force is passed.

Usage:
    python scripts/inventory.py <source> [--out-dir DIR] [--type T] [--force]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from source_types import OOXML_TYPES, detect_type

SCHEMA_VERSION = 1


def sha256_file(path: Path) -> str:
    """Return the SHA-256 hex digest of a file's bytes."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _builder(ftype: str):
    """Return the per-format build function for an ingestion type."""
    import inv_other

    if ftype == "pptx":
        import inv_pptx

        return inv_pptx.build
    if ftype == "docx":
        import inv_docx

        return inv_docx.build
    if ftype == "xlsx":
        import inv_xlsx

        return inv_xlsx.build
    return {"pdf": inv_other.build_pdf, "markdown": inv_other.build_md, "image": inv_other.build_image}.get(
        ftype, inv_other.build_generic
    )


def _extract_media(src: Path, assets_dir: Path) -> list[str]:
    """Copy every embedded media file of an OOXML package into assets/media/."""
    if src.suffix.lower() not in OOXML_TYPES:
        return []
    out = []
    with zipfile.ZipFile(src) as z:
        for name in z.namelist():
            if "/media/" in name and not name.endswith("/"):
                dest = assets_dir / "media" / name.replace("/", "_")
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(z.read(name))
                out.append(f"{assets_dir.name}/media/{dest.name}")
    return out


def _reusable(inv_path: Path, sha: str, md_dir: Path) -> dict | None:
    """Return a cached inventory when it matches the source bytes and its images exist."""
    if not inv_path.exists():
        return None
    try:
        old = json.loads(inv_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if old.get("sha256") != sha or old.get("schema") != SCHEMA_VERSION:
        return None
    images = [img for u in old.get("units", []) for img in u.get("images", [])]
    return old if all((md_dir / img).exists() for img in images) else None


def build_inventory(
    source: str,
    md_dir: Path,
    ftype: str | None = None,
    temp_root: Path | None = None,
    force: bool = False,
    do_render: bool = True,
) -> tuple[dict, Path]:
    """Build (or reuse) the inventory for a local source. Returns (inventory, json_path)."""
    src = Path(source)
    ftype = ftype or detect_type(source)
    md_dir.mkdir(parents=True, exist_ok=True)
    basename = src.stem or "source"
    inv_path = md_dir / f"{basename}.inventory.json"
    assets_dir = md_dir / f"{basename}.assets"
    sha = sha256_file(src)
    cached = None if force else _reusable(inv_path, sha, md_dir)
    if cached is not None:
        return cached, inv_path
    if assets_dir.exists():
        shutil.rmtree(assets_dir)
    assets_dir.mkdir(parents=True)
    temp_root = temp_root or md_dir.parent.parent / ".temp" / "markitdown"
    temp_dir = temp_root / f"{basename}-{sha[:10]}"
    ctx = {"assets_dir": assets_dir, "rel": assets_dir.name, "temp_dir": temp_dir, "do_render": do_render}
    try:
        result = _builder(ftype)(src, ctx)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
    result["document"]["media"] = _extract_media(src, assets_dir)
    inventory = {
        "schema": SCHEMA_VERSION,
        "source": source,
        "type": ftype,
        "basename": basename,
        "sha256": sha,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "render": result["render"],
        "units": result["units"],
        "document": result["document"],
        "visual_units": [u["id"] for u in result["units"] if u["needs_visual"]],
    }
    inv_path.write_text(json.dumps(inventory, indent=2, default=str), encoding="utf-8")
    return inventory, inv_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Inventory an original source for coverage checks")
    parser.add_argument("source", help="Path to the original file")
    parser.add_argument("--out-dir", help="Folder that holds the ingested .md (default AI_DOCS/ingested/<type>)")
    parser.add_argument("--type", dest="type_override", help="Override the detected type")
    parser.add_argument("--temp-dir", help="Scratch root (default AI_DOCS/.temp/markitdown)")
    parser.add_argument("--force", action="store_true", help="Rebuild and re-render even when cached")
    parser.add_argument("--no-render", action="store_true", help="Skip PNG rendering (inventory only)")
    args = parser.parse_args()
    if not Path(args.source).exists():
        print(f"Error: file not found: {args.source}")
        raise SystemExit(1)
    kind = args.type_override or detect_type(args.source)
    out_dir = Path(args.out_dir) if args.out_dir else Path("AI_DOCS/ingested") / kind
    inv, path = build_inventory(
        args.source, out_dir, kind, Path(args.temp_dir) if args.temp_dir else None, args.force, not args.no_render
    )
    print(f"Inventory {path.as_posix()}: {len(inv['units'])} units, {len(inv['visual_units'])} need the visual pass")
