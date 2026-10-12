"""
Pydantic v2 schemas for rehabilitation sessions, exercises, rep telemetry,
and progress metrics.
Strictly conforms to docs/contracts/session_payload.schema.json and units.md.
"""
import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Rep Telemetry Schema
# ---------------------------------------------------------------------------

class RepResultSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    set_no: Annotated[int, Field(ge=1, description="1-based set index.")]
    rep_no: Annotated[int, Field(ge=1, description="1-based rep index within set.")]
    duration_ms: Annotated[float, Field(ge=0.0, description="Rep duration in milliseconds.")]
    rom_deg: Annotated[float, Field(ge=0.0, le=180.0, description="Range of motion in degrees (0-180).")]
    form_score: Annotated[float, Field(ge=0.0, le=100.0, description="Form quality score (0-100).")]
    errors: list[str] = Field(default_factory=list, description="Error code ids that fired during rep.")
    confidence: Annotated[float, Field(ge=0.0, le=1.0, description="BlazePose landmark confidence (0-1).")]


# ---------------------------------------------------------------------------
# Exercise Result Schema
# ---------------------------------------------------------------------------

class ExerciseResultSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    exercise_id: Annotated[int, Field(description="Foreign key referencing exercises.id")]
    sets_done: Annotated[int, Field(ge=0, description="Number of sets completed.")]
    reps_done: Annotated[int, Field(ge=0, description="Total successful reps completed.")]
    avg_form_score: Annotated[float, Field(ge=0.0, le=100.0, description="Mean form score across reps (0-100).")]
    max_rom_deg: Annotated[float, Field(ge=0.0, le=180.0, description="Max ROM achieved (degrees 0-180).")]
    avg_rom_deg: Annotated[float, Field(ge=0.0, le=180.0, description="Mean ROM achieved (degrees 0-180).")]
    pain_before: Annotated[int, Field(ge=0, le=10, description="Pain score before exercise (0-10 NRS).")]
    pain_after: Annotated[int, Field(ge=0, le=10, description="Pain score after exercise (0-10 NRS).")]
    side: Literal["left", "right", "bilateral"] | None = Field(default="right", description="Body side trained.")
    reps: list[RepResultSchema] = Field(default_factory=list, description="Per-rep telemetry.")


# ---------------------------------------------------------------------------
# Session Sync Upload Payload
# ---------------------------------------------------------------------------

class SessionSyncPayload(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    client_uuid: uuid.UUID = Field(
        ...,
        description="UUID v4 generated on-device. Idempotency key.",
    )
    plan_id: uuid.UUID | None = Field(
        default=None,
        description="Optional FK referencing rehabilitation_plans.id.",
    )
    started_at: datetime = Field(
        ...,
        description="ISO-8601 UTC timestamp when session began.",
    )
    ended_at: datetime = Field(
        ...,
        description="ISO-8601 UTC timestamp when session ended.",
    )
    pose_model_ver: Annotated[
        str,
        Field(pattern=r"^\d+\.\d+\.\d+$", description="Semver of on-device pose model bundle."),
    ]
    app_version: Annotated[
        str,
        Field(pattern=r"^\d+\.\d+\.\d+$", description="Semver of mobile app."),
    ]
    overall_score: Annotated[
        float,
        Field(ge=0.0, le=100.0, description="Session aggregate form score (0-100)."),
    ]
    exercises: list[ExerciseResultSchema] = Field(
        ...,
        min_length=1,
        description="Array of exercises performed during session.",
    )


# ---------------------------------------------------------------------------
# Response Schemas
# ---------------------------------------------------------------------------

class RepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    set_no: int
    rep_no: int
    duration_ms: float
    rom_deg: float
    form_score: float
    errors: list[str]
    confidence: float


class SessionExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    exercise_id: int
    sets_done: int
    reps_done: int
    avg_form_score: float
    max_rom_deg: float
    avg_rom_deg: float
    pain_before: int
    pain_after: int
    side: str | None
    rep_events: list[RepResponse] = Field(default_factory=list)


class SessionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_uuid: uuid.UUID
    patient_id: uuid.UUID
    plan_id: uuid.UUID | None
    started_at: datetime
    ended_at: datetime
    pose_model_ver: str
    app_version: str
    overall_score: float
    created_at: datetime
    session_exercises: list[SessionExerciseResponse] = Field(default_factory=list)


class SessionSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_uuid: uuid.UUID
    patient_id: uuid.UUID
    plan_id: uuid.UUID | None
    started_at: datetime
    ended_at: datetime
    overall_score: float
    exercises_count: int
    total_reps_done: int


class SessionListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[SessionSummaryResponse]


class ProgressMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    date: date
    exercise_id: int | None
    side: str
    max_rom_deg: float
    avg_rom_deg: float
    avg_form_score: float
    avg_pain: float
    adherence_pct: float
    total_sessions: int
    total_reps: int


class SessionSyncResponse(BaseModel):
    status: Literal["created", "already_synced"]
    message: str
    session: SessionDetailResponse
    progress_metrics: list[ProgressMetricResponse] = Field(default_factory=list)
