# Error Codes

Canonical list of form-error identifiers used in `RepResult.errors[]` and `pose_config.form_rules[].id`.  
All ids are **lowercase snake_case strings**.

> [!IMPORTANT]
> This list is the single source of truth. Never add a new error id without updating this file and
> bumping the `pose_model_ver`. Both engineers must agree before adding or removing codes.

---

## `too_fast`
**Category:** Pacing  
**Trigger:** A repetition is completed in less time than `pose_config.min_rep_duration_ms`.  
**Clinical significance:** Insufficient time under tension; momentum substitutes for muscle work.  
**Default coaching cue:** *"Slow down — aim for 2 seconds up, hold, then 2 seconds down."*

---

## `low_height`
**Category:** Range of Motion  
**Trigger:** The primary movement metric (e.g., heel height or joint angle) does not reach the
target threshold at peak phase.  
**Clinical significance:** Patient is not achieving the prescribed ROM, limiting therapeutic benefit.  
**Default coaching cue:** *"Rise higher — push through the full range of motion."*

---

## `knee_valgus`
**Category:** Alignment  
**Trigger:** The knee collapses inward (medial deviation) during a weight-bearing exercise.  
Detected via the knee–ankle–hip frontal-plane angle when camera_view is `front`.  
**Clinical significance:** Valgus loading increases patellofemoral stress and risks ligament injury.  
**Default coaching cue:** *"Push your knee outward — keep it in line with your second toe."*  
**Note:** Only applicable to front-camera exercises. Pose engine ignores this rule for side-camera configs.

---

## `early_heel_lift`
**Category:** Sequencing  
**Trigger:** The heel rises before the prescribed phase transition occurs — e.g., heel lifts during
a squat descent instead of staying flat until the prescribed bottom position.  
**Clinical significance:** Indicates ankle dorsiflexion deficit or weight-shifting compensation.  
**Default coaching cue:** *"Keep your heel flat on the ground — don't let it lift early."*

---

## `hip_hike`
**Category:** Alignment / Compensation  
**Trigger:** The hip on the exercising side rises vertically more than the threshold defined in
`form_rules` during the movement, indicating trunk lateral-flexion compensation.  
**Clinical significance:** Suggests weak hip abductors or poor core control; shifts load away from
the target muscle.  
**Default coaching cue:** *"Keep your hips level — don't let one side hike up."*

---

## `low_confidence`
**Category:** Data Quality  
**Trigger:** Mean BlazePose landmark visibility score drops below `min_pose_confidence` for more
than 5 consecutive frames during a rep.  
**Clinical significance:** Pose data is unreliable; metrics computed from this rep may be inaccurate.  
**Effect on scoring:** The rep is still counted but its `form_score` is flagged as unreliable.
The backend excludes low-confidence reps from trend analysis.  
**Default coaching cue:** *"Keep your body in the camera frame for accurate tracking."*

---

## Adding a New Error Code

1. Add an entry to this file (with category, trigger, clinical significance, cue).
2. Add it to `pose_config.schema.json` validation if needed.
3. Update `validate.py` / `validate.js` known-codes list.
4. Bump `pose_model_ver` in the mobile app.
5. Notify Person A so the backend can store/surface the new code.
