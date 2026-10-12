"""
Patient pain logging endpoints:
  POST /pain-logs - Record a pain entry (0-10 NRS)
  GET  /pain-logs - Retrieve logged pain history
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_patient
from app.core.exceptions import NotFoundException
from app.db.session import get_db
from app.models.session import PainLog
from app.models.user import Patient, User
from app.schemas.exercise_plan import CreatePainLogRequest, PainLogResponse

logger = logging.getLogger("axiomedica.pain_logs")

router = APIRouter(prefix="/pain-logs", tags=["Pain Logs"])


@router.post(
    "",
    response_model=PainLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a patient pain log entry",
)
async def create_pain_log(
    payload: CreatePainLogRequest,
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> PainLogResponse:
    stmt_patient = select(Patient).where(Patient.user_id == current_user.id)
    patient = (await db.execute(stmt_patient)).scalar_one_or_none()
    if patient is None:
        raise NotFoundException("Patient profile not found.")

    log_entry = PainLog(
        patient_id=patient.id,
        pain_level=payload.pain_level,
        body_part=payload.body_part,
        notes=payload.notes,
        logged_at=payload.logged_at or datetime.now(timezone.utc),
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)

    return PainLogResponse.model_validate(log_entry)


@router.get(
    "",
    response_model=list[PainLogResponse],
    summary="List patient pain logs",
)
async def list_pain_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> list[PainLogResponse]:
    stmt_patient = select(Patient).where(Patient.user_id == current_user.id)
    patient = (await db.execute(stmt_patient)).scalar_one_or_none()
    if patient is None:
        raise NotFoundException("Patient profile not found.")

    query = (
        select(PainLog)
        .where(PainLog.patient_id == patient.id)
        .order_by(PainLog.logged_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = (await db.execute(query)).scalars().all()
    return [PainLogResponse.model_validate(l) for l in logs]
