"""
SQLAlchemy 2.x ORM models for:
  - Exercise            (catalog of prescribed rehabilitation exercises)
  - RehabilitationPlan  (patient-assigned rehabilitation prescription)
  - Session             (individual exercise session upload)
  - SessionExercise     (per-exercise results within a session)
  - RepEvent            (fine-grained rep telemetry)
  - ProgressMetric      (daily aggregated patient rehabilitation metrics)
"""
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


# ---------------------------------------------------------------------------
# Exercise Catalog
# ---------------------------------------------------------------------------

class Exercise(TimestampMixin, Base):
    """
    Catalog of available rehabilitation exercises.
    exercise_id in SessionPayload references this table's primary key.
    """
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_joint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    side_specific: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    pose_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    safe_range: Mapped[str | None] = mapped_column(String(64), nullable=True)
    color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    default_duration: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Relationships
    session_exercises: Mapped[list["SessionExercise"]] = relationship(
        "SessionExercise", back_populates="exercise"
    )
    plan_exercises: Mapped[list["PlanExercise"]] = relationship(
        "PlanExercise", back_populates="exercise", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Exercise id={self.id} code='{self.code}' name='{self.name}'>"


# ---------------------------------------------------------------------------
# Rehabilitation Plan & Plan Exercise
# ---------------------------------------------------------------------------

class RehabilitationPlan(TimestampMixin, Base):
    """
    Clinician-prescribed rehabilitation plan assigned to a patient.
    """
    __tablename__ = "rehabilitation_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    clinician_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    prescribed_frequency_per_week: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    current_week: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    total_weeks: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    recovery_stage: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="plans")  # type: ignore[name-defined]
    sessions: Mapped[list["Session"]] = relationship("Session", back_populates="plan")
    plan_exercises: Mapped[list["PlanExercise"]] = relationship(
        "PlanExercise",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanExercise.order_index",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<RehabilitationPlan id={self.id} patient_id={self.patient_id} title='{self.title}'>"


class PlanExercise(TimestampMixin, Base):
    """
    Junction table representing an exercise prescribed within a rehabilitation plan.
    """
    __tablename__ = "plan_exercises"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rehabilitation_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exercise_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("exercises.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sets: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    frequency: Mapped[str] = mapped_column(String(64), default="Twice a day", nullable=False)
    duration: Mapped[str] = mapped_column(String(32), default="5 min", nullable=False)
    safe_range: Mapped[str] = mapped_column(String(64), default="0° – 30°", nullable=False)
    color: Mapped[str] = mapped_column(String(32), default="#F5A623", nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    plan: Mapped["RehabilitationPlan"] = relationship("RehabilitationPlan", back_populates="plan_exercises")
    exercise: Mapped["Exercise"] = relationship("Exercise", back_populates="plan_exercises")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PlanExercise plan_id={self.plan_id} exercise_id={self.exercise_id}>"


# ---------------------------------------------------------------------------
# Pain Log
# ---------------------------------------------------------------------------

class PainLog(TimestampMixin, Base):
    """
    Self-reported patient pain logs.
    """
    __tablename__ = "pain_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pain_level: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 - 10 NRS
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_part: Mapped[str] = mapped_column(String(64), default="ankle", nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="pain_logs")  # type: ignore[name-defined]

    def __repr__(self) -> str:  # pragma: no cover
        return f"<PainLog patient_id={self.patient_id} pain={self.pain_level} at={self.logged_at}>"


# ---------------------------------------------------------------------------
# Rehabilitation Session
# ---------------------------------------------------------------------------

class Session(TimestampMixin, Base):
    """
    One completed rehabilitation workout session uploaded from device.
    client_uuid enforces idempotent uploads.
    """
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    client_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rehabilitation_plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    pose_model_ver: Mapped[str] = mapped_column(String(32), nullable=False)
    app_version: Mapped[str] = mapped_column(String(32), nullable=False)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="sessions")  # type: ignore[name-defined]
    plan: Mapped["RehabilitationPlan | None"] = relationship("RehabilitationPlan", back_populates="sessions")
    session_exercises: Mapped[list["SessionExercise"]] = relationship(
        "SessionExercise",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionExercise.id",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Session id={self.id} client_uuid={self.client_uuid} score={self.overall_score}>"


# ---------------------------------------------------------------------------
# Session Exercise
# ---------------------------------------------------------------------------

class SessionExercise(TimestampMixin, Base):
    """
    Aggregated performance for a single exercise within a session.
    """
    __tablename__ = "session_exercises"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    exercise_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("exercises.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    sets_done: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reps_done: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_form_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    max_rom_deg: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_rom_deg: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    pain_before: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pain_after: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    side: Mapped[str | None] = mapped_column(String(32), nullable=True, default="right")

    # Relationships
    session: Mapped["Session"] = relationship("Session", back_populates="session_exercises")
    exercise: Mapped["Exercise"] = relationship("Exercise", back_populates="session_exercises")
    rep_events: Mapped[list["RepEvent"]] = relationship(
        "RepEvent",
        back_populates="session_exercise",
        cascade="all, delete-orphan",
        order_by="RepEvent.set_no, RepEvent.rep_no",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SessionExercise id={self.id} session_id={self.session_id} exercise_id={self.exercise_id}>"


# ---------------------------------------------------------------------------
# Rep Event Telemetry
# ---------------------------------------------------------------------------

class RepEvent(TimestampMixin, Base):
    """
    Telemetry and form accuracy record for a single rep.
    """
    __tablename__ = "rep_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    session_exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("session_exercises.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    set_no: Mapped[int] = mapped_column(Integer, nullable=False)
    rep_no: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_ms: Mapped[float] = mapped_column(Float, nullable=False)
    rom_deg: Mapped[float] = mapped_column(Float, nullable=False)
    form_score: Mapped[float] = mapped_column(Float, nullable=False)
    errors: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    session_exercise: Mapped["SessionExercise"] = relationship(
        "SessionExercise", back_populates="rep_events"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<RepEvent id={self.id} set={self.set_no} rep={self.rep_no} rom={self.rom_deg}>"


# ---------------------------------------------------------------------------
# Progress Metrics
# ---------------------------------------------------------------------------

class ProgressMetric(TimestampMixin, Base):
    """
    Daily aggregated progress metrics for a patient.
    Stores max ROM per day per side, adherence %, average pain, and average form score.
    """
    __tablename__ = "progress_metrics"
    __table_args__ = (
        UniqueConstraint(
            "patient_id", "date", "exercise_id", "side",
            name="uq_patient_date_exercise_side",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    exercise_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("exercises.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    side: Mapped[str] = mapped_column(String(32), nullable=False, default="overall")
    max_rom_deg: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_rom_deg: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_form_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_pain: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    adherence_pct: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    total_reps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<ProgressMetric patient={self.patient_id} date={self.date} "
            f"side={self.side} max_rom={self.max_rom_deg} adh={self.adherence_pct}%>"
        )
