# 04. Landmark Schema Contract & Topology Mapping

**Date:** 2026-11-07  
**Project:** AxioMedica / RehabStep AI  
**Status:** LOCKED  
**Invariant Rule:** The new vision engine adapts to the existing contract, **never** the reverse.

---

## 1. Verified Output Shape (Copied from Production Code)

Source of truth: [`mobile/src/screens/LiveMonitorScreen.js:348-360`](file:///c:/c_backup/projects/AxioMedica/mobile/src/screens/LiveMonitorScreen.js#L348-L360) and [`mobile/src/pose/fixtures.js:10-21`](file:///c:/c_backup/projects/AxioMedica/mobile/src/pose/fixtures.js#L10-L21).

Existing downstream modules (`KeypointSmoother`, `MetricEngine`, `SkeletonOverlay`) consume a **named dictionary/map** (NOT a raw array), where keys are semantic anatomical joint strings and values are landmark coordinate objects:

```javascript
{
  "timestamp": 1730960000000,       // integer ms (inference acquisition time, NOT render time)
  "source": "camera",               // "camera" | "synthetic" | "fixture"
  "landmarks": {                    // NAMED MAP (matches existing mobile code)
    "left_hip":        { "x": 0.50, "y": 0.28, "z": 0.00,  "visibility": 0.92 },
    "left_knee":       { "x": 0.49, "y": 0.52, "z": 0.02,  "visibility": 0.94 },
    "left_ankle":      { "x": 0.48, "y": 0.82, "z": 0.01,  "visibility": 0.96 },
    "left_heel":       { "x": 0.45, "y": 0.82, "z": 0.04,  "visibility": 0.95 },
    "left_foot_index": { "x": 0.56, "y": 0.84, "z": -0.06, "visibility": 0.93 },
    "right_hip":       { "x": 0.52, "y": 0.28, "z": 0.00,  "visibility": 0.90 },
    "right_knee":      { "x": 0.51, "y": 0.52, "z": 0.02,  "visibility": 0.91 },
    "right_ankle":     { "x": 0.50, "y": 0.82, "z": 0.01,  "visibility": 0.92 },
    "right_heel":      { "x": 0.47, "y": 0.82, "z": 0.04,  "visibility": 0.91 },
    "right_foot_index":{ "x": 0.58, "y": 0.84, "z": -0.06, "visibility": 0.90 }
    // ... all 33 BlazePose landmarks when coming from real engine
  }
}
```

---

## 2. Core Conventions

### Coordinate System & Normalization
* **Range:** Normalized floating-point numbers `[0.0, 1.0]`.
* **Origin:** Top-left corner `(0.0, 0.0)`.
  * `x = 0.0` is the left edge of the image; `x = 1.0` is the right edge.
  * `y = 0.0` is the top edge; `y = 1.0` is the bottom edge.
* **Depth (`z`):** Represents relative depth with respect to the mid-hip landmark (smaller values are closer to the camera). In 2D plane calculations (`angle`, `verticalDelta`), `z` is ignored but preserved for 3D extension.
* **Visibility:** Float `[0.0, 1.0]` representing MediaPipe's confidence that the landmark is within the frame and unoccluded.

### Mirroring & Camera Orientation
* **Front Camera:** Image streams from front-facing mobile cameras are mirrored horizontally by native sensors.
* **Side-Aware Inversion:**
  - Front camera: If `isMirrored === true`, the adapter maps raw x-coordinates as `x' = 1.0 - x` before feeding `SkeletonOverlay` ([SkeletonOverlay.js:65](file:///c:/c_backup/projects/AxioMedica/mobile/src/components/SkeletonOverlay.js#L65)).
  - Anatomical Left vs Right: MediaPipe outputs landmarks based on the subject's anatomical left/right (e.g. `left_knee` is always the person's left leg, regardless of camera direction).

### Missing Landmark Policy
* When a landmark is completely outside the frame or below detection threshold:
  1. The landmark key is **retained** in the dictionary with `visibility: 0.0`.
  2. If omitted entirely by a partial detector, downstream geometry primitives (`angle`, `verticalDelta`, `distance`) return `0` without throwing ([geometry.js:21](file:///c:/c_backup/projects/AxioMedica/mobile/src/pose/geometry.js#L21)).
  3. UI rendering (`SkeletonOverlay.js:63`) discards nodes with `visibility <= 0.4`.

---

## 3. MediaPipe BlazePose 33-Keypoint Index Mapping Table

Enforces compliance with `docs/contracts/pose_config.schema.json:30-38` and `mobile/src/pose/fixtures.js:10-21`.

| Index | Canonical Semantic Key | Anatomical Region | Required by Heel Raise? | Required by Ankle Pump? |
| :---: | :--- | :--- | :---: | :---: |
| **0** | `nose` | Cranial | No | No |
| **1** | `left_eye_inner` | Cranial | No | No |
| **2** | `left_eye` | Cranial | No | No |
| **3** | `left_eye_outer` | Cranial | No | No |
| **4** | `right_eye_inner` | Cranial | No | No |
| **5** | `right_eye` | Cranial | No | No |
| **6** | `right_eye_outer` | Cranial | No | No |
| **7** | `left_ear` | Cranial | No | No |
| **8** | `right_ear` | Cranial | No | No |
| **9** | `mouth_left` | Cranial | No | No |
| **10** | `mouth_right` | Cranial | No | No |
| **11** | `left_shoulder` | Torso / Upper | No | No |
| **12** | `right_shoulder` | Torso / Upper | No | No |
| **13** | `left_elbow` | Upper Extremity | No | No |
| **14** | `right_elbow` | Upper Extremity | No | No |
| **15** | `left_wrist` | Upper Extremity | No | No |
| **16** | `right_wrist` | Upper Extremity | No | No |
| **17** | `left_pinky` | Upper Extremity | No | No |
| **18** | `right_pinky` | Upper Extremity | No | No |
| **19** | `left_index` | Upper Extremity | No | No |
| **20** | `right_index` | Upper Extremity | No | No |
| **21** | `left_thumb` | Upper Extremity | No | No |
| **22** | `right_thumb` | Upper Extremity | No | No |
| **23** | `left_hip` | Pelvis / Lower | **YES** (`left_hip: 23`) | No |
| **24** | `right_hip` | Pelvis / Lower | **YES** (`right_hip: 24`) | No |
| **25** | `left_knee` | Lower Extremity | **YES** (`left_knee: 25`) | **YES** (`left_knee: 25`) |
| **26** | `right_knee` | Lower Extremity | **YES** (`right_knee: 26`) | **YES** (`right_knee: 26`) |
| **27** | `left_ankle` | Lower Extremity | **YES** (`left_ankle: 27`) | **YES** (`left_ankle: 27`) |
| **28** | `right_ankle` | Lower Extremity | **YES** (`right_ankle: 28`) | **YES** (`right_ankle: 28`) |
| **29** | `left_heel` | Ankle Complex | **YES** (`left_heel: 29`) | **YES** (`left_heel: 29`) |
| **30** | `right_heel` | Ankle Complex | **YES** (`right_heel: 30`) | **YES** (`right_heel: 30`) |
| **31** | `left_foot_index` | Foot Complex | **YES** (`left_foot_index: 31`) | **YES** (`left_foot_index: 31`) |
| **32** | `right_foot_index` | Foot Complex | **YES** (`right_foot_index: 32`) | **YES** (`right_foot_index: 32`) |

---

## 4. Validator & Fixtures Verification Evidence

* **Validator Implementation:** [`contracts/validateLandmarks.js`](file:///c:/c_backup/projects/AxioMedica/contracts/validateLandmarks.js)
* **Regression Fixture Files Created:**
  - [`tests/fixtures/landmarks_neutral.json`](file:///c:/c_backup/projects/AxioMedica/tests/fixtures/landmarks_neutral.json) – Full 33 BlazePose landmark baseline in neutral standing stance.
  - [`tests/fixtures/landmarks_down.json`](file:///c:/c_backup/projects/AxioMedica/tests/fixtures/landmarks_down.json) – Heel raise start phase (`left_heel.y = 0.82`).
  - [`tests/fixtures/landmarks_up.json`](file:///c:/c_backup/projects/AxioMedica/tests/fixtures/landmarks_up.json) – Heel raise peak extension phase (`left_heel.y = 0.73`, `delta = 0.09`).
* **Execution Proof:**
  - Validated synthetic generator output from `LiveMonitorScreen.js:348-360`: **PASS**
  - Validated `landmarks_neutral.json`: **PASS**
  - Validated `landmarks_down.json`: **PASS**
  - Validated `landmarks_up.json`: **PASS**

