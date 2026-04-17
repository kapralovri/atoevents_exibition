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
    required: bool = True


# ── Overlay zones per stand configuration ────────────────────────────────────
#
# Key format: "{PACKAGE}_{CONFIGURATION}"
# Zone values: (left%, top%, width%, height%) — percentages of backdrop image.
#
# BASIC.jpg (SHELL_ONLY / SYSTEM LINEAR):
#   Front-facing linear stand. Fascia at top, info-desk bottom-right.
#
# PRO.jpg (SYSTEM ANGULAR):
#   Corner L-shaped stand, viewed at ~45°.
#   banner_eyelet_1 = left wall, banner_eyelet_2 = right (angled) wall.
#   Zones are approximate and should be refined with the final backdrop coords.
#
# NOTE: Zones are calibrated against the wireframe backdrop images uploaded
# by the admin per stand type.  When the admin uploads a new backdrop, the
# zones remain the same (they describe areas of the *template* image).

_ZONES_LINEAR: dict[str, tuple[float, float, float, float]] = {
    "information_desk": (54.5, 53.0, 24.5, 21.0),
    "fascia_board":     (11.5,  4.5, 77.0, 11.5),
    "fascia_1":         (11.5,  4.5, 48.0, 11.5),
    "fascia_2":         (59.5,  4.5, 29.0, 11.5),
    "fascia_3":         (76.0,  4.5, 14.0, 11.5),
    "banner_eyelet_1":  (13.0, 17.5, 24.0, 54.0),
    "banner_eyelet_2":  (38.0, 17.5, 23.0, 54.0),
    "banner_eyelet_3":  (52.0, 17.5, 19.5, 44.0),
    "glass_panel_1":    (13.0, 17.5, 22.0, 26.0),
    "glass_panel_2":    (35.5, 17.5, 22.0, 26.0),
    "glass_panel_3":    (58.0, 17.5, 22.0, 26.0),
    "glass_panel_4":    (13.0, 44.0, 22.0, 26.0),
    "glass_panel_5":    (35.5, 44.0, 22.0, 26.0),
    "glass_panel_6":    (58.0, 44.0, 22.0, 26.0),
}

# PRO angular stand (corner, L-shape viewed at 45°).
# Left wall: banner_eyelet_1  |  Right wall: banner_eyelet_2
# Info desk: centred in front of the corner.
_ZONES_ANGULAR: dict[str, tuple[float, float, float, float]] = {
    "information_desk": (35.0, 57.0, 26.0, 24.0),
    "fascia_1":         ( 5.0,  9.0, 43.0,  9.5),
    "fascia_2":         (47.5,  6.0, 47.5,  9.5),
    "banner_eyelet_1":  ( 5.0, 19.0, 43.0, 66.0),   # left wall
    "banner_eyelet_2":  (47.5, 15.5, 47.5, 64.5),   # right wall (angled)
}

_ZONES_PENINSULA: dict[str, tuple[float, float, float, float]] = {
    "information_desk": (40.0, 55.0, 20.0, 22.0),
    "fascia_1":         ( 5.0,  4.5, 30.0, 10.5),
    "fascia_2":         (35.0,  4.5, 30.0, 10.5),
    "fascia_3":         (65.0,  4.5, 18.0, 10.5),
    "banner_eyelet_1":  ( 5.0, 16.0, 28.0, 52.0),
    "banner_eyelet_2":  (36.0, 16.0, 28.0, 52.0),
}

# Map: "{PACKAGE}_{CONFIGURATION}" → zone dict
OVERLAY_ZONES_BY_CONFIG: dict[str, dict[str, tuple[float, float, float, float]]] = {
    "SHELL_ONLY_LINEAR":   _ZONES_LINEAR,
    "SYSTEM_LINEAR":       _ZONES_LINEAR,
    "BESPOKE_LINEAR":      _ZONES_LINEAR,
    "SHELL_ONLY_ANGULAR":  _ZONES_ANGULAR,
    "SYSTEM_ANGULAR":      _ZONES_ANGULAR,
    "BESPOKE_ANGULAR":     _ZONES_ANGULAR,
    "SHELL_ONLY_PENINSULA": _ZONES_PENINSULA,
    "SYSTEM_PENINSULA":    _ZONES_PENINSULA,
    "BESPOKE_PENINSULA":   _ZONES_PENINSULA,
}

# Flat fallback used by CSS overlay (legacy — kept for backward compat)
OVERLAY_ZONES: dict[str, tuple[float, float, float, float]] = _ZONES_LINEAR


def get_overlay_zones(
    stand_package: str, stand_configuration: str
) -> dict[str, tuple[float, float, float, float]]:
    """Return zone map for the given package + configuration combination."""
    key = f"{stand_package.upper()}_{stand_configuration.upper()}"
    return OVERLAY_ZONES_BY_CONFIG.get(key, _ZONES_LINEAR)


# ─────────────────────────────────────────────────────────────────────────────

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


def _fascia_slots(cfg: str, area_m2: float, height_mm: float, is_bespoke: bool = False) -> list[GraphicSlot]:
    """Return fascia slot(s) for the given configuration.

    Stand depth is always 3 m (торец = 3000 мм).
    Fascia width = length of the open facade side.
    Facade length = area_m2 / 3 * 1000 mm  (e.g. 9 m² / 3 × 1000 = 3000 mm).

    BESPOKE stands: fascia is 500 mm narrower than the facade because the
    structural profile of glass panels occupies the ends.
    Formula: fascia_w = facade_w - 500
    """
    cfg_u = cfg.upper()
    DEPTH_MM = 3000.0  # always 3 m deep
    facade_w = round(area_m2 / 3 * 1000)  # e.g. 9→3000, 12→4000, 15→5000 …
    fascia_w = (facade_w - 500.0) if is_bespoke else facade_w

    if cfg_u == "LINEAR":
        return [GraphicSlot("fascia_board", f"Fascia Board ({fascia_w:.0f}×{height_mm:.0f} mm)", fascia_w, height_mm)]

    if cfg_u == "ANGULAR":
        # Facade + one side (depth = 3000 mm; same bespoke reduction)
        side_w = (DEPTH_MM - 500.0) if is_bespoke else DEPTH_MM
        return [
            GraphicSlot("fascia_1", f"Fascia Board {fascia_w:.0f}×{height_mm:.0f} mm", fascia_w, height_mm),
            GraphicSlot("fascia_2", f"Fascia Board {side_w:.0f}×{height_mm:.0f} mm", side_w, height_mm),
        ]

    if cfg_u == "PENINSULA":
        # Facade + two sides
        side_w = (DEPTH_MM - 500.0) if is_bespoke else DEPTH_MM
        return [
            GraphicSlot("fascia_1", f"Fascia Board {fascia_w:.0f}×{height_mm:.0f} mm", fascia_w, height_mm),
            GraphicSlot("fascia_2", f"Fascia Board {side_w:.0f}×{height_mm:.0f} mm", side_w, height_mm),
            GraphicSlot("fascia_3", f"Fascia Board {side_w:.0f}×{height_mm:.0f} mm", side_w, height_mm),
        ]

    # Fallback
    return [GraphicSlot("fascia_board", f"Fascia Board ({fascia_w:.0f}×{height_mm:.0f} mm)", fascia_w, height_mm)]


def _banner_slots(cfg: str, area_m2: float) -> list[GraphicSlot]:
    """Return banner slot(s) for SYSTEM BOOTH.

    Banner dimensions from the technical requirements:
      Height (H) = 2400 mm  (fixed — full stand height minus fascia)
      Width  (W) = wall_length_mm − 100 mm  (e.g. 3000 mm wall → 2900 mm banner)

    For LINEAR stands:
      - 9 m² (3×3): back wall = 3 m → one banner 2400×2900
        (The doc shows 3 banners 2400×2900 for 9 m², but 3×2900=8700 mm doesn't fit on 3 m.
         Likely this means a single banner cut in 3 pieces for production — stored as 1 file.)
      - 12 m² (4×3): back wall = 4 m → banner 2400×3900
      - 15 m² (5×3): back wall = 5 m → banner 2400×4900  …etc.

    For ANGULAR: back wall (facade length) + one side wall (3000 mm).
    For PENINSULA: back wall (facade length) only (two sides are enclosed).
    """
    cfg_u = cfg.upper()
    BANNER_H = 2400.0
    facade_w = round(area_m2 / 3 * 1000)  # mm
    facade_banner_w = facade_w - 100       # e.g. 3 m → 2900, 4 m → 3900

    slots: list[GraphicSlot] = []

    if cfg_u == "LINEAR":
        slots.append(GraphicSlot(
            "banner_eyelet_1",
            f"Banner on eyelets — back wall ({BANNER_H:.0f}×{facade_banner_w:.0f} mm)",
            BANNER_H, facade_banner_w,
        ))

    elif cfg_u == "ANGULAR":
        # Facade wall + one side wall (3000 mm)
        side_banner_w = 2900.0  # 3000 − 100
        slots.append(GraphicSlot(
            "banner_eyelet_1",
            f"Banner — back wall ({BANNER_H:.0f}×{facade_banner_w:.0f} mm)",
            BANNER_H, facade_banner_w,
        ))
        slots.append(GraphicSlot(
            "banner_eyelet_2",
            f"Banner — side wall ({BANNER_H:.0f}×{side_banner_w:.0f} mm)",
            BANNER_H, side_banner_w,
        ))

    elif cfg_u == "PENINSULA":
        # Only back wall is enclosed; two open sides have no banner
        slots.append(GraphicSlot(
            "banner_eyelet_1",
            f"Banner on eyelets — back wall ({BANNER_H:.0f}×{facade_banner_w:.0f} mm)",
            BANNER_H, facade_banner_w,
        ))

    else:
        slots.append(GraphicSlot(
            "banner_eyelet_1",
            f"Banner on eyelets ({BANNER_H:.0f}×{facade_banner_w:.0f} mm)",
            BANNER_H, facade_banner_w,
        ))

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


def slot_dict_for_api(slot: GraphicSlot, stand_package: str = "SHELL_ONLY", stand_configuration: str = "LINEAR") -> dict[str, Any]:
    wmin, wmax, hmin, hmax = expected_pixel_range(slot.width_mm, slot.height_mm)
    zones = get_overlay_zones(stand_package, stand_configuration)
    zone = zones.get(slot.key)
    result: dict[str, Any] = {
        "key": slot.key,
        "label": slot.label,
        "width_mm": slot.width_mm,
        "height_mm": slot.height_mm,
        "expected_pixels": {"width_min": wmin, "width_max": wmax, "height_min": hmin, "height_max": hmax},
        "dpi_range": {"min": 75, "max": 100},
    }
    if zone:
        result["overlay_zone"] = {"x": zone[0], "y": zone[1], "w": zone[2], "h": zone[3]}
    return result
