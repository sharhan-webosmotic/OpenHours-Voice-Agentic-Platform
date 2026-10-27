"""Derive a reusable branded letterhead template from a finished .docx.

Given a polished, hand-finished Word document (corporate letterhead with a
logo header, watermark, copyright footer, embedded brand fonts and brand
heading styles), this produces a LEAN template that:

  - keeps headers, footers, watermark, embedded fonts, styles, and the
    section properties (header/footer references + titlePg);
  - empties the body, leaving a single ``{{CONTENT}}`` placeholder paragraph
    just before the trailing sectPr;
  - drops the old body media (diagrams, cover graphics) + OLE/EMF objects and
    their relationships, so the template does not carry stale content.

The /docx-from-markdown converter then opens this template, injects a fresh
cover + body before the placeholder, and removes the placeholder — preserving
all corporate chrome while swapping only the variable content.

Usage:
    python build_template.py <finished.docx> <out-template.docx>
"""

from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path


def build_template(src: Path, out: Path) -> None:
    zin = zipfile.ZipFile(src)

    # 1. Empty the body; keep the trailing sectPr; insert {{CONTENT}} marker.
    doc = zin.read("word/document.xml").decode("utf-8")
    body_m = re.search(r"(<w:body>)(.*)(</w:body>)", doc, re.S)
    if not body_m:
        raise SystemExit("ERROR: no <w:body> found in document.xml")
    sect_m = re.search(r"<w:sectPr[ >].*?</w:sectPr>", body_m.group(2), re.S)
    sectpr = sect_m.group(0) if sect_m else ""
    marker = "<w:p><w:r><w:t>{{CONTENT}}</w:t></w:r></w:p>"
    doc = (
        doc[: body_m.start()]
        + body_m.group(1) + marker + sectpr + body_m.group(3)
        + doc[body_m.end():]
    )

    # 2. Strip body image/OLE relationships (body is now empty).
    rels = zin.read("word/_rels/document.xml.rels").decode("utf-8")
    rels = re.sub(r"<Relationship [^>]*(?:image|oleObject)[^>]*/>", "", rels)

    # 3. Keep only media/fonts referenced by header/footer/fontTable rels.
    keep: set[str] = set()
    for n in zin.namelist():
        if n.endswith(".rels") and n != "word/_rels/document.xml.rels":
            data = zin.read(n).decode("utf-8", "replace")
            for tgt in re.findall(r'Target="([^"]*)"', data):
                if any(d in tgt for d in ("media/", "embeddings/", "fonts/")):
                    keep.add(tgt.split("/")[-1])

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            n = item.filename
            if n == "word/document.xml":
                zout.writestr(item, doc)
                continue
            if n == "word/_rels/document.xml.rels":
                zout.writestr(item, rels)
                continue
            if n.startswith("word/media/") or n.startswith("word/embeddings/"):
                if n.split("/")[-1] not in keep:
                    continue
            zout.writestr(item, zin.read(n))

    print(f"Template written: {out} ({out.stat().st_size // 1024} KB)")
    print(f"Kept media/fonts: {sorted(keep)}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python build_template.py <finished.docx> <out-template.docx>",
              file=sys.stderr)
        sys.exit(1)
    src_p = Path(sys.argv[1]).resolve()
    out_p = Path(sys.argv[2]).resolve()
    if not src_p.exists():
        print(f"ERROR: source not found: {src_p}", file=sys.stderr)
        sys.exit(2)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    build_template(src_p, out_p)
