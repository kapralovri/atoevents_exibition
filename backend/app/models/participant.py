from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    exhibitor_id: Mapped[int] = mapped_column(ForeignKey("exhibitors.id", ondelete="CASCADE"))

    first_name: Mapped[str] = mapped_column(String(128))
    last_name: Mapped[str] = mapped_column(String(128))
    job_title: Mapped[str] = mapped_column(String(256))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    badge_type: Mapped[str] = mapped_column(String(32), default="COMPLIMENTARY")  # COMPLIMENTARY, ADDITIONAL

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    exhibitor: Mapped["Exhibitor"] = relationship("Exhibitor", back_populates="participants")
