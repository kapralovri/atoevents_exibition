"""Sponsorship / marketing partnership catalog (from the ato comm
Marketing Partnership Packages brochure). Prices in EUR.

The 20% discount is applied by the manager on the invoice, outside the
system — the catalog stores list prices.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

SHOP_DISCOUNT_PERCENT = 20

CATALOG: List[Dict[str, Any]] = [
    {
        "category": "Sponsorship Packages",
        "items": [
            {"sku": "PKG_DIAMOND", "name": "Diamond Sponsor", "price": 17000, "note": "4 available"},
            {"sku": "PKG_PLATINUM", "name": "Platinum Sponsor", "price": 15000, "note": "8 available"},
            {"sku": "PKG_GOLD", "name": "Gold Sponsor", "price": 13000, "note": "12 available"},
            {"sku": "PKG_SILVER", "name": "Silver Sponsor", "price": 10500, "note": "unlimited"},
        ],
    },
    {
        "category": "Branded Items for Attendees",
        "items": [
            {"sku": "ITEM_BACKPACK_1D", "name": "Backpack (1-day event)", "price": 12000},
            {"sku": "ITEM_BACKPACK_2D", "name": "Backpack (2-day event)", "price": 13000},
            {"sku": "ITEM_TEXTILE_BAG_1D", "name": "Textile Bag (1-day event)", "price": 9000},
            {"sku": "ITEM_TEXTILE_BAG_2D", "name": "Textile Bag (2-day event)", "price": 10000},
            {"sku": "ITEM_PAPER_BAG_1D", "name": "Paper Bag (1-day event)", "price": 6000},
            {"sku": "ITEM_PAPER_BAG_2D", "name": "Paper Bag (2-day event)", "price": 7000},
            {"sku": "ITEM_SAFETY_VEST_1D", "name": "Branded Safety Vest (1-day event)", "price": 5000},
            {"sku": "ITEM_SAFETY_VEST_2D", "name": "Branded Safety Vest (2-day event)", "price": 6000},
            {"sku": "ITEM_NOTEPAD_1D", "name": "Notepad (1-day event)", "price": 4000},
            {"sku": "ITEM_NOTEPAD_2D", "name": "Notepad (2-day event)", "price": 5000},
            {"sku": "ITEM_PEN", "name": "Pen", "price": 2200},
            {"sku": "ITEM_LANYARD", "name": "Lanyard", "price": 7000},
            {"sku": "ITEM_SCALE", "name": "Luggage Scale", "price": 4000},
            {"sku": "ITEM_LUGGAGE_STRAP", "name": "Branded Luggage Strap", "price": 9000},
            {"sku": "ITEM_RBF_TAG", "name": "Remove Before Flight Tag", "price": 3500},
            {"sku": "ITEM_WATER_1D", "name": "Bottled Water (1-day event)", "price": 4500},
            {"sku": "ITEM_WATER_2D", "name": "Bottled Water (2-day event)", "price": 5500},
            {"sku": "ITEM_TRAVEL_HOLDER", "name": "Travel Holder", "price": 3500},
            {"sku": "ITEM_CARDS_HOLDER", "name": "Cards Holder", "price": 3500},
            {"sku": "ITEM_BAGGAGE_HOOK", "name": "Baggage Hook", "price": 4000},
        ],
    },
    {
        "category": "Branded Areas",
        "items": [
            {"sku": "AREA_STAGE", "name": "Conference Stage", "price": 10000},
            {"sku": "AREA_CHAIRS", "name": "Chairs in the Conference Hall", "price": 10000},
            {"sku": "AREA_ENTRANCE", "name": "Branded Entrance Area", "price": 10000},
            {"sku": "AREA_PHOTO_ZONE", "name": "Photo Zone with Instant Photos and Champagne", "price": 6000},
            {"sku": "AREA_COFFEE_STATION", "name": "Coffee Station & Branded Paper Cups", "price": 5000},
            {"sku": "AREA_SWEETS_TABLE", "name": "Table with Sweets", "price": 5000},
            {"sku": "AREA_FOYER_VIDEO", "name": "Company Video on the Foyer Screen (20 times, up to 1 min)", "price": 2200},
            {"sku": "SPN_REGISTRATION", "name": "Registration Sponsor", "price": 9000},
            {"sku": "SPN_WIFI", "name": "Wi-Fi Sponsor", "price": 5000},
            {"sku": "SPN_MEETING_ZONE", "name": "Meeting Zone Sponsor", "price": 6000},
            {"sku": "SPN_NETWORKING_APP", "name": "Networking App Sponsor", "price": 5000},
            {"sku": "SPN_MEETING_SCHEDULER", "name": "One-to-One Meeting Scheduler", "price": 3000},
            {"sku": "SPN_EMAIL_BLAST", "name": "Email Blast", "price": 2500},
        ],
    },
    {
        "category": "Branded Catering",
        "items": [
            {"sku": "CAT_CATERING", "name": "Catering Sponsor (all coffee breaks + lunch, day 1)", "price": 20000},
            {"sku": "CAT_BREAKFAST", "name": "Pre-Conference Business Breakfast Sponsor", "price": 15000},
            {"sku": "CAT_RECEPTION", "name": "Networking Reception", "price": 9500},
            {"sku": "CAT_REFRESHMENT_STATION", "name": "Refreshment Station Sponsor", "price": 8000},
            {"sku": "CAT_NETWORKING_LUNCH", "name": "Networking Lunch", "price": 6500},
            {"sku": "CAT_CHAMPAGNE", "name": "Welcome Champagne", "price": 6000},
            {"sku": "CAT_REFRESHMENT_BAR", "name": "Refreshment Bar", "price": 5000},
            {"sku": "CAT_COFFEE_BAR", "name": "Coffee Bar Sponsor", "price": 5000},
            {"sku": "CAT_PROMO_COFFEE_BREAK", "name": "Promo Coffee Break Sponsor (with 15-min presentation)", "price": 4500},
            {"sku": "CAT_COFFEE_BREAK", "name": "Coffee Break Sponsor", "price": 3500},
            {"sku": "CAT_EYE_OPENING", "name": "Eye-Opening Coffee Break", "price": 3500},
        ],
    },
    {
        "category": "Branding Opportunities",
        "items": [
            {"sku": "BRD_OUTDOOR_DEMO", "name": "Outdoor Equipment Demonstration", "price": 7000},
            {"sku": "BRD_OUTDOOR_BANNER", "name": "Outdoor Banner (4×2.5 m)", "price": 6000},
            {"sku": "BRD_BIG_BANNER", "name": "Big Banner (6.8×3.5 m)", "price": 5000},
            {"sku": "BRD_COLUMN_BANNER", "name": "Column-Size Banner", "price": 5000},
            {"sku": "BRD_COLUMN_STICKER", "name": "Column Sticker (3.9×2.2 m)", "price": 4000},
            {"sku": "BRD_AD_BACK_COVER", "name": "Ad in the Conference Booklet (1 page, back cover)", "price": 4000},
            {"sku": "BRD_AD_INSIDE", "name": "Ad in the Conference Booklet (1 page, inside)", "price": 2500},
            {"sku": "BRD_PROMO_DISTRIBUTION", "name": "Distribution of Promotional Materials", "price": 2500},
            {"sku": "BRD_ROLLUP", "name": "Roll-up", "price": 1500},
        ],
    },
]

_BY_SKU: Dict[str, Dict[str, Any]] = {
    item["sku"]: item for cat in CATALOG for item in cat["items"]
}


def get_item(sku: str) -> Optional[Dict[str, Any]]:
    return _BY_SKU.get(sku)
