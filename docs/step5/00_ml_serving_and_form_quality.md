# Step 5: Advanced ML Serving & Post-Hoc Form Quality Inference

## 1. Overview & Architectural Boundaries (ADR-001)

In AxioMedica's dual-tier architecture:
- **Tier 1 (On-Device Real-Time)**: Runs locally on the client mobile device via BlazePose TFLite (`mobile/src/engines/`). It generates 33 3D normalized body landmarks, runs joint-angle kinematic filters, tracks repetition phases, detects acute compensatory triggers, and provides immediate local audio-visual feedback. **Raw video and camera frame buffers never leave the physical device.**
- **Tier 2 (Server-Side Post-Hoc Kinematics Assessment)**: Located in `backend/app/ml_serving/`. This service accepts completed exercise telemetry upon session conclusion, performs multi-factorial biomechanical evaluation, computes neuromuscular fatigue degradation, and synthesizes personalized clinical rehabilitation recommendations for the clinician dashboard.

---

## 2. Implemented Components

### 2.1 Pydantic Data Contracts (`backend/app/ml_serving/schemas.py`)
- `RepTelemetryInput`: Per-repetition telemetry containing `rep_no`, `duration_ms`, `rom_deg`, `form_score`, `errors`, and `confidence`.
- `FormQualityInferenceRequest`: Complete exercise payload containing exercise metadata, side (`left` | `right` | `bilateral`), `target_rom_deg`, `baseline_rom_deg`, and the array of `reps`.
- `BiomechanicalBreakdown`: Detailed analytical breakdown containing:
  - `rom_adequacy_score` (0–100)
  - `cadence_smoothness_score` (0–100)
  - `fatigue_decay_pct` (% decay in ROM from first to final repetitions)
  - `detected_compensations` (deduplicated list of flagged biomechanical compensations)
  - `error_penalty_weight` (weighted aggregate penalty)
- `FormQualityInferenceResponse`: Overall inference evaluation outputting:
  - `status`: `"success"` | `"needs_attention"`
  - `overall_quality_score` (0–100)
  - `quality_tier`: `"excellent"` | `"satisfactory"` | `"needs_attention"` | `"high_risk"`
  - `biomechanical_breakdown`: `BiomechanicalBreakdown`
  - `clinical_recommendations`: Actionable feedback for patient and physical therapist.

### 2.2 Biomechanical Evaluator Algorithm (`backend/app/ml_serving/evaluator.py`)
The server-side post-hoc evaluator implements multi-dimensional scoring:
1. **ROM Adequacy Score**: Compares observed peak ROM against clinical targets and baseline calibration angles.
2. **Velocity & Cadence Smoothness**: Computes standard deviation across rep durations; cadences with low variance score up to 100, while erratic rep times receive smooth deductions.
3. **Neuromuscular Fatigue Decay**: Analyzes ROM drift between the first tertile and last tertile of the exercise set to detect progressive muscular exhaustion.
4. **Compensatory Error Penalties**: Applies clinically weighted penalties for flagged errors (e.g., `knee_valgus`: 15 pts, `hip_hiking`: 12 pts, `incomplete_rom`: 8 pts, `too_fast`: 5 pts).
5. **Quality Tier Stratification**:
   - $\ge 88$: `excellent`
   - $72 - 87$: `satisfactory`
   - $55 - 71$: `needs_attention`
   - $< 55$: `high_risk`
6. **Clinical Recommendations Engine**: Synthesizes structured, human-readable guidance for patient adjustments and physical therapist review.

### 2.3 ML Serving API Router (`backend/app/ml_serving/router.py`)
Mounted at `/api/v1/ml`:
- `GET /api/v1/ml/status`: Health and model runtime inspection (`status: "online"`, loaded models list, accelerator).
- `POST /api/v1/ml/inference`: Full form quality post-hoc inference.
- `POST /api/v1/ml/predict/form-quality`: Alias endpoint for interoperability with external clinical analytic systems.

---

## 3. Verification & Evidence

- **Unit Tests (`backend/tests/unit/test_evaluator.py`)**:
  - `calculate_rom_adequacy` verification.
  - `calculate_velocity_smoothness` verification.
  - `calculate_fatigue_decay` verification.
  - End-to-end `evaluate_form_quality` scoring, tier assignment, compensation mapping, and clinical advice synthesis.
  - Coroutine dispatch verification of `GET /status` and `POST /inference`.
  - **Result**: [TEST] Passed (`ALL EVALUATOR & ML ROUTER TESTS PASSED!`).
- **Mobile Regression**:
  - Full Jest suite: 11 passed, 11 total | 100 passed, 100 total.
  - Invariant preservation: Zero protected kinematic files modified.
- **Contract Schema**:
  - `validate.js`: All JSON schemas valid.