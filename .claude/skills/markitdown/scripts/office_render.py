"""Render document units to PNG for the markitdown visual pass.

Office files are rendered through the installed Office apps (PowerPoint, Word,
Excel) driven by COM from a `powershell.exe -NoProfile` subprocess, so no
pywin32 dependency is needed. PDF pages are rendered with pypdfium2. Every
image is normalized to a long edge of about LONG_EDGE pixels, a size a vision
model reads well.

COM is only available on Windows with Office installed. On any other host, or
when the Office app cannot start, the render functions return an error string
and the caller falls back to extracting embedded media.

Safety: every PowerShell job closes its document, calls Quit on the app it
started, releases COM objects, and finally stops any Office process it spawned
that is still alive. PowerPoint is single-instance, so when the operator
already has PowerPoint open the job closes only its own presentation.
"""

from __future__ import annotations

import base64
import json
import shutil
import subprocess
import sys
from pathlib import Path

LONG_EDGE = 1600
COM_TIMEOUT_S = 300

_PS_PRELUDE = r"""
$ErrorActionPreference = 'Stop'
$job = Get-Content -Raw -LiteralPath $env:ADF_RENDER_JOB | ConvertFrom-Json
$procName = $job.proc
$before = @(Get-Process -Name $procName -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$wasRunning = $before.Count -gt 0
$out = @{ ok = $false; files = @(); error = $null; figures = @(); pages = 0 }
function Release($o) { if ($null -ne $o) { try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($o) } catch {} } }
"""

_PS_EPILOGUE = r"""
[GC]::Collect(); [GC]::WaitForPendingFinalizers(); [GC]::Collect()
Start-Sleep -Milliseconds 400
$after = @(Get-Process -Name $procName -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
foreach ($p in $after) { if ($before -notcontains $p) { try { Stop-Process -Id $p -Force } catch {} } }
$out | ConvertTo-Json -Compress -Depth 5 | Set-Content -LiteralPath $job.result -Encoding UTF8
"""

_PS_PPTX = r"""
$app = $null; $pres = $null
try {
  $app = New-Object -ComObject PowerPoint.Application
  $pres = $app.Presentations.Open($job.src, -1, 0, 0)
  $w = [double]$pres.PageSetup.SlideWidth; $h = [double]$pres.PageSetup.SlideHeight
  $le = [double]$job.long_edge
  if ($w -ge $h) { $pw = [int]$le; $ph = [int]($le * $h / $w) } else { $ph = [int]$le; $pw = [int]($le * $w / $h) }
  foreach ($it in $job.items) {
    $slide = $pres.Slides.Item([int]$it.index)
    $slide.Export($it.path, 'PNG', $pw, $ph)
    Release $slide
    $out.files += $it.path
  }
  $out.ok = $true
} catch { $out.error = $_.Exception.Message }
finally {
  if ($null -ne $pres) { try { $pres.Close() } catch {}; Release $pres }
  if ($null -ne $app) { if (-not $wasRunning) { try { $app.Quit() } catch {} }; Release $app }
}
"""

_PS_DOCX = r"""
$app = $null; $doc = $null
try {
  $app = New-Object -ComObject Word.Application
  $app.Visible = $false; $app.DisplayAlerts = 0
  $doc = $app.Documents.Open($job.src, $false, $true, $false)
  $doc.ExportAsFixedFormat($job.pdf, 17)
  $out.pages = [int]$doc.ComputeStatistics(2)
  foreach ($s in $doc.InlineShapes) {
    try { $out.figures += @{ start = [int]$s.Range.Start; page = [int]$s.Range.Information(3) } } catch {}
    Release $s
  }
  foreach ($s in $doc.Shapes) {
    try { $out.figures += @{ start = [int]$s.Anchor.Start; page = [int]$s.Anchor.Information(3) } } catch {}
    Release $s
  }
  $out.files += $job.pdf
  $out.ok = $true
} catch { $out.error = $_.Exception.Message }
finally {
  if ($null -ne $doc) { try { $doc.Close(0) } catch {}; Release $doc }
  if ($null -ne $app) { try { $app.Quit(0) } catch {}; Release $app }
}
"""

_PS_XLSX = r"""
$app = $null; $wb = $null
try {
  $app = New-Object -ComObject Excel.Application
  $app.Visible = $false; $app.DisplayAlerts = $false; $app.ScreenUpdating = $false
  $wb = $app.Workbooks.Open($job.src, 0, $true)
  foreach ($it in $job.items) {
    $ws = $wb.Worksheets.Item([string]$it.name)
    if ($ws.Visible -ne -1) { $ws.Visible = -1 }
    try { $ps = $ws.PageSetup; $ps.Orientation = 2; $ps.Zoom = $false; $ps.FitToPagesWide = 1; $ps.FitToPagesTall = $false; Release $ps } catch {}
    $ws.ExportAsFixedFormat(0, $it.pdf)
    Release $ws
    $out.files += $it.pdf
  }
  $out.ok = $true
} catch { $out.error = $_.Exception.Message }
finally {
  if ($null -ne $wb) { try { $wb.Close($false) } catch {}; Release $wb }
  if ($null -ne $app) { try { $app.Quit() } catch {}; Release $app }
}
"""

_JOBS = {
    "pptx": ("POWERPNT", _PS_PPTX),
    "docx": ("WINWORD", _PS_DOCX),
    "xlsx": ("EXCEL", _PS_XLSX),
}


def com_available() -> bool:
    """Return True when this host can drive Office through PowerShell COM."""
    return sys.platform == "win32" and shutil.which("powershell.exe") is not None


def _run_com(kind: str, job: dict, temp_dir: Path) -> tuple[dict | None, str | None]:
    """Run one COM job of the given kind. Returns (result, error)."""
    if not com_available():
        return None, "Office COM unavailable on this host"
    proc, body = _JOBS[kind]
    temp_dir.mkdir(parents=True, exist_ok=True)
    job = dict(job, proc=proc, long_edge=LONG_EDGE, result=str(temp_dir / f"{kind}-result.json"))
    job_path = temp_dir / f"{kind}-job.json"
    job_path.write_text(json.dumps(job), encoding="utf-8")
    script = _PS_PRELUDE + body + _PS_EPILOGUE
    encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
    env = {**__import__("os").environ, "ADF_RENDER_JOB": str(job_path)}
    try:
        subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
            env=env, capture_output=True, timeout=COM_TIMEOUT_S, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, f"{kind} COM job failed: {exc}"
    result_path = Path(job["result"])
    if not result_path.exists():
        return None, f"{kind} COM job produced no result"
    result = json.loads(result_path.read_text(encoding="utf-8-sig"))
    if not result.get("ok"):
        return None, f"{kind} COM error: {result.get('error')}"
    return result, None


def normalize_image(src: Path | bytes, dest: Path) -> str | None:
    """Save an image as PNG with a long edge of at most LONG_EDGE. Returns error or None."""
    try:
        from io import BytesIO

        from PIL import Image

        img = Image.open(BytesIO(src) if isinstance(src, bytes) else src)
        img.load()
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            canvas = Image.new("RGB", img.size, "white")
            canvas.paste(img, mask=img.split()[-1])
            img = canvas
        elif img.mode != "RGB":
            img = img.convert("RGB")
        if max(img.size) > LONG_EDGE:
            img.thumbnail((LONG_EDGE, LONG_EDGE))
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, "PNG")
        return None
    except Exception as exc:
        return f"image normalize failed: {exc}"


def render_pdf_pages(pdf_path: Path, pages: dict[int, Path]) -> str | None:
    """Render 1-based PDF page numbers to the given PNG paths. Returns error or None."""
    try:
        import pypdfium2 as pdfium
    except ImportError:
        return "pypdfium2 not installed"
    pdf = pdfium.PdfDocument(str(pdf_path))
    try:
        for number, dest in pages.items():
            if number < 1 or number > len(pdf):
                continue
            page = pdf[number - 1]
            width, height = page.get_size()
            bitmap = page.render(scale=LONG_EDGE / max(width, height))
            dest.parent.mkdir(parents=True, exist_ok=True)
            bitmap.to_pil().convert("RGB").save(dest, "PNG")
            page.close()
    finally:
        pdf.close()
    return None


def pdf_page_count(pdf_path: Path) -> int:
    """Return the page count of a PDF, or 0 when it cannot be opened."""
    try:
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(str(pdf_path))
        count = len(pdf)
        pdf.close()
        return count
    except Exception:
        return 0


def render_pptx_slides(src: Path, slides: dict[int, Path], temp_dir: Path) -> str | None:
    """Export 1-based slide indexes to PNG via PowerPoint COM. Returns error or None."""
    items = [{"index": i, "path": str(p.resolve())} for i, p in slides.items()]
    for p in slides.values():
        p.parent.mkdir(parents=True, exist_ok=True)
    result, err = _run_com("pptx", {"src": str(src.resolve()), "items": items}, temp_dir)
    if err:
        return err
    for p in slides.values():
        if p.exists():
            normalize_image(p, p)
    return None


def export_docx_pdf(src: Path, temp_dir: Path) -> tuple[Path | None, dict | None, str | None]:
    """Export a DOCX to PDF via Word COM. Returns (pdf_path, com_result, error)."""
    pdf = (temp_dir / f"{src.stem}.docx.pdf").resolve()
    result, err = _run_com("docx", {"src": str(src.resolve()), "pdf": str(pdf)}, temp_dir)
    if err or not pdf.exists():
        return None, None, err or "Word produced no PDF"
    return pdf, result, None


def export_xlsx_sheets(src: Path, sheets: list[str], temp_dir: Path) -> tuple[dict[str, Path], str | None]:
    """Export named sheets to one PDF each via Excel COM. Returns ({name: pdf}, error)."""
    items, pdfs = [], {}
    for i, name in enumerate(sheets, 1):
        pdf = (temp_dir / f"{src.stem}.sheet{i:03d}.pdf").resolve()
        items.append({"name": name, "pdf": str(pdf)})
        pdfs[name] = pdf
    result, err = _run_com("xlsx", {"src": str(src.resolve()), "items": items}, temp_dir)
    if err:
        return {}, err
    return {n: p for n, p in pdfs.items() if p.exists()}, None
