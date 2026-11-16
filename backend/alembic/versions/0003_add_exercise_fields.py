"""Add exercise fields

Revision ID: 0003_exercise_fields
Revises: 0002_patient_fields
Create Date: 2026-10-17 17:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003_exercise_fields'
down_revision = '0002_patient_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('exercises', sa.Column('pose_config', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('exercises', sa.Column('safe_range', sa.String(length=64), nullable=True))
    op.add_column('exercises', sa.Column('color', sa.String(length=32), nullable=True))
    op.add_column('exercises', sa.Column('default_duration', sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column('exercises', 'default_duration')
    op.drop_column('exercises', 'color')
    op.drop_column('exercises', 'safe_range')
    op.drop_column('exercises', 'pose_config')
