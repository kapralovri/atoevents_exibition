"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-11

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("venue_address", sa.Text(), nullable=True),
        sa.Column("website_url", sa.String(length=1024), nullable=True),
        sa.Column("deadline_graphics_initial", sa.Date(), nullable=True),
        sa.Column("deadline_company_profile", sa.Date(), nullable=True),
        sa.Column("deadline_participants", sa.Date(), nullable=True),
        sa.Column("deadline_final_graphics", sa.Date(), nullable=True),
        sa.Column("reminder_offsets_days", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("alias_shell", sa.String(length=64), nullable=False),
        sa.Column("alias_system", sa.String(length=64), nullable=False),
        sa.Column("alias_bespoke", sa.String(length=64), nullable=False),
        sa.Column("backdrop_s3_keys", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "event_documents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("doc_type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("s3_key", sa.String(length=1024), nullable=False),
        sa.Column("version_label", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "faq_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("question", sa.String(length=1024), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "exhibitors",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=512), nullable=False),
        sa.Column("stand_package", sa.String(length=32), nullable=False),
        sa.Column("stand_configuration", sa.String(length=32), nullable=False),
        sa.Column("area_m2", sa.Float(), nullable=False),
        sa.Column("glass_panel_notes", sa.Text(), nullable=True),
        sa.Column("manual_acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("manual_defer_until_next_login", sa.Boolean(), nullable=False),
        sa.Column("gdpr_consent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("graphics_status", sa.String(length=32), nullable=False),
        sa.Column("company_status", sa.String(length=32), nullable=False),
        sa.Column("participants_status", sa.String(length=32), nullable=False),
        sa.Column("graphics_admin_comment", sa.Text(), nullable=True),
        sa.Column("company_admin_comment", sa.Text(), nullable=True),
        sa.Column("section_graphics_locked", sa.Boolean(), nullable=False),
        sa.Column("section_company_locked", sa.Boolean(), nullable=False),
        sa.Column("section_participants_locked", sa.Boolean(), nullable=False),
        sa.Column("fully_locked", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_event_type"), "audit_logs", ["event_type"], unique=False)

    op.create_table(
        "change_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exhibitor_id", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(length=32), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["exhibitor_id"], ["exhibitors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "company_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exhibitor_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=512), nullable=False),
        sa.Column("website", sa.String(length=1024), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("logo_s3_key", sa.String(length=1024), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["exhibitor_id"], ["exhibitors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exhibitor_id"),
    )

    op.create_table(
        "equipment_orders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exhibitor_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["exhibitor_id"], ["exhibitors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "equipment_line_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("sku", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["order_id"], ["equipment_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "graphic_uploads",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exhibitor_id", sa.Integer(), nullable=False),
        sa.Column("slot_key", sa.String(length=128), nullable=False),
        sa.Column("slot_label", sa.String(length=512), nullable=False),
        sa.Column("original_filename", sa.String(length=512), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("s3_key", sa.String(length=1024), nullable=False),
        sa.Column("preview_s3_key", sa.String(length=1024), nullable=True),
        sa.Column("width_px", sa.Integer(), nullable=True),
        sa.Column("height_px", sa.Integer(), nullable=True),
        sa.Column("dpi_x", sa.Float(), nullable=True),
        sa.Column("dpi_y", sa.Float(), nullable=True),
        sa.Column("validation_status", sa.String(length=32), nullable=False),
        sa.Column("validation_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["exhibitor_id"], ["exhibitors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_graphic_uploads_slot_key"), "graphic_uploads", ["slot_key"], unique=False)

    op.create_table(
        "participants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("exhibitor_id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(length=128), nullable=False),
        sa.Column("last_name", sa.String(length=128), nullable=False),
        sa.Column("job_title", sa.String(length=256), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("badge_type", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["exhibitor_id"], ["exhibitors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("participants")
    op.drop_index(op.f("ix_graphic_uploads_slot_key"), table_name="graphic_uploads")
    op.drop_table("graphic_uploads")
    op.drop_table("equipment_line_items")
    op.drop_table("equipment_orders")
    op.drop_table("company_profiles")
    op.drop_table("change_requests")
    op.drop_index(op.f("ix_audit_logs_event_type"), table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_table("exhibitors")
    op.drop_table("faq_items")
    op.drop_table("event_documents")
    op.drop_table("events")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
