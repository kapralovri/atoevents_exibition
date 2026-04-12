from datetime import date
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.exhibitor import Exhibitor


def refresh_exhibitor_locks(exhibitor: "Exhibitor", event: "Event", today: Optional[date] = None) -> None:
    """Apply deadline-based section locks (FR-12)."""
    today = today or date.today()
    if exhibitor.fully_locked:
        return

    if event.deadline_final_graphics and today > event.deadline_final_graphics:
        exhibitor.section_graphics_locked = True
    elif event.deadline_graphics_initial and today > event.deadline_graphics_initial:
        # Initial graphics deadline passed — lock only if not yet under review (simplified: lock if still NOT_UPLOADED)
        if exhibitor.graphics_status == "NOT_UPLOADED":
            exhibitor.section_graphics_locked = True

    if event.deadline_company_profile and today > event.deadline_company_profile:
        if exhibitor.company_status in ("DRAFT", "UNDER_REVIEW"):
            exhibitor.section_company_locked = True

    if event.deadline_participants and today > event.deadline_participants:
        if exhibitor.participants_status == "NOT_SUBMITTED":
            exhibitor.section_participants_locked = True
