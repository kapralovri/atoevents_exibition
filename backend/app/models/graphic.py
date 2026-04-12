from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class GraphicUpload(Base):
    __tablename__ = "graphic_uploads"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    exhibitor_id: Mapped[int] = mapped_column(ForeignKey("exhibitors.id", ondelete="CASCADE"))
    slot_key: Mapped[str] = mapped_column(String(128), index=True)
    slot_label: Mapped[str] = mapped_column(String(512))

    original_filename: Mapped[str] = mapped_column(String(512))
    mime_type: Mapped[str] = mapped_column(String(128))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    s3_key: Mapped[str] = mapped_column(String(1024))
    preview_s3_key: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    width_px: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height_px: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    dpi_x: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dpi_y: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    validation_status: Mapped[str] = mapped_column(String(32), default="PENDING")  # PENDING, VALID, INVALID
    validation_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    exhibitor: Mapped["Exhibitor"] = relationship("Exhibitor", back_populates="graphic_uploads")
