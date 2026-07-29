"""exhibitor company video task (optional, dismissible)

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-29

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "exhibitors",
        sa.Column("company_video_status", sa.String(32), nullable=False, server_default="NOT_STARTED"),
    )
    op.add_column(
        "exhibitors",
        sa.Column("company_video_url", sa.String(1024), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("exhibitors", "company_video_url")
    op.drop_column("exhibitors", "company_video_status")
