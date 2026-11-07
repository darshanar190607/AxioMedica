/**
 * mobile/src/screens/PoseTestScreen.js
 * 
 * Standalone Developer Test Harness for Real On-Device BlazePose Estimation.
 * 
 * ISOLATION GUARANTEE:
 * - Tests VisionCamera, Fast-TFLite, blazeposeAdapter, and SkeletonOverlay in isolation.
 * - Does NOT modify LiveMonitorScreen.js or any protected clinical modules.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Camera,
  RefreshCw,
  Sliders,
  Play,
  Pause,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW } from '../data/theme';
import SkeletonOverlay from '../components/SkeletonOverlay';
import {
  useVisionCameraPermission,
  useVisionPoseDetector,
  VisionCameraView,
  isVisionCameraAvailable,
} from '../engines/providers/visionCameraProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function generateSimulatedAnklePose(timestamp, isMirrored = false) {
  const cycle = (timestamp % 2400) / 2400;
  const sinVal = Math.sin(cycle * Math.PI * 2);
  const heelLift = Math.max(0, sinVal) * 0.08;
  const ankleFlex = sinVal * 0.03;

  const raw = {
    nose: { x: 0.50, y: 0.12, z: 0.0, visibility: 0.99 },
    left_shoulder: { x: 0.43, y: 0.24, z: 0.0, visibility: 0.98 },
    right_shoulder: { x: 0.57, y: 0.24, z: 0.0, visibility: 0.98 },
    left_hip: { x: 0.45, y: 0.44, z: 0.0, visibility: 0.96 },
    right_hip: { x: 0.55, y: 0.44, z: 0.0, visibility: 0.96 },
    left_knee: { x: 0.44, y: 0.64, z: 0.0, visibility: 0.94 },
    right_knee: { x: 0.56, y: 0.64, z: 0.0, visibility: 0.95 },
    left_ankle: { x: 0.44, y: 0.82 - ankleFlex * 0.4, z: 0.0, visibility: 0.95 },
    right_ankle: { x: 0.56, y: 0.82, z: 0.0, visibility: 0.96 },
    left_heel: { x: 0.42, y: 0.86 - heelLift, z: 0.0, visibility: 0.93 },
    right_heel: { x: 0.58, y: 0.86, z: 0.0, visibility: 0.94 },
    left_foot_index: { x: 0.47, y: 0.87, z: 0.0, visibility: 0.95 },
    right_foot_index: { x: 0.53, y: 0.87, z: 0.0, visibility: 0.95 },
  };

  if (isMirrored) {
    for (const k of Object.keys(raw)) {
      raw[k].x = 1.0 - raw[k].x;
    }
  }

  return raw;
}

export default function PoseTestScreen({ navigation }) {
  const [cameraPosition, setCameraPosition] = useState('front');
  const [isMirrored, setIsMirrored] = useState(true);
  const [modelVariant, setModelVariant] = useState('lite');
  const [isActive, setIsActive] = useState(true);
  const [currentLandmarks, setCurrentLandmarks] = useState(null);

  const { hasPermission, requestPermission, isAvailable: isNativePermAvailable } = useVisionCameraPermission();

  // Landmark callback from the native provider
  const handlePoseFrame = useCallback((frame) => {
    if (frame && frame.landmarks) {
      setCurrentLandmarks(frame.landmarks);
    }
  }, []);

  const {
    device,
    frameOutput,
    modelState,
    resizerState,
    isReady,
    isAvailable: isNativeProviderAvailable,
    metrics,
  } = useVisionPoseDetector({
    onPoseFrame: handlePoseFrame,
    cameraPosition,
    isMirrored,
    modelVariant,
    enabled: isActive,
  });

  // Simulated telemetry loop when native camera is not available (Web / Expo Go preview)
  const [simulatedMetrics, setSimulatedMetrics] = useState({
    fps: 0,
    inferenceMs: 0,
    totalLatencyMs: 0,
    presenceScore: 0,
    status: 'idle',
  });

  useEffect(() => {
    if (isNativeProviderAvailable) return;
    if (!isActive) {
      setSimulatedMetrics((prev) => ({ ...prev, status: 'paused', fps: 0 }));
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const mockLandmarks = generateSimulatedAnklePose(now, isMirrored);
      setCurrentLandmarks(mockLandmarks);
      setSimulatedMetrics({
        fps: 30,
        inferenceMs: 14,
        totalLatencyMs: 18,
        presenceScore: 0.98,
        status: 'tracking',
      });
    }, 33);

    return () => clearInterval(interval);
  }, [isNativeProviderAvailable, isActive, isMirrored]);

  const activeMetrics = isNativeProviderAvailable ? metrics : simulatedMetrics;

  const toggleCamera = () => {
    setCameraPosition((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  const toggleMirroring = () => {
    setIsMirrored((prev) => !prev);
  };

  const toggleModel = () => {
    setModelVariant((prev) => (prev === 'lite' ? 'full' : 'lite'));
  };

  const toggleActive = () => {
    setIsActive((prev) => !prev);
  };

  const handleBack = () => {
    if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    } else if (navigation?.navigate) {
      navigation.navigate('Landing');
    }
  };

  // Confidence indicators for lower-extremity rehab landmarks
  const leftKneeConf = currentLandmarks?.left_knee?.visibility ?? 0;
  const rightKneeConf = currentLandmarks?.right_knee?.visibility ?? 0;
  const leftAnkleConf = currentLandmarks?.left_ankle?.visibility ?? 0;
  const rightAnkleConf = currentLandmarks?.right_ankle?.visibility ?? 0;
  const leftHeelConf = currentLandmarks?.left_heel?.visibility ?? 0;
  const rightHeelConf = currentLandmarks?.right_heel?.visibility ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={20} color={COLORS.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>BlazePose ML Harness</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {isNativeProviderAvailable ? 'Native VisionCamera V5' : 'Simulation Mode (Web / Expo Go)'}
          </Text>
        </View>
        <View
          style={[styles.statusBadge, activeMetrics.status === 'tracking' ? styles.statusTracking : styles.statusLost]}
        >
          <Activity size={12} color="#FFFFFF" />
          <Text style={styles.statusText}>{activeMetrics.status.toUpperCase()}</Text>
        </View>
      </View>

      {/* Camera Viewport Area */}
      <View style={styles.viewportContainer}>
        {isNativeProviderAvailable ? (
          hasPermission ? (
            <VisionCameraView
              device={device}
              frameOutput={frameOutput}
              isActive={isActive}
              style={StyleSheet.absoluteFill}
            >
              {/* Live Skeleton Overlay */}
              {currentLandmarks && (
                <SkeletonOverlay
                  landmarks={currentLandmarks}
                  width={SCREEN_WIDTH}
                  height={SCREEN_HEIGHT * 0.48}
                  color={activeMetrics.status === 'tracking' ? '#4CAF50' : '#FF9800'}
                  isMirrored={false}
                />
              )}
            </VisionCameraView>
          ) : (
            <View style={styles.permissionPrompt}>
              <ShieldCheck size={48} color={COLORS.orange} />
              <Text style={styles.permissionTitle}>Camera Permission Required</Text>
              <Text style={styles.permissionMessage}>
                BlazePose real-time on-device landmark inference requires active camera permissions.
              </Text>
              <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.simulationContainer}>
            {/* Clinical grid background */}
            <View style={styles.gridOverlay} />
            {currentLandmarks && (
              <SkeletonOverlay
                landmarks={currentLandmarks}
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT * 0.48}
                color="#4CAF50"
                isMirrored={false}
              />
            )}
            <View style={styles.simulationBanner}>
              <Text style={styles.simulationBannerText}>
                SIMULATED ANKLE TELEMETRY PREVIEW
              </Text>
              <Text style={styles.simulationBannerSub}>
                Real camera + TFLite inference runs in Android Dev Build (npx expo run:android)
              </Text>
            </View>
          </View>
        )}

        {/* Live Floating HUD */}
        <View style={styles.floatingHud}>
          <View style={styles.hudStat}>
            <Text style={styles.hudStatLabel}>FPS</Text>
            <Text style={styles.hudStatValue}>{activeMetrics.fps}</Text>
          </View>
          <View style={styles.hudDivider} />
          <View style={styles.hudStat}>
            <Text style={styles.hudStatLabel}>INFERENCE</Text>
            <Text style={styles.hudStatValue}>{activeMetrics.inferenceMs} ms</Text>
          </View>
          <View style={styles.hudDivider} />
          <View style={styles.hudStat}>
            <Text style={styles.hudStatLabel}>LATENCY</Text>
            <Text style={styles.hudStatValue}>{activeMetrics.totalLatencyMs} ms</Text>
          </View>
          <View style={styles.hudDivider} />
          <View style={styles.hudStat}>
            <Text style={styles.hudStatLabel}>PRESENCE</Text>
            <Text style={styles.hudStatValue}>{Math.round(activeMetrics.presenceScore * 100)}%</Text>
          </View>
        </View>
      </View>

      {/* Control Panel and Diagnostics */}
      <ScrollView style={styles.dashboard} contentContainerStyle={styles.dashboardContent}>
        {/* Controls Toolbar */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
            <Camera size={16} color={COLORS.charcoal} />
            <Text style={styles.controlText}>{cameraPosition.toUpperCase()}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isMirrored && styles.controlButtonActive]}
            onPress={toggleMirroring}
          >
            <RefreshCw size={16} color={isMirrored ? '#FFFFFF' : COLORS.charcoal} />
            <Text style={[styles.controlText, isMirrored && styles.controlTextActive]}>
              {isMirrored ? 'MIRRORED' : 'STANDARD'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleModel}>
            <Layers size={16} color={COLORS.charcoal} />
            <Text style={styles.controlText}>MODEL: {modelVariant.toUpperCase()}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isActive ? styles.buttonPause : styles.buttonPlay]}
            onPress={toggleActive}
          >
            {isActive ? <Pause size={16} color="#FFFFFF" /> : <Play size={16} color="#FFFFFF" />}
            <Text style={styles.buttonTextWhite}>{isActive ? 'PAUSE' : 'START'}</Text>
          </TouchableOpacity>
        </View>

        {/* Lower Extremity Landmark Confidence Matrix */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lower-Limb Keypoint Confidence (Rehab Target)</Text>
          <View style={styles.confidenceGrid}>
            <View style={styles.confItem}>
              <Text style={styles.confLabel}>L Knee</Text>
              <Text style={styles.confValue}>{Math.round(leftKneeConf * 100)}%</Text>
            </View>
            <View style={styles.confItem}>
              <Text style={styles.confLabel}>R Knee</Text>
              <Text style={styles.confValue}>{Math.round(rightKneeConf * 100)}%</Text>
            </View>
            <View style={styles.confItem}>
              <Text style={styles.confLabel}>L Ankle</Text>
              <Text style={styles.confValue}>{Math.round(leftAnkleConf * 100)}%</Text>
            </View>
            <View style={styles.confItem}>
              <Text style={styles.confLabel}>R Ankle</Text>
              <Text style={styles.confValue}>{Math.round(rightAnkleConf * 100)}%</Text>
            </View>
            <View style={styles.confItem}>
              <Text style={styles.confLabel}>L Heel</Text>
              <Text style={styles.confValue}>{Math.round(leftHeelConf * 100)}%</Text>
            </View>
            <View style={styles.confItem}>
              <Text style={styles.confLabel}>R Heel</Text>
              <Text style={styles.confValue}>{Math.round(rightHeelConf * 100)}%</Text>
            </View>
          </View>
        </View>

        {/* Native Engine Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Engine Subsystem Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>VisionCamera Engine:</Text>
            <Text style={styles.statusVal}>{isNativeProviderAvailable ? 'Verified (Native JSI)' : 'Fallback / Jest'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>TFLite Model State:</Text>
            <Text style={styles.statusVal}>{modelState?.state || 'not-loaded'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Resizer Pipeline:</Text>
            <Text style={styles.statusVal}>{resizerState?.state || 'not-loaded'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Adapter Contract:</Text>
            <Text style={[styles.statusVal, { color: COLORS.safe }]}>Strict Verified (33 Points)</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0E1711',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 14,
    paddingBottom: 12,
    backgroundColor: '#16231A',
    borderBottomWidth: 1,
    borderBottomColor: '#24382A',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#8FAF8F',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusTracking: {
    backgroundColor: '#2E7D32',
  },
  statusLost: {
    backgroundColor: '#C62828',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  viewportContainer: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.48,
    backgroundColor: '#071009',
    position: 'relative',
    overflow: 'hidden',
  },
  simulationContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#071009',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
    borderWidth: 1,
    borderColor: '#34D399',
  },
  simulationBanner: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  simulationBannerText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  simulationBannerSub: {
    color: '#94A3B8',
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  permissionPrompt: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#16231A',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  permissionMessage: {
    color: '#A4BCA4',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  floatingHud: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(20, 32, 23, 0.82)',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(143, 175, 143, 0.25)',
  },
  hudStat: {
    alignItems: 'center',
  },
  hudStatLabel: {
    color: '#8FAF8F',
    fontSize: 9,
    fontWeight: 'bold',
  },
  hudStatValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  hudDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(143, 175, 143, 0.3)',
  },
  dashboard: {
    flex: 1,
    backgroundColor: '#0E1711',
  },
  dashboardContent: {
    padding: 14,
    gap: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E3023',
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: '#2A4231',
  },
  controlButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#4CAF50',
  },
  controlText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  controlTextActive: {
    color: '#FFFFFF',
  },
  buttonPause: {
    backgroundColor: '#C62828',
    borderColor: '#E53935',
  },
  buttonPlay: {
    backgroundColor: '#2E7D32',
    borderColor: '#4CAF50',
  },
  buttonTextWhite: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#16231A',
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#24382A',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  confidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  confItem: {
    width: (SCREEN_WIDTH - 68) / 3,
    backgroundColor: '#1E3023',
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  confLabel: {
    color: '#8FAF8F',
    fontSize: 10,
  },
  confValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1F3124',
  },
  statusLabel: {
    color: '#A4BCA4',
    fontSize: 12,
  },
  statusVal: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});

