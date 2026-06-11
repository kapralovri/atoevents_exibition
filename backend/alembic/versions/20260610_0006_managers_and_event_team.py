"""managers role + event responsible/observers, seed manager accounts

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Schema ────────────────────────────────────────────────────────────────
    op.add_column("users", sa.Column("full_name", sa.String(256), nullable=True))

    op.add_column("events", sa.Column("responsible_id", sa.Integer(), nullable=True))
    op.add_column(
        "events",
        sa.Column("observer_ids", JSONB, nullable=False, server_default="[]"),
    )
    op.create_foreign_key(
        "fk_events_responsible_id_users",
        "events",
        "users",
        ["responsible_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ── Data: seed manager accounts (idempotent) ──────────────────────────────
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        from app.services.managers_seed import seed_managers

        seed_managers(session)
    finally:
        session.close()


def downgrade() -> None:
    op.drop_constraint("fk_events_responsible_id_users", "events", type_="foreignkey")
    op.drop_column("events", "observer_ids")
    op.drop_column("events", "responsible_id")
    op.drop_column("users", "full_name")
