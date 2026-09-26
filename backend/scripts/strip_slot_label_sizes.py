"""One-off: rewrite persisted graphic_uploads.slot_label without dimensions.

Slot labels used to embed sizes, e.g. "Information Desk (1140×540 mm)" —
but sizes vary per stand, so stand_matrix.py no longer includes them. The
label is copied into graphic_uploads at upload time, so rows uploaded
before the change still carry the old text. This regenerates each row's
label from the current slot definitions for its exhibitor's stand
(matching on slot_key), falling back to stripping a trailing size.

Idempotent. Run: python -m scripts.strip_slot_label_sizes [--dry-run]
"""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal
from app.models.exhibitor import Exhibitor
from app.models.graphic import GraphicUpload
from app.services.stand_matrix import slots_for_exhibitor

_TRAILING_SIZE = re.compile(r"\s*\(?\s*\d+\s*[×x]\s*\d+\s*mm\s*\)?\s*$")


def main(dry_run: bool) -> None:
    db = SessionLocal()
    changed = 0
    try:
        labels_by_exhibitor: dict[int, dict[str, str]] = {}
        for gu in db.query(GraphicUpload).all():
            labels = labels_by_exhibitor.get(gu.exhibitor_id)
            if labels is None:
                ex = db.query(Exhibitor).filter(Exhibitor.id == gu.exhibitor_id).first()
                labels = {}
                if ex:
                    labels = {
                        s.key: s.label
                        for s in slots_for_exhibitor(ex.stand_package, ex.stand_configuration, ex.area_m2)
                    }
                labels_by_exhibitor[gu.exhibitor_id] = labels

            new_label = labels.get(gu.slot_key) or _TRAILING_SIZE.sub("", gu.slot_label or "").strip()
            if new_label and new_label != gu.slot_label:
                print(f"  #{gu.id} exhibitor {gu.exhibitor_id} [{gu.slot_key}]: {gu.slot_label!r} -> {new_label!r}")
                if not dry_run:
                    gu.slot_label = new_label
                changed += 1

        if dry_run:
            db.rollback()
            print(f"[dry-run] {changed} label(s) would change")
        else:
            db.commit()
            print(f"Updated {changed} label(s)")
    finally:
        db.close()


if __name__ == "__main__":
    main(dry_run="--dry-run" in sys.argv)
