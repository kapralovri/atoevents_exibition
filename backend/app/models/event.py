from datetime import date, datetime
from typing import Any, Optional, List, Dict

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(512))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    venue_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    # Default offsets from event.start_date (days before) — editable per event
    deadline_graphics_initial: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    deadline_company_profile: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    deadline_participants: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    deadline_final_graphics: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    reminder_offsets_days: Mapped[List[Any]] = mapped_column(JSONB, default=list)  # e.g. [30, 14, 7, 3, 1]

    # Stand display aliases (STАРТ/ПРО/ИНДИВИДУАЛ ↔ internal codes)
    alias_shell: Mapped[str] = mapped_column(String(64), default="START")
    alias_system: Mapped[str] = mapped_column(String(64), default="PRO")
    alias_bespoke: Mapped[str] = mapped_column(String(64), default="INDIVIDUAL")

    # Low-res booth backdrop S3 keys per stand package (for preview composite)
    backdrop_s3_keys: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    # Event lifecycle status
    status: Mapped[str] = mapped_column(String(32), default="upcoming")

    # Available stand slot configuration per package (legacy — kept for backward compat)
    # {"SHELL_ONLY": {"enabled": true, "count": 10, "area_m2": 9}, ...}
    stand_slots: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    # New inventory: list of stand configurations with counts
    # [{"id": "so_9_lin", "package": "SHELL_ONLY", "area_m2": 9, "configuration": "LINEAR", "total": 5}, ...]
    stand_inventory: Mapped[Optional[List[Any]]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    documents: Mapped[List["EventDocument"]] = relationship(
        "EventDocument", back_populates="event", cascade="all, delete-orphan"
    )
    exhibitors: Mapped[List["Exhibitor"]] = relationship("Exhibitor", back_populates="event")


class EventDocument(Base):
    __tablename__ = "event_documents"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    doc_type: Mapped[str] = mapped_column(String(64))  # exhibitor_manual, technical_requirements, setup_schedule
    title: Mapped[str] = mapped_column(String(256))
    s3_key: Mapped[str] = mapped_column(String(1024))
    version_label: Mapped[str] = mapped_column(String(64), default="1.0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped["Event"] = relationship("Event", back_populates="documents")
