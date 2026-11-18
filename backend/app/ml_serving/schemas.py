"""
Pydantic v2 schemas for ML Serving and Post-Hoc Form Quality Inference.
"""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field


class RepTelemetryInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    rep_no: Annotated[int, Field(ge=1, description="1-based repetition index")]
    duration_ms: Annotated[float, Field(ge=0.0, description="Rep duration in milliseconds")]
    rom_deg: Annotated[float, Field(ge=0.0, le=180.0, description="Range of motion in degrees (0-180)")]
    form_score: Annotated[float, Field(ge=0.0, le=100.0, description="On-device instantaneous form score")]
    errors: list[str] = Field(default_factory=list, description="List of detected error identifiers")
    confidence: Annotated[float, Field(ge=0.0, le=1.0, description="BlazePose landmark confidence")] = 0.90


class FormQualityInferenceRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    exercise_id: int = Field(default=1, description="Catalog exercise ID")
    exercise_name: str = Field(default="Heel Raise", description="Name of the exercise evaluated")
    side: Literal["left", "right", "bilateral"] = Field(default="right", description="Exercised body side")
    reps: list[RepTelemetryInput] = Field(
        ..., min_length=1, description="Array of completed repetition telemetries"
    )
    baseline_rom_deg: float | None = Field(
        default=None, ge=0.0, le=180.0, description="Patient calibrated baseline ROM"
    )
    target_rom_deg: float | None = Field(
        default=None, ge=0.0, le=180.0, description="Target therapeutic ROM threshold"
    )


class BiomechanicalBreakdown(BaseModel):
    rom_adequacy_score: Annotated[float, Field(ge=0.0, le=100.0)]
    velocity_smoothness_score: Annotated[float, Field(ge=0.0, le=100.0)]
    stability_score: Annotated[float, Field(ge=0.0, le=100.0)]
    fatigue_decay_percent: Annotated[float, Field(ge=-100.0, le=100.0)]
    detected_compensations: list[str]


class FormQualityInferenceResponse(BaseModel):
    status: Literal["success", "needs_attention"] = "success"
    overall_quality_score: Annotated[float, Field(ge=0.0, le=100.0)]
    quality_tier: Literal["excellent", "satisfactory", "needs_attention", "high_risk"]
    biomechanical_breakdown: BiomechanicalBreakdown
    clinical_recommendations: list[str]
    model_version: str = "form_evaluator_v1.2"
