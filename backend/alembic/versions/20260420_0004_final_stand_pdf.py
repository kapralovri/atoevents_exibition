"""add final stand PDF columns to exhibitors

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "exhibitors",
        sa.Column("final_stand_pdf_s3_key", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "exhibitors",
        sa.Column("final_stand_pdf_filename", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "exhibitors",
        sa.Column("final_stand_pdf_uploaded_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("exhibitors", "final_stand_pdf_uploaded_at")
    op.drop_column("exhibitors", "final_stand_pdf_filename")
    op.drop_column("exhibitors", "final_stand_pdf_s3_key")
