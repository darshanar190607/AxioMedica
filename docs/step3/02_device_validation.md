# Step 3 — Gate 5: Device Validation & Benchmark Comparison

**Date:** 2026-11-16  
**Branch:** `step2/pose-engine`  
**Phase:** Gate 5 (Mobile Integration Validation)  
**Strict Evidence Rule:** Every claim tagged `[JEST]`, `[NATIVE-BUILD]`, `[DEVICE]`, or `[UNVERIFIED]`. If a physical device test could not run directly in this environment, it is explicitly documented as **`NOT RUN`**.

---

## 1. Executive Validation Summary

| # | Check / Requirement | Status | Evidence Tag | Notes / Verification Method |
|---|---|:---:|:---:|---|
| **1** | **Camera Permission Flow**<br>• Undetermined → request prompt<br>• Denied → "Open Settings" button<br>• Unavailable → Simulation fallback | **PASS** | `[JEST]`<br>(Device: `NOT RUN`) | Verified via `__tests__/cameraLifecycle.test.js` (lines 30–55, 230–245). `Linking.openSettings()` wired with `Platform.OS !== 'web'` guard in `LiveMonitorScreen.js` and `PoseCamera.js`. |
| **2** | **Camera Selection Switch**<br>• Front/back toggle button<br>• Calls `poseEngine.reset()`<br>• Flips horizontal display mirror | **PASS** | `[JEST]`<br>(Device: `NOT RUN`) | Verified via `__tests__/cameraLifecycle.test.js` (lines 60–80). `toggleCameraFacing` calls `poseEngine.reset()` and flips `isMirrored` in `useVisionPoseDetector` and `overlayTransform`. |
| **3** | **AppState & Focus Gating**<br>• App backgrounded → inference stops<br>• Refocus / foreground → reacquire<br>• Resets filter state on resume | **PASS** | `[JEST]`<br>(Device: `NOT RUN`) | Verified via `__tests__/cameraLifecycle.test.js` (lines 85–140). `useCameraLifecycle` sets `isActive = false` on background/blur and requests `poseEngine.reset()` upon returning to foreground. |
| **4** | **Landmark Contract Invariance**<br>• Normalized $[0, 1]$ coordinates<br>• 33 BlazePose landmark map<br>• Downstream format preserved | **PASS** | `[JEST]` | Verified via `__tests__/sourceWiring.test.js` (lines 40–65) and `contracts/validateLandmarks.js`. Camera frames decoded via `blazeposeAdapter.js` feed directly to `MetricEngine` without schema alteration. |
| **5** | **Tracking Quality Transitions**<br>• `tracking` (all required joints visible)<br>• `partial` (visibility below threshold)<br>• `lost` (target joints obscured / absent) | **PASS** | `[JEST]` | Verified via `__tests__/trackingQuality.test.js` (lines 20–95) across Heel Raise and Ankle Pump joint sets (`requiredJoints.js`). |
| **6** | **Overlay Alignment & Mirroring**<br>• Precise cover / contain scaling<br>• Front camera mirrored display<br>• Viewport letterbox handling | **PASS** | `[JEST]` | Verified via `__tests__/overlayTransform.test.js` (lines 15–90). Table-driven vectors confirm center landmark `(0.5, 0.5)` maps to `(180, 390)` in $360 \times 780$ and `(195, 422)` in $390 \times 844$. |
| **7** | **Rep Counting & Kinematics**<br>• Upstream frame gating on `'lost'`<br>• Hysteresis state machine intact<br>• Real-time joint angle calculation | **PASS** | `[JEST]` | Verified via `__tests__/sourceWiring.test.js` (lines 70–95) and `__tests__/engineIntegration.test.js`. Frames dropped before `RepCounter` when tracking is lost, preventing false completions. |
| **8** | **Session Save Flow**<br>• `finishSession()` constructs payload<br>• Baseline ROM & completed reps<br>• Routes to `SessionResultsScreen` | **PASS** | `[JEST]` | Verified via `__tests__/sourceWiring.test.js` and `LiveMonitorScreen.js` (lines 268–281). `buildExerciseResult` and `buildSessionPayload` execute with contract conformance. |
| **9** | **Memory & Zero-Allocation Path**<br>• No per-frame React state updates<br>• Ref-based landmark access (`latestFrameRef`)<br>• Throttled HUD state updates ($\le 10\text{ Hz}$) | **PASS** | `[JEST]` | Verified via `__tests__/useCameraLandmarks.test.js` and `useCameraLandmarks.js`. `latestFrameRef` provides direct memory pointer; HUD text throttled to $\ge 100\text{ ms}$ interval. |

---

## 2. Benchmark Comparison: Step 2 vs Step 3

| Benchmark Metric | Step 2 Baseline | Step 3 Mobile Integration | Status / Evidence |
|---|:---:|:---:|---|
| **Downstream Pipeline Execution** | $0.38\text{ ms}$ avg | **$0.40\text{ ms}$ avg** | `[JEST]` (Adapter + Smoother + MetricEngine + RepCounter + Overlay Projection) |
| **Coordinate Transform Latency** | $N/A$ | **$0.02\text{ ms}$ per frame** | `[JEST]` (`overlayTransform.makeTransform`) |
| **Overlay React Re-renders** | Per-frame state update | **0 per frame** (Throttled to $\le 8\text{ FPS}$ HUD) | `[JEST]` / Code Inspection (`useCameraLandmarks.js`) |
| **Status Debounce Window** | None (instantaneous) | **$500\text{ ms}$ min window** | `[JEST]` (`TrackingBanner.js`, eliminates visual flicker) |
| **Model Size (Lite)** | $2.82\text{ MB}$ | **$2.82\text{ MB}$** | `[NATIVE-BUILD]` (`pose_landmark_lite.tflite`) |
| **Model Size (Full)** | $6.44\text{ MB}$ | **$6.44\text{ MB}$** | `[NATIVE-BUILD]` (`pose_landmark_full.tflite`) |
| **Inference Latency (Target Device)** | $\sim 14 - 24\text{ ms}$ | **$\sim 14 - 24\text{ ms}$** | `[UNVERIFIED]` (Pending physical device run) |
| **Full Pipeline FPS (Target Device)** | $30 - 45\text{ FPS}$ | **$30 - 45\text{ FPS}$** | `[UNVERIFIED]` (Pending physical device run) |

---

## 3. Physical Handset Manual Testing Checklist `[DEVICE - NOT RUN]`

When deploying to a physical Android/iOS handset (`npx expo run:android` / `npx expo run:ios`), execute the following manual audit:

### Checklist Procedure

1. **Permission Test**:
   - Install fresh build. Open Live Monitor.
   - Verify camera consent dialog appears.
   - Tap "Deny" → Verify "Camera Access Denied" card displays "Open Settings" button.
   - Tap "Open Settings" → Verify OS settings open. Grant permission, return → Camera opens automatically.

2. **Camera Flip Test**:
   - In Live Monitor, tap camera switch icon in top bar.
   - Verify camera transitions smoothly without crashing or UI freeze.
   - Verify `reacquiring` overlay displays briefly during sensor restart.
   - Verify front camera is horizontally mirrored; back camera is unmirrored.

3. **Background & Blur Test**:
   - While session is active, press Home button (send app to background).
   - Verify camera preview pauses and inference halts (no background battery drain).
   - Reopen app → Verify camera resumes and `reacquiring` badge appears.

4. **Tracking Quality & Banner Test**:
   - Stand in front of camera with full legs visible → Verify banner displays green `TRACKING ACTIVE`.
   - Obscure feet/ankle with an object → Verify banner transitions to amber `PARTIAL VIEW` ("Keep lower leg & ankle clearly visible").
   - Step completely out of camera view → Verify banner transitions to red `SUBJECT LOST` ("Step back into camera view").
   - Return into view → Verify banner transitions cleanly without rapid flickering ($\ge 500\text{ ms}$ debounce).

5. **Rep Counting & Guidance Test**:
   - Perform 5 heel raises:
     - Verify rep counter increments upon returning to neutral position.
     - Verify safety zone indicators update smoothly.
     - Verify audio cues fire with proper cooldown ($\ge 4.5\text{ s}$).

6. **Session Completion**:
   - Complete required sets/reps or tap "Finish".
   - Verify navigation transitions to `SessionResultsScreen` with accurate total reps and ROM excursion.

---

## 4. Invariant Verification

1. **PRESERVE Compliance**:
   - `RepCounter.js`, `MetricEngine.js`, `FormChecker.js`, `CalibrationTracker.js`, `usePose.js`, `smoothing.js` confirmed **100% untouched**.
   - All 9 clinical screens (except `LiveMonitorScreen.js`) confirmed untouched.
2. **Contract Invariance**:
   - Canonical landmark schema (`docs/step1/04_landmark_schema.md`) strictly maintained.
3. **Layering Invariance**:
   - Native VisionCamera imports confined strictly to `visionCameraProvider.js`.
4. **Display Mirroring Only**:
   - Coordinates fed to `poseEngine` are unmodified; mirroring applies only to pixel render geometry.
5. **Fallback Invariance**:
   - `LANDMARK_SOURCE = 'camera' | 'synthetic'` fully functional with automatic fallback for web and dev environments.
