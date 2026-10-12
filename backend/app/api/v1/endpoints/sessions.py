"""
Rehabilitation session endpoints:
  POST /sessions/sync       - Batch upload a session (idempotent, contract validated)
  GET  /sessions            - List authenticated patient's sessions (filtered by ?from=&to=)
  GET  /sessions/{id}       - Get single session details with nested exercises and reps
"""
import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_patient
from app.core.exceptions import ForbiddenException, NotFoundException
from app.db.session import get_db
from app.models.session import Session, SessionExercise
from app.models.user import Patient, User
from app.schemas.session import (
    SessionDetailResponse,
    SessionListResponse,
    SessionSummaryResponse,
    SessionSyncResponse,
)
from app.services.session_sync import SessionSyncService

logger = logging.getLogger("axiomedica.sessions")

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post(
    "/sync",
    response_model=SessionSyncResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Batch upload a completed rehabilitation session",
    responses={
        200: {"description": "Session was previously synced (idempotent retry)."},
        201: {"description": "Session created and progress metrics updated."},
        400: {"description": "Invalid contract payload or exercise reference."},
        403: {"description": "Missing active data consent or unauthorized plan access."},
        404: {"description": "Referenced rehabilitation plan not found."},
    },
)
async def sync_session(
    payload: dict[str, Any] = Body(
        ...,
        description="Session payload adhering to docs/contracts/session_payload.schema.json",
    ),
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> SessionSyncResponse:
    """
    Synchronizes one rehabilitation session from the mobile client to the backend:
      - Validates against `docs/contracts/session_payload.schema.json`
      - Validates numeric boundaries (pain 0-10, confidence 0-1, ROM 0-180)
      - Requires active 'data_processing' patient consent
      - Guarantees idempotency via `client_uuid`
      - Executes inside a single DB transaction with automatic rollback
      - Computes and upserts daily progress metrics
    """
    session, metrics, is_new = await SessionSyncService.sync_session(
        db=db,
        current_user=current_user,
        raw_payload=payload,
    )

    status_str = "created" if is_new else "already_synced"
    msg = (
        "Session successfully synchronized."
        if is_new
        else "Session already synced (idempotent response)."
    )

    return SessionSyncResponse(
        status=status_str,
        message=msg,
        session=SessionDetailResponse.model_validate(session),
        progress_metrics=[m for m in metrics],
    )


@router.get(
    "",
    response_model=SessionListResponse,
    summary="List patient sessions with optional date filtering",
)
async def list_sessions(
    from_date: datetime | None = Query(None, alias="from", description="ISO-8601 start timestamp filter"),
    to_date: datetime | None = Query(None, alias="to", description="ISO-8601 end timestamp filter"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> SessionListResponse:
    """
    Returns a paginated list of sessions for the authenticated patient,
    optionally filtered by time interval [from, to].
    """
    patient = await SessionSyncService.get_patient_by_user(db, current_user.id)

    query = select(Session).where(Session.patient_id == patient.id)
    count_query = select(func.count(Session.id)).where(Session.patient_id == patient.id)

    if from_date:
        query = query.where(Session.started_at >= from_date)
        count_query = count_query.where(Session.started_at >= from_date)
    if to_date:
        query = query.where(Session.started_at <= to_date)
        count_query = count_query.where(Session.started_at <= to_date)

    query = (
        query.options(selectinload(Session.session_exercises))
        .order_by(Session.started_at.desc())
        .limit(limit)
        .offset(offset)
    )

    total = (await db.execute(count_query)).scalar_one()
    sessions = (await db.execute(query)).scalars().all()

    items = [
        SessionSummaryResponse(
            id=s.id,
            client_uuid=s.client_uuid,
            patient_id=s.patient_id,
            plan_id=s.plan_id,
            started_at=s.started_at,
            ended_at=s.ended_at,
            overall_score=s.overall_score,
            exercises_count=len(s.session_exercises),
            total_reps_done=sum(ex.reps_done for ex in s.session_exercises),
        )
        for s in sessions
    ]

    return SessionListResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )


@router.get(
    "/{session_id}",
    response_model=SessionDetailResponse,
    summary="Get full session details by ID",
)
async def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> SessionDetailResponse:
    """
    Fetches full session details including all exercises and individual rep telemetry.
    Strictly restricted to the session owner.
    """
    patient = await SessionSyncService.get_patient_by_user(db, current_user.id)

    session = await SessionSyncService.get_session_by_id(db, session_id)
    if session is None:
        raise NotFoundException(f"Session {session_id} not found.")

    if session.patient_id != patient.id:
        raise ForbiddenException("Access to this session is forbidden.")

    return SessionDetailResponse.model_validate(session)
