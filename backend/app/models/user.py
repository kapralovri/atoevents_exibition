from __future__ import annotations

import enum
from datetime import datetime
from typing import List

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EXHIBITOR = "exhibitor"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default=UserRole.EXHIBITOR.value)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    exhibitor_profiles: Mapped[List["Exhibitor"]] = relationship(
        "Exhibitor", back_populates="user", foreign_keys="Exhibitor.user_id"
    )
