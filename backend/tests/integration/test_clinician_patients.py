"""
tests/integration/test_clinician_patients.py
Tests for clinician patient management endpoints:
  - GET  /api/v1/clinician/patients
  - POST /api/v1/clinician/patients
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Consent, ConsentType, Patient, User, UserRole


from scripts.seed import seed_data
from app.core.rate_limit import reset_rate_limit


@pytest.mark.asyncio
async def test_clinician_list_and_create_patient(
    async_client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    reset_rate_limit()
    await seed_data(db_session)

    # Login patient
    res_p = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "sarah.johnson@email.com", "password": "PatientPass123!"},
    )
    assert res_p.status_code == 200
    patient_auth_headers = {"Authorization": f"Bearer {res_p.json()['access_token']}"}

    # Login clinician
    res_c = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "dr.torres@axiomedica.io", "password": "ClinicianPass123!"},
    )
    assert res_c.status_code == 200
    clinician_auth_headers = {"Authorization": f"Bearer {res_c.json()['access_token']}"}

    # Login admin
    res_a = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@axiomedica.io", "password": "AdminPass123!"},
    )
    assert res_a.status_code == 200
    admin_auth_headers = {"Authorization": f"Bearer {res_a.json()['access_token']}"}

    # 1. Non-clinician patient should be forbidden
    res_forbidden = await async_client.get("/api/v1/clinician/patients", headers=patient_auth_headers)
    assert res_forbidden.status_code == 403

    # 2. Clinician & Admin can list patients
    res_list_init = await async_client.get("/api/v1/clinician/patients", headers=clinician_auth_headers)
    assert res_list_init.status_code == 200
    init_data = res_list_init.json()
    assert "total" in init_data
    assert "patients" in init_data
    initial_count = init_data["total"]

    # Admin can also list patients
    res_admin_list = await async_client.get("/api/v1/clinician/patients", headers=admin_auth_headers)
    assert res_admin_list.status_code == 200

    # 3. Clinician onboard a new patient
    new_patient_email = "new.onboarded.patient@example.com"
    new_patient_pass = "SecurePatient123!"
    payload = {
        "email": new_patient_email,
        "password": new_patient_pass,
        "full_name": "Alex Mercer",
        "phone": "+1 555-432-1098",
        "injured_ankle": "Right",
        "injury_type": "Achilles Tendonitis",
        "total_weeks": 8,
        "recovery_stage": 1,
    }
    res_create = await async_client.post(
        "/api/v1/clinician/patients",
        json=payload,
        headers=clinician_auth_headers,
    )
    assert res_create.status_code == 201
    create_data = res_create.json()
    assert "patient" in create_data
    created_item = create_data["patient"]
    assert created_item["email"] == new_patient_email
    assert created_item["full_name"] == "Alex Mercer"
    assert created_item["injured_ankle"] == "Right"
    assert created_item["injury_type"] == "Achilles Tendonitis"

    # 4. Verify patient list incremented
    res_list_after = await async_client.get("/api/v1/clinician/patients", headers=clinician_auth_headers)
    assert res_list_after.status_code == 200
    after_data = res_list_after.json()
    assert after_data["total"] == initial_count + 1

    # 5. Verify the new patient can immediately log in with their credentials!
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": new_patient_email, "password": new_patient_pass},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    patient_new_headers = {"Authorization": f"Bearer {login_data['access_token']}"}

    # Verify the patient can access their own profile and see the data
    me_res = await async_client.get("/api/v1/patients/me", headers=patient_new_headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["patient"]["user"]["email"] == new_patient_email
    assert me_data["patient"]["phone"] == "+1 555-432-1098"

    # 6. Verify duplicate email is rejected with 409 Conflict
    res_dup = await async_client.post(
        "/api/v1/clinician/patients",
        json=payload,
        headers=clinician_auth_headers,
    )
    assert res_dup.status_code == 409
