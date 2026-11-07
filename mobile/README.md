# RehabStep AI – Mobile (Expo)

React Native (0.86.3) + Expo SDK 57 development build for the RehabStep AI physiotherapy tele-rehabilitation application.

## Quick Start (Development Build)

```bash
cd mobile
npm install

# Prebuild native projects (New Architecture)
npx expo prebuild --platform android --no-install

# Run Android Development Build
npx expo run:android

# Run unit and integration tests
npm test -- --ci
```

## Structure
```text
mobile/
├── App.js                     # Entry component (DO NOT touch layout)
├── index.js                   # Expo registerRootComponent
├── assets/
│   └── models/                # Bundled standalone BlazePose TFLite models
│       ├── pose_landmark_lite.tflite (2.8 MB)
│       ├── pose_landmark_full.tflite (6.4 MB)
│       └── pose_detection.tflite (3.0 MB)
├── src/
│   ├── engines/
│   │   ├── adapters/          # Pure JS tensor decoders (blazeposeAdapter.js)
│   │   ├── providers/         # Native vision bindings (visionCameraProvider.js)
│   │   └── poseEngine.js      # Pure JS singleton engine with One-Euro filter
│   ├── pose/                  # Downstream kinematic analyzers
│   │   ├── metricEngine.js    # 3D angle and vertical displacement calculation
│   │   ├── repCounter.js      # Hysteresis state machine for rep counting
│   │   ├── formChecker.js     # Safe AST condition evaluation and cues
│   │   ├── calibration.js     # Baseline range of motion (ROM) tracking
│   │   └── smoothing.js       # One Euro Filter implementation
│   ├── screens/               # Clinical UI screens + PoseTestScreen dev harness
│   ├── components/            # SkeletonOverlay, BottomNav, ExerciseCard, UI.js
│   ├── navigation/            # AppNavigator
│   ├── data/                  # theme.js, patientData.js
│   ├── services/              # API client, auth, sync
│   ├── hooks/                 # useAuth, useSession, usePose
│   ├── store/                 # App-wide state (Zustand)
│   └── db/                    # expo-sqlite offline storage
└── contracts/
    └── validateLandmarks.js   # Landmark schema runtime validator
```

## Key Rules & Invariants
- **Camera Frames Stay On-Device:** Video frames are processed entirely on-device via GPU `vision-camera-resizer` and `react-native-fast-tflite`. Raw video frames are never transmitted over the network or saved to disk.
- **Contract-First Pose Architecture:** Provider and adapter adapt to the locked 33-point BlazePose landmark contract. Downstream kinematic engines (`RepCounter`, `MetricEngine`, `FormChecker`, `CalibrationTracker`) are never modified.
- **Strict Layering:** Only files inside `src/engines/providers/` may import native vision dependencies. Adapters, engine, and downstream modules remain 100% pure JavaScript.
- **Developer Test Harness:** Use `PoseTestScreen` (route `PoseTest`) to test on-device camera inference, FPS counters, and skeleton overlay in isolation.
