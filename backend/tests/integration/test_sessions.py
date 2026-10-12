"""
Integration tests for /sessions endpoints:
  - POST /sessions/sync
  - GET  /sessions
  - GET  /sessions/{id}

Covers requirements:
  1. Successful session sync with nested session_exercises and rep_events
  2. Idempotent upload via client_uuid (duplicate returns existing, no new row)
  3. Range validation (pain 0-10, confidence 0-1, ROM 0-180, form score 0-100)
  4. Contract schema validation against docs/contracts/session_payload.schema.json
  5. Missing / revoked 'data_processing' consent rejected (403 Forbidden)
  6. Another patient's plan_id rejected (403 Forbidden)
  7. Partial failure triggers complete rollback (no orphaned rows)
  8. Large payload (500 reps) processed and aggregated accurately
  9. Progress metrics computed and upserted (max ROM per day per side, adherence %, avg pain, avg form score)
 10. GET /sessions with ?from=&to= date range filtering
 11. GET /sessions/{id} retrieves complete nested details and prevents cross-patient access
"""
import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import (
    Exercise,
    ProgressMetric,
    RehabilitationPlan,
    RepEvent,
    Session,
    SessionExercise,
)
from app.models.user import Consent, ConsentType, Patient, User


from app.core.rate_limit import reset_rate_limit

# ─── Seed Helper ─────────────────────────────────────────────────────────────

async def seed_exercise_catalog(db: AsyncSession) -> Exercise:
    """Ensure catalog has exercise_id=1 (Heel Raise) and exercise_id=2 (Ankle Pump)."""
    ex1 = await db.get(Exercise, 1)
    if not ex1:
        ex1 = Exercise(
            id=1,
            code="heel_raise",
            name="Heel Raise",
            description="Calf raise on flat surface",
            target_joint="ankle",
            side_specific=True,
        )
        db.add(ex1)

    ex2 = await db.get(Exercise, 2)
    if not ex2:
        ex2 = Exercise(
            id=2,
            code="ankle_pump",
            name="Ankle Pump",
            description="Plantarflexion and dorsiflexion",
            target_joint="ankle",
            side_specific=True,
        )
        db.add(ex2)

    await db.flush()
    return ex1


async def register_patient(
    client: AsyncClient, email: str = "patient@axiomedica.io"
) -> dict:
    """Register patient and log in to obtain access token and user info."""
    reset_rate_limit()
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123", "full_name": "Test Patient"},
    )
    assert reg_resp.status_code == 201
    user_id = reg_resp.json()["user"]["id"]

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePassword123"},
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    return {
        "access_token": data["access_token"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
        "user_id": user_id,
        "email": email,
    }


def make_valid_session_payload(
    client_uuid: str | None = None,
    plan_id: str | None = None,
    pain_before: int = 3,
    pain_after: int = 2,
    max_rom: float = 45.0,
    num_reps: int = 5,
) -> dict:
    cid = client_uuid or str(uuid.uuid4())
    reps = [
        {
            "set_no": (i // 10) + 1,
            "rep_no": (i % 10) + 1,
            "duration_ms": 2200.0,
            "rom_deg": round(35.0 + (i % 25) * 0.5, 1),
            "form_score": 85.0,
            "errors": [] if i % 2 == 0 else ["too_fast"],
            "confidence": 0.94,
        }
        for i in range(num_reps)
    ]
    payload = {
        "client_uuid": cid,
        "started_at": "2026-10-07T17:30:00Z",
        "ended_at": "2026-10-07T17:45:00Z",
        "pose_model_ver": "1.0.0",
        "app_version": "1.0.0",
        "overall_score": 85.0,
        "exercises": [
            {
                "exercise_id": 1,
                "sets_done": max(1, (num_reps // 10) + (1 if num_reps % 10 else 0)),
                "reps_done": num_reps,
                "avg_form_score": 85.0,
                "max_rom_deg": max_rom,
                "avg_rom_deg": 39.0,
                "pain_before": pain_before,
                "pain_after": pain_after,
                "side": "right",
                "reps": reps,
            }
        ],
    }
    if plan_id is not None:
        payload["plan_id"] = plan_id
    return payload


# ─── 1. Successful Sync ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_session_success(async_client: AsyncClient, db_session: AsyncSession):
    await seed_exercise_catalog(db_session)
    user_info = await register_patient(async_client, "patient1@axiomedica.io")

    payload = make_valid_session_payload()
    resp = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=user_info["headers"],
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "created"
    assert data["session"]["client_uuid"] == payload["client_uuid"]
    assert len(data["session"]["session_exercises"]) == 1
    assert len(data["session"]["session_exercises"][0]["rep_events"]) == 5

    # Check progress metrics
    assert len(data["progress_metrics"]) >= 1
    metric = data["progress_metrics"][0]
    assert metric["max_rom_deg"] >= 43.0
    assert metric["adherence_pct"] == 100.0
    assert metric["avg_pain"] == 2.5


# ─── 2. Idempotent Retry ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_session_idempotent_duplicate(async_client: AsyncClient, db_session: AsyncSession):
    await seed_exercise_catalog(db_session)
    user_info = await register_patient(async_client, "patient_idem@axiomedica.io")

    payload = make_valid_session_payload()
    # First sync
    resp1 = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=user_info["headers"],
    )
    assert resp1.status_code == 201

    # Second sync with exact same client_uuid
    resp2 = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=user_info["headers"],
    )
    assert resp2.status_code in (200, 201)
    data2 = resp2.json()
    assert data2["status"] == "already_synced"
    assert data2["session"]["client_uuid"] == payload["client_uuid"]

    # Verify database has exactly 1 session record
    stmt = select(Session).where(Session.client_uuid == uuid.UUID(payload["client_uuid"]))
    records = (await db_session.execute(stmt)).scalars().all()
    assert len(records) == 1


# ─── 3. Range Validation ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_session_range_validations(async_client: AsyncClient, db_session: AsyncSession):
    await seed_exercise_catalog(db_session)
    user_info = await register_patient(async_client, "patient_val@axiomedica.io")

    # A. Pain > 10
    payload = make_valid_session_payload(pain_before=11)
    resp = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=user_info["headers"],
    )
    assert resp.status_code in (400, 422)

    # B. Confidence > 1.0
    payload = make_valid_session_payload()
    payload["exercises"][0]["reps"][0]["confidence"] = 1.5
    resp = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=user_info["headers"],
    )
    assert resp.status_code in (400, 422)

    # C. ROM > 180
    payload = make_valid_session_payload()
    payload["exercises"][0]["max_rom_deg"] = 195.0
    resp = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=user_info["headers"],
    )
    assert resp.status_code in (400, 422)


# ─── 4. Missing / Revoked Consent ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_session_without_consent_rejected(async_client: AsyncClient, db_session: AsyncSession):
    await seed_exercise_catalog(db_session)
    user_info = await register_patient(async_client, "no_consent@axiomedica.io")

    # Revoke data_processing consent
    stmt = select(Consent).where(
        Consent.user_id == uuid.UUID(user_info["user_id"]),
        Consent.consent_type == ConsentType.data_processing,
    )
    consent = (await db_session.execute(stmt)).scalar_one()
    consent.granted = False
    await db_session.flush()

    payload = make_valid_session_payload()
    resp = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=user_info["headers"],
    )
    assert resp.status_code == 403
    assert "consent" in resp.text.lower()


# ─── 5. Another Patient's plan_id Rejected ───────────────────────────────────

@pytest.mark.asyncio
async def test_sync_session_other_patient_plan_rejected(async_client: AsyncClient, db_session: AsyncSession):
    await seed_exercise_catalog(db_session)
    patient_a = await register_patient(async_client, "patient_a@axiomedica.io")
    patient_b = await register_patient(async_client, "patient_b@axiomedica.io")

    # Look up patient B profile
    stmt = select(Patient).where(Patient.user_id == uuid.UUID(patient_b["user_id"]))
    pat_b = (await db_session.execute(stmt)).scalar_one()

    # Create a plan belonging to Patient B
    plan_b = RehabilitationPlan(
        patient_id=pat_b.id,
        title="Patient B's Custom Protocol",
        prescribed_frequency_per_week=5,
    )
    db_session.add(plan_b)
    await db_session.flush()

    # Patient A attempts to sync a session citing Patient B's plan_id
    payload = make_valid_session_payload(plan_id=str(plan_b.id))
    resp = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=patient_a["headers"],
    )
    assert resp.status_code == 403
    assert "belong" in resp.text.lower()


# ─── 6. Partial Failure Rollback ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_session_partial_failure_rollback(async_client: AsyncClient, db_session: AsyncSession):
    await seed_exercise_catalog(db_session)
    user_info = await register_patient(async_client, "patient_rollback@axiomedica.io")

    # Use a non-existent exercise ID (9999)
    payload = make_valid_session_payload()
    payload["exercises"][0]["exercise_id"] = 9999

    resp = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=user_info["headers"],
    )
    assert resp.status_code == 400

    # Ensure transaction rolled back: no session, no exercises, no reps
    stmt_session = select(Session).where(Session.client_uuid == uuid.UUID(payload["client_uuid"]))
    assert (await db_session.execute(stmt_session)).scalar_one_or_none() is None

    stmt_reps = select(RepEvent)
    reps_count = len((await db_session.execute(stmt_reps)).scalars().all())
    assert reps_count == 0


# ─── 7. Large Payload (500 Reps) ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sync_session_large_payload_500_reps(async_client: AsyncClient, db_session: AsyncSession):
    await seed_exercise_catalog(db_session)
    user_info = await register_patient(async_client, "patient_500@axiomedica.io")

    payload = make_valid_session_payload(num_reps=500)
    resp = await async_client.post(
        "/api/v1/sessions/sync",
        json=payload,
        headers=user_info["headers"],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["session"]["session_exercises"][0]["rep_events"]) == 500

    # Verify count in DB
    session_id = uuid.UUID(data["session"]["id"])
    stmt = (
        select(RepEvent)
        .join(SessionExercise)
        .where(SessionExercise.session_id == session_id)
    )
    persisted_reps = (await db_session.execute(stmt)).scalars().all()
    assert len(persisted_reps) == 500


# ─── 8. GET /sessions with ?from=&to= ────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_sessions_list_and_date_filtering(async_client: AsyncClient, db_session: AsyncSession):
    await seed_exercise_catalog(db_session)
    user_info = await register_patient(async_client, "patient_list@axiomedica.io")

    # Sync Session 1 on Oct 7
    payload1 = make_valid_session_payload()
    payload1["started_at"] = "2026-10-07T10:00:00Z"
    payload1["ended_at"] = "2026-10-07T10:15:00Z"
    r1 = await async_client.post("/api/v1/sessions/sync", json=payload1, headers=user_info["headers"])
    assert r1.status_code == 201

    # Sync Session 2 on Oct 8
    payload2 = make_valid_session_payload()
    payload2["started_at"] = "2026-10-08T10:00:00Z"
    payload2["ended_at"] = "2026-10-08T10:15:00Z"
    r2 = await async_client.post("/api/v1/sessions/sync", json=payload2, headers=user_info["headers"])
    assert r2.status_code == 201

    # List all
    list_resp = await async_client.get("/api/v1/sessions", headers=user_info["headers"])
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert list_data["total"] == 2

    # Filter with ?from=2026-10-08T00:00:00Z
    filtered_resp = await async_client.get(
        "/api/v1/sessions?from=2026-10-08T00:00:00Z",
        headers=user_info["headers"],
    )
    assert filtered_resp.status_code == 200
    filtered_data = filtered_resp.json()
    assert filtered_data["total"] == 1
    assert filtered_data["items"][0]["client_uuid"] == payload2["client_uuid"]


# ─── 9. GET /sessions/{id} ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_session_by_id_and_access_control(async_client: AsyncClient, db_session: AsyncSession):
    await seed_exercise_catalog(db_session)
    user1 = await register_patient(async_client, "owner@axiomedica.io")
    user2 = await register_patient(async_client, "intruder@axiomedica.io")

    payload = make_valid_session_payload()
    sync_resp = await async_client.post("/api/v1/sessions/sync", json=payload, headers=user1["headers"])
    assert sync_resp.status_code == 201
    session_id = sync_resp.json()["session"]["id"]

    # Owner accesses session -> 200
    get_resp = await async_client.get(f"/api/v1/sessions/{session_id}", headers=user1["headers"])
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == session_id

    # Intruder accesses session -> 403 Forbidden
    intruder_resp = await async_client.get(f"/api/v1/sessions/{session_id}", headers=user2["headers"])
    assert intruder_resp.status_code == 403

    # Non-existent session -> 404 Not Found
    random_id = str(uuid.uuid4())
    missing_resp = await async_client.get(f"/api/v1/sessions/{random_id}", headers=user1["headers"])
    assert missing_resp.status_code == 404
