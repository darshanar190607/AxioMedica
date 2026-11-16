"""
ML Serving Router for AxioMedica Tele-Rehab.

Provides endpoints for on-demand biomechanical model inference,
post-hoc form quality scoring, and model metadata/status checks.
"""
from typing import Any, Dict
from fastapi import APIRouter, status, HTTPException
from app.ml_serving.schemas import (
    FormQualityInferenceRequest,
    FormQualityInferenceResponse,
)
from app.ml_serving.evaluator import evaluate_form_quality

router = APIRouter(prefix="/ml", tags=["ML Serving"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def ml_service_status() -> Dict[str, Any]:
    """
    Returns the status of loaded ML models and inference engine runtime.
    """
    return {
        "status": "online",
        "service": "ml_serving",
        "loaded_models": [
            "biomechanical_form_evaluator_v1.2",
            "cadence_smoothness_estimator_v1.0",
            "fatigue_decay_estimator_v1.0",
        ],
        "accelerator": "cpu",
        "notes": "Ready for post-hoc form quality evaluation and kinematics assessment.",
    }


@router.post(
    "/inference",
    response_model=FormQualityInferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Post-hoc biomechanical form quality evaluation",
)
async def predict_form_quality_inference(
    payload: FormQualityInferenceRequest,
) -> FormQualityInferenceResponse:
    """
    Evaluates completed repetition kinematics, cadence consistency,
    compensatory error weighting, and neuromuscular fatigue.
    """
    if not payload.reps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one repetition must be provided for evaluation.",
        )

    return evaluate_form_quality(payload)


@router.post(
    "/predict/form-quality",
    response_model=FormQualityInferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict form quality and compensatory movement risk",
)
async def predict_form_quality(
    payload: FormQualityInferenceRequest,
) -> FormQualityInferenceResponse:
    """
    Alias endpoint for clinical telemetry form quality prediction.
    """
    return evaluate_form_quality(payload)
