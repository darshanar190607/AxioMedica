# ADR-001: On-Device Pose Estimation Only

**Status:** Accepted  
**Date:** 2026-10-07

## Context
Privacy regulations and bandwidth constraints make server-side video processing undesirable.

## Decision
All pose inference runs on-device using TFLite + MediaPipe BlazePose.
Only anonymised keypoint summaries, rep metrics, and scores are uploaded.
Raw video frames are never transmitted or persisted.

## Consequences
- Requires Expo development build (react-native-vision-camera + TFLite plugin).
- Backend ML module only performs post-hoc scoring — no inference.
- Reduces server cost and strengthens user privacy.
