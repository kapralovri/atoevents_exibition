"""add status and stand_slots to events

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-12

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="upcoming",
        ),
    )
    op.add_column(
        "events",
        sa.Column(
            "stand_slots",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("events", "stand_slots")
    op.drop_column("events", "status")
