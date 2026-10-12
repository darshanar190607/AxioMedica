"""
Health check endpoints.
Performs liveness and readiness checks, including live database connectivity verification.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.db.session import check_db_connection
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="System Health & Database Connectivity Check",
    description="Checks the operational status of the API server and tests live connectivity to PostgreSQL.",
)
async def get_health(response: Response) -> HealthResponse:
    is_db_connected, db_error, latency_ms = await check_db_connection()

    db_status = "connected" if is_db_connected else "disconnected"
    overall_status = "healthy" if is_db_connected else "unhealthy"

    if not is_db_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status=overall_status,
        app_name=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        timestamp=datetime.now(timezone.utc),
        services={
            "database": {
                "status": db_status,
                "latency_ms": latency_ms,
                **({"error": db_error} if db_error else {}),
            }
        },
    )
