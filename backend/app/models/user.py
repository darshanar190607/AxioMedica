"""
SQLAlchemy 2.x ORM models for:
  - User        (authentication identity, role)
  - Patient     (patient profile linked 1-1 to User)
  - RefreshToken (server-side refresh-token store for rotation + reuse detection)
  - Consent     (camera / data_processing consents created at registration)
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from typing import TYPE_CHECKING

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.session import RehabilitationPlan, Session, PainLog


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, PyEnum):
    patient = "patient"
    clinician = "clinician"
    admin = "admin"


class ConsentType(str, PyEnum):
    camera = "camera"
    data_processing = "data_processing"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(TimestampMixin, Base):
    """
    Primary authentication identity.

    Primary key is a UUID generated in the application layer so that the value
    is known before the INSERT (useful for building related records in the same
    transaction without an extra round-trip).
    """
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    password_hash: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_type=True),
        nullable=False,
        default=UserRole.patient,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ---- relationships ----
    patient: Mapped["Patient | None"] = relationship(
        "Patient",
        foreign_keys="[Patient.user_id]",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    consents: Mapped[list["Consent"]] = relationship(
        "Consent",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} email={self.email} role={self.role}>"


# ---------------------------------------------------------------------------
# Patient
# ---------------------------------------------------------------------------

class Patient(TimestampMixin, Base):
    """
    Extended patient profile; one-to-one with User.
    Additional demographic / clinical fields will be added in Phase 3.
    """
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    date_of_birth: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    injured_ankle: Mapped[str | None] = mapped_column(String(32), default="Left", nullable=True)
    injury_type: Mapped[str | None] = mapped_column(String(64), default="Ankle Sprain", nullable=True)
    recovery_stage: Mapped[int | None] = mapped_column(default=2, nullable=True)
    current_week: Mapped[int | None] = mapped_column(default=3, nullable=True)
    total_weeks: Mapped[int | None] = mapped_column(default=6, nullable=True)
    recovery_percent: Mapped[int | None] = mapped_column(default=72, nullable=True)
    assigned_clinician_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ---- relationships ----
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="patient")
    clinician: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_clinician_id])
    plans: Mapped[list["RehabilitationPlan"]] = relationship(
        "RehabilitationPlan", back_populates="patient", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="patient", cascade="all, delete-orphan"
    )
    pain_logs: Mapped[list["PainLog"]] = relationship(
        "PainLog", back_populates="patient", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Patient id={self.id} user_id={self.user_id}>"


# ---------------------------------------------------------------------------
# RefreshToken (server-side store for rotation + reuse detection)
# ---------------------------------------------------------------------------

class RefreshToken(Base):
    """
    Persisted refresh-token records.

    Each successful login or refresh creates a new row.  The *token_hash*
    column stores a SHA-256 hex digest of the opaque token so the raw value
    is never at rest.  On refresh:
      - Locate by token_hash.
      - If `revoked` is True → reuse attack detected → revoke all tokens for
        this user (family invalidation).
      - Otherwise mark this row revoked and issue a new token.
    """
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),  # SHA-256 hex = 64 chars
        unique=True,
        nullable=False,
        index=True,
    )
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ---- relationships ----
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<RefreshToken id={self.id} user_id={self.user_id} revoked={self.revoked}>"


# ---------------------------------------------------------------------------
# Consent
# ---------------------------------------------------------------------------

class Consent(TimestampMixin, Base):
    """
    Tracks per-user data-usage consent records.
    Created automatically during registration for 'camera' and 'data_processing'.
    """
    __tablename__ = "consents"
    __table_args__ = (
        UniqueConstraint("user_id", "consent_type", name="uq_consent_user_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    consent_type: Mapped[ConsentType] = mapped_column(
        Enum(ConsentType, name="consent_type", create_type=True),
        nullable=False,
    )
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ---- relationships ----
    user: Mapped["User"] = relationship("User", back_populates="consents")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Consent id={self.id} user_id={self.user_id} type={self.consent_type}>"
