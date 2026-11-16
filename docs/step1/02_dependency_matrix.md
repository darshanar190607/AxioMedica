# 02. Dependency and Environment Audit & Camera Decision Gate

**Date:** 2026-11-07  
**Project:** AxioMedica / RehabStep AI  
**Scope:** Mobile (Expo / React Native) & Backend (FastAPI / PostgreSQL)

---

## 1. Recorded Version Matrix

### Mobile Core Stack (`mobile/package.json`)
| Component | Declared Version | Resolved / Installed Version | Status / Notes |
| :--- | :--- | :--- | :--- |
| **Expo SDK** | `~57.0.27` | `57.0.27` (CLI `57.0.28`) | Current SDK 57 release |
| **React Native** | `0.86.3` | `0.86.3` | New Architecture default |
| **React** | `19.2.3` | `19.2.3` | React 19 baseline |
| **expo-camera** | `~57.0.6` | `57.0.6` | UI preview only (no frame processors) |
| **react-native-reanimated** | `4.5.1` | `4.5.1` | UI animations & shared values |
| **react-native-worklets** | `~0.10.4` | `0.10.4` | Worklet multithreading runtime |
| **react-native-safe-area-context**| `~5.7.0` | `5.7.0` | Inset management |
| **react-native-screens** | `~4.26.0` | `4.26.0` | Screen container primitives |
| **react-native-svg** | `^15.16.0` | `15.16.0` | Skeleton overlay rendering |
| **expo-sqlite** | `~57.0.4` | `57.0.4` | Offline-first local session cache |
| **expo-secure-store** | `~57.0.4` | `57.0.4` | Encrypted JWT & auth token storage |
| **@supabase/supabase-js** | `^2.118.0`| `2.118.0` | Remote cloud backend integration |

### Backend & Database Stack (`backend/` & `docker-compose.yml`)
| Component | Project Version | Environment / Freeze Version | Status / Notes |
| :--- | :--- | :--- | :--- |
| **Python** | `3.13.5` | `3.13.5` | Python runtime |
| **FastAPI** | `==0.115.5` | `0.116.1` (pip freeze) | ASGI REST API framework |
| **Uvicorn** | `==0.32.1` | `0.35.0` (pip freeze) | ASGI server |
| **SQLAlchemy** | `==2.0.36` | `2.0.51` (pip freeze) | Async ORM (asyncio) |
| **asyncpg** | `==0.30.0` | `0.30.0` | High-performance PostgreSQL async driver |
| **Alembic** | `==1.14.0` | `1.14.0` | DB migration tool |
| **Pydantic** | `==2.10.1` | `2.11.7` (pip freeze) | Data validation & schemas |
| **PostgreSQL** | `16-alpine` | `16` (Docker service `axiomedica_postgres`) | Primary relational database |

> Full pip freeze snapshot has been saved to: `docs/step1/backend_freeze.txt`

---

## 2. `npx expo-doctor` Diagnostics & Recommendations

`expo-doctor` evaluated 21 project checks. **18 passed, 3 checks flagged attention points:**

1. **`app.json` Schema Check:**
   - *Finding:* `Field: splash - Additional property "splash" is not allowed.`
   - *Reason:* In Expo SDK 57, splash screen configuration is governed via `expo-splash-screen` plugin or the `splash` object structure under modern configuration guidelines.
   - *Action:* Migrate splash config to `expo-splash-screen` plugin in `app.json`.

2. **React Native Directory Metadata:**
   - *Finding:* `expo-av` is flagged as unmaintained in the New Architecture index; `react-native-vector-icons` has unindexed metadata.
   - *Action:* If audio feedback is needed, migrate from `expo-av` to `expo-audio` (modern SDK 57 recommendation). `lucide-react-native` is already used for icons throughout the app, minimizing reliance on `react-native-vector-icons`.

3. **Minor / Patch Dependency Alignment:**
   - *Finding:*
     - `react-native-svg`: found `15.16.0`, expected `15.15.4`
     - `@expo/metro-runtime`: found `57.0.16`, expected `~57.0.18`
     - `expo`: found `57.0.27`, expected `~57.0.32`
     - `react-native-worklets`: found `0.10.4`, expected `0.10.1`
   - *Action:* Run `npx expo install --check` during development build prep to synchronize patch versions.

---

## 3. Decision Gate: Camera & ML Pipeline Path

### Options Evaluated

| Option | Architecture | Pros | Cons | Viability for AxioMedica |
| :--- | :--- | :--- | :--- | :--- |
| **Option A** | **VisionCamera + Native Plugin / TFLite** | On-device, 100% offline-capable, lowest latency (30-60 FPS), zero video leaves device (strict HIPAA/GDPR privacy compliance) | Requires Expo Prebuild / Development Build (no Expo Go) | **Selected Path** |
| **Option B** | **Frame → Backend** | Simple client implementation using HTTP / WebSockets | Extreme network bandwidth requirement, high latency (150-500ms jitter), unusable offline, violates privacy rules in ADR-001 | **Rejected** |
| **Option C** | **WebView MediaPipe** | Fast JavaScript browser-based prototyping | Heavy bridge serialization overhead, thermal throttling, poor framerate stability (<15 FPS on budget Android) | **Rejected** |

### Selected Architecture: Option A (VisionCamera + On-Device ML)

#### Decision Rationale
1. **Adherence to ADR-001:** `docs/adr/ADR-001-on-device-pose.md` strictly dictates:
   - *"All pose inference runs on-device using TFLite + MediaPipe BlazePose."*
   - *"Only anonymised keypoint summaries, rep metrics, and scores are uploaded. Raw video frames are never transmitted or persisted."*
   Option B directly violates ADR-001.
2. **Clinical Latency Requirements:** Real-time auditory and visual biomechanical feedback during ankle dorsiflexion / heel raises requires frame-to-feedback latency under 40ms. On-device frame processing is the only architecture capable of sustaining 30+ FPS feedback loops without network jitter.

#### Verification Against Installed Versions
- **React Native 0.86.3 & New Architecture:**
  - Expo SDK 57 enforces the New Architecture (Bridgeless + Fabric).
  - Modern `react-native-vision-camera` (v4.x / v5.x) and `react-native-nitro-modules` fully support React Native 0.86 with zero-copy JSI buffers.
- **Worklets Integration:**
  - VisionCamera's `useFrameProcessor` executes frame callback worklets on a dedicated background camera thread.
  - The project already has `react-native-worklets: ~0.10.4` and `react-native-reanimated: 4.5.1` installed.
- **MediaPipe / TFLite Execution Strategy:**
  - **Primary Approach:** Use `react-native-vision-camera` combined with `react-native-fast-tflite` + `vision-camera-resize-plugin` (Marc Rousavy / Margelo). This loads MediaPipe BlazePose / PoseLandmarker `.tflite` models directly on hardware acceleration delegates (CoreML on iOS, GPU / NNAPI on Android) without writing fragile custom native glue code.
  - **Fallback / Alternative:** If MediaPipe Task Vision `.task` bundle features (e.g., full 33 3D landmark segmentation) are required beyond standard TFLite graph execution, implement a custom `FrameProcessorPlugin` subclassing VisionCamera's native C++/Swift/Kotlin plugin interface with Google MediaPipe Tasks Vision (`MPImage` / `MediaPipeImage`).
- **Development Build Strategy (`expo prebuild`):**
  - As confirmed by `mobile/README.md`, the repository is configured to use `npx expo prebuild` to generate native `android/` and `ios/` folders for EAS / local development builds (`npx expo run:android` / `npx expo run:ios`).
  - Expo Go is neither required nor recommended for production vision processing.

---

## 4. Verification Checkpoint Summary
- [x] Mobile `package.json` dependencies audited.
- [x] Expo CLI and Expo SDK versions recorded (`57.0.28` / `57.0.27`).
- [x] `npx expo-doctor` executed and findings documented.
- [x] Backend Python (`3.13.5`), FastAPI (`0.115.5`/`0.116.1`), and PostgreSQL (`16`) recorded.
- [x] `docs/step1/backend_freeze.txt` generated.
- [x] Camera path decision gate resolved (Option A: VisionCamera + On-Device ML).

