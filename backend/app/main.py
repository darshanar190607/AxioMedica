"""
AxioMedica Backend - FastAPI Main Application Entrypoint.

Configures:
- Structured JSON logging
- CORS for Expo development, web apps, and LAN testing
- Global exception handlers
- Database connection lifecycle management
- API v1 routers & root /health endpoint
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging, JSONRequestLoggingMiddleware
from app.core.exceptions import register_exception_handlers
from app.api.v1.api import api_router
from app.api.v1.endpoints import health

# 1. Initialize structured JSON logger
logger = setup_logging(log_level=settings.LOG_LEVEL)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan context manager for startup and shutdown procedures.
    """
    logger.info(
        f"Starting {settings.PROJECT_NAME} (v{settings.VERSION}) in [{settings.ENVIRONMENT.upper()}] mode",
        extra={
            "environment": settings.ENVIRONMENT,
            "version": settings.VERSION,
            "debug": settings.DEBUG,
        },
    )

    yield

    logger.info(f"Shutting down {settings.PROJECT_NAME}")


# 2. Instantiate FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="FastAPI Backend for AxioMedica Tele-Rehabilitation Platform.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# 3. Register Global Exception Handlers
register_exception_handlers(app)

# 4. Add Structured JSON HTTP Request Logging Middleware
app.add_middleware(JSONRequestLoggingMiddleware, logger=logger)

# 5. Configure CORS (Supports Expo Go LAN, Emulators, Web Dev servers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS],
    allow_origin_regex=settings.CORS_ORIGIN_REGEX if not settings.is_production else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 6. Mount Root Health Endpoint (Direct accessibility for container orchestration / uptime checks)
app.include_router(health.router)

# 7. Mount API v1 Router Aggregator
app.include_router(api_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=not settings.is_production,
        log_config=None,  # Use our custom structured JSON logger
    )
