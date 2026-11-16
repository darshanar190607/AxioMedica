"""
Biomechanical Form Quality Evaluator.

Performs post-hoc kinematics analysis, compensatory error weighting,
cadence consistency assessment, and neuromuscular fatigue estimation.
"""
import math
from typing import Sequence
from app.ml_serving.schemas import (
    BiomechanicalBreakdown,
    FormQualityInferenceRequest,
    FormQualityInferenceResponse,
    RepTelemetryInput,
)

ERROR_WEIGHTS = {
    "knee_valgus": 12.0,
    "hip_hike": 10.0,
    "early_heel_lift": 8.0,
    "too_fast": 6.0,
    "low_height": 7.0,
    "low_confidence": 4.0,
}


def calculate_rom_adequacy(
    reps: Sequence[RepTelemetryInput],
    target_rom: float | None,
    baseline_rom: float | None,
) -> float:
    """
    Evaluates ROM adequacy against target or baseline expectations.
    """
    if not reps:
        return 0.0

    ref_rom = target_rom or baseline_rom or 28.0
    if ref_rom <= 0:
        return 100.0

    avg_rom = sum(r.rom_deg for r in reps) / len(reps)
    ratio = avg_rom / ref_rom

    # Optimal ratio is between 0.95 and 1.25
    if ratio >= 0.95:
        score = 100.0 - max(0.0, (ratio - 1.25) * 50.0)  # slight penalty for excessive hyperextension
    else:
        score = max(0.0, ratio * 100.0)

    return round(min(100.0, max(0.0, score)), 1)


def calculate_velocity_smoothness(reps: Sequence[RepTelemetryInput]) -> float:
    """
    Evaluates cadence consistency and velocity smoothness across reps.
    Uses coefficient of variation of duration (CV = std / mean).
    """
    if len(reps) < 2:
        return 95.0

    durations = [r.duration_ms for r in reps]
    mean_dur = sum(durations) / len(durations)
    if mean_dur <= 0:
        return 50.0

    variance = sum((d - mean_dur) ** 2 for d in durations) / len(durations)
    std_dev = math.sqrt(variance)
    cv = std_dev / mean_dur

    # Low CV (< 0.15) indicates high smoothness and cadence consistency
    smoothness = 100.0 - min(100.0, cv * 120.0)
    return round(max(30.0, min(100.0, smoothness)), 1)


def calculate_fatigue_decay(reps: Sequence[RepTelemetryInput]) -> float:
    """
    Estimates neuromuscular fatigue by comparing ROM in early vs late reps.
    Positive percentage means ROM decayed (fatigue); negative means ROM increased.
    """
    if len(reps) < 4:
        return 0.0

    split_idx = max(1, len(reps) // 3)
    early_reps = reps[:split_idx]
    late_reps = reps[-split_idx:]

    early_rom = sum(r.rom_deg for r in early_reps) / len(early_reps)
    late_rom = sum(r.rom_deg for r in late_reps) / len(late_reps)

    if early_rom <= 0:
        return 0.0

    decay_pct = ((early_rom - late_rom) / early_rom) * 100.0
    return round(decay_pct, 1)


def evaluate_form_quality(request: FormQualityInferenceRequest) -> FormQualityInferenceResponse:
    """
    Main evaluation pipeline returning clinical metrics and actionable recommendations.
    """
    reps = request.reps
    total_reps = len(reps)

    # 1. Component scores
    rom_score = calculate_rom_adequacy(reps, request.target_rom_deg, request.baseline_rom_deg)
    smoothness_score = calculate_velocity_smoothness(reps)
    fatigue_decay = calculate_fatigue_decay(reps)

    # 2. Compensatory errors analysis
    unique_errors = set()
    total_penalty = 0.0

    for r in reps:
        for err in r.errors:
            unique_errors.add(err)
            total_penalty += ERROR_WEIGHTS.get(err, 5.0)

    # Average error penalty per rep
    avg_penalty = total_penalty / total_reps if total_reps > 0 else 0.0
    stability_score = round(max(0.0, 100.0 - avg_penalty * 2.5), 1)

    # 3. Overall composite quality score
    # Weighted: 35% ROM adequacy, 25% velocity smoothness, 40% stability / form
    composite_score = (
        0.35 * rom_score +
        0.25 * smoothness_score +
        0.40 * stability_score
    )

    # Further penalize if severe fatigue decay (> 20%)
    if fatigue_decay > 20.0:
        composite_score -= (fatigue_decay - 20.0) * 0.4

    overall_score = round(max(0.0, min(100.0, composite_score)), 1)

    # 4. Tier assignment
    if overall_score >= 88.0:
        tier = "excellent"
    elif overall_score >= 75.0:
        tier = "satisfactory"
    elif overall_score >= 60.0:
        tier = "needs_attention"
    else:
        tier = "high_risk"

    # 5. Formulate clinical recommendations
    recommendations = []
    if "knee_valgus" in unique_errors:
        recommendations.append(
            "Medial knee collapse observed during plantarflexion. Focus on hip abductor alignment."
        )
    if "hip_hike" in unique_errors:
        recommendations.append(
            "Pelvic elevation detected. Patient may be compensating with trunk lateral flexion."
        )
    if "too_fast" in unique_errors or smoothness_score < 65.0:
        recommendations.append(
            "Cadence is inconsistent or excessively rushed. Cue eccentric lowering phase (3 seconds down)."
        )
    if fatigue_decay > 15.0:
        recommendations.append(
            f"Significant ROM decay ({fatigue_decay}%) in final repetitions. Consider decreasing set volume or increasing rest interval."
        )
    if rom_score < 70.0:
        recommendations.append(
            "Sub-therapeutic ROM excursion. Verify patient footwear and check for anterior ankle impingement."
        )
    if not recommendations:
        recommendations.append(
            "Kinematics within therapeutic range. Patient demonstrates stable joint control and consistent cadence."
        )

    return FormQualityInferenceResponse(
        status="success" if overall_score >= 60.0 else "needs_attention",
        overall_quality_score=overall_score,
        quality_tier=tier,
        biomechanical_breakdown=BiomechanicalBreakdown(
            rom_adequacy_score=rom_score,
            velocity_smoothness_score=smoothness_score,
            stability_score=stability_score,
            fatigue_decay_percent=fatigue_decay,
            detected_compensations=sorted(list(unique_errors)),
        ),
        clinical_recommendations=recommendations,
        model_version="form_evaluator_v1.2",
    )
