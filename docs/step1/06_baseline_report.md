# 06. System Baseline Test & Execution Report

**Date:** 2026-11-07  
**Project:** AxioMedica / RehabStep AI  
**Scope:** Automated test execution and operational baseline measurement across mobile and backend.

---

## 1. Executive Baseline Summary Table

| System Check | Result | Evidence & Test Outputs |
| :--- | :---: | :--- |
| **Mobile App Starts** | ✅ **PASS** | Validated via Expo CLI v57.0.28, `app.json` configuration, Metro asset loader, and full Jest test runner. |
| **Backend Starts** | ✅ **PASS** | FastAPI instantiates cleanly, all 12 routers mounted, OpenAPI schema exported without warnings to [`docs/step1/openapi.json`](file:///c:/c_backup/projects/AxioMedica/docs/step1/openapi.json). |
| **Database Connects** | ⚠️ **PARTIAL** | In-memory SQLite (`aiosqlite`) connects and passes 100% of integration test fixtures. Local PostgreSQL container (port 5432) was offline in initial audit (standard development state before container launch). |
| **RepCounter on Fixtures**| ✅ **PASS** | 100% pass on synthetic and recorded kinematics in [`mobile/__tests__/poseEngine.test.js`](file:///c:/c_backup/projects/AxioMedica/mobile/__tests__/poseEngine.test.js). Hysteresis state transitions, phase durations, and cue triggers operate correctly. |
| **Endpoints with Errors**| ⚠️ **NOTED** | `/api/v1/ml/inference` intentionally returns `501 Not Implemented` (placeholder for Step 5). `/api/v1/tts` has a client-side URL prefix mismatch in `tts.js`. |

---

## 2. Test Execution Evidence

### Mobile Test Suite (`Jest`)
* **Execution Command:** `cd mobile && npx jest --ci`
* **Artifact:** [`docs/step1/jest_baseline.txt`](file:///c:/c_backup/projects/AxioMedica/docs/step1/jest_baseline.txt)
* **Summary:**
  ```text
  PASS __tests__/poseEngine.test.js (16.92 s)
  PASS __tests__/offlineSync.test.js (17.157 s)

  Test Suites: 2 passed, 2 total
  Tests:       29 passed, 29 total
  Snapshots:   0 total
  Time:        19.643 s
  Ran all test suites.
  ```
* **Coverage Scope:**
  - `poseEngine.test.js`: Geometry math, landmark smoothing (1 Euro filter), phase evaluation, `RepCounter` state machine, form scoring deductions, calibration baseline calculation.
  - `offlineSync.test.js`: SQLite offline session persistence, retry queues, idempotency key generation (`client_uuid`).

---

### Backend Test Suite (`Pytest`)
* **Execution Command:** `cd backend && python -m pytest -q`
* **Artifact:** [`docs/step1/pytest_baseline.txt`](file:///c:/c_backup/projects/AxioMedica/docs/step1/pytest_baseline.txt)
* **Summary:**
  ```text
  ..................................                                       [100%]
  34 passed, 46 warnings in 8.73s
  ```
* **Coverage Scope:**
  - `tests/unit/test_config.py`: Environment configuration loading and CORS parsing (3 tests passed).
  - `tests/unit/test_health.py`: Database connectivity health check mocks and 503 error handling (3 tests passed).
  - `tests/unit/test_ml_serving.py`: ML status and 501 inference placeholder (2 tests passed).
  - `tests/integration/test_auth.py`: Patient/Clinician registration, login, token refresh, duplicate prevention (8 tests passed).
  - `tests/integration/test_clinician_patients.py`: Patient roster listing and assignment (3 tests passed).
  - `tests/integration/test_plans_exercises_progress.py`: Plan creation, exercise catalog retrieval, progress calculation (7 tests passed).
  - `tests/integration/test_sessions.py`: Session upload, idempotency, per-rep telemetry insertion (8 tests passed).

---

## 3. Discovered Anomalies & Known Non-Blockers

1. **`asyncpg` / `argon2` Installation Blocker:**
   - *Finding:* Initial backend test runs failed due to missing `asyncpg` and `argon2-cffi` in the local Python environment.
   - *Resolution:* Installed `asyncpg` and dependencies from `requirements.txt`. All 34 tests now pass cleanly.
2. **Deprecation Warnings in JWT Utilities:**
   - *Finding:* `python-jose` issues deprecation warnings regarding `datetime.utcnow()`.
   - *Impact:* Non-blocking; will be addressed when updating auth utilities in future hardening.
3. **Database Pre-Ping in Test Fixtures:**
   - *Finding:* SQLite in-memory test engine required isolated transaction management via `aiosqlite` context. Handled gracefully by `tests/conftest.py`.

