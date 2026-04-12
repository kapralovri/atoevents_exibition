from datetime import datetime
from typing import Optional, List

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Exhibitor(Base):
    __tablename__ = "exhibitors"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    company_name: Mapped[str] = mapped_column(String(512))
    stand_package: Mapped[str] = mapped_column(String(32))  # SHELL_ONLY, SYSTEM, BESPOKE
    stand_configuration: Mapped[str] = mapped_column(String(32))  # LINEAR, ANGULAR, PENINSULA, ISLAND
    area_m2: Mapped[float] = mapped_column(Float)

    glass_panel_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    manual_acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    manual_defer_until_next_login: Mapped[bool] = mapped_column(Boolean, default=False)
    gdpr_consent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    graphics_status: Mapped[str] = mapped_column(String(32), default="NOT_UPLOADED")
    company_status: Mapped[str] = mapped_column(String(32), default="DRAFT")
    participants_status: Mapped[str] = mapped_column(String(32), default="NOT_SUBMITTED")

    graphics_admin_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    company_admin_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    section_graphics_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    section_company_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    section_participants_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    fully_locked: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    event: Mapped["Event"] = relationship("Event", back_populates="exhibitors")
    user: Mapped["User"] = relationship("User", back_populates="exhibitor_profiles", foreign_keys=[user_id])
    graphic_uploads: Mapped[List["GraphicUpload"]] = relationship(
        "GraphicUpload", back_populates="exhibitor", cascade="all, delete-orphan"
    )
    company_profile: Mapped[Optional["CompanyProfile"]] = relationship(
        "CompanyProfile", back_populates="exhibitor", uselist=False, cascade="all, delete-orphan"
    )
    participants: Mapped[List["Participant"]] = relationship(
        "Participant", back_populates="exhibitor", cascade="all, delete-orphan"
    )
    equipment_orders: Mapped[List["EquipmentOrder"]] = relationship(
        "EquipmentOrder", back_populates="exhibitor", cascade="all, delete-orphan"
    )
