# 07. Step 1 Gate Review & Readiness Verification

**Date:** 2026-11-07  
**Project:** AxioMedica / RehabStep AI  
**Gate Status:** **PASSED — READY FOR STEP 2**

---

## 1. Step 1 Verification Checklist

- [x] **Real directory tree mapped; all 38 files accounted for**
  - All source modules across `mobile/src/`, `backend/app/`, and `docs/contracts/` verified and categorized.
- [x] **Versions recorded; camera decision documented**
  - Documented in [`docs/step1/02_dependency_matrix.md`](file:///c:/c_backup/projects/AxioMedica/docs/step1/02_dependency_matrix.md). Option A (VisionCamera + On-Device ML) committed per ADR-001.
- [x] **Landmark contract finalized (map vs array resolved) and validator passing**
  - Documented in [`docs/step1/04_landmark_schema.md`](file:///c:/c_backup/projects/AxioMedica/docs/step1/04_landmark_schema.md). Confirmed **named dictionary/map** contract matching existing mobile production code. [`contracts/validateLandmarks.js`](file:///c:/c_backup/projects/AxioMedica/contracts/validateLandmarks.js) passes on synthetic output and regression fixtures.
- [x] **Input assumptions documented for all four processing modules**
  - Documented in [`docs/step1/03_dataflow.md`](file:///c:/c_backup/projects/AxioMedica/docs/step1/03_dataflow.md) for `MetricEngine`, `RepCounter`, `FormChecker`, and `CalibrationTracker`.
- [x] **OpenAPI spec saved; endpoint actions assigned**
  - Exported to [`docs/step1/openapi.json`](file:///c:/c_backup/projects/AxioMedica/docs/step1/openapi.json). Detailed roadmap documented in [`docs/step1/05_api_spec.md`](file:///c:/c_backup/projects/AxioMedica/docs/step1/05_api_spec.md).
- [x] **Jest and pytest actually executed, with output saved**
  - Mobile Jest: **29/29 passed** ([`docs/step1/jest_baseline.txt`](file:///c:/c_backup/projects/AxioMedica/docs/step1/jest_baseline.txt)).
  - Backend Pytest: **34/34 passed** ([`docs/step1/pytest_baseline.txt`](file:///c:/c_backup/projects/AxioMedica/docs/step1/pytest_baseline.txt)).
  - Baseline report compiled in [`docs/step1/06_baseline_report.md`](file:///c:/c_backup/projects/AxioMedica/docs/step1/06_baseline_report.md).
- [x] **Preserve / Modify / Create checklist finalized**
  - Clear architectural boundary established to protect finished UI and downstream kinematics.

---

## 2. Real Repository Source Tree (38 Core Production Files)

```text
AxioMedica/
├── mobile/src/
│   ├── screens/ (9 finished UI screens - DO NOT REDESIGN)
│   │   ├── LandingScreen.js
│   │   ├── LoginScreen.js
│   │   ├── DashboardScreen.js
│   │   ├── MyPlanScreen.js
│   │   ├── ExerciseDetailScreen.js
│   │   ├── LiveMonitorScreen.js
│   │   ├── ClinicianScreen.js
│   │   ├── ProfileScreen.js
│   │   └── SessionResultsScreen.js
│   ├── components/
│   │   ├── SkeletonOverlay.js
│   │   ├── ExerciseCard.js
│   │   ├── BottomNav.js
│   │   └── ReadAloudButton.js
│   ├── pose/ (kinematic pipeline)
│   │   ├── angleCalculator.js
│   │   ├── geometry.js
│   │   ├── smoothing.js
│   │   ├── metricEngine.js
│   │   ├── repCounter.js
│   │   ├── formChecker.js
│   │   ├── calibration.js
│   │   ├── poseConfig.js
│   │   ├── poseEngine.js (stub -> Step 2 implementation)
│   │   └── fixtures.js
│   ├── hooks/
│   │   ├── usePose.js
│   │   └── useSession.js
│   └── lib/
│       └── tts.js
├── backend/app/
│   ├── main.py
│   ├── models/
│   │   ├── user.py
│   │   └── session.py
│   ├── api/v1/endpoints/
│   │   ├── auth.py
│   │   ├── patients.py
│   │   ├── plans.py
│   │   ├── exercises.py
│   │   ├── sessions.py
│   │   ├── progress.py
│   │   ├── pain_logs.py
│   │   ├── clinician.py
│   │   ├── health.py
│   │   └── tts.py
│   └── ml_serving/
│       └── router.py
└── docs/contracts/
    ├── pose_config.schema.json
    ├── session_payload.schema.json
    └── openapi.yaml
```

---

## 3. Step 2 Architectural Action Plan: Preserve / Modify / Create

### PRESERVE (Untouchable Invariants)
1. **Screen Layouts & Visual Designs:** All 9 mobile screens in `mobile/src/screens/` must remain unchanged in styling and hierarchy.
2. **Kinematic Algorithms:** Do not modify `geometry.js`, `smoothing.js` (1 Euro Filter), `repCounter.js`, or `formChecker.js`. They are mathematically validated by 29 unit tests.
3. **Data Contract:** Do not alter the named landmark dictionary format (`{ left_ankle: { x, y, z, visibility } }`).
4. **Offline Privacy Rule (ADR-001):** Never transmit raw video frames to the server.

### MODIFY
1. **`mobile/src/pose/poseEngine.js`:** Implement real VisionCamera frame processor + TFLite BlazePose execution (replaces empty stub).
2. **`mobile/src/screens/LiveMonitorScreen.js`:**
   - Detach the simulated `setInterval` kinematic loop (lines 338-363).
   - Wire live landmark stream from `poseEngine` into `processPoseFrame(landmarks, timestamp)`.
3. **`mobile/src/lib/tts.js`:** Update request URL from `${TTS_BASE_URL}/api/tts` to `/api/v1/tts`.
4. **`mobile/app.json`:** Align splash screen configuration to the Expo SDK 57 `expo-splash-screen` standard.

### CREATE
1. **`mobile/src/pose/adapters/blazeposeAdapter.js`:** Native BlazePose output converter that converts raw 33-point tensors into the canonical named map with aspect-ratio scaling and front-camera mirror correction.
2. **`contracts/validateLandmarks.js`:** Frame contract validator (completed and verified).
3. **`tests/fixtures/landmarks_*.json`:** Regression fixtures (neutral, down, up completed).
4. **Step 2 Dev Build Configuration:** Native development build artifacts via `npx expo prebuild`.

