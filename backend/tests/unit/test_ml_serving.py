"""
Unit tests for the ML Serving router & form quality evaluation.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ml_status_endpoint(async_client: AsyncClient):
    response = await async_client.get("/api/v1/ml/status")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "ml_serving"
    assert data["status"] == "online"
    assert len(data["loaded_models"]) > 0


@pytest.mark.asyncio
async def test_ml_inference_form_quality(async_client: AsyncClient):
    payload = {
        "exercise_id": 1,
        "exercise_name": "Heel Raise",
        "side": "right",
        "target_rom_deg": 35.0,
        "baseline_rom_deg": 28.0,
        "reps": [
            {
                "rep_no": 1,
                "duration_ms": 2800.0,
                "rom_deg": 36.2,
                "form_score": 96.0,
                "errors": [],
                "confidence": 0.95,
            },
            {
                "rep_no": 2,
                "duration_ms": 2900.0,
                "rom_deg": 35.8,
                "form_score": 94.0,
                "errors": [],
                "confidence": 0.94,
            },
            {
                "rep_no": 3,
                "duration_ms": 3100.0,
                "rom_deg": 34.1,
                "form_score": 88.0,
                "errors": ["too_fast"],
                "confidence": 0.92,
            },
            {
                "rep_no": 4,
                "duration_ms": 3200.0,
                "rom_deg": 31.0,
                "form_score": 82.0,
                "errors": ["knee_valgus"],
                "confidence": 0.91,
            },
        ],
    }

    response = await async_client.post("/api/v1/ml/inference", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["success", "needs_attention"]
    assert "overall_quality_score" in data
    assert "quality_tier" in data
    assert "biomechanical_breakdown" in data
    assert "clinical_recommendations" in data
    assert len(data["clinical_recommendations"]) > 0
    assert "knee_valgus" in data["biomechanical_breakdown"]["detected_compensations"]


@pytest.mark.asyncio
async def test_ml_predict_alias_endpoint(async_client: AsyncClient):
    payload = {
        "exercise_name": "Ankle Pump",
        "reps": [
            {
                "rep_no": 1,
                "duration_ms": 2500.0,
                "rom_deg": 28.0,
                "form_score": 92.0,
                "errors": [],
            }
        ],
    }

    response = await async_client.post("/api/v1/ml/predict/form-quality", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["overall_quality_score"] > 0
    assert data["quality_tier"] in ["excellent", "satisfactory", "needs_attention", "high_risk"]
