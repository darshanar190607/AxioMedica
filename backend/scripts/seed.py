#!/usr/bin/env python3
"""
Seed script for AxioMedica Tele-Rehab database.

Populates:
  - 6 ankle exercises (ankle pumps, ankle alphabet, heel raises, resistance-band dorsiflexion,
    single-leg balance, calf stretch) with pose_config strictly validated against
    docs/contracts/pose_config.schema.json
  - 1 Clinician user (Dr. Michael Torres)
  - 1 Demo Patient user (Sarah Johnson) with full mobile profile data & active consents
  - 1 Active Rehabilitation Plan with prescribed exercises matching mobile UI

Idempotency:
  - Safe to run multiple times; checks for existing records by unique keys (code, email, active plan).
"""
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator, FormatChecker
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.base import Base
from app.models.session import Exercise, PlanExercise, RehabilitationPlan
from app.models.user import Consent, ConsentType, Patient, User, UserRole

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("seed")

# Path to pose config contract
POSE_SCHEMA_PATH = BACKEND_DIR.parent / "docs" / "contracts" / "pose_config.schema.json"


def load_pose_schema() -> dict:
    if not POSE_SCHEMA_PATH.exists():
        raise FileNotFoundError(f"Contract schema not found: {POSE_SCHEMA_PATH}")
    with open(POSE_SCHEMA_PATH, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def validate_pose_config(config: dict[str, Any], exercise_name: str, schema: dict) -> None:
    validator = Draft7Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(config), key=lambda e: list(e.path))
    if errors:
        msg = f"Pose config for '{exercise_name}' failed schema validation: {errors[0].message}"
        logger.error(msg)
        raise ValueError(msg)


# ─── 6 Ankle Exercises with Validated Pose Configs ───────────────────────────

EXERCISES_DATA: list[dict[str, Any]] = [
    {
        "id": 1,
        "code": "heel_raise",
        "name": "Heel Raises",
        "description": "Stand tall and lift both heels simultaneously off the floor into plantarflexion, hold for 2 seconds, then slowly lower.",
        "target_joint": "ankle",
        "side_specific": True,
        "safe_range": "0° – 45°",
        "color": "#F5C842",
        "default_duration": "5 min",
        "pose_config": {
            "camera_view": "side_either",
            "side_aware": True,
            "landmarks": {
                "left_hip": 23,
                "right_hip": 24,
                "left_knee": 25,
                "right_knee": 26,
                "left_ankle": 27,
                "right_ankle": 28,
                "left_heel": 29,
                "right_heel": 30,
                "left_foot_index": 31,
                "right_foot_index": 32,
            },
            "metrics": [
                {
                    "name": "heel_height",
                    "type": "vertical_delta",
                    "landmark": "left_heel",
                    "reference_landmark": "left_ankle",
                },
                {
                    "name": "ankle_angle",
                    "type": "angle",
                    "joints": ["left_knee", "left_ankle", "left_foot_index"],
                },
                {
                    "name": "hip_vertical_delta",
                    "type": "vertical_delta",
                    "landmark": "left_hip",
                    "reference_landmark": "left_knee",
                },
            ],
            "phases": [
                {
                    "name": "down",
                    "condition": {"metric": "heel_height", "operator": "lte", "value": 0.02},
                },
                {
                    "name": "up",
                    "condition": {"metric": "heel_height", "operator": "gte", "value": 0.08},
                },
            ],
            "rep_cycle": ["down", "up", "down"],
            "min_rep_duration_ms": 1500,
            "form_rules": [
                {
                    "id": "too_fast",
                    "check": {"metric": "rep_duration_ms", "operator": "lt", "value": 1500},
                    "cue": "Slow down — aim for 2 seconds up, hold, then 2 seconds down.",
                },
                {
                    "id": "low_height",
                    "check": {"metric": "heel_height", "operator": "lt", "value": 0.05},
                    "cue": "Lift your heels higher to achieve full plantarflexion range.",
                },
                {
                    "id": "hip_hike",
                    "check": {"metric": "hip_vertical_delta", "operator": "gt", "value": 0.05},
                    "cue": "Keep your hips level — avoid leaning or hiking your pelvis.",
                },
            ],
            "min_pose_confidence": 0.60,
        },
    },
    {
        "id": 2,
        "code": "ankle_pump",
        "name": "Ankle Pumps",
        "description": "Seated ankle dorsiflexion and plantarflexion pump to promote venous return and restore sagittal range of motion.",
        "target_joint": "ankle",
        "side_specific": True,
        "safe_range": "0° – 30°",
        "color": "#F5A623",
        "default_duration": "5 min",
        "pose_config": {
            "camera_view": "side_either",
            "side_aware": True,
            "landmarks": {
                "left_knee": 25,
                "right_knee": 26,
                "left_ankle": 27,
                "right_ankle": 28,
                "left_heel": 29,
                "right_heel": 30,
                "left_foot_index": 31,
                "right_foot_index": 32,
            },
            "metrics": [
                {
                    "name": "ankle_angle",
                    "type": "angle",
                    "joints": ["left_knee", "left_ankle", "left_foot_index"],
                },
                {
                    "name": "ankle_angle_delta",
                    "type": "vertical_delta",
                    "landmark": "left_foot_index",
                    "reference_landmark": "left_ankle",
                },
            ],
            "phases": [
                {
                    "name": "neutral",
                    "condition": {"metric": "ankle_angle", "operator": "between", "value": 82, "value_max": 98},
                },
                {
                    "name": "dorsiflexed",
                    "condition": {"metric": "ankle_angle", "operator": "lte", "value": 78},
                },
                {
                    "name": "plantarflexed",
                    "condition": {"metric": "ankle_angle", "operator": "gte", "value": 108},
                },
            ],
            "rep_cycle": ["neutral", "dorsiflexed", "neutral", "plantarflexed", "neutral"],
            "min_rep_duration_ms": 1200,
            "form_rules": [
                {
                    "id": "too_fast",
                    "check": {"metric": "rep_duration_ms", "operator": "lt", "value": 1200},
                    "cue": "Slow it down — move through the full range steadily.",
                },
                {
                    "id": "low_confidence",
                    "check": {"metric": "rep_duration_ms", "operator": "gt", "value": 0},
                    "cue": "Keep your leg in the camera frame for accurate tracking.",
                },
            ],
            "min_pose_confidence": 0.60,
        },
    },
    {
        "id": 3,
        "code": "ankle_alphabet",
        "name": "Ankle Alphabet",
        "description": "Point your big toe and gently trace capital letters in the air to mobilize multi-plane ankle and subtalar articulation.",
        "target_joint": "ankle",
        "side_specific": True,
        "safe_range": "0° – 20°",
        "color": "#7EC8A4",
        "default_duration": "4 min",
        "pose_config": {
            "camera_view": "side_either",
            "side_aware": True,
            "landmarks": {
                "left_knee": 25,
                "right_knee": 26,
                "left_ankle": 27,
                "right_ankle": 28,
                "left_heel": 29,
                "right_heel": 30,
                "left_foot_index": 31,
                "right_foot_index": 32,
            },
            "metrics": [
                {
                    "name": "toe_vertical_delta",
                    "type": "vertical_delta",
                    "landmark": "left_foot_index",
                    "reference_landmark": "left_ankle",
                },
                {
                    "name": "ankle_angle",
                    "type": "angle",
                    "joints": ["left_knee", "left_ankle", "left_foot_index"],
                },
            ],
            "phases": [
                {
                    "name": "center",
                    "condition": {"metric": "toe_vertical_delta", "operator": "between", "value": -0.05, "value_max": 0.05},
                },
                {
                    "name": "stroke_up",
                    "condition": {"metric": "toe_vertical_delta", "operator": "gte", "value": 0.06},
                },
                {
                    "name": "stroke_down",
                    "condition": {"metric": "toe_vertical_delta", "operator": "lte", "value": -0.06},
                },
            ],
            "rep_cycle": ["center", "stroke_up", "stroke_down", "center"],
            "min_rep_duration_ms": 2000,
            "form_rules": [
                {
                    "id": "too_fast",
                    "check": {"metric": "rep_duration_ms", "operator": "lt", "value": 2000},
                    "cue": "Trace letters slowly and deliberately.",
                },
                {
                    "id": "low_confidence",
                    "check": {"metric": "rep_duration_ms", "operator": "gt", "value": 0},
                    "cue": "Position foot clearly in camera frame.",
                },
            ],
            "min_pose_confidence": 0.60,
        },
    },
    {
        "id": 4,
        "code": "band_dorsiflexion",
        "name": "Resistance-Band Dorsiflexion",
        "description": "Loop an elastic resistance band around the forefoot and pull your toes backward toward your shin against resistance.",
        "target_joint": "ankle",
        "side_specific": True,
        "safe_range": "0° – 20°",
        "color": "#A8D5BA",
        "default_duration": "5 min",
        "pose_config": {
            "camera_view": "side_either",
            "side_aware": True,
            "landmarks": {
                "left_knee": 25,
                "right_knee": 26,
                "left_ankle": 27,
                "right_ankle": 28,
                "left_heel": 29,
                "right_heel": 30,
                "left_foot_index": 31,
                "right_foot_index": 32,
            },
            "metrics": [
                {
                    "name": "ankle_angle",
                    "type": "angle",
                    "joints": ["left_knee", "left_ankle", "left_foot_index"],
                },
                {
                    "name": "toe_lift",
                    "type": "vertical_delta",
                    "landmark": "left_foot_index",
                    "reference_landmark": "left_ankle",
                },
            ],
            "phases": [
                {
                    "name": "start_plantar",
                    "condition": {"metric": "ankle_angle", "operator": "gte", "value": 98},
                },
                {
                    "name": "peak_dorsi",
                    "condition": {"metric": "ankle_angle", "operator": "lte", "value": 78},
                },
            ],
            "rep_cycle": ["start_plantar", "peak_dorsi", "start_plantar"],
            "min_rep_duration_ms": 1500,
            "form_rules": [
                {
                    "id": "too_fast",
                    "check": {"metric": "rep_duration_ms", "operator": "lt", "value": 1500},
                    "cue": "Control the return movement against the band resistance.",
                },
                {
                    "id": "low_height",
                    "check": {"metric": "toe_lift", "operator": "lt", "value": 0.03},
                    "cue": "Pull the band closer to shin for full dorsiflexion excursion.",
                },
            ],
            "min_pose_confidence": 0.60,
        },
    },
    {
        "id": 5,
        "code": "single_leg_balance",
        "name": "Single-Leg Balance",
        "description": "Stand unsupported on the rehabilitating limb with knee slightly unlocked to train proprioception and ankle stability.",
        "target_joint": "ankle",
        "side_specific": True,
        "safe_range": "0° – 10°",
        "color": "#76C7C0",
        "default_duration": "3 min",
        "pose_config": {
            "camera_view": "front",
            "side_aware": True,
            "landmarks": {
                "left_shoulder": 11,
                "right_shoulder": 12,
                "left_hip": 23,
                "right_hip": 24,
                "left_knee": 25,
                "right_knee": 26,
                "left_ankle": 27,
                "right_ankle": 28,
            },
            "metrics": [
                {
                    "name": "knee_valgus_angle",
                    "type": "angle",
                    "joints": ["left_hip", "left_knee", "left_ankle"],
                },
                {
                    "name": "hip_level_delta",
                    "type": "vertical_delta",
                    "landmark": "left_hip",
                    "reference_landmark": "right_hip",
                },
            ],
            "phases": [
                {
                    "name": "balance_entry",
                    "condition": {"metric": "knee_valgus_angle", "operator": "gte", "value": 165},
                },
                {
                    "name": "balance_hold",
                    "condition": {"metric": "knee_valgus_angle", "operator": "between", "value": 168, "value_max": 180},
                },
            ],
            "rep_cycle": ["balance_entry", "balance_hold", "balance_entry"],
            "min_rep_duration_ms": 5000,
            "form_rules": [
                {
                    "id": "knee_valgus",
                    "check": {"metric": "knee_valgus_angle", "operator": "lt", "value": 160},
                    "cue": "Keep your knee aligned over your second toe; avoid caving inward.",
                },
                {
                    "id": "hip_hike",
                    "check": {"metric": "hip_level_delta", "operator": "gt", "value": 0.08},
                    "cue": "Keep your pelvis square and level.",
                },
            ],
            "min_pose_confidence": 0.65,
        },
    },
    {
        "id": 6,
        "code": "calf_stretch",
        "name": "Calf Stretch",
        "description": "Place hands against wall, step injured foot back with heel pressed into floor and rear leg extended to stretch calf muscles.",
        "target_joint": "ankle",
        "side_specific": True,
        "safe_range": "10° – 35°",
        "color": "#81A4CD",
        "default_duration": "4 min",
        "pose_config": {
            "camera_view": "side_either",
            "side_aware": True,
            "landmarks": {
                "left_hip": 23,
                "right_hip": 24,
                "left_knee": 25,
                "right_knee": 26,
                "left_ankle": 27,
                "right_ankle": 28,
                "left_heel": 29,
                "right_heel": 30,
            },
            "metrics": [
                {
                    "name": "rear_knee_angle",
                    "type": "angle",
                    "joints": ["left_hip", "left_knee", "left_ankle"],
                },
                {
                    "name": "heel_ground_delta",
                    "type": "vertical_delta",
                    "landmark": "left_heel",
                    "reference_landmark": "left_ankle",
                },
            ],
            "phases": [
                {
                    "name": "stretch_entry",
                    "condition": {"metric": "rear_knee_angle", "operator": "between", "value": 155, "value_max": 170},
                },
                {
                    "name": "stretch_hold",
                    "condition": {"metric": "rear_knee_angle", "operator": "gte", "value": 170},
                },
            ],
            "rep_cycle": ["stretch_entry", "stretch_hold", "stretch_entry"],
            "min_rep_duration_ms": 10000,
            "form_rules": [
                {
                    "id": "early_heel_lift",
                    "check": {"metric": "heel_ground_delta", "operator": "gt", "value": 0.03},
                    "cue": "Keep your rear heel planted firmly on the floor throughout the stretch.",
                },
                {
                    "id": "too_fast",
                    "check": {"metric": "rep_duration_ms", "operator": "lt", "value": 8000},
                    "cue": "Hold the static stretch for at least 10 seconds without bouncing.",
                },
            ],
            "min_pose_confidence": 0.60,
        },
    },
]


async def seed_data(session: AsyncSession) -> None:
    logger.info("Loading and validating pose_config contract schema...")
    schema = load_pose_schema()

    # 1. Seed & Validate Exercises
    logger.info("Seeding 6 ankle exercises...")
    for ex_data in EXERCISES_DATA:
        validate_pose_config(ex_data["pose_config"], ex_data["name"], schema)

        stmt = select(Exercise).where(Exercise.code == ex_data["code"])
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            existing.name = ex_data["name"]
            existing.description = ex_data["description"]
            existing.target_joint = ex_data["target_joint"]
            existing.side_specific = ex_data["side_specific"]
            existing.pose_config = ex_data["pose_config"]
            existing.safe_range = ex_data["safe_range"]
            existing.color = ex_data["color"]
            existing.default_duration = ex_data["default_duration"]
            logger.info("  Updated exercise: %s (id=%s)", ex_data["name"], existing.id)
        else:
            new_ex = Exercise(
                id=ex_data["id"],
                code=ex_data["code"],
                name=ex_data["name"],
                description=ex_data["description"],
                target_joint=ex_data["target_joint"],
                side_specific=ex_data["side_specific"],
                pose_config=ex_data["pose_config"],
                safe_range=ex_data["safe_range"],
                color=ex_data["color"],
                default_duration=ex_data["default_duration"],
            )
            session.add(new_ex)
            logger.info("  Created exercise: %s (id=%s)", ex_data["name"], ex_data["id"])

    await session.flush()

    # 2. Seed Admin User (admin@axiomedica.io)
    admin_email = "admin@axiomedica.io"
    logger.info("Seeding admin: %s...", admin_email)
    stmt_admin = select(User).where(User.email == admin_email)
    admin_user = (await session.execute(stmt_admin)).scalar_one_or_none()
    if not admin_user:
        admin_user = User(
            email=admin_email,
            password_hash=get_password_hash("AdminPass123!"),
            role=UserRole.admin,
            full_name="System Administrator",
            is_active=True,
        )
        session.add(admin_user)
        await session.flush()
        logger.info("  Created admin: %s", admin_user.email)
    else:
        admin_user.full_name = "System Administrator"
        admin_user.role = UserRole.admin
        logger.info("  Admin already exists: %s", admin_user.email)

    # 3. Seed Clinician User (Dr. Michael Torres)
    clinician_email = "dr.torres@axiomedica.io"
    logger.info("Seeding clinician: %s...", clinician_email)
    stmt_clin = select(User).where(User.email == clinician_email)
    clinician_user = (await session.execute(stmt_clin)).scalar_one_or_none()
    if not clinician_user:
        clinician_user = User(
            email=clinician_email,
            password_hash=get_password_hash("ClinicianPass123!"),
            role=UserRole.clinician,
            full_name="Dr. Michael Torres",
            is_active=True,
        )
        session.add(clinician_user)
        await session.flush()
        logger.info("  Created clinician: %s", clinician_user.email)
    else:
        clinician_user.full_name = "Dr. Michael Torres"
        clinician_user.role = UserRole.clinician
        logger.info("  Clinician already exists: %s", clinician_user.email)

    # 3. Seed Demo Patient User (Sarah Johnson)
    patient_email = "sarah.johnson@email.com"
    logger.info("Seeding demo patient: %s...", patient_email)
    stmt_pat = select(User).where(User.email == patient_email)
    patient_user = (await session.execute(stmt_pat)).scalar_one_or_none()
    if not patient_user:
        patient_user = User(
            email=patient_email,
            password_hash=get_password_hash("PatientPass123!"),
            role=UserRole.patient,
            full_name="Sarah Johnson",
            is_active=True,
        )
        session.add(patient_user)
        await session.flush()
        logger.info("  Created patient user: %s", patient_user.email)
    else:
        patient_user.full_name = "Sarah Johnson"
        logger.info("  Patient user already exists: %s", patient_user.email)

    # 4. Seed Patient Profile matching mobile app
    stmt_profile = select(Patient).where(Patient.user_id == patient_user.id)
    patient_profile = (await session.execute(stmt_profile)).scalar_one_or_none()
    if not patient_profile:
        patient_profile = Patient(
            user_id=patient_user.id,
            phone="+1 (555) 234-7890",
            bio="Grade 2 anterior talofibular ligament (ATFL) sprain rehabilitating via remote telerehab.",
            injured_ankle="Left",
            injury_type="Ankle Sprain",
            recovery_stage=2,
            current_week=3,
            total_weeks=6,
            recovery_percent=72,
            assigned_clinician_id=clinician_user.id,
        )
        session.add(patient_profile)
        await session.flush()
        logger.info("  Created patient profile for: %s", patient_user.full_name)
    else:
        patient_profile.phone = "+1 (555) 234-7890"
        patient_profile.injured_ankle = "Left"
        patient_profile.injury_type = "Ankle Sprain"
        patient_profile.recovery_stage = 2
        patient_profile.current_week = 3
        patient_profile.total_weeks = 6
        patient_profile.recovery_percent = 72
        patient_profile.assigned_clinician_id = clinician_user.id
        logger.info("  Updated patient profile for: %s", patient_user.full_name)

    # 5. Ensure consents are created and granted
    for c_type in [ConsentType.camera, ConsentType.data_processing]:
        stmt_c = select(Consent).where(
            Consent.user_id == patient_user.id,
            Consent.consent_type == c_type,
        )
        existing_c = (await session.execute(stmt_c)).scalar_one_or_none()
        if not existing_c:
            session.add(Consent(user_id=patient_user.id, consent_type=c_type, granted=True))
            logger.info("  Created %s consent for patient", c_type.value)
        else:
            existing_c.granted = True

    await session.flush()

    # 6. Seed Active Rehabilitation Plan
    stmt_plan = select(RehabilitationPlan).where(
        RehabilitationPlan.patient_id == patient_profile.id,
        RehabilitationPlan.is_active.is_(True),
    )
    active_plan = (await session.execute(stmt_plan)).scalar_one_or_none()
    if not active_plan:
        active_plan = RehabilitationPlan(
            patient_id=patient_profile.id,
            clinician_id=clinician_user.id,
            title="Ankle Sprain Recovery Protocol",
            status="active",
            is_approved=True,
            prescribed_frequency_per_week=7,
            current_week=3,
            total_weeks=6,
            recovery_stage=2,
            is_active=True,
        )
        session.add(active_plan)
        await session.flush()
        logger.info("  Created active rehabilitation plan: %s", active_plan.title)

        # Prescribe 4 core assigned exercises matching assignedExercises in patientData.js
        prescriptions = [
            {"exercise_id": 1, "sets": 3, "reps": 10, "frequency": "Twice a day", "duration": "5 min", "safe_range": "0° – 45°", "color": "#F5C842", "order": 0},
            {"exercise_id": 2, "sets": 3, "reps": 10, "frequency": "Twice a day", "duration": "5 min", "safe_range": "0° – 30°", "color": "#F5A623", "order": 1},
            {"exercise_id": 3, "sets": 3, "reps": 10, "frequency": "Once a day", "duration": "4 min", "safe_range": "0° – 20°", "color": "#7EC8A4", "order": 2},
            {"exercise_id": 4, "sets": 3, "reps": 10, "frequency": "Once a day", "duration": "5 min", "safe_range": "0° – 20°", "color": "#A8D5BA", "order": 3},
        ]
        for p in prescriptions:
            pe = PlanExercise(
                plan_id=active_plan.id,
                exercise_id=p["exercise_id"],
                sets=p["sets"],
                reps=p["reps"],
                frequency=p["frequency"],
                duration=p["duration"],
                safe_range=p["safe_range"],
                color=p["color"],
                order_index=p["order"],
            )
            session.add(pe)
        logger.info("  Prescribed %d exercises to active plan.", len(prescriptions))
    else:
        logger.info("  Active rehabilitation plan already exists: %s", active_plan.title)

    await session.commit()
    logger.info("Database seeding successfully completed!")


import argparse


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed AxioMedica database with demo data.")
    parser.add_argument(
        "--database-url",
        default=None,
        help="Optional database URL override (defaults to settings.DATABASE_URL)",
    )
    args = parser.parse_args()

    db_url = args.database_url or settings.DATABASE_URL
    logger.info("Connecting to database: %s...", db_url.split("@")[-1] if "@" in db_url else db_url)

    connect_args = {}
    if "sqlite" in db_url:
        connect_args["check_same_thread"] = False

    engine = create_async_engine(db_url, echo=False, connect_args=connect_args)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        await seed_data(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
