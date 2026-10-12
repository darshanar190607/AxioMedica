"""
ML Serving Router (Placeholder for Person B).

This module will host endpoints for on-demand ML model inference, keypoint processing,
repetition assessment, and model metadata/status checks.
"""
from typing import Any, Dict
from fastapi import APIRouter, status

router = APIRouter(prefix="/ml", tags=["ML Serving"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def ml_service_status() -> Dict[str, Any]:
    """
    Returns the status of loaded ML models and inference engine runtime.
    TODO (Person B): Implement model registry inspection and hardware accelerator checks.
    """
    return {
        "status": "idle",
        "service": "ml_serving",
        "loaded_models": [],
        "notes": "Ready for ML pipeline integration by Person B.",
    }


@router.post("/inference", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def predict_sample(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Placeholder endpoint for pose/exercise inference requests.
    TODO (Person B): Implement model inference logic, input validation, and score calculation.
    """
    return {
        "status": "not_implemented",
        "message": "ML inference endpoint placeholder. To be implemented by Person B.",
        "received_payload_keys": list(payload.keys()),
    }
