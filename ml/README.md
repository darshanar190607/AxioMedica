# RehabStep AI – ML

On-device pose estimation pipeline and model assets.

## Contents
- models/    — .tflite / .task model bundles (BlazePose, angle classifiers)
- 
otebooks/ — Jupyter notebooks for experimentation & evaluation
- scripts/   — Training, export, and benchmark scripts
- 	ests/     — Unit tests for pre/post-processing utilities

## Design Decisions
- Inference runs **on-device** (TFLite). Raw video never leaves the phone.
- Only keypoint coordinates, rep metrics, and scores are uploaded to the backend.
- MediaPipe BlazePose Full (33 landmarks) is the canonical landmark set.
