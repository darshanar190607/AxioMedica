# Step 3 — Gate 1: Current Screen Analysis

**File:** `mobile/src/screens/LiveMonitorScreen.js` (765 lines)  
**Analysis date:** 2026-11-14  
**Analyst:** Step 3 Gate 1 automated review  

---

## 1. Component Structure

```
LiveMonitorScreen (export default) — lines 498–603
  ├── PreSessionPainModal                — lines 36–120
  └── LiveExercise                       — lines 122–495
```

| Component | Role |
|---|---|
| `LiveMonitorScreen` | Outer shell: handles camera permissions, pre-session pain gate, routes to LiveExercise |
| `PreSessionPainModal` | Modal with 0–10 pain slider + sharp-pain toggle; gates session start |
| `LiveExercise` | Full runtime: frame loop, kinematic analysis, UI rendering, session completion |

---

## 2. Session Lifecycle

### 2a. Session Start Flow

```
LiveMonitorScreen mounts
  → useCameraPermissions() [line 500] → permission object reactive
  → If permission.granted [line 507]: setGranted(true), setShowPainModal(true)
  → Permission Gate Screen [lines 530–583]:
      "Enable Camera" → requestPermission() → if granted: setIsSimulation(false), setGranted(true), showPainModal
      "Continue in Simulation Mode" → setIsSimulation(true), setGranted(true), showPainModal
  → PreSessionPainModal appears (visible={showPainModal}) [line 588]
  → handlePainProceed(score) [line 514]: setPainScorePre, setShowPainModal(false), progressApi.recordPainLog(...)
  → LiveExercise mounts when: !showPainModal && (granted implied) [line 593]
```

### 2b. Session End Flow

```
finishSession() [lines 225–266]
  → guard: sessionDoneRef.current = true (prevents re-entry)
  → repCounterRef.current.completedReps → exerciseResult via buildExerciseResult()
  → calibrationRef.current.getBaseline() → baselineRomDeg
  → buildSessionPayload(...)
  → speakCue('Exercise complete!')
  → setTimeout 700ms → navigation.replace('SessionResults', {exercise, elapsed, sessionPayload, summary})
```

Triggered by either:
- `repRes.repsDone >= TOTAL_REPS` inside `processPoseFrame` [line 296]  
- User pressing "Finish" button [line 485]

There is **no "stop" state** separate from "done" — `sessionDoneRef` guards re-entry. Pausing (`pausedRef`) halts frame processing and the timer but does not end the session.

---

## 3. Synthetic Generator Location

**Lines 332–364** — a `setInterval` useEffect inside `LiveExercise`:

```js
// line 332–365
useEffect(() => {
  let frameStep = 0;
  const intervalMs = 50;  // 20 FPS

  const frameLoop = setInterval(() => {
    if (pausedRef.current || sessionDoneRef.current) return;
    frameStep += 1;

    const cycle = Math.sin((frameStep * Math.PI) / 36); // ~3.6s per full rep cycle
    const ankleAngle = 90 + cycle * 35;
    const heelRaiseDelta = Math.max(0, cycle * 0.09);

    const syntheticLandmarks = {
      left_hip:         { x: 0.50, y: 0.28, visibility: 0.92 },
      left_knee:        { x: 0.49, y: 0.52, visibility: 0.94 },
      left_ankle:       { x: 0.48, y: 0.82, visibility: 0.96 },
      left_heel:        { x: 0.45, y: 0.82 - heelRaiseDelta, visibility: 0.95 },
      left_foot_index:  { x: 0.56, y: 0.84, visibility: 0.93 },
      right_hip:        { x: 0.52, y: 0.28, visibility: 0.90 },
      right_knee:       { x: 0.51, y: 0.52, visibility: 0.91 },
      right_ankle:      { x: 0.50, y: 0.82, visibility: 0.92 },
      right_heel:       { x: 0.47, y: 0.82, visibility: 0.91 },
      right_foot_index: { x: 0.58, y: 0.84, visibility: 0.90 },
    };

    processPoseFrame(syntheticLandmarks, Date.now());
  }, intervalMs);

  return () => clearInterval(frameLoop);
}, [processPoseFrame]);
```

**This is the only source of landmarks in the current code.** The `setInterval` is always active regardless of `isSimulation`; the `isSimulation` prop only toggles the camera view vs a static emoji background — it does **not** affect landmark production.

---

## 4. How Landmarks Reach Downstream Processing

### 4a. processPoseFrame pipeline [lines 268–320]

```
processPoseFrame(rawLandmarks: NamedMap, timestamp: number)
  line 270: guard — if (pausedRef.current || sessionDoneRef.current) return
  line 273: checkPositioningGuidance(rawLandmarks) → guideMsg string
  line 276: smootherRef.current.filter(rawLandmarks, timestamp) → smoothed (NamedMap)
  line 279: metricEngineRef.current.computeMetrics(smoothed) → metrics object
  line 280: metricEngineRef.current.calculateConfidence(smoothed) → confidence float
  line 283: calibrationRef.current.addFrame(metrics, confidence) [side-effect]
  line 286: repCounterRef.current.processFrame(metrics, confidence, timestamp) → repRes
  lines 288–302: rep completion / TTS / finishSession guard
  lines 306–319: Throttled UI update at 120ms (~8 FPS):
    setAngle, setSafetyKey, setRepsDone, setCurrentSet, setFormScore, setGuidance, setLandmarks(smoothed)
```

### 4b. Landmark contract (from docs/step1/04_landmark_schema.md)

Input to `processPoseFrame` is a **named-map** `{ joint_name: { x, y, z?, visibility } }`.  
`z` is optional; smoothing.js One Euro Filters handle named keys dynamically.  
`usePose.js` exists but is **NOT used** in `LiveMonitorScreen` — the screen instantiates its own engine instances at lines 138–141.

---

## 5. Camera (expo-camera) Current State

| Aspect | Current behaviour |
|---|---|
| Import | `import { CameraView, useCameraPermissions } from 'expo-camera'` [line 6] |
| Rendered | `<CameraView style={StyleSheet.absoluteFill} facing="front" />` [line 385] |
| Frame processing | **None** — CameraView is display-only; no `onFrame`, no frameProcessor |
| Permission hook | `useCameraPermissions()` used at line 500 for the permission gate |
| Permission denial path | No "Open Settings" or denied state — just stays on permission gate screen |
| AppState handling | **None** — no AppState listener, no camera pause on background |
| Camera selection | **None** — always `facing="front"`, no switch control |

**Conclusion:** `expo-camera` is used only for displaying the camera viewfinder. It contributes nothing to landmark data. In Step 3 it will be replaced by `VisionCameraView` from `src/engines/providers/visionCameraProvider.js` for the camera path. `expo-camera` import can be removed after wiring.

---

## 6. Props / State Driving the UI

### LiveExercise internal state (all lines 143–154)

| State | Type | Drives |
|---|---|---|
| `repsDone` | number | Rep counter display |
| `currentSet` | number | Set badge |
| `angle` | number | ANGLE metric display |
| `formScore` | number | FORM% display |
| `safetyKey` | `'SAFE'|'CAUTION'|'STOP'` | Safety box colour + label |
| `feedback` | string | Toast banner text |
| `fbType` | `'correct'|'incorrect'` | Toast colour |
| `guidance` | string | Positioning guide card |
| `paused` | boolean | Pause/Resume button label; stops frame loop |
| `elapsed` | number (seconds) | Timer display |
| `landmarks` | NamedMap \| null | SkeletonOverlay input |

### LiveExercise refs (not state)

| Ref | Purpose |
|---|---|
| `pausedRef` | Mirror of `paused` for use inside frame loop callbacks |
| `sessionDoneRef` | Guards finishSession() re-entry |
| `lastUiUpdateRef` | Throttle: last timestamp of UI update |
| `lastSpeechTime` | TTS cooldown |
| `sessionStartRef` | ISO timestamp when session started |
| `fbOpacity` | Animated.Value for feedback toast fade |
| `smootherRef` | KeypointSmoother instance |
| `metricEngineRef` | MetricEngine instance |
| `repCounterRef` | RepCounter instance |
| `calibrationRef` | CalibrationTracker instance |

### LiveMonitorScreen state (outer, lines 500–504)

| State | Drives |
|---|---|
| `permission` | From useCameraPermissions hook |
| `granted` | Whether to show permission gate vs session |
| `isSimulation` | Passed to LiveExercise; swaps camera view ↔ emoji bg |
| `showPainModal` | Whether PreSessionPainModal is visible |
| `painScorePre` | Passed to LiveExercise for session payload |

---

## 7. Navigation Params

**Route:** `LiveMonitorScreen` receives `route.params.exercise`:

```js
// line 499
const { exercise } = route.params || { exercise: { name: 'Heel Raise', reps: 10, sets: 3 } };
```

Expected shape (from ExerciseDetailScreen / MyPlanScreen):
```js
{
  id: number,
  name: string,         // e.g. 'Heel Raise', 'Ankle Pump'
  reps: number,
  sets: number,
  side: string,         // 'left' | 'right'
  plan_id: number | null,
}
```

No other navigation params are used. Session results navigate to `'SessionResults'` via `navigation.replace(...)` [line 254].

---

## 8. Session Save Flow

```
finishSession()                                                      [line 225]
  buildExerciseResult({ exerciseId, completedReps, setsDone,         [line 233]
                        painBefore, painAfter, side })
    → { exercise_id, completed_reps, sets_done, pain_before,
        pain_after, side, avg_form_score, max_rom_deg }

  buildSessionPayload({ planId, startedAt, endedAt,                  [line 242]
                        exerciseResults, painScorePre, painScorePost })
    → { plan_id, started_at, ended_at, exercise_results, ... }

  navigation.replace('SessionResults', {                              [line 254]
    exercise,
    elapsed,
    sessionPayload,
    summary: {
      totalReps, avgFormScore, maxRomDeg, baselineRom
    }
  })
```

Backend API (`progressApi.saveSession`) is called from `SessionResultsScreen`, **not** from `LiveMonitorScreen`. LiveMonitorScreen only assembles the payload.

---

## 9. Required Joints Per Exercise

Derived from `mobile/src/pose/fixtures.js` and `poseConfig.js`:

### Heel Raise (`heel_raise`)
Minimum confidence threshold: **0.65**

| Metric | Landmark triple | Required joints |
|---|---|---|
| `heel_height` | vertical_delta: `left_heel` vs `left_ankle` | `left_heel`, `left_ankle` |
| `ankle_angle` | angle: `left_knee` → `left_ankle` → `left_foot_index` | `left_knee`, `left_ankle`, `left_foot_index` |
| `hip_vertical_delta` | `left_hip` vs `left_knee` | `left_hip`, `left_knee` |

**Full required joint set:**
```
left_hip, right_hip, left_knee, right_knee,
left_ankle, right_ankle, left_heel, right_heel,
left_foot_index, right_foot_index
```

Phase gates (RepCounter, `fixtures.js`):
- `down`: `heel_height ≤ 0.02`
- `up`: `heel_height ≥ 0.08`

### Ankle Pump (`ankle_pump`)
Minimum confidence threshold: **0.60**

| Metric | Required joints |
|---|---|
| `ankle_angle` | `left_knee`, `left_ankle`, `left_foot_index` |
| `ankle_angle_delta` | (derived from successive ankle_angle) |

**Full required joint set:**
```
left_knee, right_knee,
left_ankle, right_ankle, left_heel, right_heel,
left_foot_index, right_foot_index
```

---

## 10. Tracking State Model

**Current state:** None. Synthetic generator always produces high-confidence landmarks; there is no concept of "lost" or "partial" tracking.

**Step 3 tracking-state model (to be implemented):**

```
States:
  initializing  — camera started, first frame not yet received
  tracking      — all required joints visible (mean visibility ≥ min_confidence)
  partial       — some required joints visible but mean visibility < min_confidence
  lost          — required joints mean visibility < 0.40 OR no frame for > 500ms

Transitions:
  initializing → tracking    : first frame with mean visibility ≥ threshold
  tracking     → partial     : mean visibility drops below threshold (sustained 3 frames)
  tracking     → lost        : visibility < 0.40 OR frame timeout
  partial      → tracking    : mean visibility recovers ≥ threshold
  partial      → lost        : visibility < 0.40
  lost         → initializing: camera restarted or new frame received after back/switch
  any          → initializing: poseEngine.reset() called (camera switch, AppState resume)
```

**Frame gating rule (INVARIANT #2):**
- Frames still flow through `smootherRef.current.filter()` in all states
- `processPoseFrame` early-returns on `pausedRef` or `sessionDoneRef` (existing guards)
- NEW: also early-return when tracking status is `'lost'` — prevents invalid data reaching RepCounter
- `'partial'` frames still processed — RepCounter already handles low-confidence at rep-completion (repCounter.js line 138–140)

---

## 11. Files That Must NOT Be Modified (PRESERVE)

Confirmed unchanged in Step 3:

| File | Reason |
|---|---|
| `src/pose/repCounter.js` | PRESERVE — RepCounter |
| `src/pose/metricEngine.js` | PRESERVE — MetricEngine |
| `src/pose/formChecker.js` | PRESERVE — FormChecker |
| `src/pose/calibration.js` | PRESERVE — CalibrationTracker |
| `src/hooks/usePose.js` | PRESERVE — usePose hook |
| `src/pose/smoothing.js` | PRESERVE — KeypointSmoother |
| `src/engines/poseEngine.js` | PRESERVE — engine singleton internals |
| `src/screens/LandingScreen.js` | PRESERVE — not in scope |
| `src/screens/LoginScreen.js` | PRESERVE |
| `src/screens/DashboardScreen.js` | PRESERVE |
| `src/screens/MyPlanScreen.js` | PRESERVE |
| `src/screens/ExerciseDetailScreen.js` | PRESERVE |
| `src/screens/ClinicianScreen.js` | PRESERVE |
| `src/screens/ProfileScreen.js` | PRESERVE |
| `src/screens/SessionResultsScreen.js` | PRESERVE |
| `src/engines/providers/visionCameraProvider.js` | PRESERVE — Step 2 output |
| `src/engines/adapters/blazeposeAdapter.js` | PRESERVE — Step 2 output |

