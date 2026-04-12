from datetime import datetime
from typing import Optional, List

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EquipmentOrder(Base):
    __tablename__ = "equipment_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    exhibitor_id: Mapped[int] = mapped_column(ForeignKey("exhibitors.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(32), default="SUBMITTED")  # SUBMITTED, ACKNOWLEDGED
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    exhibitor: Mapped["Exhibitor"] = relationship("Exhibitor", back_populates="equipment_orders")
    line_items: Mapped[List["EquipmentLineItem"]] = relationship(
        "EquipmentLineItem", back_populates="order", cascade="all, delete-orphan"
    )


class EquipmentLineItem(Base):
    __tablename__ = "equipment_line_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("equipment_orders.id", ondelete="CASCADE"))
    sku: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(512))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    order: Mapped["EquipmentOrder"] = relationship("EquipmentOrder", back_populates="line_items")
