"""Tests for memory-bounded graphics validation / preview generation.

Run from backend/:  python -m pytest tests
"""
from __future__ import annotations

import io

import fitz
import pytest
from PIL import Image

from app.config import settings
from app.services import graphics_validation as gv
from app.services.stand_matrix import GraphicSlot

SLOT = GraphicSlot("back_wall", "Back Wall", 2900, 2400)


def _tiff(path, size, orientation=None, dpi=(100, 100)):
    im = Image.new("RGB", size, (200, 30, 30))
    kwargs = {"compression": "tiff_lzw", "dpi": dpi}
    if orientation:
        exif = Image.Exif()
        exif[0x0112] = orientation
        kwargs["exif"] = exif
    im.save(path, **kwargs)
    return str(path)


def _pdf(path, w_mm, h_mm):
    doc = fitz.open()
    pg = doc.new_page(width=w_mm / 25.4 * 72, height=h_mm / 25.4 * 72)
    pg.draw_rect(pg.rect, color=(1, 0, 0), fill=(1, 0, 0))
    doc.save(str(path))
    return str(path)


def _preview_size(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as im:
        return im.size


def test_tiff_validation_applies_exif_orientation_without_decoding(tmp_path):
    path = _tiff(tmp_path / "rot.tif", (400, 300), orientation=6)
    ok, _, meta = gv.validate_tiff_from_path(path, SLOT)
    assert ok
    assert (meta["width_px"], meta["height_px"]) == (300, 400)


def test_preview_is_upright_and_bounded(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "preview_max_side_px", 100)
    path = _tiff(tmp_path / "rot.tif", (400, 300), orientation=6)
    w, h = _preview_size(gv.build_preview_jpeg_from_path(path))
    assert max(w, h) <= 100
    assert h > w  # rotated to portrait like ImageOps.exif_transpose would


def test_jpeg_exif_orientation_applied(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "preview_max_side_px", 100)
    exif = Image.Exif()
    exif[0x0112] = 6
    path = tmp_path / "rot.jpg"
    Image.new("RGB", (400, 300), (0, 90, 200)).save(path, exif=exif)
    ok, _, meta = gv.validate_jpeg_from_path(str(path), SLOT)
    assert ok
    assert (meta["width_px"], meta["height_px"]) == (300, 400)
    w, h = _preview_size(gv.build_preview_jpeg_from_path(str(path)))
    assert h > w and max(w, h) <= 100


def test_jpeg_preview_bounded(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "preview_max_side_px", 256)
    path = tmp_path / "big.jpg"
    Image.new("RGB", (3000, 2000), (0, 90, 200)).save(path, quality=90)
    ok, _, meta = gv.validate_jpeg_from_path(str(path), SLOT)
    assert ok and meta["width_px"] == 3000
    assert max(_preview_size(gv.build_preview_jpeg_from_path(str(path)))) <= 256


def test_pdf_size_read_from_page_box(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "preview_max_side_px", 512)
    path = _pdf(tmp_path / "wall.pdf", 2900, 2400)
    ok, _, meta = gv.validate_pdf_from_path(path, SLOT)
    assert ok
    # Same values the former full 96-DPI render reported.
    assert (meta["width_px"], meta["height_px"]) == (10961, 9071)
    assert max(_preview_size(gv.build_preview_jpeg_from_path(path))) <= 512


def test_print_size_banner_is_not_rejected_by_pillow_bomb_limit():
    # 4.9 m banner at 100 DPI = 182 Mpx > Pillow's default error threshold.
    banner = GraphicSlot("banner", "Banner", 4900, 2400)
    assert gv.pixel_limit_for_slot(banner) >= 19291 * 9449
    assert Image.MAX_IMAGE_PIXELS == settings.graphics_max_pixels


def test_oversized_raster_rejected_before_decoding(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "graphics_max_pixels", 10_000)
    path = _tiff(tmp_path / "huge.tif", (200, 200))
    ok, msg, _ = gv.validate_tiff_from_path(path, SLOT)
    assert not ok
    assert "too large" in msg


def test_truncated_tiff_fails_in_preview(tmp_path):
    path = _tiff(tmp_path / "t.tif", (2000, 2000))
    raw = (tmp_path / "t.tif").read_bytes()
    (tmp_path / "t.tif").write_bytes(raw[: len(raw) // 3])
    with pytest.raises(Exception):
        gv.build_preview_jpeg_from_path(path)


def test_heavy_image_slot_is_exclusive():
    with gv.heavy_image_slot():
        with pytest.raises(gv.GraphicsBusyError):
            with gv.heavy_image_slot(timeout=0.3):
                pass
    with gv.heavy_image_slot(timeout=0.3):  # released after the first exits
        pass
