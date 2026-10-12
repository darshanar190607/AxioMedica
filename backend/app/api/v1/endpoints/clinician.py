"""
Clinician rehabilitation plan management endpoints:
  POST /clinician/plans                - Create a customized rehabilitation plan
  PUT  /clinician/plans/{id}/approve   - Approve and activate a rehabilitation plan
"""
import logging
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_clinician
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.session import Exercise, PlanExercise, RehabilitationPlan
from app.models.user import Consent, ConsentType, Patient, User, UserRole
from app.schemas.exercise_plan import (
    ActivePlanResponse,
    ApprovePlanResponse,
    ClinicianCreatePatientRequest,
    ClinicianCreatePatientResponse,
    ClinicianPatientItem,
    ClinicianPatientListResponse,
    CreatePlanRequest,
    PrescribedExerciseResponse,
)

logger = logging.getLogger("axiomedica.clinician")

router = APIRouter(prefix="/clinician", tags=["Clinician"])


@router.post(
    "/plans",
    response_model=ActivePlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new rehabilitation plan for a patient",
)
async def create_plan(
    payload: CreatePlanRequest,
    current_user: User = Depends(require_clinician),
    db: AsyncSession = Depends(get_db),
) -> ActivePlanResponse:
    # 1. Verify patient exists
    stmt_patient = select(Patient).where(Patient.id == payload.patient_id)
    patient = (await db.execute(stmt_patient)).scalar_one_or_none()
    if patient is None:
        raise NotFoundException(f"Patient with ID {payload.patient_id} not found.")

    # 2. Deactivate previous active plans for this patient if new one is active
    stmt_prev = select(RehabilitationPlan).where(
        RehabilitationPlan.patient_id == patient.id,
        RehabilitationPlan.is_active.is_(True),
    )
    prev_plans = (await db.execute(stmt_prev)).scalars().all()
    for p in prev_plans:
        p.is_active = False

    # 3. Create plan
    new_plan = RehabilitationPlan(
        patient_id=patient.id,
        clinician_id=current_user.id,
        title=payload.title,
        status="active",
        is_approved=True,
        prescribed_frequency_per_week=payload.prescribed_frequency_per_week,
        current_week=1,
        total_weeks=payload.total_weeks,
        recovery_stage=payload.recovery_stage,
        is_active=True,
    )
    db.add(new_plan)
    await db.flush()

    # 4. Add exercises
    plan_exercise_responses: list[PrescribedExerciseResponse] = []
    for pe_data in payload.exercises:
        ex = await db.get(Exercise, pe_data.exercise_id)
        if ex is None:
            raise BadRequestException(f"Exercise ID {pe_data.exercise_id} not found.")

        pe = PlanExercise(
            plan_id=new_plan.id,
            exercise_id=ex.id,
            sets=pe_data.sets,
            reps=pe_data.reps,
            frequency=pe_data.frequency,
            duration=pe_data.duration,
            safe_range=pe_data.safe_range,
            color=pe_data.color,
            order_index=pe_data.order_index,
        )
        db.add(pe)
        plan_exercise_responses.append(
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
                progress=0,
                completed_sessions=0,
                total_sessions=8,
                completed_reps=0,
                total_reps=pe.sets * pe.reps * 8,
                pose_config=ex.pose_config,
            )
        )

    await db.commit()

    return ActivePlanResponse(
        id=new_plan.id,
        patient_id=new_plan.patient_id,
        title=new_plan.title,
        status=new_plan.status,
        is_approved=new_plan.is_approved,
        prescribed_frequency_per_week=new_plan.prescribed_frequency_per_week,
        current_week=new_plan.current_week,
        total_weeks=new_plan.total_weeks,
        recovery_stage=new_plan.recovery_stage,
        doctor=None,
        exercises=plan_exercise_responses,
    )


@router.put(
    "/plans/{plan_id}/approve",
    response_model=ApprovePlanResponse,
    summary="Clinician approves and activates a rehabilitation plan",
)
async def approve_plan(
    plan_id: uuid.UUID,
    current_user: User = Depends(require_clinician),
    db: AsyncSession = Depends(get_db),
) -> ApprovePlanResponse:
    plan = await db.get(RehabilitationPlan, plan_id)
    if plan is None:
        raise NotFoundException(f"Rehabilitation plan {plan_id} not found.")

    plan.is_approved = True
    plan.status = "active"
    plan.is_active = True
    plan.clinician_id = current_user.id
    await db.commit()

    return ApprovePlanResponse(
        id=plan.id,
        status=plan.status,
        is_approved=plan.is_approved,
        message="Plan approved and activated successfully.",
    )


@router.get(
    "/patients",
    response_model=ClinicianPatientListResponse,
    summary="List all registered rehabilitation patients",
)
async def list_patients(
    current_user: User = Depends(require_clinician),
    db: AsyncSession = Depends(get_db),
) -> ClinicianPatientListResponse:
    """
    Retrieve all patients in the system with their clinical profile and contact details.
    Accessible by clinicians and admins.
    """
    stmt = (
        select(Patient)
        .options(selectinload(Patient.user))
        .order_by(Patient.created_at.desc())
    )
    result = await db.execute(stmt)
    patients = result.scalars().all()

    items = [
        ClinicianPatientItem(
            patient_id=p.id,
            user_id=p.user_id,
            full_name=p.user.full_name if p.user else None,
            email=p.user.email if p.user else "",
            phone=p.phone,
            injured_ankle=p.injured_ankle or "Left",
            injury_type=p.injury_type or "Ankle Sprain",
            recovery_stage=p.recovery_stage or 2,
            current_week=p.current_week or 1,
            total_weeks=p.total_weeks or 6,
            recovery_percent=p.recovery_percent or 0,
            assigned_clinician_id=p.assigned_clinician_id,
            created_at=p.created_at,
        )
        for p in patients
    ]

    return ClinicianPatientListResponse(total=len(items), patients=items)


@router.post(
    "/patients",
    response_model=ClinicianCreatePatientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Onboard and create a new patient with credentials",
)
async def create_patient(
    payload: ClinicianCreatePatientRequest,
    current_user: User = Depends(require_clinician),
    db: AsyncSession = Depends(get_db),
) -> ClinicianCreatePatientResponse:
    """
    Register a new patient account with credentials, assign them to this clinician,
    and automatically create required consents so they can immediately log in.
    Accessible by clinicians and admins.
    """
    # 1. Check if email is already taken
    email_clean = payload.email.lower().strip()
    stmt_check = select(User).where(User.email == email_clean)
    existing_user = (await db.execute(stmt_check)).scalar_one_or_none()
    if existing_user is not None:
        raise ConflictException(f"User with email '{email_clean}' already exists.")

    # 2. Create User account
    new_user = User(
        email=email_clean,
        password_hash=get_password_hash(payload.password),
        role=UserRole.patient,
        full_name=payload.full_name,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    # 3. Create Patient profile
    new_patient = Patient(
        user_id=new_user.id,
        phone=payload.phone,
        injured_ankle=payload.injured_ankle,
        injury_type=payload.injury_type,
        recovery_stage=payload.recovery_stage,
        current_week=1,
        total_weeks=payload.total_weeks,
        recovery_percent=0,
        assigned_clinician_id=current_user.id,
    )
    db.add(new_patient)
    await db.flush()

    # 4. Automatically grant camera & data_processing consents
    for c_type in [ConsentType.camera, ConsentType.data_processing]:
        consent = Consent(
            user_id=new_user.id,
            consent_type=c_type,
            granted=True,
        )
        db.add(consent)

    await db.commit()
    await db.refresh(new_patient)
    await db.refresh(new_user)

    patient_item = ClinicianPatientItem(
        patient_id=new_patient.id,
        user_id=new_user.id,
        full_name=new_user.full_name,
        email=new_user.email,
        phone=new_patient.phone,
        injured_ankle=new_patient.injured_ankle or "Left",
        injury_type=new_patient.injury_type or "Ankle Sprain",
        recovery_stage=new_patient.recovery_stage or 1,
        current_week=new_patient.current_week or 1,
        total_weeks=new_patient.total_weeks or 6,
        recovery_percent=new_patient.recovery_percent or 0,
        assigned_clinician_id=new_patient.assigned_clinician_id,
        created_at=new_patient.created_at,
    )

    return ClinicianCreatePatientResponse(
        message=f"Patient '{new_user.full_name}' successfully created and onboarded.",
        patient=patient_item,
    )
