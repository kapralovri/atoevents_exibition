from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    exhibitor_id: Mapped[int] = mapped_column(ForeignKey("exhibitors.id", ondelete="CASCADE"), unique=True)

    company_name: Mapped[str] = mapped_column(String(512))
    website: Mapped[str] = mapped_column(String(1024))
    description: Mapped[str] = mapped_column(Text)
    logo_s3_key: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    exhibitor: Mapped["Exhibitor"] = relationship("Exhibitor", back_populates="company_profile")
