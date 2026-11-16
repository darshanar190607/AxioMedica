"""Add patient recovery fields

Revision ID: 0002_patient_fields
Revises: 0001_initial_schema
Create Date: 2026-10-17 17:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002_patient_fields'
down_revision = '0001_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('patients', sa.Column('injured_ankle', sa.String(length=32), nullable=True, server_default='Left'))
    op.add_column('patients', sa.Column('injury_type', sa.String(length=64), nullable=True, server_default='Ankle Sprain'))
    op.add_column('patients', sa.Column('recovery_stage', sa.Integer(), nullable=True, server_default='2'))
    op.add_column('patients', sa.Column('current_week', sa.Integer(), nullable=True, server_default='3'))
    op.add_column('patients', sa.Column('total_weeks', sa.Integer(), nullable=True, server_default='6'))
    op.add_column('patients', sa.Column('recovery_percent', sa.Integer(), nullable=True, server_default='72'))
    op.add_column('patients', sa.Column('assigned_clinician_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_patients_assigned_clinician', 'patients', 'users', ['assigned_clinician_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_patients_assigned_clinician', 'patients', type_='foreignkey')
    op.drop_column('patients', 'assigned_clinician_id')
    op.drop_column('patients', 'recovery_percent')
    op.drop_column('patients', 'total_weeks')
    op.drop_column('patients', 'current_week')
    op.drop_column('patients', 'recovery_stage')
    op.drop_column('patients', 'injury_type')
    op.drop_column('patients', 'injured_ankle')
