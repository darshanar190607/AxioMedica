/**
 * mobile/src/engines/providers/visionCameraProvider.js
 * 
 * VisionCamera & Fast-TFLite native frame acquisition and ML inference provider.
 * 
 * STRICT ARCHITECTURAL INVARIANT:
 * - This is the ONLY file in the entire repository permitted to import:
 *   * react-native-vision-camera
 *   * react-native-fast-tflite
 *   * react-native-vision-camera-resizer
 *   * react-native-nitro-modules
 * - Must fall back gracefully (no crash, clean status) if native modules
 *   are unavailable (e.g. running in Jest, web, or non-native environments).
 * - Passes raw model tensors to blazeposeAdapter.js; never directly modifies
 *   or bypasses the canonical landmark contract.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { decodeBlazePoseTensors, computeLetterboxParams } from '../adapters/blazeposeAdapter';

// Safe dynamic native bindings with graceful fallback
let NativeCamera = null;
let useNativeCameraDevice = null;
let useNativeFrameOutput = null;
let useNativePermission = null;
let useNativeTensorflowModel = null;
let useNativeResizer = null;
let nativeRunOnJS = null;
let isNativeAvailable = false;

try {
  // VisionCamera
  const VC = require('react-native-vision-camera');
  NativeCamera = VC.Camera;
  useNativeCameraDevice = VC.useCameraDevice;
  useNativeFrameOutput = VC.useFrameOutput;
  useNativePermission = VC.usePermission;

  // Fast-TFLite
  const TFLite = require('react-native-fast-tflite');
  useNativeTensorflowModel = TFLite.useTensorflowModel;

  // Resizer Plugin
  const Resizer = require('react-native-vision-camera-resizer');
  useNativeResizer = Resizer.useResizer;

  // Worklets
  const Worklets = require('react-native-worklets');
  nativeRunOnJS = Worklets.runOnJS;

  isNativeAvailable = true;
} catch (e) {
  isNativeAvailable = false;
}

/**
 * Returns whether native VisionCamera and Fast-TFLite modules are available.
 * @returns {boolean}
 */
export function isVisionCameraAvailable() {
  return isNativeAvailable;
}

/**
 * Bundled model assets mapping.
 */
export const BLAZEPOSE_MODELS = {
  lite: require('../../../assets/models/pose_landmark_lite.tflite'),
  full: require('../../../assets/models/pose_landmark_full.tflite'),
};

/**
 * Custom hook to manage camera permissions and device status.
 * Gracefully handles non-native environments.
 */
export function useVisionCameraPermission() {
  if (!isNativeAvailable || !useNativePermission) {
    return {
      hasPermission: false,
      requestPermission: async () => false,
      status: 'not-available',
      isAvailable: false,
    };
  }

  const { hasPermission, requestPermission } = useNativePermission('camera');
  return {
    hasPermission: Boolean(hasPermission),
    requestPermission,
    status: hasPermission ? 'granted' : 'denied',
    isAvailable: true,
  };
}

/**
 * Custom hook for selecting a camera device.
 * @param {'front' | 'back'} position
 */
export function useVisionCameraDevice(position = 'front') {
  if (!isNativeAvailable || !useNativeCameraDevice) {
    return null;
  }
  return useNativeCameraDevice(position);
}

/**
 * Custom hook providing real-time pose detection from the camera feed.
 * 
 * @param {Object} params
 * @param {Function} params.onPoseFrame - Callback receiving canonical landmark frame
 * @param {'front' | 'back'} [params.cameraPosition='front']
 * @param {boolean} [params.isMirrored=true]
 * @param {'lite' | 'full'} [params.modelVariant='lite']
 * @param {Array<string>} [params.delegates=[]] - Optional hardware delegates (e.g. ['android-gpu'])
 * @param {boolean} [params.enabled=true]
 * @returns {Object} { device, frameOutput, modelState, resizerState, isReady, metrics }
 */
export function useVisionPoseDetector({
  onPoseFrame,
  cameraPosition = 'front',
  isMirrored = true,
  modelVariant = 'lite',
  delegates = [],
  enabled = true,
} = {}) {
  if (!isNativeAvailable) {
    return {
      device: null,
      frameOutput: null,
      modelState: { state: 'not-available', model: null },
      resizerState: { state: 'not-available', resizer: null },
      isReady: false,
      isAvailable: false,
      metrics: {
        fps: 0,
        inferenceMs: 0,
        totalLatencyMs: 0,
        presenceScore: 0,
        status: 'not-available',
      },
    };
  }

  const [metrics, setMetrics] = useState({
    fps: 0,
    inferenceMs: 0,
    totalLatencyMs: 0,
    presenceScore: 0,
    status: 'idle',
  });

  // Track FPS and performance counters
  const lastFrameTimeRef = useRef(Date.now());
  const frameCountRef = useRef(0);
  const fpsWindowStartRef = useRef(Date.now());

  // Safe metrics reporter called via runOnJS
  const reportMetrics = useCallback((infMs, totalMs, presence, status) => {
    frameCountRef.current += 1;
    const now = Date.now();
    const elapsed = now - fpsWindowStartRef.current;

    let currentFps = metrics.fps;
    if (elapsed >= 1000) {
      currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
      frameCountRef.current = 0;
      fpsWindowStartRef.current = now;
    }

    setMetrics({
      fps: currentFps,
      inferenceMs: Math.round(infMs),
      totalLatencyMs: Math.round(totalMs),
      presenceScore: presence,
      status,
    });
  }, [metrics.fps]);

  // Model loading
  const modelAsset = BLAZEPOSE_MODELS[modelVariant] || BLAZEPOSE_MODELS.lite;
  const modelState = useNativeTensorflowModel
    ? useNativeTensorflowModel(modelAsset, delegates)
    : { state: 'not-available', model: null };

  // Resizer setup: 256x256, float32, interleaved RGB (matches BlazePose NHWC [1, 256, 256, 3])
  const resizerState = useNativeResizer
    ? useNativeResizer({
        width: 256,
        height: 256,
        channelOrder: 'rgb',
        dataType: 'float32',
        scaleMode: 'contain',
        pixelLayout: 'interleaved',
      })
    : { state: 'not-available', resizer: null };

  // Resolve camera device
  const device = useVisionCameraDevice(cameraPosition);

  // Set up frame processor
  const frameOutput = useNativeFrameOutput
    ? useNativeFrameOutput({
        pixelFormat: 'rgb',
        onFrame: (frame) => {
          'worklet';
          if (!enabled) {
            frame.dispose();
            return;
          }

          const model = modelState?.model;
          const resizer = resizerState?.resizer;

          if (!model || !resizer) {
            frame.dispose();
            return;
          }

          const frameStart = Date.now();
          const frameWidth = frame.width;
          const frameHeight = frame.height;

          try {
            // 1. Resize and letterbox frame to 256x256 float32 RGB
            const resized = resizer.resize(frame);
            const pixelBuffer = resized.getPixelBuffer();
            resized.dispose();

            // 2. Synchronous model inference
            const infStart = Date.now();
            const rawOutputs = model.runSync([pixelBuffer]);
            const infMs = Date.now() - infStart;

            if (rawOutputs && rawOutputs.length >= 1) {
              const rawLandmarks = new Float32Array(rawOutputs[0]);
              const rawPresence = rawOutputs.length > 1 ? new Float32Array(rawOutputs[1]) : null;

              // 3. Compute letterbox un-padding parameters
              const letterbox = computeLetterboxParams(frameWidth, frameHeight, 256);

              // 4. Decode into canonical landmark contract
              const canonicalFrame = decodeBlazePoseTensors(rawLandmarks, {
                timestamp: Date.now(),
                source: 'camera',
                rawPresence,
                isMirrored,
                letterbox,
              });

              const totalMs = Date.now() - frameStart;

              // 5. Emit to JS thread via runOnJS
              if (nativeRunOnJS && onPoseFrame) {
                nativeRunOnJS(onPoseFrame)(canonicalFrame);
              }
              if (nativeRunOnJS && reportMetrics) {
                nativeRunOnJS(reportMetrics)(infMs, totalMs, canonicalFrame.presence, canonicalFrame.status);
              }
            }
          } catch (err) {
            // Drop frame on error without crashing pipeline
          } finally {
            frame.dispose();
          }
        },
      })
    : null;

  const isReady =
    isNativeAvailable &&
    device != null &&
    modelState?.state === 'loaded' &&
    resizerState?.state === 'ready';

  return {
    device,
    frameOutput,
    modelState,
    resizerState,
    isReady,
    isAvailable: isNativeAvailable,
    metrics,
  };
}

/**
 * High-performance Camera View component wrapper.
 * Encapsulates the native Camera component and safely handles non-native environments.
 */
export function VisionCameraView({
  device,
  frameOutput,
  isActive = true,
  style = StyleSheet.absoluteFill,
  resizeMode = 'cover',
  children,
}) {
  if (!isNativeAvailable || !NativeCamera) {
    return (
      <View style={[style, styles.fallbackContainer]}>
        <Text style={styles.fallbackTitle}>VisionCamera Native Module Unavailable</Text>
        <Text style={styles.fallbackSubtext}>
          Running in fallback/simulated mode. Full on-device ML pose estimation requires a native development build (EAS dev build or Expo prebuild).
        </Text>
        {children}
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[style, styles.fallbackContainer]}>
        <Text style={styles.fallbackSubtext}>No camera device selected.</Text>
        {children}
      </View>
    );
  }

  return (
    <NativeCamera
      style={style}
      device={device}
      isActive={isActive}
      outputs={frameOutput ? [frameOutput] : []}
      resizeMode={resizeMode}
    >
      {children}
    </NativeCamera>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#1C2E1E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fallbackTitle: {
    color: '#8FAF8F',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackSubtext: {
    color: '#D4E2D4',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
