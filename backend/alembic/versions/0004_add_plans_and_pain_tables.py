"""Add plans and pain tables

Revision ID: 0004_plans_pain
Revises: 0003_exercise_fields
Create Date: 2026-10-17 17:25:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0004_plans_pain'
down_revision = '0003_exercise_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Update rehabilitation_plans columns
    op.add_column('rehabilitation_plans', sa.Column('clinician_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('rehabilitation_plans', sa.Column('status', sa.String(length=32), nullable=False, server_default='active'))
    op.add_column('rehabilitation_plans', sa.Column('is_approved', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('rehabilitation_plans', sa.Column('current_week', sa.Integer(), nullable=False, server_default='3'))
    op.add_column('rehabilitation_plans', sa.Column('total_weeks', sa.Integer(), nullable=False, server_default='6'))
    op.add_column('rehabilitation_plans', sa.Column('recovery_stage', sa.Integer(), nullable=False, server_default='2'))
    op.create_foreign_key('fk_plans_clinician', 'rehabilitation_plans', 'users', ['clinician_id'], ['id'], ondelete='SET NULL')

    # 2. Create plan_exercises table
    op.create_table(
        'plan_exercises',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('plan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('rehabilitation_plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('exercise_id', sa.Integer(), sa.ForeignKey('exercises.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sets', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('reps', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('frequency', sa.String(length=64), nullable=False, server_default='Twice a day'),
        sa.Column('duration', sa.String(length=32), nullable=False, server_default='5 min'),
        sa.Column('safe_range', sa.String(length=64), nullable=False, server_default='0° – 30°'),
        sa.Column('color', sa.String(length=32), nullable=False, server_default='#F5A623'),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_plan_exercises_plan_id'), 'plan_exercises', ['plan_id'], unique=False)
    op.create_index(op.f('ix_plan_exercises_exercise_id'), 'plan_exercises', ['exercise_id'], unique=False)

    # 3. Create pain_logs table
    op.create_table(
        'pain_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('pain_level', sa.Integer(), nullable=False),
        sa.Column('logged_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_pain_logs_patient_id'), 'pain_logs', ['patient_id'], unique=False)


def downgrade() -> None:
    op.drop_table('pain_logs')
    op.drop_table('plan_exercises')
    op.drop_constraint('fk_plans_clinician', 'rehabilitation_plans', type_='foreignkey')
    op.drop_column('rehabilitation_plans', 'recovery_stage')
    op.drop_column('rehabilitation_plans', 'total_weeks')
    op.drop_column('rehabilitation_plans', 'current_week')
    op.drop_column('rehabilitation_plans', 'is_approved')
    op.drop_column('rehabilitation_plans', 'status')
    op.drop_column('rehabilitation_plans', 'clinician_id')
