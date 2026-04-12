from typing import Any, Optional, Dict

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def log_event(
    db: Session,
    *,
    user_id: Optional[int],
    event_type: str,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    row = AuditLog(
        user_id=user_id,
        event_type=event_type,
        ip_address=ip,
        user_agent=user_agent,
        payload=payload or {},
    )
    db.add(row)
    db.commit()
