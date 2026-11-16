# 02. BlazePose TFLite Model Manifest & Licensing

**Date:** 2026-11-07  
**Branch:** `step2/pose-engine`  
**License:** Apache License 2.0 (Google MediaPipe / Google AI Edge)  
**Destination Path:** `mobile/assets/models/`

---

## 1. Acquired Model Artifacts

| Model File | Size (Bytes) | SHA-256 Checksum | Source URL | Purpose |
| :--- | :---: | :--- | :--- | :--- |
| **`pose_landmark_lite.tflite`** | 2,818,358 | `1150dc68a713b80660b90ef46ce4e85c1c781bb88b6e3512cc64e6a685ba5588` | [https://storage.googleapis.com/mediapipe-assets/pose_landmark_lite.tflite](https://storage.googleapis.com/mediapipe-assets/pose_landmark_lite.tflite) | Ultra-low-latency 33-keypoint landmark regression (~15ms on mobile CPU/GPU). Primary candidate for budget devices. |
| **`pose_landmark_full.tflite`** | 6,440,512 | `e9a5c5cb17f736fafd4c2ec1da3b3d331d6edbe8a0d32395855aeb2cdfd64b9f` | [https://storage.googleapis.com/mediapipe-assets/pose_landmark_full.tflite](https://storage.googleapis.com/mediapipe-assets/pose_landmark_full.tflite) | Higher-precision landmark regression with deeper convolutional feature extractors. Candidate for high-accuracy clinical trials. |
| **`pose_detection.tflite`** | 2,959,046 | `9ba9dd3d42efaaba86b4ff0122b06f29c4122e756b329d89dca1e297fd8f866c` | [https://storage.googleapis.com/mediapipe-assets/pose_detection.tflite](https://storage.googleapis.com/mediapipe-assets/pose_detection.tflite) | Single-shot person detector yielding bounding boxes and preliminary torso/hip anchors for two-stage tracking. |

---

## 2. Licensing Compliance

* **Author:** Google LLC (MediaPipe Team / Google AI Edge)
* **License:** Apache License, Version 2.0 (January 2004)
  - Commercial use: Permitted
  - Modification: Permitted
  - Distribution: Permitted
  - Patent grant: Included
  - Requirement: Attribution and copyright notice retained.
* **Redistribution Policy:** Free to bundle into mobile client asset bundles without royalties.

---

## 3. Storage & Packaging

All models are placed in `mobile/assets/models/`.  
Metro bundler configuration in `mobile/metro.config.js` is updated to include `'tflite'` in asset extensions, allowing direct JavaScript asset resolution via `require('./assets/models/pose_landmark_lite.tflite')`.

