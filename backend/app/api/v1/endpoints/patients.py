"""
Patient profile endpoints:

  GET   /patients/me  – fetch authenticated patient's own profile
  PATCH /patients/me  – update authenticated patient's own profile
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_patient
from app.core.exceptions import NotFoundException
from app.db.session import get_db
from app.models.user import Patient, User
from app.schemas.auth import PatientMeResponse, PatchPatientRequest, PatientProfile

logger = logging.getLogger("axiomedica.patients")

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get(
    "/me",
    response_model=PatientMeResponse,
    summary="Get authenticated patient's profile",
)
async def get_patient_me(
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> PatientMeResponse:
    """
    Retrieve the full patient profile for the currently authenticated patient.
    Requires role: patient.
    """
    result = await db.execute(
        select(Patient)
        .where(Patient.user_id == current_user.id)
        .options(selectinload(Patient.user))
    )
    patient: Patient | None = result.scalar_one_or_none()
    if patient is None:
        raise NotFoundException("Patient profile not found.")

    return PatientMeResponse(patient=PatientProfile.model_validate(patient))


@router.patch(
    "/me",
    response_model=PatientMeResponse,
    summary="Update authenticated patient's profile",
)
async def patch_patient_me(
    payload: PatchPatientRequest,
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> PatientMeResponse:
    """
    Partially update the patient profile for the currently authenticated patient.
    All fields are optional – only provided fields are updated.
    Requires role: patient.
    """
    result = await db.execute(
        select(Patient)
        .where(Patient.user_id == current_user.id)
        .options(selectinload(Patient.user))
    )
    patient: Patient | None = result.scalar_one_or_none()
    if patient is None:
        raise NotFoundException("Patient profile not found.")

    # Apply partial updates
    update_data = payload.model_dump(exclude_unset=True)

    # Separate user-level fields from patient-level fields
    user_fields = {"full_name"}
    patient_fields = {"phone", "bio", "date_of_birth"}

    for field, value in update_data.items():
        if field in patient_fields:
            setattr(patient, field, value)
        elif field in user_fields:
            setattr(current_user, field, value)

    db.add(patient)
    db.add(current_user)
    await db.flush()

    # Re-load to ensure updated_at etc. are fresh
    await db.refresh(patient)
    await db.refresh(current_user)

    return PatientMeResponse(patient=PatientProfile.model_validate(patient))
