# AxioMedica / RehabStep AI

Ankle-injury rehabilitation mobile app with on-device pose tracking and AI-driven exercise plans.

## Monorepo Structure

| Folder     | Purpose |
|------------|---------|
| mobile/  | React Native + Expo app (screens, pose pipeline, offline DB) |
| ackend/ | FastAPI + PostgreSQL REST API |
| ml/      | TFLite model assets, training & evaluation scripts |
| docs/    | Shared contracts (session payload, pose config, OpenAPI) and ADRs |

## Getting Started
See the README inside each sub-folder.

## Privacy & Safety
- Raw video never leaves the device.
- All passwords hashed with argon2.
- AI exercise plans require clinician approval before activation.
- Minimal PII in logs.
