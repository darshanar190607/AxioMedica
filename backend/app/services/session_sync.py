"""
Session sync service:
  - Validates session payloads against JSON schema contract (docs/contracts/session_payload.schema.json)
  - Enforces active "data_processing" patient consent
  - Enforces plan ownership (rejects plans assigned to other patients)
  - Ensures atomic transactional persistence (full rollback on failure)
  - Handles idempotency via client_uuid
  - Computes and upserts daily progress_metrics (max ROM per day per side, adherence %, avg pain, avg form score)
"""
import json
import logging
import uuid
from datetime import date
from pathlib import Path
from typing import Any

import jsonschema
from jsonschema import Draft7Validator, FormatChecker
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.models.session import (
    Exercise,
    ProgressMetric,
    RehabilitationPlan,
    RepEvent,
    Session,
    SessionExercise,
)
from app.models.user import Consent, ConsentType, Patient, User
from app.schemas.session import SessionSyncPayload

logger = logging.getLogger("axiomedica.session_sync")

# Locate contract schema file
CONTRACT_SCHEMA_PATH = (
    Path(__file__).resolve().parents[3] / "docs" / "contracts" / "session_payload.schema.json"
)

_cached_schema: dict | None = None


def get_contract_schema() -> dict:
    global _cached_schema
    if _cached_schema is None:
        if not CONTRACT_SCHEMA_PATH.exists():
            raise RuntimeError(f"Contract schema not found at {CONTRACT_SCHEMA_PATH}")
        with open(CONTRACT_SCHEMA_PATH, "r", encoding="utf-8-sig") as f:
            _cached_schema = json.load(f)
    return _cached_schema


def validate_payload_against_schema(raw_data: dict[str, Any]) -> None:
    """
    Validate a raw dictionary payload against docs/contracts/session_payload.schema.json.
    Raises BadRequestException with field path details if validation fails.
    """
    schema = get_contract_schema()
    validator = Draft7Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(raw_data), key=lambda e: list(e.path))

    if errors:
        error_details = [
            {"path": " -> ".join(str(p) for p in err.path) or "root", "message": err.message}
            for err in errors
        ]
        logger.warning("Contract schema validation failed: %s", error_details)
        raise BadRequestException(
            message=f"Payload failed contract schema validation: {errors[0].message}",
            details={"contract_errors": error_details},
        )


class SessionSyncService:
    @staticmethod
    async def verify_consent(db: AsyncSession, user_id: uuid.UUID) -> None:
        """
        Verify that the user has an active, granted 'data_processing' consent.
        """
        stmt = select(Consent).where(
            Consent.user_id == user_id,
            Consent.consent_type == ConsentType.data_processing,
            Consent.granted.is_(True),
        )
        result = await db.execute(stmt)
        consent = result.scalar_one_or_none()
        if not consent:
            raise ForbiddenException(
                "Active 'data_processing' consent is required to sync rehabilitation sessions."
            )

    @staticmethod
    async def get_patient_by_user(db: AsyncSession, user_id: uuid.UUID) -> Patient:
        stmt = select(Patient).where(Patient.user_id == user_id)
        result = await db.execute(stmt)
        patient = result.scalar_one_or_none()
        if not patient:
            raise NotFoundException("Patient profile not found.")
        return patient

    @staticmethod
    async def get_existing_session_by_client_uuid(
        db: AsyncSession, client_uuid: uuid.UUID
    ) -> Session | None:
        stmt = (
            select(Session)
            .where(Session.client_uuid == client_uuid)
            .options(
                selectinload(Session.session_exercises).selectinload(
                    SessionExercise.rep_events
                )
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_session_by_id(
        db: AsyncSession, session_id: uuid.UUID
    ) -> Session | None:
        stmt = (
            select(Session)
            .where(Session.id == session_id)
            .options(
                selectinload(Session.session_exercises).selectinload(
                    SessionExercise.rep_events
                )
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def sync_session(
        cls,
        db: AsyncSession,
        current_user: User,
        raw_payload: dict[str, Any],
    ) -> tuple[Session, list[ProgressMetric], bool]:
        """
        Main synchronization pipeline:
          1. Contract schema validation
          2. Check active data_processing consent
          3. Pydantic range & type validation
          4. Check idempotency (duplicate client_uuid)
          5. Verify plan ownership (if plan_id provided)
          6. Verify exercises exist
          7. Single DB transaction: insert session, exercises, reps, upsert metrics
          8. Full rollback on any error
        Returns (session, metrics, is_newly_created).
        """
        # 1. Validate raw payload against JSON schema contract
        validate_payload_against_schema(raw_payload)

        # 2. Check active data_processing consent
        await cls.verify_consent(db, current_user.id)

        # 3. Pydantic validation (ranges, types)
        payload = SessionSyncPayload.model_validate(raw_payload)

        patient = await cls.get_patient_by_user(db, current_user.id)

        # 4. Idempotency check
        existing_session = await cls.get_existing_session_by_client_uuid(
            db, payload.client_uuid
        )
        if existing_session is not None:
            if existing_session.patient_id != patient.id:
                raise ForbiddenException("Session client_uuid belongs to another patient.")

            # Load existing metrics for this date
            session_date = payload.started_at.date()
            stmt_metrics = select(ProgressMetric).where(
                ProgressMetric.patient_id == patient.id,
                ProgressMetric.date == session_date,
            )
            existing_metrics = (await db.execute(stmt_metrics)).scalars().all()
            return existing_session, list(existing_metrics), False

        # 5. Verify plan ownership if plan_id provided
        if payload.plan_id is not None:
            stmt_plan = select(RehabilitationPlan).where(
                RehabilitationPlan.id == payload.plan_id
            )
            plan = (await db.execute(stmt_plan)).scalar_one_or_none()
            if plan is None:
                raise NotFoundException(f"Rehabilitation plan {payload.plan_id} not found.")
            if plan.patient_id != patient.id:
                raise ForbiddenException(
                    "Rehabilitation plan does not belong to the authenticated patient."
                )

        # 6. Verify exercises exist in DB
        exercise_ids = {ex.exercise_id for ex in payload.exercises}
        stmt_ex = select(Exercise.id).where(Exercise.id.in_(exercise_ids))
        found_ex_ids = set((await db.execute(stmt_ex)).scalars().all())
        missing_ids = exercise_ids - found_ex_ids
        if missing_ids:
            raise BadRequestException(
                f"Exercises with IDs {sorted(missing_ids)} do not exist in catalog."
            )

        # 7. Single DB transaction with full rollback on failure
        try:
            new_session = Session(
                client_uuid=payload.client_uuid,
                patient_id=patient.id,
                plan_id=payload.plan_id,
                started_at=payload.started_at,
                ended_at=payload.ended_at,
                pose_model_ver=payload.pose_model_ver,
                app_version=payload.app_version,
                overall_score=payload.overall_score,
            )
            db.add(new_session)
            await db.flush()

            for ex_data in payload.exercises:
                session_exercise = SessionExercise(
                    session_id=new_session.id,
                    exercise_id=ex_data.exercise_id,
                    sets_done=ex_data.sets_done,
                    reps_done=ex_data.reps_done,
                    avg_form_score=ex_data.avg_form_score,
                    max_rom_deg=ex_data.max_rom_deg,
                    avg_rom_deg=ex_data.avg_rom_deg,
                    pain_before=ex_data.pain_before,
                    pain_after=ex_data.pain_after,
                    side=ex_data.side or "right",
                )
                db.add(session_exercise)
                await db.flush()

                for rep_data in ex_data.reps:
                    rep_event = RepEvent(
                        session_exercise_id=session_exercise.id,
                        set_no=rep_data.set_no,
                        rep_no=rep_data.rep_no,
                        duration_ms=rep_data.duration_ms,
                        rom_deg=rep_data.rom_deg,
                        form_score=rep_data.form_score,
                        errors=rep_data.errors,
                        confidence=rep_data.confidence,
                    )
                    db.add(rep_event)

            await db.flush()

            # 8. Compute and upsert progress_metrics
            session_date = payload.started_at.date()
            updated_metrics = await cls._upsert_progress_metrics(
                db=db,
                patient_id=patient.id,
                session_date=session_date,
                exercises=payload.exercises,
            )

            await db.commit()

            # Re-fetch session with loaded relationships
            synced_session = await cls.get_session_by_id(db, new_session.id)
            if synced_session is None:  # pragma: no cover
                synced_session = new_session

            return synced_session, updated_metrics, True

        except Exception as exc:
            await db.rollback()
            logger.error("Session sync failed, rolled back transaction: %s", exc, exc_info=True)
            raise

    @classmethod
    async def _upsert_progress_metrics(
        cls,
        db: AsyncSession,
        patient_id: uuid.UUID,
        session_date: date,
        exercises: list[Any],
    ) -> list[ProgressMetric]:
        """
        Compute and upsert daily progress metrics:
          - max ROM per day per side
          - adherence %
          - average pain
          - average form score
        """
        metrics: list[ProgressMetric] = []

        # Process per exercise and side
        for ex in exercises:
            side = ex.side or "right"
            max_rom = ex.max_rom_deg
            if ex.reps:
                max_rom = max(max_rom, max(r.rom_deg for r in ex.reps))

            avg_pain = (ex.pain_before + ex.pain_after) / 2.0
            avg_form = ex.avg_form_score
            reps_count = ex.reps_done

            stmt = select(ProgressMetric).where(
                ProgressMetric.patient_id == patient_id,
                ProgressMetric.date == session_date,
                ProgressMetric.exercise_id == ex.exercise_id,
                ProgressMetric.side == side,
            )
            existing = (await db.execute(stmt)).scalar_one_or_none()

            if existing:
                existing.max_rom_deg = max(existing.max_rom_deg, max_rom)
                new_total_sessions = existing.total_sessions + 1
                existing.avg_form_score = round(
                    (existing.avg_form_score * existing.total_sessions + avg_form)
                    / new_total_sessions,
                    2,
                )
                existing.avg_pain = round(
                    (existing.avg_pain * existing.total_sessions + avg_pain)
                    / new_total_sessions,
                    2,
                )
                existing.avg_rom_deg = round(
                    (existing.avg_rom_deg * existing.total_sessions + ex.avg_rom_deg)
                    / new_total_sessions,
                    2,
                )
                existing.total_sessions = new_total_sessions
                existing.total_reps += reps_count
                existing.adherence_pct = 100.0  # Daily completion achieved
                metrics.append(existing)
            else:
                metric = ProgressMetric(
                    patient_id=patient_id,
                    date=session_date,
                    exercise_id=ex.exercise_id,
                    side=side,
                    max_rom_deg=round(max_rom, 2),
                    avg_rom_deg=round(ex.avg_rom_deg, 2),
                    avg_form_score=round(avg_form, 2),
                    avg_pain=round(avg_pain, 2),
                    adherence_pct=100.0,
                    total_sessions=1,
                    total_reps=reps_count,
                )
                db.add(metric)
                metrics.append(metric)

        await db.flush()
        return metrics
