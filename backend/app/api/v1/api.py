"""
API v1 Router registry.
Aggregates and mounts all v1 sub-routers.
"""
from fastapi import APIRouter
from app.api.v1.endpoints import health
from app.api.v1.endpoints import auth
from app.api.v1.endpoints import patients
from app.api.v1.endpoints import sessions
from app.api.v1.endpoints import exercises
from app.api.v1.endpoints import plans
from app.api.v1.endpoints import clinician
from app.api.v1.endpoints import progress
from app.api.v1.endpoints import pain_logs
from app.ml_serving.router import router as ml_router

api_router = APIRouter()

# Core health check
api_router.include_router(health.router)

# Auth endpoints
api_router.include_router(auth.router)

# Patient profile endpoints
api_router.include_router(patients.router)

# Sessions endpoints
api_router.include_router(sessions.router)

# Exercise catalog endpoints
api_router.include_router(exercises.router)

# Patient rehabilitation plan endpoints
api_router.include_router(plans.router)

# Clinician plan management endpoints
api_router.include_router(clinician.router)

# Progress & Recovery tracking endpoints
api_router.include_router(progress.router)

# Pain logging endpoints
api_router.include_router(pain_logs.router)

# ML Serving router (Person B placeholder)
api_router.include_router(ml_router)

