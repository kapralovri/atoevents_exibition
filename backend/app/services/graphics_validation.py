"""Validation and preview generation for exhibitor print graphics.

Print-size files are huge once decoded (a 2.9 x 2.4 m wall at 100 DPI is
~108 Mpx, i.e. 320-430 MB of raw pixels), so this module is written to keep
memory bounded:

* validation reads only file headers (size, DPI, EXIF orientation, PDF page
  box) and never decodes pixel data;
* previews are produced at most `settings.preview_max_side_px` on the long
  side: JPEG is downscaled during decoding, PDF is rendered directly at the
  preview scale, TIFF is decoded once and reduced in place;
* `heavy_image_slot()` lets only one heavy decode run at a time across all
  uvicorn workers in the container.
"""
from __future__ import annotations

import fcntl
import io
import os
import tempfile
import time
from contextlib import contextmanager
from typing import Iterator

from PIL import Image

from app.config import settings
from app.services.stand_matrix import GraphicSlot, expected_pixel_range

# Pillow's default decompression-bomb limit (error above ~179 Mpx) rejects
# legitimate print files, e.g. a 4.9 m banner at 100 DPI is 182 Mpx. Raise the
# library ceiling to our own configurable cap; the slot-aware check below
# rejects oversized images before any pixels are decoded.
Image.MAX_IMAGE_PIXELS = settings.graphics_max_pixels

# Allowed source formats
ALLOWED_EXTENSIONS = {".tif", ".tiff", ".pdf", ".jpg", ".jpeg"}
ALLOWED_MIME_TYPES = {
    "image/tiff",
    "image/jpeg",
    "application/pdf",
    "application/octet-stream",  # some browsers send this for TIFF or JPEG
}

# Small slots still get a generous floor so a designer exporting at a higher
# DPI gets a size warning rather than a rejection. 50 Mpx decodes in ~200 MB.
_MIN_PIXEL_LIMIT = 50_000_000

# EXIF orientation -> transpose that makes the image upright (same mapping as
# PIL.ImageOps.exif_transpose).
_ORIENTATION_TRANSPOSE = {
    2: Image.Transpose.FLIP_LEFT_RIGHT,
    3: Image.Transpose.ROTATE_180,
    4: Image.Transpose.FLIP_TOP_BOTTOM,
    5: Image.Transpose.TRANSPOSE,
    6: Image.Transpose.ROTATE_270,
    7: Image.Transpose.TRANSVERSE,
    8: Image.Transpose.ROTATE_90,
}

_LOCK_PATH = os.path.join(tempfile.gettempdir(), "exb-graphics-processing.lock")


class GraphicsBusyError(RuntimeError):
    """Another heavy image job held the processing slot for too long."""


@contextmanager
def heavy_image_slot(timeout: float | None = None) -> Iterator[None]:
    """Serialise heavy image decoding across all worker processes.

    Uses an flock on a file in the container's temp dir, so it covers every
    uvicorn worker and thread; the kernel releases it if a worker dies.
    """
    wait = settings.graphics_lock_timeout_seconds if timeout is None else timeout
    with open(_LOCK_PATH, "a") as fh:
        deadline = time.monotonic() + wait
        while True:
            try:
                fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise GraphicsBusyError("Image processing is busy")
                time.sleep(0.25)
        try:
            yield
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)


def _ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()


def _orientation(im: Image.Image) -> int:
    """EXIF orientation that we still have to apply ourselves.

    Pillow's TIFF plugin already reports `size` upright and transposes the
    pixels itself in `load()`, so TIFFs need no extra handling (doing it again
    would rotate twice). JPEG orientation is left to the caller.
    """
    if im.format == "TIFF":
        return 1
    try:
        return int(im.getexif().get(0x0112, 1) or 1)
    except Exception:  # noqa: BLE001
        return 1


def _oriented_size(im: Image.Image) -> tuple[int, int]:
    """Image size after EXIF orientation is applied, without decoding pixels."""
    w, h = im.size
    if _orientation(im) in (5, 6, 7, 8):
        return h, w
    return w, h


def pixel_limit_for_slot(slot: GraphicSlot) -> int:
    """Largest raster (in pixels) we are willing to decode for this slot."""
    _, wmax, _, hmax = expected_pixel_range(slot.width_mm, slot.height_mm)
    tol = 1 + max(slot.tolerance_pct / 100.0, 0.30)
    slot_limit = int(wmax * tol * hmax * tol)
    return min(settings.graphics_max_pixels, max(_MIN_PIXEL_LIMIT, slot_limit))


def _too_large_message(w: int, h: int, slot: GraphicSlot) -> str:
    _, wmax, _, hmax = expected_pixel_range(slot.width_mm, slot.height_mm)
    size = f"{w}×{h} px" if w and h else "the image"
    return (
        f"Image is too large ({size}). For {slot.label} export at 75–100 DPI "
        f"(about {wmax}×{hmax} px)."
    )


def _check_pixel_limit(w: int, h: int, slot: GraphicSlot) -> str | None:
    if w * h > pixel_limit_for_slot(slot):
        return _too_large_message(w, h, slot)
    return None


# ── PDF helpers ───────────────────────────────────────────────────────────────

def _fitz():
    try:
        import fitz  # pymupdf
    except ImportError as exc:
        raise RuntimeError(
            "PyMuPDF is required for PDF validation. Install with: pip install pymupdf"
        ) from exc
    return fitz


def _pdf_first_page_size_pt(path: str) -> tuple[float, float]:
    """Visible size of page 1 in points, read from the page box (no rendering)."""
    fitz = _fitz()
    with fitz.open(path) as doc:
        if doc.page_count < 1:
            raise ValueError("PDF has no pages")
        rect = doc.load_page(0).rect
        return float(rect.width), float(rect.height)


def _pdf_preview_image(path: str) -> Image.Image:
    """Render page 1 straight at preview scale (never at full print size)."""
    fitz = _fitz()
    with fitz.open(path) as doc:
        page = doc.load_page(0)
        rect = page.rect
        long_side_pt = max(rect.width, rect.height, 1.0)
        zoom = min(150 / 72, settings.preview_max_side_px / long_side_pt)
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


# ── TIFF helpers ──────────────────────────────────────────────────────────────

def _resolve_dpi(im: Image.Image) -> tuple[float | None, float | None]:
    info = im.info
    x = info.get("dpi", (None, None))[0] if isinstance(info.get("dpi"), tuple) else None
    y = info.get("dpi", (None, None))[1] if isinstance(info.get("dpi"), tuple) else None
    if x and y:
        return float(x), float(y)
    try:
        if hasattr(im, "tag_v2"):
            xf = im.tag_v2.get(282)
            yf = im.tag_v2.get(283)
            if xf and yf:
                return float(xf), float(yf)
    except Exception:
        pass
    return None, None


# ── Main validators (header-only, no pixel decoding) ─────────────────────────

def validate_tiff_from_path(path: str, slot: GraphicSlot) -> tuple[bool, str, dict]:
    """Validate TIFF file on disk."""
    try:
        with Image.open(path) as im:
            fmt = (im.format or "").upper()
            if fmt not in ("TIFF", "TIF"):
                return False, "File must be TIFF.", {}

            dpi_x, dpi_y = _resolve_dpi(im)
            w, h = _oriented_size(im)

            too_large = _check_pixel_limit(w, h, slot)
            if too_large:
                return False, too_large, {"width_px": w, "height_px": h}

            # Only reject if DPI is explicitly set AND outside the allowed range.
            dpi_known = dpi_x is not None and dpi_y is not None and dpi_x > 1 and dpi_y > 1
            if dpi_known and (dpi_x < 75 or dpi_x > 100 or dpi_y < 75 or dpi_y > 100):
                return (
                    False,
                    f"DPI must be between 75 and 100 (got {dpi_x:.1f}×{dpi_y:.1f}).",
                    {"width_px": w, "height_px": h, "dpi_x": dpi_x, "dpi_y": dpi_y},
                )

            wmin, wmax, hmin, hmax = expected_pixel_range(slot.width_mm, slot.height_mm)
            tol = slot.tolerance_pct / 100.0
            w_ok = wmin * (1 - tol) <= w <= wmax * (1 + tol)
            h_ok = hmin * (1 - tol) <= h <= hmax * (1 + tol)

            meta = {"width_px": w, "height_px": h, "dpi_x": dpi_x, "dpi_y": dpi_y}

            if not (w_ok and h_ok):
                warning = (
                    f"⚠ Pixel size {w}×{h} may not match print specs for {slot.label} "
                    f"(expected approx {wmin}–{wmax} × {hmin}–{hmax} px at 75–100 DPI). "
                    f"Admin will verify before production."
                )
                meta["size_warning"] = warning
                return True, warning, meta

            return True, "", meta
    except Image.DecompressionBombError:
        return False, _too_large_message(0, 0, slot), {}
    except Exception as e:  # noqa: BLE001
        return False, f"Invalid or corrupted TIFF: {e}", {}


def validate_pdf_from_path(path: str, slot: GraphicSlot) -> tuple[bool, str, dict]:
    """Validate PDF (first page) dimensions against slot specs."""
    try:
        w_pt, h_pt = _pdf_first_page_size_pt(path)
        # Same numbers the old 96-DPI render produced, without rendering.
        w, h = round(w_pt * 96 / 72), round(h_pt * 96 / 72)
        meta = {"width_px": w, "height_px": h, "dpi_x": 96.0, "dpi_y": 96.0, "source": "pdf"}

        # PDF page dimensions: soft-check only (print DPI unknown at preview stage)
        wmin, wmax, hmin, hmax = expected_pixel_range(slot.width_mm, slot.height_mm)
        # Use wide tolerance for PDF (3× normal) since render DPI is arbitrary
        tol = max(slot.tolerance_pct / 100.0, 0.30)
        w_ok = wmin * (1 - tol) <= w <= wmax * (1 + tol)
        h_ok = hmin * (1 - tol) <= h <= hmax * (1 + tol)

        if not (w_ok and h_ok):
            warning = (
                f"⚠ PDF page size {w}×{h} px at 96 DPI may not match print specs for {slot.label}. "
                f"Admin will verify before production."
            )
            meta["size_warning"] = warning
            return True, warning, meta

        return True, "", meta
    except RuntimeError as e:
        return False, str(e), {}
    except Exception as e:  # noqa: BLE001
        return False, f"Invalid or corrupted PDF: {e}", {}


def validate_jpeg_from_path(path: str, slot: GraphicSlot) -> tuple[bool, str, dict]:
    """Validate JPEG/JPG file — soft size check, no DPI enforcement."""
    try:
        with Image.open(path) as im:
            w, h = _oriented_size(im)
        too_large = _check_pixel_limit(w, h, slot)
        if too_large:
            return False, too_large, {"width_px": w, "height_px": h}
        dpi_x, dpi_y = 96.0, 96.0  # JPEGs rarely carry accurate DPI
        meta = {"width_px": w, "height_px": h, "dpi_x": dpi_x, "dpi_y": dpi_y}
        wmin, wmax, hmin, hmax = expected_pixel_range(slot.width_mm, slot.height_mm)
        tol = max(slot.tolerance_pct / 100.0, 0.30)
        w_ok = wmin * (1 - tol) <= w <= wmax * (1 + tol)
        h_ok = hmin * (1 - tol) <= h <= hmax * (1 + tol)
        if not (w_ok and h_ok):
            warning = (
                f"⚠ JPEG size {w}×{h} px may not match print specs for {slot.label}. "
                f"Admin will verify before production."
            )
            meta["size_warning"] = warning
            return True, warning, meta
        return True, "", meta
    except Image.DecompressionBombError:
        return False, _too_large_message(0, 0, slot), {}
    except Exception as e:  # noqa: BLE001
        return False, f"Invalid or corrupted JPEG: {e}", {}


def validate_graphic_from_path(path: str, slot: GraphicSlot) -> tuple[bool, str, dict]:
    """Auto-detect TIFF, PDF, or JPEG and validate accordingly."""
    ext = _ext(path)
    if ext == ".pdf":
        return validate_pdf_from_path(path, slot)
    if ext in (".jpg", ".jpeg"):
        return validate_jpeg_from_path(path, slot)
    return validate_tiff_from_path(path, slot)


# ── Preview generation ────────────────────────────────────────────────────────

def _raster_preview_image(path: str) -> Image.Image:
    """Decode a TIFF/JPEG at most once and shrink it to preview size.

    Peak memory is roughly one copy of the decoded source (TIFF) or a fraction
    of it (JPEG, which is downscaled by the decoder itself).
    """
    side = settings.preview_max_side_px
    with Image.open(path) as im:
        orientation = _orientation(im)
        if im.format == "JPEG":
            im.draft("RGB", (side, side))
        im.thumbnail((side, side), Image.Resampling.LANCZOS)
        small = im.convert("RGB")
    transpose = _ORIENTATION_TRANSPOSE.get(orientation)
    if transpose is not None:
        small = small.transpose(transpose)
    return small


def build_preview_jpeg_from_path(path: str, max_bytes: int = settings.preview_max_bytes) -> bytes:
    """Generate a small JPEG preview from a TIFF, JPEG or PDF file.

    Raises on unreadable pixel data; callers should treat that as a corrupted
    upload. Run inside `heavy_image_slot()`.
    """
    if _ext(path) == ".pdf":
        im = _pdf_preview_image(path)
    else:
        im = _raster_preview_image(path)

    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=85, optimize=True)
    data = buf.getvalue()
    if len(data) <= max_bytes:
        return data

    scale = 0.7
    for _ in range(6):
        w, h = im.size
        im2 = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im2.save(buf, format="JPEG", quality=75, optimize=True)
        data = buf.getvalue()
        if len(data) <= max_bytes:
            return data
        scale *= 0.75
    return data


def build_preview_jpeg(image_bytes: bytes, max_bytes: int = settings.preview_max_bytes) -> bytes:
    """Downscale raw image bytes to JPEG under max_bytes."""
    with Image.open(io.BytesIO(image_bytes)) as im:
        im = im.convert("RGB")
        quality = 82
        scale = 1.0
        for _ in range(8):
            w, h = im.size
            buf = io.BytesIO()
            im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS).save(
                buf, format="JPEG", quality=quality, optimize=True
            )
            data = buf.getvalue()
            if len(data) <= max_bytes or scale < 0.2:
                return data
            scale *= 0.75
            quality = max(55, quality - 10)
        return data
