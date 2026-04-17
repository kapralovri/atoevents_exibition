"""add stand_inventory to events and stand_inventory_id to exhibitors

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Inventory list on the event: replaces the old per-package stand_slots
    op.add_column(
        "events",
        sa.Column(
            "stand_inventory",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    # Link exhibitor → inventory item (nullable for backward compat)
    op.add_column(
        "exhibitors",
        sa.Column("stand_inventory_id", sa.String(length=64), nullable=True),
    )
    # GIN index for fast JSON queries
    op.create_index(
        "ix_events_stand_inventory",
        "events",
        ["stand_inventory"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_events_stand_inventory", table_name="events")
    op.drop_column("exhibitors", "stand_inventory_id")
    op.drop_column("events", "stand_inventory")
