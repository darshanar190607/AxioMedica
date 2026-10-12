"""
Pydantic schemas for:
  - Exercises Catalog
  - Rehabilitation Plans (Patient Active Plan, Clinician Management)
  - Progress Summary & Time-Series Metrics
  - Patient Pain Logging
"""
import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Exercise Catalog Schemas
# ---------------------------------------------------------------------------

class ExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    code: str
    name: str
    description: str | None = None
    target_joint: str | None = None
    side_specific: bool = True
    safe_range: str | None = Field(default=None, serialization_alias="safeRange")
    color: str | None = None
    default_duration: str | None = Field(default=None, serialization_alias="duration")
    pose_config: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Plan Prescription Schemas
# ---------------------------------------------------------------------------

class PrescribedExerciseCreate(BaseModel):
    exercise_id: int
    sets: int = Field(default=3, ge=1)
    reps: int = Field(default=10, ge=1)
    frequency: str = "Twice a day"
    duration: str = "5 min"
    safe_range: str = "0° – 30°"
    color: str = "#F5A623"
    order_index: int = 0


class PrescribedExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int  # exercise_id
    exercise_id: int
    name: str
    code: str
    description: str | None = None
    sets: int
    reps: int
    frequency: str
    duration: str
    safe_range: str = Field(..., serialization_alias="safeRange")
    color: str
    progress: int = 0
    completed_sessions: int = Field(default=0, serialization_alias="completedSessions")
    total_sessions: int = Field(default=8, serialization_alias="totalSessions")
    completed_reps: int = Field(default=0, serialization_alias="completedReps")
    total_reps: int = Field(default=80, serialization_alias="totalReps")
    pose_config: dict[str, Any] | None = None


class ClinicianDoctorInfo(BaseModel):
    name: str
    phone: str | None = None


class ActivePlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    title: str
    status: str
    is_approved: bool
    prescribed_frequency_per_week: int
    current_week: int = Field(..., serialization_alias="currentWeek")
    total_weeks: int = Field(..., serialization_alias="totalWeeks")
    recovery_stage: int = Field(..., serialization_alias="recoveryStage")
    doctor: ClinicianDoctorInfo | None = None
    exercises: list[PrescribedExerciseResponse] = Field(default_factory=list)


class CreatePlanRequest(BaseModel):
    patient_id: uuid.UUID
    title: str
    prescribed_frequency_per_week: int = Field(default=7, ge=1, le=21)
    total_weeks: int = Field(default=6, ge=1, le=52)
    recovery_stage: int = Field(default=1, ge=1, le=5)
    exercises: list[PrescribedExerciseCreate] = Field(default_factory=list)


class ApprovePlanResponse(BaseModel):
    id: uuid.UUID
    status: str
    is_approved: bool
    message: str


# ---------------------------------------------------------------------------
# Pain Logging Schemas
# ---------------------------------------------------------------------------

class CreatePainLogRequest(BaseModel):
    pain_level: int = Field(..., ge=0, le=10, description="Pain rating (0-10 NRS)")
    body_part: str = Field(default="ankle", description="Affected body part")
    notes: str | None = Field(default=None, description="Optional patient notes")
    logged_at: datetime | None = Field(default=None, description="Timestamp of pain record")


class PainLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    pain_level: int
    body_part: str
    notes: str | None
    logged_at: datetime
    created_at: datetime


# ---------------------------------------------------------------------------
# Progress & Recovery Summary Schemas
# ---------------------------------------------------------------------------

class ROMComparison(BaseModel):
    current_rom: float
    baseline_rom: float
    improvement_deg: float
    improvement_pct: float


class PainTrend(BaseModel):
    current_pain: float
    baseline_pain: float
    status: Literal["improving", "stable", "worsening"]


class SessionHistoryItem(BaseModel):
    session: str
    score: float


class QuickStats(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    completed_sessions: int = Field(..., serialization_alias="completedSessions")
    total_reps: int = Field(..., serialization_alias="totalReps")
    accuracy: float


class MovementQuality(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    accuracy: float
    safe_range_pct: float = Field(..., serialization_alias="safeRange")
    correct_movements: int = Field(..., serialization_alias="correctMovements")
    corrections_made: int = Field(..., serialization_alias="correctionsMade")


class ProgressSummaryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Core metrics required
    current_vs_baseline_rom: ROMComparison
    streak: int
    weekly_adherence: float
    pain_trend: PainTrend

    # Direct mobile DashboardScreen & ProgressScreen shape mappings
    recovery_percent: int = Field(..., serialization_alias="recoveryPercent")
    recovery_stage: int = Field(..., serialization_alias="recoveryStage")
    current_week: int = Field(..., serialization_alias="currentWeek")
    total_weeks: int = Field(..., serialization_alias="totalWeeks")
    session_history: list[SessionHistoryItem] = Field(default_factory=list, serialization_alias="sessionHistory")
    stats: QuickStats
    movement_quality: MovementQuality = Field(..., serialization_alias="movementQuality")


class MetricPoint(BaseModel):
    date: date
    metric: str
    value: float
    side: str | None = None
    exercise_id: int | None = None


class MetricsTimeSeriesResponse(BaseModel):
    metric: str
    from_date: date | None = None
    to_date: date | None = None
    data: list[MetricPoint]


# ---------------------------------------------------------------------------
# Clinician Patient Management Schemas
# ---------------------------------------------------------------------------

class ClinicianPatientItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_id: uuid.UUID
    user_id: uuid.UUID
    full_name: str | None = None
    email: str
    phone: str | None = None
    injured_ankle: str | None = "Left"
    injury_type: str | None = "Ankle Sprain"
    recovery_stage: int | None = 2
    current_week: int | None = 3
    total_weeks: int | None = 6
    recovery_percent: int | None = 72
    assigned_clinician_id: uuid.UUID | None = None
    created_at: datetime | None = None


class ClinicianPatientListResponse(BaseModel):
    total: int
    patients: list[ClinicianPatientItem]


class ClinicianCreatePatientRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str
    phone: str | None = None
    injured_ankle: str = "Left"
    injury_type: str = "Ankle Sprain"
    total_weeks: int = 6
    recovery_stage: int = 1


class ClinicianCreatePatientResponse(BaseModel):
    message: str = "Patient successfully created and onboarded."
    patient: ClinicianPatientItem

