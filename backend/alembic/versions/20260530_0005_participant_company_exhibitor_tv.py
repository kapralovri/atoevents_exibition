"""add participant.company and exhibitor.tv_location

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-30

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("participants", sa.Column("company", sa.String(512), nullable=False, server_default=""))
    op.add_column("exhibitors", sa.Column("tv_location", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("participants", "company")
    op.drop_column("exhibitors", "tv_location")
