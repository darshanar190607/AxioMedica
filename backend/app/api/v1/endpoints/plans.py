"""
Rehabilitation plan endpoints for patients:
  GET /plans/active  - Get patient's active prescribed plan with exercises & pose_configs
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_patient
from app.core.exceptions import NotFoundException
from app.db.session import get_db
from app.models.session import (
    PlanExercise,
    RehabilitationPlan,
    Session,
    SessionExercise,
)
from app.models.user import Patient, User
from app.schemas.exercise_plan import (
    ActivePlanResponse,
    ClinicianDoctorInfo,
    PrescribedExerciseResponse,
)

logger = logging.getLogger("axiomedica.plans")

router = APIRouter(prefix="/plans", tags=["Plans"])


@router.get(
    "/active",
    response_model=ActivePlanResponse,
    summary="Get patient's active prescribed rehabilitation plan",
)
async def get_active_plan(
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> ActivePlanResponse:
    # 1. Fetch patient
    stmt_patient = (
        select(Patient)
        .where(Patient.user_id == current_user.id)
        .options(selectinload(Patient.clinician))
    )
    patient = (await db.execute(stmt_patient)).scalar_one_or_none()
    if patient is None:
        raise NotFoundException("Patient profile not found.")

    # 2. Fetch active plan
    stmt_plan = (
        select(RehabilitationPlan)
        .where(
            RehabilitationPlan.patient_id == patient.id,
            RehabilitationPlan.is_active.is_(True),
        )
        .options(
            selectinload(RehabilitationPlan.plan_exercises).selectinload(
                PlanExercise.exercise
            )
        )
        .order_by(RehabilitationPlan.created_at.desc())
    )
    plan = (await db.execute(stmt_plan)).scalar_one_or_none()
    if plan is None:
        raise NotFoundException("No active rehabilitation plan found for this patient.")

    # 3. Doctor info
    doctor_info = None
    if patient.clinician:
        doctor_info = ClinicianDoctorInfo(
            name=patient.clinician.full_name or "Assigned Clinician",
            phone=None,
        )

    # 4. Compute completed sessions/reps per exercise in this plan
    exercise_responses: list[PrescribedExerciseResponse] = []
    for pe in plan.plan_exercises:
        ex = pe.exercise

        # Aggregate stats for this exercise
        stmt_stats = (
            select(
                func.count(SessionExercise.id).label("completed_sessions"),
                func.coalesce(func.sum(SessionExercise.reps_done), 0).label("completed_reps"),
            )
            .join(Session, Session.id == SessionExercise.session_id)
            .where(
                Session.patient_id == patient.id,
                SessionExercise.exercise_id == ex.id,
            )
        )
        stats_row = (await db.execute(stmt_stats)).one()
        comp_sessions = int(stats_row.completed_sessions)
        comp_reps = int(stats_row.completed_reps)
        target_sessions = 8
        target_reps = pe.sets * pe.reps * target_sessions
        progress = min(100, int((comp_sessions / max(target_sessions, 1)) * 100))

        exercise_responses.append(
            PrescribedExerciseResponse(
                id=ex.id,
                exercise_id=ex.id,
                name=ex.name,
                code=ex.code,
                description=ex.description,
                sets=pe.sets,
                reps=pe.reps,
                frequency=pe.frequency,
                duration=pe.duration,
                safe_range=pe.safe_range,
                color=pe.color,
                progress=progress,
                completed_sessions=comp_sessions,
                total_sessions=target_sessions,
                completed_reps=comp_reps,
                total_reps=target_reps,
                pose_config=ex.pose_config,
            )
        )

    return ActivePlanResponse(
        id=plan.id,
        patient_id=plan.patient_id,
        title=plan.title,
        status=plan.status,
        is_approved=plan.is_approved,
        prescribed_frequency_per_week=plan.prescribed_frequency_per_week,
        current_week=plan.current_week,
        total_weeks=plan.total_weeks,
        recovery_stage=plan.recovery_stage,
        doctor=doctor_info,
        exercises=exercise_responses,
    )
