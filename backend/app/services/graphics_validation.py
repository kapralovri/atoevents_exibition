from __future__ import annotations

import io

from PIL import Image, ImageOps

from app.config import settings
from app.services.stand_matrix import GraphicSlot, expected_pixel_range


def validate_tiff_from_path(path: str, slot: GraphicSlot) -> tuple[bool, str, dict]:
    """Validate TIFF file on disk."""
    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)
            fmt = (im.format or "").upper()
            if fmt not in ("TIFF", "TIF"):
                return False, "File must be TIFF.", {}

            w, h = im.size
            dpi_x, dpi_y = _resolve_dpi(im)
            if dpi_x is None or dpi_y is None:
                return False, "Could not read DPI from TIFF. Ensure DPI is embedded (75–100).", {
                    "width_px": w,
                    "height_px": h,
                }

            if dpi_x < 75 or dpi_x > 100 or dpi_y < 75 or dpi_y > 100:
                return (
                    False,
                    f"DPI must be between 75 and 100 (got {dpi_x:.1f}×{dpi_y:.1f}).",
                    {"width_px": w, "height_px": h, "dpi_x": dpi_x, "dpi_y": dpi_y},
                )

            wmin, wmax, hmin, hmax = expected_pixel_range(slot.width_mm, slot.height_mm)
            tol = slot.tolerance_pct / 100.0
            w_ok = wmin * (1 - tol) <= w <= wmax * (1 + tol)
            h_ok = hmin * (1 - tol) <= h <= hmax * (1 + tol)
            if not (w_ok and h_ok):
                return (
                    False,
                    f"Pixel size {w}×{h} does not match expected range for {slot.label} "
                    f"(approx {wmin}–{wmax} × {hmin}–{hmax} at 75–100 DPI, ±{slot.tolerance_pct}%).",
                    {"width_px": w, "height_px": h, "dpi_x": dpi_x, "dpi_y": dpi_y},
                )

            meta = {"width_px": w, "height_px": h, "dpi_x": dpi_x, "dpi_y": dpi_y}
            return True, "", meta
    except Exception as e:  # noqa: BLE001
        return False, f"Invalid or corrupted TIFF: {e}", {}


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


def build_preview_jpeg_from_path(path: str, max_bytes: int = settings.preview_max_bytes) -> bytes:
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
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
    """Downscale to JPEG under max_bytes."""
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
