"""
SQLAlchemy models package.
Import all model modules here so that Base.metadata is fully populated
for Alembic autogenerate and for application startup.
"""
from app.models.base import Base, TimestampMixin
from app.models.user import User, Patient, RefreshToken, Consent, UserRole, ConsentType
from app.models.session import (
    Exercise,
    RehabilitationPlan,
    PlanExercise,
    PainLog,
    Session,
    SessionExercise,
    RepEvent,
    ProgressMetric,
)

__all__ = [
    "Base",
    "TimestampMixin",
    "User",
    "Patient",
    "RefreshToken",
    "Consent",
    "UserRole",
    "ConsentType",
    "Exercise",
    "RehabilitationPlan",
    "PlanExercise",
    "PainLog",
    "Session",
    "SessionExercise",
    "RepEvent",
    "ProgressMetric",
]
