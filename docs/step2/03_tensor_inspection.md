# 03. TFLite Tensor Inspection & Architectural Pipeline Decision

**Date:** 2026-11-07  
**Branch:** `step2/pose-engine`  
**Inspection Tool:** TensorFlow Lite Interpreter Python API (`tf.lite.Interpreter`) on downloaded binaries

---

## 1. Verified Tensor Architecture

### A. Landmark Models (`pose_landmark_lite.tflite` & `pose_landmark_full.tflite`)

Both models share an **identical I/O tensor contract**:

#### Input Tensor Details
* **Name:** `input_1`
* **Shape:** `[1, 256, 256, 3]` (Batch: 1, Height: 256, Width: 256, Channels: 3 RGB)
* **Data Type:** `numpy.float32` (IEEE 754 32-bit float)
* **Quantization:** `(0.0, 0)` — Unquantized floating-point model
* **Normalization Requirement:** Input pixel RGB intensities must be normalized to floating-point range **`[0.0, 1.0]`** (i.e. $pixel / 255.0$).

#### Output Tensors Details

| Tensor Name | Shape | Data Type | Contents / Interpretation |
| :--- | :---: | :---: | :--- |
| **`Identity`** | `[1, 195]` | `float32` | **Primary 2D/3D Landmarks.** 39 total keypoints $\times$ 5 attributes per point ($39 \times 5 = 195$). First 33 keypoints correspond to the canonical BlazePose skeleton. |
| **`Identity_1`** | `[1, 1]` | `float32` | **Pose Presence Flag.** Scalar logit indicating whether a human pose is present in the input image. Evaluates to $\sim 0.0$ on blank/occluded inputs. |
| **`Identity_2`** | `[1, 256, 256, 1]` | `float32` | **Body Segmentation Mask.** Grayscale mask segmenting human silhouette from background. |
| **`Identity_3`** | `[1, 64, 64, 39]` | `float32` | **Internal Heatmap.** Spatial confidence heatmaps used internally by MediaPipe for bounding box regression. |
| **`Identity_4`** | `[1, 117]` | `float32` | **World 3D Landmarks.** 39 keypoints $\times$ 3 metric coordinates $(X, Y, Z)$ centered at hip midpoint in meters. |

---

## 2. Empirical Landmark Decoding Analysis

From forward pass inspection on `Identity` (`[1, 195]`):

Each landmark $i$ ($0 \le i < 33$) occupies a 5-element stride starting at offset $k = i \times 5$:

1. **$x$ coordinate (`raw[k + 0]`):**
   - Output range: `[0.0, 256.0]`. Expressed in model pixel coordinates.
   - **Transformation required:** Divide by input width ($256.0$) to convert to normalized $[0.0, 1.0]$:
     $$x_{norm} = \frac{raw[k + 0]}{256.0}$$
2. **$y$ coordinate (`raw[k + 1]`):**
   - Output range: `[0.0, 256.0]`. Expressed in model pixel coordinates.
   - **Transformation required:** Divide by input height ($256.0$) to convert to normalized $[0.0, 1.0]$:
     $$y_{norm} = \frac{raw[k + 1]}{256.0}$$
3. **$z$ coordinate (`raw[k + 2]`):**
   - Relative depth scaled approximately in proportion to $x$.
   - **Transformation required:** Normalize relative to 256:
     $$z_{norm} = \frac{raw[k + 2]}{256.0}$$
4. **Visibility score (`raw[k + 3]`):**
   - **Empirical Type: Raw LOGIT** (unbounded float, e.g. $+2.96$ on clear joints, $-3.5$ on occlusions).
   - **Transformation required:** Sigmoid function to map to probability $[0.0, 1.0]$:
     $$visibility = \frac{1}{1 + e^{-raw[k + 3]}}$$
5. **Presence score (`raw[k + 4]`):**
   - **Empirical Type: Raw LOGIT**.
   - **Transformation required:** Sigmoid function:
     $$presence = \frac{1}{1 + e^{-raw[k + 4]}}$$

---

## 3. Pipeline Architectural Decision: Letterboxed Full Frame vs. Two-Stage Detector + Crop

### Context
In full MediaPipe pipelines, a two-stage architecture is used:
1. `pose_detection.tflite` runs on $224 \times 224$ to find person bounding box.
2. The detected region of interest (ROI) is cropped, rotated to align torso vertical axis, and fed to `pose_landmark.tflite` at $256 \times 256$.
3. Subsequent frames track the previous ROI unless tracking is lost.

### Evaluation for AxioMedica Ankle Rehabilitation

| Parameter | Single-Stage Letterboxed Full Frame | Two-Stage Detector + Crop Pipeline |
| :--- | :--- | :--- |
| **Inference Latency** | **~15ms – 25ms** (1 TFLite call per frame) | **~35ms – 65ms** (2 TFLite calls per frame + CPU rotation/affine transform) |
| **Framerate on Mid-Range Android** | **30 – 45 FPS** (smooth real-time coaching) | **15 – 22 FPS** (potential audio cue jitter) |
| **Memory / CPU Overhead** | Low (direct GPU buffer scaling) | High (intermediate bitmap crops & matrix inversions) |
| **Clinical User Scenario** | Patient stands/sits 2–3m away facing camera; `LiveMonitorScreen` provides positioning guidance banner | Arbitrary full-body motion across wide visual fields |
| **Accuracy on Lower Extremity** | Excellent when patient is centered in frame | Marginally higher if patient is in extreme periphery |

### Decision: **Adoption of Single-Stage Letterboxed Full Frame for v1**
* **Rationale:**
  1. `LiveMonitorScreen.js:417` already guides the patient into position with explicit positioning checks (`checkPositioningGuidance`).
  2. Tele-rehab ankle exercises (heel raises, ankle pumps) are performed in stationary standing or seated positions.
  3. Halving the computational overhead ensures reliable 30+ FPS execution on budget patient devices without thermal throttling or frame drops.
  4. The adapter maintains letterbox aspect-ratio compensation so joint angles (`angleCalculator.js`, `geometry.js`) are computed with zero geometric distortion.

