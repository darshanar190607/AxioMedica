# RehabStep AI – Mobile (Expo)

React Native + Expo development build for the RehabStep AI rehabilitation app.

## Quick Start
`ash
cd mobile
npm install
npx expo prebuild          # generates ios/ and android/
npx expo run:android       # or run:ios
`

## Structure
`
mobile/
├── App.js                 # Entry component (DO NOT touch layout)
├── index.js               # Expo registerRootComponent
├── src/
│   ├── screens/           # 9 finished UI screens (DO NOT redesign)
│   ├── components/        # BottomNav, ExerciseCard, UI.js
│   ├── navigation/        # AppNavigator
│   ├── data/              # theme.js, patientData.js (mock → replace)
│   ├── services/          # API client, auth, sync
│   ├── hooks/             # useAuth, useSession, usePose
│   ├── store/             # App-wide state (Zustand)
│   ├── pose/              # TFLite BlazePose pipeline
│   └── db/                # expo-sqlite offline storage
└── assets/
`

## Key Rules
- Do NOT change styling or layout of existing screens.
- Pose inference runs on-device — never upload raw video.
- Offline sessions are synced via idempotent client_uuid.
