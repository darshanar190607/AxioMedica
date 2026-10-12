"""
Pydantic schemas for health and system status endpoints.
"""
from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class DatabaseHealth(BaseModel):
    status: str = Field(..., description="Database connection status: 'connected' or 'disconnected'")
    latency_ms: Optional[float] = Field(None, description="Query round-trip latency in milliseconds")
    error: Optional[str] = Field(None, description="Error message if disconnected")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall system health: 'healthy' or 'unhealthy'")
    app_name: str
    version: str
    environment: str
    timestamp: datetime
    services: Dict[str, Any] = Field(default_factory=dict)
