# Clinical Kinematic Accuracy Validation Protocol
**Document Version:** 1.0.0  
**Project:** AxioMedica Tele-Rehabilitation Kinematic Validation  
**Standard Compliance:** STARD (Standards for Reporting Diagnostic Accuracy Studies), HIPAA Privacy Rule §164.514  

---

## 1. Objective and Clinical Rationale
The purpose of this validation protocol is to quantitatively evaluate the agreement and accuracy of AxioMedica’s on-device computer vision engine (BlazePose + `MetricEngine` + `RepCounter`) against clinical gold-standard measurement tools:
1. **Joint Angle Accuracy:** Validated against a calibrated digital orthopedic goniometer (±0.5° precision).
2. **Repetition Counting Accuracy:** Validated against synchronized manual clinician observation.
3. **Environmental Robustness:** Evaluated across a 4-variable test matrix (Lighting, Distance, Clothing, Hardware).

---

## 2. Privacy & Data Integrity: Zero Video Retention Rule
Per AxioMedica core security architecture and HIPAA compliance:
- **No raw video footage, photos, or facial biometric buffers are stored on disk or transmitted over networks.**
- All validation trials capture **anonymized 2D/3D landmark coordinates and timestamps only** (`landmarks.json`).
- Landmarks contain normalized floating-point coordinates `[0.0, 1.0]` corresponding to the 33 BlazePose anatomical keypoints.

---

## 3. Experimental Setup and Reference Standards

### 3.1 Reference Instruments
- **Digital Orthopedic Goniometer:** Baseline reference with dual digital LCD display (0.1° resolution, ±0.5° accuracy).
- **Physical Therapist (PT) Annotator:** Board-certified physical therapist placing goniometric arms on anatomical bony landmarks:
  - **Stationary Arm:** Aligned with the fibular head / lateral midline of the fibula.
  - **Fulcrum:** Center of the lateral malleolus.
  - **Movement Arm:** Parallel to the longitudinal axis of the fifth metatarsal.
- **Tripod Mount:** Device placed at ankle height (0.25m - 0.40m off floor) with 0° pitch tilt.
- **Lux Meter:** Digital light meter measuring ambient illumination at patient ankle level.

### 3.2 Target Exercises
1. **Bilateral Heel Raise (Calf Raise):** Sagittal plane plantarflexion excursion (standing).
2. **Seated Ankle Pump:** Active dorsiflexion and plantarflexion in long-sitting position.

---

## 4. Bland-Altman Statistical Analysis Protocol

For each matched frame/peak $i$, let:
- $\theta_{\text{camera}, i}$ = Angle measured by the vision engine.
- $\theta_{\text{gonio}, i}$ = Angle measured by the digital goniometer.
- $d_i = \theta_{\text{camera}, i} - \theta_{\text{gonio}, i}$ (individual paired difference).
- $m_i = \frac{\theta_{\text{camera}, i} + \theta_{\text{gonio}, i}}{2}$ (mean measurement).

### Key Metrics
1. **Mean Absolute Error (MAE):**
   $$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |d_i|$$
2. **Root Mean Square Error (RMSE):**
   $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N d_i^2}$$
3. **Systematic Bias ($\bar{d}$):**
   $$\bar{d} = \frac{1}{N} \sum_{i=1}^N d_i$$
4. **Standard Deviation of Differences ($s_d$):**
   $$s_d = \sqrt{\frac{1}{N-1} \sum_{i=1}^N (d_i - \bar{d})^2}$$
5. **95% Limits of Agreement (LoA):**
   $$\text{LoA}_{\text{lower}} = \bar{d} - 1.96 \cdot s_d, \quad \text{LoA}_{\text{upper}} = \bar{d} + 1.96 \cdot s_d$$

### Clinical Acceptance Criteria for Telerehabilitation
- **MAE:** $\le 4.5^\circ$
- **Systematic Bias:** within $[-2.0^\circ, +2.0^\circ]$
- **95% Limits of Agreement:** within $[-6.0^\circ, +6.0^\circ]$
- **Rep Counting Accuracy:** $\ge 95.0\%$ (Sensitivity $\ge 95\%$, Precision $\ge 95\%$)

---

## 5. Test Matrix (20 Controlled Trials)

Validation data is recorded across 4 critical real-world dimensions:

| Dimension | Variable Levels | Operational Description |
| :--- | :--- | :--- |
| **Lighting** | **Bright** (500–800 lux)<br>**Dim** (30–60 lux) | Daylight / direct indoor LED vs ambient evening light |
| **Distance** | **Close** (1.0m)<br>**Optimal** (1.8m)<br>**Far** (2.8m) | Distance from smartphone camera lens to subject ankle |
| **Clothing** | **Tight** (athletic compression / bare skin)<br>**Loose** (baggy sweatpants / draped trousers) | Evaluates keypoint occlusion around lateral malleolus |
| **Hardware** | **Pixel 8** (Tensor G3, NNAPI delegate)<br>**Samsung S23** (Snapdragon 8 Gen 2)<br>**iPhone 14** (A15 Bionic)<br>**Budget Android** (Helio G99, CPU fallback) | Evaluates sensor shutter, focal lengths, and processing latency |

---

## 6. Execution Workflow
1. Execute `python ml/validation/generate_benchmark_data.py` to synthesize or load the calibrated 20-recording dataset in `ml/validation/data/recordings.json`.
2. Run `python ml/validation/accuracy_eval.py` to calculate all statistical metrics, Bland-Altman data, and generate the final markdown report table.
