"""One-off: translate Cyrillic stand package aliases to English.

Run: python -m scripts.englishify_stand_aliases
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal
from app.models.event import Event

TRANSLATIONS = {
    "СТАРТ": "START",
    "Старт": "START",
    "ПРО": "PRO",
    "Про": "PRO",
    "ИНДИВИДУАЛ": "INDIVIDUAL",
    "Индивидуал": "INDIVIDUAL",
}


def main() -> None:
    db = SessionLocal()
    changed = 0
    try:
        for ev in db.query(Event).all():
            for attr in ("alias_shell", "alias_system", "alias_bespoke"):
                val = (getattr(ev, attr) or "").strip()
                if val in TRANSLATIONS:
                    setattr(ev, attr, TRANSLATIONS[val])
                    changed += 1
        db.commit()
        print(f"Updated {changed} alias value(s)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
