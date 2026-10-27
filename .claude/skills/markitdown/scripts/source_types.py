"""Source type detection shared by ingest.py, inventory.py and verify_coverage.py."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

EXT_TYPE_MAP: dict[str, str] = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".doc": "docx",
    ".pptx": "pptx",
    ".ppt": "pptx",
    ".xlsx": "xlsx",
    ".xlsm": "xlsx",
    ".xls": "xlsx",
    ".csv": "data",
    ".tsv": "data",
    ".json": "data",
    ".xml": "data",
    ".md": "markdown",
    ".markdown": "markdown",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".gif": "image",
    ".bmp": "image",
    ".tiff": "image",
    ".webp": "image",
    ".mp3": "audio",
    ".wav": "audio",
    ".m4a": "audio",
    ".flac": "audio",
    ".ogg": "audio",
    ".html": "html",
    ".htm": "html",
    ".zip": "zip",
    ".epub": "epub",
}

OOXML_TYPES = {".docx", ".pptx", ".xlsx", ".xlsm"}


def is_url(source: str) -> bool:
    """Return True when the source looks like an http(s) URL."""
    return urlparse(source).scheme in ("http", "https")


def detect_type(source: str) -> str:
    """Map a path or URL to its ingestion type folder name."""
    if is_url(source):
        host = (urlparse(source).hostname or "").lower()
        if "youtube.com" in host or "youtu.be" in host:
            return "youtube"
        return "html"
    return EXT_TYPE_MAP.get(Path(source).suffix.lower(), "data")
