"""Resolve notification recipients for an event.

Every event has one responsible manager and any number of observers. Both
exhibitor-triggered notifications (new uploads, submissions, requests) and
organizer-triggered status changes are routed to this set of people.
"""

from __future__ import annotations

from typing import List

from sqlalchemy.orm import Session

from app.config import settings
from app.models.event import Event
from app.models.user import User


def event_recipient_emails(
    db: Session,
    event: Event | None,
    *,
    fallback_admin: bool = True,
) -> List[str]:
    """Return the de-duplicated, active email addresses for an event's team.

    Order: responsible first, then observers. When no team is assigned and
    ``fallback_admin`` is True, falls back to ``settings.admin_notify_email`` so
    notifications are never silently dropped.
    """
    ids: List[int] = []
    if event is not None:
        if event.responsible_id:
            ids.append(event.responsible_id)
        for oid in (event.observer_ids or []):
            try:
                ids.append(int(oid))
            except (TypeError, ValueError):
                continue

    emails: List[str] = []
    if ids:
        # Preserve responsible-first ordering by mapping id -> email.
        users = db.query(User).filter(User.id.in_(set(ids))).all()
        by_id = {u.id: u for u in users}
        for uid in ids:
            u = by_id.get(uid)
            if u and u.email and u.is_active:
                emails.append(u.email)

    if not emails and fallback_admin and settings.admin_notify_email:
        emails = [settings.admin_notify_email]

    # De-duplicate, preserving order.
    seen: set[str] = set()
    out: List[str] = []
    for e in emails:
        if e not in seen:
            seen.add(e)
            out.append(e)
    return out
