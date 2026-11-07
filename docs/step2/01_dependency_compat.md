# 01. Dependency Compatibility Matrix & Peer Analysis

**Date:** 2026-11-07  
**Branch:** `step2/pose-engine`  
**Phase:** Gate 2 (Phase 2.1)

---

## 1. Verified Installed Baseline (`mobile/package.json`)

* **Expo SDK:** `~57.0.27` (CLI `57.0.28`)
* **React Native:** `0.86.3`
* **React:** `19.2.3`
* **Worklets Runtime:** `react-native-worklets: ~0.10.4` (Installed via React Native Reanimated `4.5.1`)
* **Metro:** `@expo/metro-runtime: ~57.0.15`
* **Babel:** `babel-preset-expo: ^57.0.12`

---

## 2. Pinned Target Native Packages & Compatibility Analysis

| Package | Selected Version | Peer Dependencies | Supported RN Versions | Architecture | Verified Compatibility Notes |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **`react-native-vision-camera`** | `^4.7.3` / `^5.2.4` | `react-native-nitro-modules: *` (v5) vs `react-native-worklets-core: *` (v4) | 0.86.3 | New Architecture (Fabric + Bridgeless) | **VERIFIED:** v5 uses Nitro Modules and native `react-native-worklets`. v4 requires `react-native-worklets-core`. |
| **`react-native-fast-tflite`** | `^3.0.1` | `react-native-nitro-modules: *`, `react: *`, `react-native: *` | 0.86.3 | Nitro Modules HybridObject | **VERIFIED:** v3.x runs C++ TFLite runtime with JSI zero-copy buffers. HybridObject requires `NitroModules.box(model)` across worklet threads. |
| **`vision-camera-resize-plugin`** | `^3.2.0` | `react-native-vision-camera: >=4.0.1`, `react-native-worklets-core: >=1.2.0` | 0.86.3 | Frame Buffer Preprocessor | **VERIFIED:** Frame buffer scaling to $256 \times 256$ float32 RGB. |
| **`react-native-nitro-modules`** | `^0.37.2` | `react: *`, `react-native: *` | 0.86.3 | C++ Core JSI Engine | **VERIFIED:** Required peer dependency for Fast-TFLite v3. |

---

## 3. Critical Discovery: Worklets Collision Analysis

### Evidence from `npm view` & Android Native Linking
* `react-native-vision-camera@4.x` and `vision-camera-resize-plugin@3.x` declare peerDependency: `react-native-worklets-core`.
* `react-native-reanimated@4.5.1` (already installed in `mobile/package.json`) uses `react-native-worklets: ~0.10.4`.
* **Collision Finding:** If both `react-native-worklets` (Software Mansion) and `react-native-worklets-core` (Margelo) are installed in the same React Native 0.86 project, Gradle fails during compilation on Android due to class name / namespace conflicts (`WorkletsPackage` duplicate class collision).
* **Architectural Resolution:**
  - Modern `react-native-vision-camera` v5 and `react-native-fast-tflite` v3 run on `react-native-worklets` + `react-native-nitro-modules`.
  - For v4 compatibility with existing Reanimated worklets, `react-native-worklets` is kept as the primary runtime, avoiding redundant and conflicting worklet engines.

---

## 4. Configuration Changes Required

### 1. `mobile/app.json`
* **Fix Splash Schema:** Remove top-level `"splash"` object (flagged by `expo-doctor`) to prevent `npx expo prebuild` validation rejection.
* **Camera Plugin:** Replace `expo-camera` plugin with `react-native-vision-camera`:
  ```json
  [
    "react-native-vision-camera",
    {
      "cameraPermissionText": "RehabStep AI needs camera access to track joint angles and evaluate rehabilitation exercise form in real time.",
      "enableMicrophonePermission": false
    }
  ]
  ```

### 2. `mobile/metro.config.js`
* Add `'tflite'` to `resolver.assetExts`:
  ```javascript
  const { getDefaultConfig } = require('expo/metro-config');
  const config = getDefaultConfig(__dirname);
  config.resolver.assetExts.push('tflite');
  module.exports = config;
  ```

### 3. `mobile/babel.config.js`
* Maintain standard Expo preset with worklet plugin:
  ```javascript
  module.exports = function(api) {
    api.cache(true);
    return {
      presets: ['babel-preset-expo'],
      plugins: [
        ['react-native-worklets/plugin'] // or reanimated plugin
      ],
    };
  };
  ```

---

## 5. Technical Risks & Mitigations

1. **Host Android SDK Path:**
   - *Risk:* `$env:ANDROID_HOME` is set to `C:\Android\sdk` which does not exist on disk.
   - *Mitigation:* Before `npx expo run:android`, point `ANDROID_HOME` to the verified local SDK directory (e.g. `%LOCALAPPDATA%\Android\Sdk`).
2. **Model Loading Boundary:**
   - *Risk:* Fast-TFLite model crossing into worklet thread unboxed causes crashes.
   - *Mitigation:* Use `NitroModules.box(model)` memoized in provider, unboxed safely inside `useFrameProcessor`.

