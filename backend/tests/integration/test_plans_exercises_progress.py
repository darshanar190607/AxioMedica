"""
Integration tests for Phase 3 endpoints:
  - 3.1 Exercises, active plan, clinician plan creation & approval
  - 3.3 Progress summary, time-series metrics, and pain logging
"""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import reset_rate_limit
from app.core.security import get_password_hash
from app.models.session import Exercise, PlanExercise, RehabilitationPlan
from app.models.user import Consent, ConsentType, Patient, User, UserRole
from scripts.seed import seed_data


# ─── Auth Setup Helpers ───────────────────────────────────────────────────────

async def setup_seeded_users(db: AsyncSession, client: AsyncClient) -> dict:
    """Run seed_data in test session and obtain login tokens."""
    reset_rate_limit()
    await seed_data(db)

    # Login demo patient (Sarah Johnson)
    resp_patient = await client.post(
        "/api/v1/auth/login",
        json={"email": "sarah.johnson@email.com", "password": "PatientPass123!"},
    )
    assert resp_patient.status_code == 200, resp_patient.text
    patient_token = resp_patient.json()["access_token"]

    # Login clinician (Dr. Michael Torres)
    resp_clinician = await client.post(
        "/api/v1/auth/login",
        json={"email": "dr.torres@axiomedica.io", "password": "ClinicianPass123!"},
    )
    assert resp_clinician.status_code == 200, resp_clinician.text
    clinician_token = resp_clinician.json()["access_token"]

    return {
        "patient_token": patient_token,
        "patient_headers": {"Authorization": f"Bearer {patient_token}"},
        "clinician_token": clinician_token,
        "clinician_headers": {"Authorization": f"Bearer {clinician_token}"},
    }


# ─── 3.1 Exercises & Plans Tests ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_exercises_list_and_detail(async_client: AsyncClient, db_session: AsyncSession):
    tokens = await setup_seeded_users(db_session, async_client)

    # 1. GET /exercises
    resp = await async_client.get("/api/v1/exercises")
    assert resp.status_code == 200
    exercises = resp.json()
    assert len(exercises) >= 6
    codes = [e["code"] for e in exercises]
    assert "heel_raise" in codes
    assert "ankle_pump" in codes
    assert "ankle_alphabet" in codes
    assert "band_dorsiflexion" in codes
    assert "single_leg_balance" in codes
    assert "calf_stretch" in codes

    # 2. GET /exercises/{id}
    ex1_id = exercises[0]["id"]
    detail_resp = await async_client.get(f"/api/v1/exercises/{ex1_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == ex1_id
    assert "pose_config" in detail
    assert detail["pose_config"]["camera_view"] in ("front", "side_either", "side_left", "side_right")


@pytest.mark.asyncio
async def test_get_active_plan(async_client: AsyncClient, db_session: AsyncSession):
    tokens = await setup_seeded_users(db_session, async_client)

    resp = await async_client.get(
        "/api/v1/plans/active",
        headers=tokens["patient_headers"],
    )
    assert resp.status_code == 200, resp.text
    plan = resp.json()
    assert plan["title"] == "Ankle Sprain Recovery Protocol"
    assert plan["status"] == "active"
    assert plan["currentWeek"] == 3
    assert plan["totalWeeks"] == 6
    assert plan["recoveryStage"] == 2
    assert plan["doctor"]["name"] == "Dr. Michael Torres"
    assert len(plan["exercises"]) >= 4

    # Verify camelCase compatibility for mobile UI
    first_ex = plan["exercises"][0]
    assert "safeRange" in first_ex
    assert "completedSessions" in first_ex
    assert "totalSessions" in first_ex
    assert "completedReps" in first_ex
    assert "totalReps" in first_ex
    assert "pose_config" in first_ex


@pytest.mark.asyncio
async def test_clinician_create_and_approve_plan(async_client: AsyncClient, db_session: AsyncSession):
    tokens = await setup_seeded_users(db_session, async_client)

    # Get patient ID
    me_resp = await async_client.get("/api/v1/patients/me", headers=tokens["patient_headers"])
    assert me_resp.status_code == 200
    patient_id = me_resp.json()["patient"]["id"]

    # 1. Clinician creates a new plan
    create_payload = {
        "patient_id": patient_id,
        "title": "Phase 2 Advanced Ankle Strengthening",
        "prescribed_frequency_per_week": 5,
        "total_weeks": 4,
        "recovery_stage": 3,
        "exercises": [
            {
                "exercise_id": 1,
                "sets": 4,
                "reps": 12,
                "frequency": "Once a day",
                "duration": "6 min",
                "safe_range": "0° – 45°",
                "color": "#F5C842",
                "order_index": 0,
            }
        ],
    }
    create_resp = await async_client.post(
        "/api/v1/clinician/plans",
        json=create_payload,
        headers=tokens["clinician_headers"],
    )
    assert create_resp.status_code == 201, create_resp.text
    new_plan = create_resp.json()
    assert new_plan["title"] == "Phase 2 Advanced Ankle Strengthening"
    plan_id = new_plan["id"]

    # 2. Patient trying to create clinician plan is denied (403)
    denied_resp = await async_client.post(
        "/api/v1/clinician/plans",
        json=create_payload,
        headers=tokens["patient_headers"],
    )
    assert denied_resp.status_code == 403

    # 3. Clinician approves the plan
    approve_resp = await async_client.put(
        f"/api/v1/clinician/plans/{plan_id}/approve",
        headers=tokens["clinician_headers"],
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["is_approved"] is True


# ─── 3.3 Progress & Pain Logging Tests ────────────────────────────────────────

@pytest.mark.asyncio
async def test_pain_logs_create_and_list(async_client: AsyncClient, db_session: AsyncSession):
    tokens = await setup_seeded_users(db_session, async_client)

    # 1. POST /pain-logs
    pain_payload = {
        "pain_level": 4,
        "body_part": "left_ankle",
        "notes": "Mild soreness after morning walking.",
    }
    post_resp = await async_client.post(
        "/api/v1/pain-logs",
        json=pain_payload,
        headers=tokens["patient_headers"],
    )
    assert post_resp.status_code == 201, post_resp.text
    log_data = post_resp.json()
    assert log_data["pain_level"] == 4
    assert log_data["body_part"] == "left_ankle"

    # 2. GET /pain-logs
    get_resp = await async_client.get(
        "/api/v1/pain-logs",
        headers=tokens["patient_headers"],
    )
    assert get_resp.status_code == 200
    logs = get_resp.json()
    assert len(logs) >= 1
    assert logs[0]["pain_level"] == 4


@pytest.mark.asyncio
async def test_progress_summary(async_client: AsyncClient, db_session: AsyncSession):
    tokens = await setup_seeded_users(db_session, async_client)

    resp = await async_client.get(
        "/api/v1/progress/summary",
        headers=tokens["patient_headers"],
    )
    assert resp.status_code == 200, resp.text
    summary = resp.json()

    # Core required fields
    assert "current_vs_baseline_rom" in summary
    assert "streak" in summary
    assert "weekly_adherence" in summary
    assert "pain_trend" in summary
    assert summary["pain_trend"]["status"] in ("improving", "stable", "worsening")

    # Mobile direct consumer mappings
    assert summary["recoveryPercent"] == 72
    assert summary["recoveryStage"] == 2
    assert summary["currentWeek"] == 3
    assert summary["totalWeeks"] == 6
    assert len(summary["sessionHistory"]) >= 1
    assert "completedSessions" in summary["stats"]
    assert "accuracy" in summary["movementQuality"]


@pytest.mark.asyncio
async def test_progress_metrics_time_series(async_client: AsyncClient, db_session: AsyncSession):
    tokens = await setup_seeded_users(db_session, async_client)

    # First sync a session to ensure progress_metrics table has records
    session_payload = {
        "client_uuid": str(uuid.uuid4()),
        "started_at": "2026-10-07T17:30:00Z",
        "ended_at": "2026-10-07T17:45:00Z",
        "pose_model_ver": "1.0.0",
        "app_version": "1.0.0",
        "overall_score": 85.0,
        "exercises": [
            {
                "exercise_id": 1,
                "sets_done": 2,
                "reps_done": 10,
                "avg_form_score": 85.0,
                "max_rom_deg": 44.0,
                "avg_rom_deg": 38.0,
                "pain_before": 3,
                "pain_after": 2,
                "side": "right",
                "reps": [
                    {
                        "set_no": 1,
                        "rep_no": 1,
                        "duration_ms": 2200.0,
                        "rom_deg": 44.0,
                        "form_score": 85.0,
                        "errors": [],
                        "confidence": 0.94,
                    }
                ],
            }
        ],
    }
    sync_resp = await async_client.post(
        "/api/v1/sessions/sync",
        json=session_payload,
        headers=tokens["patient_headers"],
    )
    assert sync_resp.status_code == 201

    # Query metrics time series for rom
    resp_rom = await async_client.get(
        "/api/v1/progress/metrics?metric=rom&from=2026-10-01&to=2026-10-31",
        headers=tokens["patient_headers"],
    )
    assert resp_rom.status_code == 200
    data_rom = resp_rom.json()
    assert data_rom["metric"] == "rom"
    assert len(data_rom["data"]) >= 1
    assert data_rom["data"][0]["value"] >= 40.0

    # Query metrics time series for pain
    resp_pain = await async_client.get(
        "/api/v1/progress/metrics?metric=pain",
        headers=tokens["patient_headers"],
    )
    assert resp_pain.status_code == 200
    data_pain = resp_pain.json()
    assert data_pain["metric"] == "pain"
    assert len(data_pain["data"]) >= 1
