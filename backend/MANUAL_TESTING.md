# AxioMedica Manual Testing Guide (cURL & Postman)

This guide provides automated and manual verification commands for the AxioMedica API:
- **Postman Collection**: [AxioMedica_API.postman_collection.json](AxioMedica_API.postman_collection.json)
- **Base URL**: `http://localhost:8000/api/v1`

---

## 1. Database Seeding (Idempotent)

Populates the 6 ankle rehabilitation exercises with validated `pose_config`, demo clinician (Dr. Michael Torres), demo patient (Sarah Johnson), and an active rehabilitation plan:

```bash
# From the backend directory
python scripts/seed.py
```

---

## 2. Authentication & Patient Setup

### 2.1 Login Demo Patient (Sarah Johnson)
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.johnson@email.com",
    "password": "PatientPass123!"
  }'
```
*Export token:*
```bash
export PATIENT_TOKEN="<access_token>"
```

### 2.2 Login Clinician (Dr. Michael Torres)
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dr.torres@axiomedica.io",
    "password": "ClinicianPass123!"
  }'
```
*Export token:*
```bash
export CLINICIAN_TOKEN="<access_token>"
```

### 2.3 Login Admin (System Administrator)
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@axiomedica.io",
    "password": "AdminPass123!"
  }'
```
*Export token:*
```bash
export ADMIN_TOKEN="<access_token>"
```

### 2.4 Clinician / Admin View All Patients & Patient Count
```bash
curl -X GET "http://localhost:8000/api/v1/clinician/patients" \
  -H "Authorization: Bearer $CLINICIAN_TOKEN"
```
Response:
```json
{
  "total": 1,
  "patients": [
    {
      "id": "...",
      "user_id": "...",
      "full_name": "Sarah Johnson",
      "email": "sarah.johnson@email.com",
      "injured_ankle": "right",
      "recovery_stage": 2
    }
  ]
}
```

### 2.5 Clinician / Admin Add New Patient with Login Credentials
```bash
curl -X POST "http://localhost:8000/api/v1/clinician/patients" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLINICIAN_TOKEN" \
  -d '{
    "email": "new.patient@example.com",
    "password": "PatientPassword123!",
    "full_name": "John Doe",
    "phone": "+1 555-123-4567",
    "injured_ankle": "Right",
    "injury_type": "Grade 2 Inversion Sprain",
    "total_weeks": 6,
    "recovery_stage": 1
  }'
```
*The newly created patient can now immediately log in with `new.patient@example.com` and `PatientPassword123!` to view their plan and sync sessions.*

---

## 3. Exercises & Active Plan

### 3.1 List All Exercises in Catalog
```bash
curl -X GET "http://localhost:8000/api/v1/exercises"
```

### 3.2 Get Single Exercise Details & Pose Config
```bash
curl -X GET "http://localhost:8000/api/v1/exercises/1"
```

### 3.3 Get Patient's Active Plan (`GET /plans/active`)
```bash
curl -X GET "http://localhost:8000/api/v1/plans/active" \
  -H "Authorization: Bearer $PATIENT_TOKEN"
```

### 3.4 Clinician Create Plan (`POST /clinician/plans`)
```bash
curl -X POST "http://localhost:8000/api/v1/clinician/plans" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLINICIAN_TOKEN" \
  -d '{
    "patient_id": "<PATIENT_UUID>",
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
        "order_index": 0
      }
    ]
  }'
```

### 3.5 Clinician Approve Plan (`PUT /clinician/plans/{id}/approve`)
```bash
curl -X PUT "http://localhost:8000/api/v1/clinician/plans/<PLAN_UUID>/approve" \
  -H "Authorization: Bearer $CLINICIAN_TOKEN"
```

---

## 4. Rehabilitation Session Synchronization (`POST /sessions/sync`)

### 4.1 Sync a Completed Rehabilitation Session
```bash
curl -X POST "http://localhost:8000/api/v1/sessions/sync" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -d '{
    "client_uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "started_at": "2026-10-07T17:30:00Z",
    "ended_at": "2026-10-07T17:43:20Z",
    "pose_model_ver": "1.0.0",
    "app_version": "1.0.0",
    "overall_score": 79.6,
    "exercises": [
      {
        "exercise_id": 1,
        "sets_done": 2,
        "reps_done": 10,
        "avg_form_score": 79.6,
        "max_rom_deg": 44.2,
        "avg_rom_deg": 38.5,
        "pain_before": 3,
        "pain_after": 2,
        "side": "right",
        "reps": [
          { "set_no": 1, "rep_no": 1, "duration_ms": 1280, "rom_deg": 32.1, "form_score": 61.0, "errors": ["too_fast"], "confidence": 0.91 }
        ]
      }
    ]
  }'
```

### 4.2 Idempotent Retry Test
Re-send the request with the identical `client_uuid` to verify it returns `already_synced` without duplicate DB rows.

---

## 5. Recovery Progress & Pain Logging

### 5.1 Recovery Progress Summary (`GET /progress/summary`)
Returns baseline vs current ROM, streak, weekly adherence, pain trend, and direct dashboard shapes:
```bash
curl -X GET "http://localhost:8000/api/v1/progress/summary" \
  -H "Authorization: Bearer $PATIENT_TOKEN"
```

### 5.2 Time-Series Metrics (`GET /progress/metrics?metric=rom`)
```bash
curl -X GET "http://localhost:8000/api/v1/progress/metrics?metric=rom&from=2026-10-01&to=2026-10-31" \
  -H "Authorization: Bearer $PATIENT_TOKEN"
```

### 5.3 Record Pain Log (`POST /pain-logs`)
```bash
curl -X POST "http://localhost:8000/api/v1/pain-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PATIENT_TOKEN" \
  -d '{
    "pain_level": 3,
    "body_part": "left_ankle",
    "notes": "Mild soreness after completing exercises"
  }'
```

### 5.4 List Pain Logs (`GET /pain-logs`)
```bash
curl -X GET "http://localhost:8000/api/v1/pain-logs" \
  -H "Authorization: Bearer $PATIENT_TOKEN"
```
