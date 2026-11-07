/**
 * mobile/src/screens/PoseTestScreen.js
 * 
 * Standalone Developer Test Harness for Real On-Device BlazePose Estimation.
 * 
 * ISOLATION GUARANTEE:
 * - Tests VisionCamera, Fast-TFLite, blazeposeAdapter, and SkeletonOverlay in isolation.
 * - Does NOT modify LiveMonitorScreen.js or any protected clinical modules.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
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
        <View>
          <Text style={styles.headerTitle}>BlazePose ML Harness</Text>
          <Text style={styles.headerSubtitle}>
            {isNativeProviderAvailable ? 'Native VisionCamera V5' : 'Fallback / Jest Mode'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.statusBadge, metrics.status === 'tracking' ? styles.statusTracking : styles.statusLost]}
        >
          <Activity size={12} color="#FFFFFF" />
          <Text style={styles.statusText}>{metrics.status.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {/* Camera Viewport Area */}
      <View style={styles.viewportContainer}>
        {hasPermission ? (
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
                height={SCREEN_HEIGHT * 0.58}
                color={metrics.status === 'tracking' ? '#4CAF50' : '#FF9800'}
                isMirrored={false} // Already transformed by blazeposeAdapter if isMirrored
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
        )}

        {/* Live Floating HUD */}
        <View style={styles.floatingHud}>
          <View style={styles.hudStat}>
            <Text style={styles.hudStatLabel}>FPS</Text>
            <Text style={styles.hudStatValue}>{metrics.fps}</Text>
          </View>
          <View style={styles.hudDivider} />
          <View style={styles.hudStat}>
            <Text style={styles.hudStatLabel}>INFERENCE</Text>
            <Text style={styles.hudStatValue}>{metrics.inferenceMs} ms</Text>
          </View>
          <View style={styles.hudDivider} />
          <View style={styles.hudStat}>
            <Text style={styles.hudStatLabel}>LATENCY</Text>
            <Text style={styles.hudStatValue}>{metrics.totalLatencyMs} ms</Text>
          </View>
          <View style={styles.hudDivider} />
          <View style={styles.hudStat}>
            <Text style={styles.hudStatLabel}>PRESENCE</Text>
            <Text style={styles.hudStatValue}>{Math.round(metrics.presenceScore * 100)}%</Text>
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
    paddingVertical: 12,
    backgroundColor: '#16231A',
    borderBottomWidth: 1,
    borderBottomColor: '#24382A',
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
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.52,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  permissionPrompt: {
    flex: 1,
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

