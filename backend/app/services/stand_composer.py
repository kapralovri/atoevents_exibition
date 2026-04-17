"""Server-side stand preview compositor.

Downloads the backdrop and all uploaded graphic previews from S3, then
pastes each graphic at its configured zone on the backdrop.
Returns a JPEG bytestring.

Zone coordinates are percentages of the backdrop image dimensions.
"""
from __future__ import annotations

import io
import tempfile
from typing import Any

from PIL import Image, ImageOps

from app.services import storage
from app.services.stand_matrix import get_overlay_zones


def _pil_from_path(path: str) -> Image.Image:
    """Open any image (JPEG, PNG, TIFF, PDF-page) from a file path."""
    # Try pymupdf first for PDF (renders page 0 at 150 DPI)
    if path.lower().endswith(".pdf"):
        try:
            import fitz  # pymupdf
            doc = fitz.open(path)
            page = doc.load_page(0)
            mat = fitz.Matrix(150 / 72, 150 / 72)  # 150 DPI
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            doc.close()
            return img
        except ImportError:
            pass  # fall through to Pillow

    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        return im.convert("RGBA")


def _pil_from_bytes(data: bytes, suffix: str = ".jpg") -> Image.Image:
    """Open image from raw bytes."""
    if suffix.lower() == ".pdf":
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(data)
            tmp_path = f.name
        return _pil_from_path(tmp_path)
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im)
        return im.convert("RGBA")


def build_stand_composite(
    backdrop_s3_key: str,
    layers: list[dict[str, Any]],
    output_quality: int = 90,
    max_width: int = 2400,
) -> bytes:
    """Composite a stand preview image.

    Args:
        backdrop_s3_key: S3 key of the backdrop (PNG/JPEG wireframe).
        layers: list of dicts, each with:
            - ``preview_s3_key``: S3 key of the uploaded graphic preview JPEG.
            - ``zone``: dict with keys x, y, w, h (percentages of backdrop).
        output_quality: JPEG output quality (1–95).
        max_width: Maximum output width in pixels (keeps aspect ratio).

    Returns:
        JPEG bytes of the composited image.
    """
    # ── Load backdrop ────────────────────────────────────────────────────────
    with tempfile.NamedTemporaryFile(suffix=".jpg") as tf:
        storage.download_to_path(backdrop_s3_key, tf.name)
        backdrop = _pil_from_path(tf.name).convert("RGBA")

    bw, bh = backdrop.size

    # Downscale backdrop if very large (keep aspect)
    if bw > max_width:
        scale = max_width / bw
        backdrop = backdrop.resize((max_width, int(bh * scale)), Image.Resampling.LANCZOS)
        bw, bh = backdrop.size

    # ── Paste each graphic layer ─────────────────────────────────────────────
    for layer in layers:
        zone = layer.get("zone")
        preview_key = layer.get("preview_s3_key")
        if not zone or not preview_key:
            continue

        # Zone in pixels
        lx = int(zone["x"] / 100.0 * bw)
        ly = int(zone["y"] / 100.0 * bh)
        lw = max(1, int(zone["w"] / 100.0 * bw))
        lh = max(1, int(zone["h"] / 100.0 * bh))

        try:
            raw = storage.download_bytes(preview_key)
            graphic = _pil_from_bytes(raw).convert("RGBA")
            graphic = graphic.resize((lw, lh), Image.Resampling.LANCZOS)

            # Paste with alpha channel as mask so white graphic BG blends naturally
            backdrop.paste(graphic, (lx, ly), mask=graphic.split()[3])
        except Exception as exc:  # noqa: BLE001
            # Skip bad layer rather than crashing the whole preview
            print(f"[stand_composer] skip layer {preview_key}: {exc}")
            continue

    # ── Encode output ────────────────────────────────────────────────────────
    out = backdrop.convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=output_quality, optimize=True)
    return buf.getvalue()
