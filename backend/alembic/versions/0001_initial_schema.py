"""Initial schema including Auth, Patient profiles, Sessions, and Telemetry

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2026-10-11 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=512), nullable=False),
        sa.Column(
            'role',
            sa.Enum('patient', 'clinician', 'admin', name='user_role'),
            nullable=False,
        ),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. patients
    op.create_table(
        'patients',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('date_of_birth', sa.DateTime(timezone=True), nullable=True),
        sa.Column('phone', sa.String(length=32), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )

    # 3. refresh_tokens
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_refresh_tokens_token_hash'), 'refresh_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)

    # 4. consents
    op.create_table(
        'consents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column(
            'consent_type',
            sa.Enum('camera', 'data_processing', name='consent_type'),
            nullable=False,
        ),
        sa.Column('granted', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'consent_type', name='uq_consent_user_type'),
    )
    op.create_index(op.f('ix_consents_user_id'), 'consents', ['user_id'], unique=False)

    # 5. exercises
    op.create_table(
        'exercises',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('target_joint', sa.String(length=64), nullable=True),
        sa.Column('side_specific', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_exercises_code'), 'exercises', ['code'], unique=True)

    # 6. rehabilitation_plans
    op.create_table(
        'rehabilitation_plans',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('prescribed_frequency_per_week', sa.Integer(), nullable=False, server_default='7'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_rehabilitation_plans_patient_id'), 'rehabilitation_plans', ['patient_id'], unique=False)

    # 7. sessions
    op.create_table(
        'sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('client_uuid', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('plan_id', sa.UUID(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('pose_model_ver', sa.String(length=32), nullable=False),
        sa.Column('app_version', sa.String(length=32), nullable=False),
        sa.Column('overall_score', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['plan_id'], ['rehabilitation_plans.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_sessions_client_uuid'), 'sessions', ['client_uuid'], unique=True)
    op.create_index(op.f('ix_sessions_patient_id'), 'sessions', ['patient_id'], unique=False)
    op.create_index(op.f('ix_sessions_plan_id'), 'sessions', ['plan_id'], unique=False)

    # 8. session_exercises
    op.create_table(
        'session_exercises',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('exercise_id', sa.Integer(), nullable=False),
        sa.Column('sets_done', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reps_done', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('avg_form_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('max_rom_deg', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('avg_rom_deg', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('pain_before', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pain_after', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('side', sa.String(length=32), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_session_exercises_exercise_id'), 'session_exercises', ['exercise_id'], unique=False)
    op.create_index(op.f('ix_session_exercises_session_id'), 'session_exercises', ['session_id'], unique=False)

    # 9. rep_events
    op.create_table(
        'rep_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_exercise_id', sa.UUID(), nullable=False),
        sa.Column('set_no', sa.Integer(), nullable=False),
        sa.Column('rep_no', sa.Integer(), nullable=False),
        sa.Column('duration_ms', sa.Float(), nullable=False),
        sa.Column('rom_deg', sa.Float(), nullable=False),
        sa.Column('form_score', sa.Float(), nullable=False),
        sa.Column('errors', sa.JSON(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['session_exercise_id'], ['session_exercises.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_rep_events_session_exercise_id'), 'rep_events', ['session_exercise_id'], unique=False)

    # 10. progress_metrics
    op.create_table(
        'progress_metrics',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('patient_id', sa.UUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('exercise_id', sa.Integer(), nullable=True),
        sa.Column('side', sa.String(length=32), nullable=False, server_default='overall'),
        sa.Column('max_rom_deg', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('avg_rom_deg', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('avg_form_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('avg_pain', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('adherence_pct', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('total_sessions', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('total_reps', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('patient_id', 'date', 'exercise_id', 'side', name='uq_patient_date_exercise_side'),
    )
    op.create_index(op.f('ix_progress_metrics_date'), 'progress_metrics', ['date'], unique=False)
    op.create_index(op.f('ix_progress_metrics_exercise_id'), 'progress_metrics', ['exercise_id'], unique=False)
    op.create_index(op.f('ix_progress_metrics_patient_id'), 'progress_metrics', ['patient_id'], unique=False)


def downgrade() -> None:
    op.drop_table('progress_metrics')
    op.drop_table('rep_events')
    op.drop_table('session_exercises')
    op.drop_table('sessions')
    op.drop_table('rehabilitation_plans')
    op.drop_table('exercises')
    op.drop_table('consents')
    op.drop_table('refresh_tokens')
    op.drop_table('patients')
    op.drop_table('users')
    op.execute('DROP TYPE IF EXISTS consent_type')
    op.execute('DROP TYPE IF EXISTS user_role')
