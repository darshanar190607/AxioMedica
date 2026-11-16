/**
 * mobile/src/components/PoseCamera.js
 *
 * Camera container component for BlazePose inference.
 *
 * ARCHITECTURAL RULES:
 * - Native VisionCamera imports are ONLY via visionCameraProvider.js
 * - This component is display + lifecycle only; landmark decoding happens
 *   inside visionCameraProvider.js -> poseEngine.js
 * - isActive controls inference; set to false on background / blur / pause / error.
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Camera, RefreshCw, AlertTriangle } from 'lucide-react-native';
import {
  VisionCameraView,
  useVisionPoseDetector,
} from '../engines/providers/visionCameraProvider';
import { poseEngine } from '../engines/poseEngine';
import { useCameraLifecycle } from '../hooks/useCameraLifecycle';
import { COLORS, RADIUS } from '../data/theme';

// ─── Permission Gate Screen ──────────────────────────────────────────────────

function PermissionGate({ status, onRequest, onOpenSettings, onSimulate }) {
  if (status === 'not-available') {
    return (
      <View style={styles.gateRoot}>
        <AlertTriangle size={36} color={COLORS.caution} />
        <Text style={styles.gateTitle}>Camera Unavailable</Text>
        <Text style={styles.gateBody}>
          This device or environment does not support on-device hardware camera acceleration.
          You can continue with simulated kinematics.
        </Text>
        <TouchableOpacity style={[styles.gateBtn, styles.gateBtnSecondary]} onPress={onSimulate} activeOpacity={0.88}>
          <Text style={[styles.gateBtnText, { color: COLORS.charcoal }]}>Use Simulation Mode</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={styles.gateRoot}>
        <Camera size={36} color={COLORS.charcoal} />
        <Text style={styles.gateTitle}>Camera Access Denied</Text>
        <Text style={styles.gateBody}>
          AxioMedica requires camera access to monitor your ankle kinematics in real time.
          Please enable camera permissions in your device settings.
        </Text>
        {Platform.OS !== 'web' && (
          <TouchableOpacity style={styles.gateBtn} onPress={onOpenSettings} activeOpacity={0.88}>
            <Text style={styles.gateBtnText}>Open Settings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.gateBtn, styles.gateBtnSecondary]} onPress={onSimulate} activeOpacity={0.88}>
          <Text style={[styles.gateBtnText, { color: COLORS.charcoal }]}>Continue in Simulation Mode</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 'undetermined' or initial state
  return (
    <View style={styles.gateRoot}>
      <Camera size={36} color={COLORS.charcoal} />
      <Text style={styles.gateTitle}>Camera Access Required</Text>
      <Text style={styles.gateBody}>
        AxioMedica uses on-device BlazePose AI to monitor your ankle kinematics,
        track ROM excursion, and provide real-time coaching feedback.{'\n\n'}
        Video is processed entirely on-device and never saved or transmitted.
      </Text>
      <TouchableOpacity style={styles.gateBtn} onPress={onRequest} activeOpacity={0.88}>
        <Text style={styles.gateBtnText}>Enable Camera</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.gateBtn, styles.gateBtnSecondary]} onPress={onSimulate} activeOpacity={0.88}>
        <Text style={[styles.gateBtnText, { color: COLORS.charcoal }]}>Continue in Simulation Mode</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Camera Hardware Error Screen ────────────────────────────────────────────

function HardwareErrorScreen({ error, onRetry, onSimulate }) {
  return (
    <View style={styles.gateRoot}>
      <AlertTriangle size={36} color={COLORS.stop} />
      <Text style={styles.gateTitle}>Camera Hardware Error</Text>
      <Text style={styles.gateBody}>
        {error?.message || 'Unable to access camera hardware. The camera may be in use by another application.'}
      </Text>
      <TouchableOpacity style={styles.gateBtn} onPress={onRetry} activeOpacity={0.88}>
        <Text style={styles.gateBtnText}>Retry Camera</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.gateBtn, styles.gateBtnSecondary]} onPress={onSimulate} activeOpacity={0.88}>
        <Text style={[styles.gateBtnText, { color: COLORS.charcoal }]}>Switch to Simulation Mode</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main PoseCamera Component ───────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {'front'|'back'} [props.facing='front']
 * @param {Function} [props.onFacingChange]
 * @param {string} [props.modelVariant='lite']
 * @param {boolean} [props.sessionActive=true]
 * @param {Function} [props.onPermissionGranted]
 * @param {Function} [props.onPermissionDenied]
 * @param {Function} [props.onSimulate]
 * @param {React.ReactNode} [props.children]
 */
export function PoseCamera({
  facing = 'front',
  onFacingChange,
  modelVariant = 'lite',
  sessionActive = true,
  onPermissionGranted,
  onPermissionDenied,
  onSimulate,
  children,
}) {
  const isFocused = useIsFocused();

  const {
    facing: activeFacing,
    switchCamera,
    lifecycleStatus,
    error,
    handleCameraError,
    retry,
    markFrameReceived,
    isActive,
    permission,
  } = useCameraLifecycle({
    initialFacing: facing,
    isFocused,
    sessionActive,
    poseEngineInstance: poseEngine,
  });

  // Sync external facing prop if changed from outside
  useEffect(() => {
    if (facing !== activeFacing) {
      switchCamera();
    }
  }, [facing]);

  // Notify parent of facing change
  useEffect(() => {
    if (onFacingChange) {
      onFacingChange(activeFacing);
    }
  }, [activeFacing, onFacingChange]);

  // Feed canonical frame into poseEngine
  const onPoseFrame = React.useCallback((canonicalFrame) => {
    markFrameReceived();
    if (canonicalFrame) {
      const frameToFeed = canonicalFrame.landmarks
        ? canonicalFrame
        : { timestamp: Date.now(), source: 'camera', landmarks: canonicalFrame };
      poseEngine.feedFrame(frameToFeed);
    }
  }, [markFrameReceived]);

  // VisionCamera detector hook
  const { device, frameOutput, isReady } = useVisionPoseDetector({
    onPoseFrame,
    cameraPosition: activeFacing,
    isMirrored: activeFacing === 'front',
    modelVariant,
    enabled: isActive,
  });

  // Check for device errors if active but no device found
  useEffect(() => {
    if (permission.isAvailable && permission.hasPermission && isActive && !device && isReady === false) {
      // Possible device error or missing camera sensor
      const timer = setTimeout(() => {
        if (!device && isActive) {
          handleCameraError({
            code: 'NO_DEVICE',
            message: `No ${activeFacing} camera device found on this system.`,
          });
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [device, activeFacing, isActive, permission, isReady, handleCameraError]);

  // Permission callbacks
  useEffect(() => {
    if (permission.hasPermission && onPermissionGranted) {
      onPermissionGranted();
    }
  }, [permission.hasPermission, onPermissionGranted]);

  useEffect(() => {
    if (!permission.isAvailable && onPermissionDenied) {
      onPermissionDenied('not-available');
    }
  }, [permission.isAvailable, onPermissionDenied]);

  // 1. Error state
  if (lifecycleStatus === 'error') {
    return (
      <HardwareErrorScreen
        error={error}
        onRetry={retry}
        onSimulate={onSimulate}
      />
    );
  }

  // 2. Permission gate
  if (!permission.isAvailable || !permission.hasPermission) {
    const permStatus = !permission.isAvailable ? 'not-available' : (permission.status ?? 'undetermined');
    return (
      <PermissionGate
        status={permStatus}
        onRequest={async () => {
          const granted = await permission.requestPermission();
          if (!granted && onPermissionDenied) onPermissionDenied('denied');
        }}
        onOpenSettings={() => Linking.openSettings()}
        onSimulate={onSimulate}
      />
    );
  }

  // 3. Camera view with lifecycle overlay
  return (
    <View style={StyleSheet.absoluteFill}>
      <VisionCameraView
        device={device}
        frameOutput={frameOutput}
        isActive={isActive}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        {lifecycleStatus === 'reacquiring' && (
          <View style={styles.reacquiringOverlay}>
            <ActivityIndicator size="small" color={COLORS.sage} />
            <Text style={styles.statusText}>Reacquiring camera...</Text>
          </View>
        )}
        {lifecycleStatus === 'initializing' && !isReady && (
          <View style={styles.initOverlay}>
            <RefreshCw size={24} color={COLORS.sage} />
            <Text style={styles.initText}>Starting camera pipeline...</Text>
          </View>
        )}
      </VisionCameraView>
      {children}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gateRoot: {
    flex: 1,
    backgroundColor: '#14261A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  gateTitle: {
    color: COLORS.ivory,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  gateBody: {
    color: '#B2C9B2',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  gateBtn: {
    width: '100%',
    backgroundColor: COLORS.sage,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginBottom: 10,
  },
  gateBtnSecondary: {
    backgroundColor: '#F5E6CC',
  },
  gateBtnText: {
    color: COLORS.ivory,
    fontSize: 15,
    fontWeight: '700',
  },
  initOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,26,13,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  initText: {
    color: COLORS.sage,
    fontSize: 14,
    fontWeight: '600',
  },
  reacquiringOverlay: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: COLORS.ivory,
    fontSize: 12,
    fontWeight: '600',
  },
});
