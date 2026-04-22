from __future__ import annotations

import io
import os

from PIL import Image, ImageOps

from app.config import settings
from app.services.stand_matrix import GraphicSlot, expected_pixel_range

# Allowed source formats
ALLOWED_EXTENSIONS = {".tif", ".tiff", ".pdf", ".jpg", ".jpeg"}
ALLOWED_MIME_TYPES = {
    "image/tiff",
    "image/jpeg",
    "application/pdf",
    "application/octet-stream",  # some browsers send this for TIFF or JPEG
}


def _ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()


# ── PDF helpers ───────────────────────────────────────────────────────────────

def _pdf_to_pil(path: str, dpi: int = 150) -> Image.Image:
    """Render first page of PDF to a PIL Image using PyMuPDF."""
    try:
        import fitz  # pymupdf
    except ImportError as exc:
        raise RuntimeError(
            "PyMuPDF is required for PDF validation. Install with: pip install pymupdf"
        ) from exc

    doc = fitz.open(path)
    page = doc.load_page(0)
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    doc.close()
    return img


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


# ── Main validators ───────────────────────────────────────────────────────────

def validate_tiff_from_path(path: str, slot: GraphicSlot) -> tuple[bool, str, dict]:
    """Validate TIFF file on disk."""
    try:
        with Image.open(path) as im:
            fmt = (im.format or "").upper()  # read format BEFORE exif_transpose loses it
            if fmt not in ("TIFF", "TIF"):
                return False, "File must be TIFF.", {}

            dpi_x, dpi_y = _resolve_dpi(im)  # read DPI before exif_transpose
            im = ImageOps.exif_transpose(im)
            w, h = im.size

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
    except Exception as e:  # noqa: BLE001
        return False, f"Invalid or corrupted TIFF: {e}", {}


def validate_pdf_from_path(path: str, slot: GraphicSlot) -> tuple[bool, str, dict]:
    """Validate PDF (first page) dimensions against slot specs."""
    try:
        img = _pdf_to_pil(path, dpi=96)
        w, h = img.size
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
            im = ImageOps.exif_transpose(im)
            w, h = im.size
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

def build_preview_jpeg_from_path(path: str, max_bytes: int = settings.preview_max_bytes) -> bytes:
    """Generate a small JPEG preview from a TIFF or PDF file."""
    ext = _ext(path)
    if ext == ".pdf":
        im = _pdf_to_pil(path, dpi=150)
    else:
        with Image.open(path) as raw:
            raw = ImageOps.exif_transpose(raw)
            im = raw.convert("RGB")

    im = im.convert("RGB")
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
