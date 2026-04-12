from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    exhibitor_id: Mapped[int] = mapped_column(ForeignKey("exhibitors.id", ondelete="CASCADE"))
    section: Mapped[str] = mapped_column(String(32))  # GRAPHICS, COMPANY, PARTICIPANTS
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="OPEN")  # OPEN, RESOLVED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
