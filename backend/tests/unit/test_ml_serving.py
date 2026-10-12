"""
Unit tests for the ML Serving router placeholder.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ml_status_endpoint(async_client: AsyncClient):
    response = await async_client.get("/api/v1/ml/status")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "ml_serving"
    assert data["status"] == "idle"


@pytest.mark.asyncio
async def test_ml_inference_placeholder(async_client: AsyncClient):
    response = await async_client.post("/api/v1/ml/inference", json={"keypoints": [1, 2, 3]})
    assert response.status_code == 501
    data = response.json()
    assert data["status"] == "not_implemented"
