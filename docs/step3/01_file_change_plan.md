# Step 3 — Gate 1: File Change Plan

**Step:** 3 — Mobile Integration  
**Produced by:** Gate 1 inspection  
**Date:** 2026-11-14  

---

## Overview

Replace the synthetic `setInterval` frame source in `LiveMonitorScreen.js` with real BlazePose camera frames from `VisionCameraView` / `poseEngine`, while keeping the synthetic path selectable via a `LANDMARK_SOURCE` flag and preserving all downstream kinematic modules untouched.

---

## NEW Files

### Source files

| File | Purpose |
|---|---|
| `mobile/src/hooks/useCameraLandmarks.js` | Subscribes to `poseEngine` singleton. Exposes `{ frame, status, fps }` updated via ref/callback (no per-frame setState). |
| `mobile/src/utils/overlayTransform.js` | Pure JS: maps normalised landmark coords `[0,1]` → pixel coords for a given viewport, handling `cover` / `contain` resize, horizontal mirror, and frame-to-view aspect ratio. |
| `mobile/src/utils/trackingQuality.js` | Frame + required-joints list → `'tracking' | 'partial' | 'lost'` + human-readable message. Used upstream to gate RepCounter and drive `TrackingBanner`. |
| `mobile/src/utils/requiredJoints.js` | Exercise-name → required landmark names array lookup table (Heel Raise, Ankle Pump). Single source of truth consumed by `trackingQuality.js` and `useCameraLandmarks.js`. |
| `mobile/src/components/TrackingBanner.js` | Debounced (~500 ms minimum display) status banner component. Colour + text + accessible `accessibilityLabel`. Must NOT use per-frame setState. |

### Test files

| File | Covers |
|---|---|
| `mobile/__tests__/overlayTransform.test.js` | Table-driven: 1280×720 frame in 390×844 view, cover mode; center pt → (195, 422); mirror; edge coords |
| `mobile/__tests__/trackingQuality.test.js` | All joints visible → `tracking`; some below threshold → `partial`; all below 0.4 → `lost`; missing joint → `lost` |
| `mobile/__tests__/useCameraLandmarks.test.js` | poseEngine subscription lifecycle; status transitions; unsubscribe on unmount |
| `mobile/__tests__/trackingBanner.test.js` | Render correct colour/text per status; debounce: fast status changes don't flicker |

### Docs

| File | Produced at |
|---|---|
| `docs/step3/00_current_screen_analysis.md` | Gate 1 |
| `docs/step3/01_file_change_plan.md` | Gate 1 (this file) |
| `docs/step3/02_device_validation.md` | Gate 5 |

---

## MODIFIED Files

### `mobile/src/screens/LiveMonitorScreen.js`

**Reason:** This is the only integration point for Step 3. All other screens are PRESERVE.

| Change | Lines affected | Detail |
|---|---|---|
| Remove `expo-camera` import | Line 6 | Replace `CameraView, useCameraPermissions` with VisionCamera equivalents via `visionCameraProvider` |
| Add `LANDMARK_SOURCE` flag | New constant (top of file) | `'camera' \| 'synthetic'`; default `'camera'`; can override with `__DEV__` env |
| Replace `setInterval` synthetic loop | Lines 332–365 | Wrap in `if (LANDMARK_SOURCE === 'synthetic')` branch; keep code intact |
| Add camera source branch | Lines 332–365 | `if (LANDMARK_SOURCE === 'camera')` → use `useCameraLandmarks` subscription |
| Wire `poseEngine.reset()` | On camera switch + AppState resume | Call on camera facing change and when returning from background |
| Replace `<CameraView>` | Line 385 | Use `<VisionCameraView>` from `visionCameraProvider.js` |
| Add permission handling | Lines 500–584 | Augment existing gate with: denied state → "Open Settings" (uses `Linking.openSettings()`); unavailable → hardware-error screen |
| Add camera facing toggle | Lines 435–491 bottom panel | Front/Back switch button; on press: flip `facing`, call `poseEngine.reset()` |
| Add AppState listener | New useEffect in LiveExercise | Pause camera + session on background; resume with `'initializing'` on foreground |
| Add screen focus listener | New useEffect in LiveExercise | Use `useIsFocused()` or navigation focus event; set `isActive` |
| Add `trackingStatus` state | Lines 143–154 | `'initializing' \| 'tracking' \| 'partial' \| 'lost'`; throttle to ≤ 10 Hz |
| Add `TrackingBanner` | Render tree | Insert below `SkeletonOverlay`, above guidance card |
| Gate `processPoseFrame` on `'lost'` | Line 270 | Add `trackingStatusRef.current === 'lost'` early-return guard |
| Remove `isSimulation` prop route | Lines 377–386 | Replaced by `LANDMARK_SOURCE` flag; `isSimulation` removed from LiveMonitorScreen state |

> [!IMPORTANT]
> `processPoseFrame` internals (lines 270–320) are **not restructured** — only the frame source that calls it changes. All downstream kinematic code is untouched.

---

## PRESERVED Files — Confirmed Untouched in Step 3

### Kinematic engine (PRESERVE tagged)

| File | Verification |
|---|---|
| `src/pose/repCounter.js` | No modifications planned or permitted |
| `src/pose/metricEngine.js` | No modifications planned or permitted |
| `src/pose/formChecker.js` | No modifications planned or permitted |
| `src/pose/calibration.js` | No modifications planned or permitted |
| `src/hooks/usePose.js` | No modifications planned or permitted |
| `src/pose/smoothing.js` | No modifications planned or permitted |
| `src/engines/poseEngine.js` | No modifications planned or permitted |
| `src/engines/adapters/blazeposeAdapter.js` | Step 2 output — no modifications planned |
| `src/engines/providers/visionCameraProvider.js` | Step 2 output — consumed read-only |

### Clinical screens (PRESERVE)

| File |
|---|
| `src/screens/LandingScreen.js` |
| `src/screens/LoginScreen.js` |
| `src/screens/DashboardScreen.js` |
| `src/screens/MyPlanScreen.js` |
| `src/screens/ExerciseDetailScreen.js` |
| `src/screens/ClinicianScreen.js` |
| `src/screens/ProfileScreen.js` |
| `src/screens/SessionResultsScreen.js` |

---

## Tracking-State Model

```
Enum: 'initializing' | 'tracking' | 'partial' | 'lost'

initializing
  → tracking    : first frame arrives with required-joint mean visibility ≥ exercise threshold
  → lost        : no frame received for > 500 ms

tracking
  → partial     : mean required-joint visibility < threshold, sustained for ≥ 3 consecutive frames
  → lost        : mean required-joint visibility < 0.40 OR frame gap > 500 ms

partial
  → tracking    : mean visibility recovers ≥ threshold for ≥ 2 consecutive frames
  → lost        : visibility < 0.40

lost
  → initializing: poseEngine.reset() triggered (camera switch, AppState resume, retry tap)
```

**Frame gating at `processPoseFrame` entry:**
```js
// NEW guard (after existing pausedRef guard):
if (trackingStatusRef.current === 'lost') return;
// 'partial' frames continue flowing — RepCounter handles low-confidence at rep end
```

---

## Required-Joints Table

```js
// mobile/src/utils/requiredJoints.js
export const REQUIRED_JOINTS = {
  heel_raise: [
    'left_hip', 'right_hip',
    'left_knee', 'right_knee',
    'left_ankle', 'right_ankle',
    'left_heel', 'right_heel',
    'left_foot_index', 'right_foot_index',
  ],
  ankle_pump: [
    'left_knee', 'right_knee',
    'left_ankle', 'right_ankle',
    'left_heel', 'right_heel',
    'left_foot_index', 'right_foot_index',
  ],
};

export function getRequiredJoints(exerciseName) {
  const key = exerciseName?.toLowerCase().replace(/\s+/g, '_');
  return REQUIRED_JOINTS[key] ?? REQUIRED_JOINTS['ankle_pump'];
}
```

---

## LANDMARK_SOURCE Flag

```js
// Top of LiveMonitorScreen.js
const LANDMARK_SOURCE = process.env.EXPO_PUBLIC_LANDMARK_SOURCE ?? 'camera';
// Values: 'camera' | 'synthetic'
// Set EXPO_PUBLIC_LANDMARK_SOURCE=synthetic in .env for dev/test
```

> [!NOTE]
> `EXPO_PUBLIC_USE_MOCK=true` already in `mobile/.env` for backend bypass.
> Add `EXPO_PUBLIC_LANDMARK_SOURCE=synthetic` for Web / Expo Go where VisionCamera is unavailable.

---

## overlayTransform.js Reference Implementation

```js
// mobile/src/utils/overlayTransform.js
export function makeTransform({ frameW, frameH, viewW, viewH, resizeMode = 'cover', mirror = false }) {
  const sx = viewW / frameW;
  const sy = viewH / frameH;
  const s  = resizeMode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  const drawnW = frameW * s;
  const drawnH = frameH * s;
  const offX = (viewW - drawnW) / 2;
  const offY = (viewH - drawnH) / 2;

  return (lm) => {
    let nx = lm.x;
    if (mirror) nx = 1 - nx;
    return {
      px: offX + nx * drawnW,
      py: offY + lm.y * drawnH,
    };
  };
}
```

**Canonical test vector:**  
Frame 1280×720, view 390×844, `resizeMode='cover'`, `mirror=false`:
- `s = max(390/1280, 844/720) = max(0.305, 1.172) = 1.172`
- `drawnW = 1280 × 1.172 = 1500.0`, `drawnH = 720 × 1.172 = 844.0`
- `offX = (390 − 1500) / 2 = −555`, `offY = (844 − 844) / 2 = 0`
- Center landmark (0.5, 0.5) → `px = −555 + 0.5×1500 = 195`, `py = 0 + 0.5×844 = 422` ✓

---

## Per-Gate Deliverables Summary

| Gate | Files created/modified |
|---|---|
| **Gate 1** (this gate) | `docs/step3/00_current_screen_analysis.md`, `docs/step3/01_file_change_plan.md` |
| **Gate 2** | `LiveMonitorScreen.js` — permission flow, camera lifecycle, AppState, switch |
| **Gate 3** | `useCameraLandmarks.js`, `requiredJoints.js`, `LANDMARK_SOURCE` wiring in `LiveMonitorScreen.js` |
| **Gate 4** | `overlayTransform.js`, `trackingQuality.js`, `TrackingBanner.js`, all test files, full `LiveMonitorScreen.js` integration |
| **Gate 5** | `docs/step3/02_device_validation.md` |

---

## Open Risks / Decisions Needed Before Gate 2

| # | Risk / Decision | Recommended |
|---|---|---|
| R1 | `useVisionCameraPermission` from `visionCameraProvider.js` — confirm it wraps `Camera.requestCameraPermission()` correctly for both Android and iOS [UNVERIFIED on physical device] | Read provider types before Gate 2 |
| R2 | `Linking.openSettings()` availability in Expo SDK 57 managed workflow on web | Wrap in `Platform.OS !== 'web'` guard |
| R3 | `useIsFocused()` from `@react-navigation/native` vs navigation event listener — both available, hook is cleaner | Use `useIsFocused()` |
| R4 | AppState pause should stop VisionCamera inference (`isActive` prop) but NOT destroy session state — confirm VisionCameraView `isActive` prop exists in provider [UNVERIFIED] | Read visionCameraProvider.js before Gate 2 |
| R5 | `EXPO_PUBLIC_LANDMARK_SOURCE` env var: web mode must default to `'synthetic'` automatically when VisionCamera is unavailable | Add `isVisionCameraAvailable()` check as fallback |

