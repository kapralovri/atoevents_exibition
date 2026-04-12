"""Graphic slot definitions from Product Brief (mm). Expected pixels at 75–100 DPI."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class GraphicSlot:
    key: str
    label: str
    width_mm: float
    height_mm: float
    tolerance_pct: float = 5.0


def _mm_to_px_at_dpi(mm: float, dpi: float) -> int:
    return int(round(mm / 25.4 * dpi))


def expected_pixel_range(
    width_mm: float, height_mm: float, dpi_min: float = 75, dpi_max: float = 100
) -> tuple[int, int, int, int]:
    w_low = _mm_to_px_at_dpi(width_mm, dpi_min)
    w_high = _mm_to_px_at_dpi(width_mm, dpi_max)
    h_low = _mm_to_px_at_dpi(height_mm, dpi_min)
    h_high = _mm_to_px_at_dpi(height_mm, dpi_max)
    return (min(w_low, w_high), max(w_low, w_high), min(h_low, h_high), max(h_low, h_high))


def _fascia_slots(cfg: str, area_m2: float, height_mm: float) -> list[GraphicSlot]:
    cfg_u = cfg.upper()
    if cfg_u == "LINEAR":
        fascia_w = max(1200.0, min(6000.0, area_m2 * 200))
        return [GraphicSlot("fascia_board", f"Fascia Board ({fascia_w:.0f}×{height_mm:.0f} mm)", fascia_w, height_mm)]
    if cfg_u == "ANGULAR":
        return [
            GraphicSlot("fascia_1", f"Fascia Board 3000×{height_mm:.0f} mm", 3000, height_mm),
            GraphicSlot("fascia_2", f"Fascia Board 2000×{height_mm:.0f} mm", 2000, height_mm),
        ]
    if cfg_u == "PENINSULA":
        return [
            GraphicSlot("fascia_1", f"Fascia Board 3000×{height_mm:.0f} mm", 3000, height_mm),
            GraphicSlot("fascia_2", f"Fascia Board 3000×{height_mm:.0f} mm", 3000, height_mm),
            GraphicSlot("fascia_3", f"Fascia Board 2000×{height_mm:.0f} mm", 2000, height_mm),
        ]
    return [GraphicSlot("fascia_board", f"Fascia Board (×{height_mm:.0f} mm)", 3000, height_mm)]


def _banner_slots(cfg: str, area_m2: float) -> list[GraphicSlot]:
    cfg_u = cfg.upper()
    slots: list[GraphicSlot] = []
    if cfg_u == "LINEAR" and area_m2 <= 9:
        for i in range(3):
            slots.append(
                GraphicSlot(f"banner_eyelet_{i+1}", f"Banner on eyelets {i+1} (2400×2900 mm)", 2400, 2900)
            )
    elif cfg_u == "LINEAR":
        slots.append(GraphicSlot("banner_eyelet_1", "Banner 2400×2900 mm", 2400, 2900))
        slots.append(GraphicSlot("banner_eyelet_2", "Banner 2400×2900 mm", 2400, 2900))
        slots.append(GraphicSlot("banner_eyelet_3", "Banner 2400×custom mm", 2400, 2500))
    elif cfg_u == "ANGULAR" and area_m2 <= 9:
        for i in range(2):
            slots.append(GraphicSlot(f"banner_eyelet_{i+1}", f"Banner {i+1} (2400×2900 mm)", 2400, 2900))
    else:
        slots.append(GraphicSlot("banner_eyelet_1", "Banner on eyelets (2400×2900 mm)", 2400, 2900))
    return slots


def slots_for_exhibitor(
    stand_package: str,
    stand_configuration: str,
    area_m2: float,
) -> list[GraphicSlot]:
    pkg = stand_package.upper()
    cfg = stand_configuration.upper()
    slots: list[GraphicSlot] = [
        GraphicSlot("information_desk", "Information Desk (1140×540 mm)", 1140, 540),
    ]

    fascia_h = 300.0
    if pkg == "BESPOKE":
        fascia_h = 500.0

    slots.extend(_fascia_slots(cfg, area_m2, fascia_h))

    if pkg in ("SYSTEM", "BESPOKE"):
        slots.extend(_banner_slots(cfg, area_m2))

    if pkg == "BESPOKE":
        for i in range(6):
            slots.append(GraphicSlot(f"glass_panel_{i+1}", f"Glass panel {i+1} (1020×1020 mm)", 1020, 1020))

    return slots


def slot_dict_for_api(slot: GraphicSlot) -> dict[str, Any]:
    wmin, wmax, hmin, hmax = expected_pixel_range(slot.width_mm, slot.height_mm)
    return {
        "key": slot.key,
        "label": slot.label,
        "width_mm": slot.width_mm,
        "height_mm": slot.height_mm,
        "expected_pixels": {"width_min": wmin, "width_max": wmax, "height_min": hmin, "height_max": hmax},
        "dpi_range": {"min": 75, "max": 100},
    }
