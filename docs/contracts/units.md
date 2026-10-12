# Units Reference

All numeric fields in the RehabStep AI data contracts use the units defined here.
Deviating from this table is a breaking change — update both engineers before changing.

---

## Angular Measurements

| Field | Unit | Range | Notes |
|-------|------|-------|-------|
| `rom_deg` | Degrees (°) | 0 – 180 | Absolute angular excursion for a rep |
| `max_rom_deg` | Degrees (°) | 0 – 180 | Max across all reps in an exercise |
| `avg_rom_deg` | Degrees (°) | 0 – 180 | Mean across all reps |
| Metric type `angle` | Degrees (°) | 0 – 180 | Interior angle at the pivot landmark |
| Phase / FormRule thresholds (angle metric) | Degrees (°) | 0 – 180 | |

Angles are computed using the law of cosines on 2-D projected landmark coordinates (x, y in
normalized screen space). The z-depth component from BlazePose is **not** used for angle
computation to keep results stable for 2-D side/front camera setups.

---

## Time Measurements

| Field | Unit | Notes |
|-------|------|-------|
| `duration_ms` | Milliseconds (ms) | Wall-clock time; non-negative |
| `min_rep_duration_ms` | Milliseconds (ms) | Minimum acceptable rep time |
| `started_at` / `ended_at` | ISO-8601 date-time (UTC) | Always UTC; local time NOT stored |

---

## Scores (Form & Performance)

| Field | Unit | Range | Notes |
|-------|------|-------|-------|
| `form_score` | Dimensionless | 0 – 100 | 100 = perfect form, 0 = completely wrong |
| `avg_form_score` | Dimensionless | 0 – 100 | Mean of per-rep form_score |
| `overall_score` | Dimensionless | 0 – 100 | Session-level aggregate |

Scoring formula (computed on-device):
```
form_score = 100 − Σ(error_penalty_per_rule_fired)
```
Penalty weights are defined per exercise in `pose_config` (future field, not yet in schema).
Minimum score is clamped to 0.

---

## Confidence (Pose Detection)

| Field | Unit | Range | Notes |
|-------|------|-------|-------|
| `confidence` | Normalized | 0 – 1 | BlazePose visibility score |
| `min_pose_confidence` | Normalized | 0 – 1 | Frames below this are skipped |

BlazePose landmark visibility is a model output in [0, 1] where values > 0.5 indicate the
landmark is likely visible. RehabStep uses a default floor of 0.60.

---

## Spatial Coordinates (Landmark Positions)

| Coordinate | Unit | Range | Notes |
|------------|------|-------|-------|
| `x`, `y` | Normalized | 0 – 1 | (0,0) = top-left of camera frame |
| `z` | Normalized (depth) | ~ −1 – 1 | Not used for angle/delta calculations |

Metric type `vertical_delta`:
```
vertical_delta = reference_landmark.y − landmark.y
```
**Positive** when the tracked landmark is **higher on screen** than the reference (smaller y value,
since y=0 is at the top). Range is approximately −1 to +1 but practically −0.5 to +0.5 for
ankle rehabilitation exercises.

---

## Pain Scale

| Field | Unit | Range | Notes |
|-------|------|-------|-------|
| `pain_before` / `pain_after` | Integer | 0 – 10 | Numeric Rating Scale (NRS); 0 = no pain, 10 = worst imaginable |

Pain values are self-reported by the patient via the app UI before and after each exercise.
They are **never** computed from pose data.
