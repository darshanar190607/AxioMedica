"""
Unit tests for the /health and /api/v1/health endpoints.
"""
import pytest
from unittest.mock import patch
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_success(async_client: AsyncClient):
    """
    When the database is connected, /health should return 200 OK with 'healthy' status.
    """
    with patch("app.api.v1.endpoints.health.check_db_connection") as mock_check:
        mock_check.return_value = (True, None, 1.25)

        response = await async_client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert "app_name" in data
        assert "version" in data
        assert "timestamp" in data
        assert data["services"]["database"]["status"] == "connected"
        assert data["services"]["database"]["latency_ms"] == 1.25


@pytest.mark.asyncio
async def test_health_check_db_failure(async_client: AsyncClient):
    """
    When the database connection fails, /health should return 503 Service Unavailable.
    """
    with patch("app.api.v1.endpoints.health.check_db_connection") as mock_check:
        mock_check.return_value = (False, "Connection refused: port 5432", 50.0)

        response = await async_client.get("/health")
        assert response.status_code == 503

        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["services"]["database"]["status"] == "disconnected"
        assert "Connection refused" in data["services"]["database"]["error"]


@pytest.mark.asyncio
async def test_api_v1_health_route(async_client: AsyncClient):
    """
    /api/v1/health should also respond cleanly.
    """
    with patch("app.api.v1.endpoints.health.check_db_connection") as mock_check:
        mock_check.return_value = (True, None, 0.8)

        response = await async_client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
