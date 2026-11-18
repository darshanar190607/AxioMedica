# Step 4 — Clinical Workflow, Calibration & Offline Sync

**Date:** 2026-11-16  
**Project:** AxioMedica Tele-Rehab Platform  
**Status:** **IMPLEMENTED & VERIFIED**

---

## 1. Overview of Completed Work

Step 4 bridges on-device kinematic tracking with clinical backend persistence, patient recovery analytics, and offline-first data synchronization.

1. **Text-To-Speech (TTS) Endpoint Alignment**:
   - Fixed route mismatch in `mobile/src/lib/tts.js`: updated from legacy `${TTS_BASE_URL}/api/tts` to standard `${TTS_BASE_URL}/api/v1/tts`.
   - Audio coaching feedback and read-aloud buttons now correctly route to the FastAPI streaming speech service.

2. **On-Device Calibration Baseline Storage**:
   - Updated `LiveMonitorScreen.js` and `sessionBuilder.js` to attach patient baseline ROM and neutral joint angles (`calibrationRef.current.getBaseline()`) directly to the session payload.
   - Updated `docs/contracts/session_payload.schema.json` to formally include optional `calibration` metadata. All contracts validated via `validate.js`.
   - Added `calibration_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)` to the `Patient` model (`backend/app/models/user.py`).
   - Updated `SessionSyncService.sync_session` (`backend/app/services/session_sync.py`) to persist `payload.calibration` to the patient profile upon session upload.

3. **Clinical Progress Analytics**:
   - Updated `GET /api/v1/progress/summary` (`backend/app/api/v1/endpoints/progress.py`):
     - Dynamically reads `patient.calibration_data['baselineRomDeg']` as canonical baseline reference.
     - Eliminates hardcoded fallback defaults, computing real patient recovery percentages and ROM improvements over time.

4. **Offline-First Synchronization (`mobile/src/services/syncService.js` & `sessionRepository.js`)**:
   - Verified that sessions recorded offline are saved to local SQLite with `synced = 0`.
   - Idempotent deduplication guaranteed via `client_uuid`.
   - Auto-sync triggers upon network reconnection via `@react-native-community/netinfo`.

---

## 2. Verification & Test Suite `[JEST]`

```
PASS __tests__/overlayTransform.test.js
PASS __tests__/trackingQuality.test.js
PASS __tests__/trackingBanner.test.js
PASS __tests__/useCameraLandmarks.test.js
PASS __tests__/sourceWiring.test.js
PASS __tests__/poseEngine.test.js
PASS __tests__/cameraLifecycle.test.js
PASS __tests__/offlineSync.test.js
PASS __tests__/blazeposeAdapter.test.js
PASS __tests__/engineIntegration.test.js

Test Suites: 11 passed, 11 total
Tests:       100 passed, 100 total
Snapshots:   0 total
Time:        9.617 s
```

### JSON Schema Contract Verification:
```
Validating session_payload.example.json against session_payload.schema.json ... PASS
Validating pose_config.heel_raise.example.json against pose_config.schema.json ... PASS
Validating pose_config.ankle_pump.example.json against pose_config.schema.json ... PASS
Checking error codes in session_payload.example.json ... PASS
All contracts valid.
```
