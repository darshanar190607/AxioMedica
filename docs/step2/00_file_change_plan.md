# 00. Step 2 File Change Plan & Architectural Boundaries

**Date:** 2026-11-07  
**Branch:** `step2/pose-engine`  
**Baseline Tag:** `baseline-before-step2`  
**Phase:** Gate 1 (Preparation & Change Plan)

---

## 1. Architectural Invariants & Layering Design

Per the Step 2 specification, strict layering is enforced. Dependencies flow inward; no native code leaks into pure JS business logic:

```text
[ Hardware / Native Camera Stream ]
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Provider Layer (mobile/src/engines/providers/*)           │
│    - ONLY layer importing native VisionCamera / fast-tflite │
│    - Frame acquisition, resize/crop, native C++ inference   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Raw output tensors + metadata
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Adapter Layer (mobile/src/engines/adapters/*)            │
│    - Pure JS, 100% Jest testable, no native imports         │
│    - Tensor decode, normalization [0, 1], sigmoid logits    │
│    - Letterbox/rotation undo, 33 index -> semantic name map │
└──────────────────────────────┬──────────────────────────────┘
                               │ Canonical landmark frame
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Engine Layer (mobile/src/engines/poseEngine.js)          │
│    - Pure JS singleton                                      │
│    - Frame validation (validateLandmarks.js)                │
│    - One-Euro low-pass landmark smoothing (smoothing.js)    │
│    - Tracking state management ("tracking" | "lost")        │
│    - Subscriber broadcast                                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Canonical landmark stream
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Downstream Consuming Pipeline (UNTOUCHED / PRESERVED)    │
│    - usePose.js                                             │
│    - MetricEngine.js, RepCounter.js, FormChecker.js         │
│    - LiveMonitorScreen.js (Protected in Step 2)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Landmark Contract

Output format emitted by `poseEngine.js` strictly matches the verified Step 1 schema (`docs/step1/04_landmark_schema.md`):

```javascript
{
  timestamp: number,            // integer ms (inference acquisition timestamp)
  source: "camera",             // "camera" | "synthetic" | "fixture"
  status: "tracking" | "lost",  // "tracking" when pose detected, "lost" when no person
  landmarks: {                  // Named dictionary matching schema 04
    left_hip:        { x: 0.50, y: 0.28, z: 0.00, visibility: 0.92 },
    left_knee:       { x: 0.49, y: 0.52, z: 0.02, visibility: 0.94 },
    left_ankle:      { x: 0.48, y: 0.82, z: 0.01, visibility: 0.96 },
    left_heel:       { x: 0.45, y: 0.82, z: 0.04, visibility: 0.95 },
    left_foot_index: { x: 0.56, y: 0.84, z: -0.06, visibility: 0.93 },
    right_hip:       { x: 0.52, y: 0.28, z: 0.00, visibility: 0.90 },
    right_knee:      { x: 0.51, y: 0.52, z: 0.02, visibility: 0.91 },
    right_ankle:     { x: 0.50, y: 0.82, z: 0.01, visibility: 0.92 },
    right_heel:      { x: 0.47, y: 0.82, z: 0.04, visibility: 0.91 },
    right_foot_index:{ x: 0.58, y: 0.84, z: -0.06, visibility: 0.90 }
    // ... all 33 BlazePose landmarks (indices 0 to 32)
  }
}
```

---

## 3. Smoothing Approach Decision

* **Decision:** **REUSE `mobile/src/pose/smoothing.js`**.
* **Rationale:**
  - `smoothing.js` already provides a mathematically sound, 1D/2D One Euro Filter implementation (`LowPassFilter`, `OneEuroFilter`, and `KeypointSmoother`) based on Casiez et al. (ACM CHI 2012).
  - It supports dynamic speed-adaptive cutoff frequencies (`minCutoff = 1.0`, `beta = 0.007`, `dCutoff = 1.0`).
  - It is already tested and validated by passing tests in `mobile/__tests__/poseEngine.test.js`.
  - Creating a redundant duplicate would violate Invariant 1 and Invariant 5.
* **Engine Integration:**
  - `poseEngine.js` will wrap `KeypointSmoother` from `mobile/src/pose/smoothing.js`.
  - When a landmark has low visibility (`visibility < minVisibility`), smoothing for that joint is bypassed and its filter state is reset, while preserving the raw visibility score in the emitted frame.
  - When status transitions to `"lost"`, all smoother filter states are reset.

---

## 4. Complete File Inventory for Step 2

### A. NEW Files to Create

| Path | Layer / Purpose | Gate |
| :--- | :--- | :---: |
| `docs/step2/00_file_change_plan.md` | Architecture plan and file registry (this document) | Gate 1 |
| `docs/step2/01_dependency_compat.md` | Dependency compatibility matrix and verified peer requirements | Gate 2 |
| `docs/step2/02_model_manifest.md` | Model origins, licenses, and SHA-256 cryptographic hashes | Gate 2 |
| `docs/step2/03_tensor_inspection.md` | Verified input/output tensor shapes, dtypes, and quantization | Gate 2 |
| `mobile/assets/models/pose_landmark_lite.tflite` | Standalone BlazePose Lite TFLite model | Gate 2 |
| `mobile/assets/models/pose_landmark_full.tflite` | Standalone BlazePose Full TFLite model | Gate 2 |
| `mobile/src/contract/validateLandmarks.js` | Pure JS landmark frame contract validator | Gate 3 |
| `mobile/src/engines/landmarkMap.js` | 33-point MediaPipe BlazePose index $\leftrightarrow$ canonical semantic key map | Gate 3 |
| `mobile/src/engines/adapters/blazePoseAdapter.js` | Pure JS adapter: raw tensors $\rightarrow$ canonical normalized landmarks | Gate 3 |
| `mobile/src/engines/poseEngine.js` | Pure JS engine singleton: validation, smoothing, tracking state | Gate 3 |
| `mobile/__tests__/blazePoseAdapter.test.js` | Jest unit test suite for tensor decoding, normalization, and error handling | Gate 3 / 5 |
| `mobile/src/engines/providers/blazePoseTfliteProvider.js` | Native provider: VisionCamera frame processor + fast-tflite execution | Gate 4 |
| `mobile/src/screens/dev/PoseTestScreen.js` | Standalone dev harness screen for on-device testing (isolated from prod) | Gate 4 |
| `docs/step2/04_manual_checks.md` | On-device physical manual verification checklist | Gate 4 |
| `docs/step2/05_benchmark.md` | Physical device benchmark report (FPS, latency, jitter, dropouts) | Gate 5 |

### B. MODIFIED Existing Files

| Path | Reason for Modification | Gate |
| :--- | :--- | :---: |
| `mobile/src/pose/poseEngine.js` | Re-export the new engine interface from `mobile/src/engines/poseEngine.js` to ensure 100% backward compatibility with existing imports. | Gate 3 |
| `mobile/app.json` | 1. Remove invalid top-level `"splash"` to resolve `expo-doctor` prebuild blocker.<br/>2. Add `react-native-vision-camera` config plugin with required camera permission text. | Gate 2 |
| `mobile/metro.config.js` | Add `'tflite'` to `resolver.assetExts` so Metro bundles `.tflite` binaries. | Gate 2 |
| `mobile/babel.config.js` | Configure worklets Babel plugin if verified as required during Gate 2 dependency probe. | Gate 2 |
| `mobile/package.json` | Add pinned native dependencies (`react-native-vision-camera`, `react-native-fast-tflite`, `vision-camera-resize-plugin`, etc.). | Gate 2 |

### C. PRESERVED Files (Strictly Untouched)

The following files are **FROZEN** throughout Step 2. Zero modifications permitted:

1. **Downstream Kinematic Modules:**
   - `mobile/src/pose/geometry.js`
   - `mobile/src/pose/smoothing.js`
   - `mobile/src/pose/metricEngine.js`
   - `mobile/src/pose/repCounter.js`
   - `mobile/src/pose/formChecker.js`
   - `mobile/src/pose/calibration.js`
   - `mobile/src/pose/poseConfig.js`
   - `mobile/src/pose/sessionBuilder.js`
   - `mobile/src/pose/fixtures.js`
   - `mobile/src/hooks/usePose.js`
   - `mobile/src/hooks/useSession.js`
2. **Production Screens:**
   - `mobile/src/screens/LiveMonitorScreen.js` (Protected in Step 2; dev harness `PoseTestScreen.js` is used instead)
   - `mobile/src/screens/LandingScreen.js`
   - `mobile/src/screens/LoginScreen.js`
   - `mobile/src/screens/DashboardScreen.js`
   - `mobile/src/screens/MyPlanScreen.js`
   - `mobile/src/screens/ExerciseDetailScreen.js`
   - `mobile/src/screens/ClinicianScreen.js`
   - `mobile/src/screens/ProfileScreen.js`
   - `mobile/src/screens/SessionResultsScreen.js`
3. **Core Contracts:**
   - `docs/contracts/pose_config.schema.json`
   - `docs/contracts/session_payload.schema.json`

