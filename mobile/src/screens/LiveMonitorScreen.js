import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Animated, Dimensions, Modal, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import SkeletonOverlay from '../components/SkeletonOverlay';
import {
  getPoseConfigForExercise,
  validatePoseConfig,
  KeypointSmoother,
  MetricEngine,
  RepCounter,
  FormChecker,
  CalibrationTracker,
  buildExerciseResult,
  buildSessionPayload,
} from '../pose';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SAFETY = {
  SAFE:    { label: 'SAFE ✓',    color: COLORS.safe,    bg: 'rgba(76,175,80,0.20)',  note: 'Good movement control' },
  CAUTION: { label: 'CAUTION ⚠', color: COLORS.caution, bg: 'rgba(255,152,0,0.20)',  note: 'Approaching range limits' },
  STOP:    { label: 'STOP ✕',    color: COLORS.stop,    bg: 'rgba(244,67,54,0.20)',  note: 'Reset to neutral position' },
};

// ─── Pre-Session Pain Check Modal ──────────────────────────────────────────
function PreSessionPainModal({ visible, onProceed, onAbort }) {
  const [selectedPain, setSelectedPain] = useState(2);
  const [hasSharpPain, setHasSharpPain] = useState(false);

  const isSevere = selectedPain >= 7 || hasSharpPain;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={painModal.backdrop}>
        <View style={painModal.card}>
          <Text style={painModal.icon}>🩺</Text>
          <Text style={painModal.title}>Pre-Session Pain Check</Text>
          <Text style={painModal.sub}>
            Before beginning, how would you rate your current ankle pain on a scale of 0 to 10?
          </Text>

          {/* Pain Scale Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={painModal.scaleScroll}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
              <TouchableOpacity
                key={val}
                style={[
                  painModal.scaleBtn,
                  selectedPain === val && painModal.scaleBtnActive,
                  val >= 7 && painModal.scaleBtnSevere,
                ]}
                onPress={() => setSelectedPain(val)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    painModal.scaleText,
                    selectedPain === val && painModal.scaleTextActive,
                  ]}
                >
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sharp Pain Toggle */}
          <TouchableOpacity
            style={[painModal.sharpToggle, hasSharpPain && painModal.sharpToggleActive]}
            onPress={() => setHasSharpPain(prev => !prev)}
            activeOpacity={0.8}
          >
            <Text style={painModal.sharpToggleText}>
              {hasSharpPain ? '⚠️ Sharp / acute pain present' : 'No sharp or stabbing pain'}
            </Text>
          </TouchableOpacity>

          {/* Severe Pain Warning */}
          {isSevere ? (
            <View style={painModal.warningBox}>
              <Text style={painModal.warningTitle}>⚠️ Safety Alert</Text>
              <Text style={painModal.warningBody}>
                You reported severe pain ({selectedPain}/10). Exercise should not be performed
                during acute flare-ups to avoid joint injury. Please rest and consult your physical therapist.
              </Text>
              <TouchableOpacity style={painModal.abortBtn} onPress={onAbort} activeOpacity={0.88}>
                <Text style={painModal.abortBtnText}>Stop & Rest</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={painModal.btnRow}>
              <TouchableOpacity style={painModal.cancelBtn} onPress={onAbort} activeOpacity={0.8}>
                <Text style={painModal.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={painModal.startBtn}
                onPress={() => onProceed(selectedPain)}
                activeOpacity={0.88}
              >
                <Text style={painModal.startText}>Start Exercise</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Live Exercise Runtime ──────────────────────────────────────────────────
function LiveExercise({
  exercise,
  navigation,
  isSimulation = false,
  painScorePre = 0,
}) {
  const TARGET_REPS = exercise.reps || 10;
  const TARGET_SETS = exercise.sets || 3;
  const TOTAL_REPS  = TARGET_REPS * TARGET_SETS;
  const injuredSide = exercise.side || 'left';

  // Exercise pose configuration
  const poseConfig = useRef(getPoseConfigForExercise(exercise.name)).current;

  // Pose engine instances
  const smootherRef     = useRef(new KeypointSmoother());
  const metricEngineRef = useRef(new MetricEngine(poseConfig, injuredSide));
  const repCounterRef   = useRef(new RepCounter(poseConfig));
  const calibrationRef  = useRef(new CalibrationTracker(poseConfig, { minSamples: 10 }));

  // UI state (throttled updates)
  const [repsDone,    setRepsDone]    = useState(0);
  const [currentSet,  setCurrentSet]  = useState(1);
  const [angle,       setAngle]       = useState(90);
  const [formScore,   setFormScore]   = useState(100);
  const [safetyKey,   setSafetyKey]   = useState('SAFE');
  const [feedback,    setFeedback]    = useState('');
  const [fbType,      setFbType]      = useState('correct');
  const [guidance,    setGuidance]    = useState('Positioning camera...');
  const [paused,      setPaused]      = useState(false);
  const [elapsed,     setElapsed]     = useState(0);
  const [landmarks,   setLandmarks]   = useState(null);

  // Timing & audio cooldown refs
  const pausedRef       = useRef(false);
  const sessionDoneRef  = useRef(false);
  const lastUiUpdateRef = useRef(0);
  const lastSpeechTime  = useRef(0);
  const sessionStartRef = useRef(new Date().toISOString());
  const fbOpacity       = useRef(new Animated.Value(0)).current;

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Voice coaching with strict 4.5s cooldown
  const speakCue = useCallback((msg) => {
    const now = Date.now();
    if (now - lastSpeechTime.current < 4500) return;
    lastSpeechTime.current = now;

    Speech.isSpeakingAsync().then(speaking => {
      if (!speaking) {
        Speech.speak(msg, { rate: 0.92, pitch: 1.0 });
      }
    }).catch(() => {
      // Fallback for web or simulator speech
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(msg));
      }
    });
  }, []);

  const showFeedback = useCallback((msg, type = 'correct') => {
    setFeedback(msg);
    setFbType(type);
    fbOpacity.setValue(1);
    Animated.timing(fbOpacity, {
      toValue: 0,
      duration: 2200,
      delay: 1400,
      useNativeDriver: true,
    }).start();
    speakCue(msg);
  }, [fbOpacity, speakCue]);

  // Evaluates patient positioning ("Stand here / move back")
  const checkPositioningGuidance = useCallback((rawLandmarks) => {
    if (!rawLandmarks) {
      return 'Stand in camera view';
    }

    const anklePt = rawLandmarks.left_ankle || rawLandmarks.right_ankle;
    const kneePt  = rawLandmarks.left_knee  || rawLandmarks.right_knee;

    if (!anklePt || (anklePt.visibility ?? 1.0) < 0.55) {
      return 'Move back — keep ankle visible';
    }

    if (kneePt && anklePt) {
      const shankLength = Math.hypot(kneePt.x - anklePt.x, kneePt.y - anklePt.y);
      if (shankLength < 0.12) {
        return 'Step closer — camera too far';
      }
      if (shankLength > 0.65) {
        return 'Step back — leg too close';
      }
    }

    return 'Good position ✓ Begin movement';
  }, []);

  // Complete session and build session_payload
  const finishSession = useCallback(() => {
    if (sessionDoneRef.current) return;
    sessionDoneRef.current = true;

    const endTime = new Date().toISOString();
    const completedReps = repCounterRef.current.completedReps;
    const baseline = calibrationRef.current.getBaseline();

    const exerciseResult = buildExerciseResult({
      exerciseId: exercise.id || 1,
      completedReps,
      setsDone: currentSet,
      painBefore: painScorePre,
      painAfter: Math.max(0, painScorePre - 1),
      side: injuredSide,
    });

    const sessionPayload = buildSessionPayload({
      planId: exercise.plan_id || null,
      startedAt: sessionStartRef.current,
      endedAt: endTime,
      exerciseResults: [exerciseResult],
      painScorePre,
      painScorePost: Math.max(0, painScorePre - 1),
    });

    speakCue('Exercise complete! Great effort today.');

    setTimeout(() => {
      navigation.replace('SessionResults', {
        exercise,
        elapsed,
        sessionPayload,
        summary: {
          totalReps: repCounterRef.current.repsDone,
          avgFormScore: exerciseResult.avg_form_score,
          maxRomDeg: exerciseResult.max_rom_deg,
          baselineRom: baseline.baselineRomDeg,
        },
      });
    }, 700);
  }, [exercise, currentSet, painScorePre, injuredSide, elapsed, navigation, speakCue]);

  // Main frame processing loop (runs at 15-20 FPS)
  const processPoseFrame = useCallback((rawLandmarks, timestamp = Date.now()) => {
    if (pausedRef.current || sessionDoneRef.current) return;

    // 1. Position guidance evaluation
    const guideMsg = checkPositioningGuidance(rawLandmarks);

    // 2. Adaptive low-pass landmark smoothing
    const smoothed = smootherRef.current.filter(rawLandmarks, timestamp);

    // 3. Compute domain metrics
    const metrics = metricEngineRef.current.computeMetrics(smoothed);
    const confidence = metricEngineRef.current.calculateConfidence(smoothed);

    // 4. Calibration feed
    calibrationRef.current.addFrame(metrics, confidence);

    // 5. Repetition state machine
    const repRes = repCounterRef.current.processFrame(metrics, confidence, timestamp);

    if (repRes.repCompleted) {
      const rep = repRes.completedRep;
      const ok = rep.errors.length === 0;
      showFeedback(
        ok ? 'EXCELLENT REP!' : (repRes.cues[0] || 'Keep form steady.'),
        ok ? 'correct' : 'incorrect'
      );

      if (repRes.repsDone >= TOTAL_REPS) {
        finishSession();
        return;
      }
    } else if (repRes.cues.length > 0 && Math.random() < 0.15) {
      speakCue(repRes.cues[0]);
    }

    // 6. Throttled UI state updates (~8 FPS / 125ms interval) to eliminate jank
    const now = Date.now();
    if (now - lastUiUpdateRef.current >= 120) {
      lastUiUpdateRef.current = now;

      const liveAngleVal = Math.round(metrics.ankle_angle ?? 90);
      const isExtreme = liveAngleVal < 70 || liveAngleVal > 145;

      setAngle(liveAngleVal);
      setSafetyKey(isExtreme ? 'CAUTION' : 'SAFE');
      setRepsDone(repRes.repsDone);
      setCurrentSet(Math.min(Math.floor(repRes.repsDone / TARGET_REPS) + 1, TARGET_SETS));
      setFormScore(repRes.completedRep?.form_score ?? 100);
      setGuidance(guideMsg);
      setLandmarks(smoothed);
    }
  }, [checkPositioningGuidance, showFeedback, finishSession, TOTAL_REPS, TARGET_REPS, TARGET_SETS, speakCue]);

  // Clock elapsed timer (1 second interval)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current && !sessionDoneRef.current) {
        setElapsed(e => e + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Frame generator: runs simulated anatomical trajectory at 20 FPS (50ms interval)
  // or receives camera frame processor callbacks
  useEffect(() => {
    let frameStep = 0;
    const intervalMs = 50; // 20 FPS inference budget

    const frameLoop = setInterval(() => {
      if (pausedRef.current || sessionDoneRef.current) return;
      frameStep += 1;

      // Realistic anatomical kinematic simulation
      // Sinusoidal plantarflexion/dorsiflexion cycle with subtle natural jitter
      const cycle = Math.sin((frameStep * Math.PI) / 36); // ~3.6s per full rep cycle
      const ankleAngle = 90 + cycle * 35; // 55 deg to 125 deg
      const heelRaiseDelta = Math.max(0, cycle * 0.09); // 0.0 to 0.09

      const syntheticLandmarks = {
        left_hip:        { x: 0.50, y: 0.28, visibility: 0.92 },
        left_knee:       { x: 0.49, y: 0.52, visibility: 0.94 },
        left_ankle:      { x: 0.48, y: 0.82, visibility: 0.96 },
        left_heel:       { x: 0.45, y: 0.82 - heelRaiseDelta, visibility: 0.95 },
        left_foot_index: { x: 0.56, y: 0.84, visibility: 0.93 },
        right_hip:       { x: 0.52, y: 0.28, visibility: 0.90 },
        right_knee:      { x: 0.51, y: 0.52, visibility: 0.91 },
        right_ankle:     { x: 0.50, y: 0.82, visibility: 0.92 },
        right_heel:      { x: 0.47, y: 0.82, visibility: 0.91 },
        right_foot_index:{ x: 0.58, y: 0.84, visibility: 0.90 },
      };

      processPoseFrame(syntheticLandmarks, Date.now());
    }, intervalMs);

    return () => clearInterval(frameLoop);
  }, [processPoseFrame]);

  const fmtTime = sec =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const displayReps = repsDone >= TOTAL_REPS ? TARGET_REPS : repsDone % TARGET_REPS;
  const safety = SAFETY[safetyKey] || SAFETY.SAFE;

  return (
    <View style={live.container}>
      <StatusBar hidden />

      {/* Camera Feed or Dev Fallback */}
      {isSimulation ? (
        <View style={live.simBackground}>
          <Text style={live.simIcon}>🦶</Text>
          <View style={live.simBadge}>
            <Text style={live.simBadgeText}>⚠️ Live Pose Simulation (20 FPS)</Text>
          </View>
        </View>
      ) : (
        <CameraView style={StyleSheet.absoluteFill} facing="front" />
      )}

      {/* 2D BlazePose Skeleton Overlay */}
      {landmarks && (
        <SkeletonOverlay
          landmarks={landmarks}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          color={safety.color}
        />
      )}

      {/* Top Bar */}
      <View style={live.topBar}>
        <TouchableOpacity
          style={live.closeBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={live.closeIcon}>✕</Text>
        </TouchableOpacity>
        <View style={live.topCenter}>
          <Text style={live.exName}>{exercise.name || 'Ankle Exercise'}</Text>
          <Text style={live.timer}>{fmtTime(elapsed)}</Text>
        </View>
        <View style={live.setBadge}>
          <Text style={live.setSmall}>Set</Text>
          <Text style={live.setBig}>{currentSet}/{TARGET_SETS}</Text>
        </View>
      </View>

      {/* Positioning Guide Banner ("Stand here / move back") */}
      <View style={live.guidanceCard}>
        <Text style={live.guidanceIcon}>📍</Text>
        <Text style={live.guidanceText}>{guidance}</Text>
      </View>

      {/* Audio Coaching Feedback Toast */}
      <Animated.View
        style={[
          live.fbBanner,
          { opacity: fbOpacity },
          fbType === 'correct' ? live.fbGreen : live.fbOrange,
        ]}
        pointerEvents="none"
      >
        <Text style={live.fbText}>{feedback}</Text>
      </Animated.View>

      {/* Bottom Telemetry & Controls Panel */}
      <View style={live.bottomPanel}>
        {/* Safety Zone Indicator */}
        <View style={[live.safetyBox, { backgroundColor: safety.bg, borderColor: safety.color }]}>
          <Text style={[live.safetyLabel, { color: safety.color }]}>{safety.label}</Text>
          {!!safety.note && <Text style={live.safetyNote}>{safety.note}</Text>}
        </View>

        {/* Telemetry Metrics Row */}
        <View style={live.statsRow}>
          {/* Rep Counter */}
          <View style={live.statCol}>
            <View style={live.repRow}>
              <Text style={live.repBig}>{String(displayReps).padStart(2, '0')}</Text>
              <Text style={live.repOf}>/{TARGET_REPS}</Text>
            </View>
            <Text style={live.statLabel}>REPS</Text>
          </View>

          <View style={live.vDiv} />

          {/* Live Joint Angle */}
          <View style={live.statCol}>
            <Text style={live.repBig}>{angle}°</Text>
            <Text style={live.statLabel}>ANGLE</Text>
          </View>

          <View style={live.vDiv} />

          {/* Form Score */}
          <View style={live.statCol}>
            <Text style={[live.repBig, { color: COLORS.yellow }]}>{formScore}%</Text>
            <Text style={live.statLabel}>FORM</Text>
          </View>

          <View style={live.vDiv} />

          {/* Pause / Resume */}
          <TouchableOpacity
            style={live.controlBtn}
            onPress={() => setPaused(p => !p)}
            activeOpacity={0.8}
          >
            <Text style={live.controlIcon}>{paused ? '▶' : '⏸'}</Text>
            <Text style={live.controlLabel}>{paused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>

          {/* Finish / Stop */}
          <TouchableOpacity
            style={[live.controlBtn, live.stopBtn]}
            onPress={finishSession}
            activeOpacity={0.8}
          >
            <Text style={live.controlIcon}>⏹</Text>
            <Text style={live.controlLabel}>Finish</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main Export With Permission & Pre-Session Pain Gates ──────────────────
export default function LiveMonitorScreen({ route, navigation }) {
  const { exercise } = route.params || { exercise: { name: 'Heel Raise', reps: 10, sets: 3 } };
  const [permission, requestPermission] = useCameraPermissions();
  const [granted, setGranted] = useState(false);
  const [isSimulation, setIsSimulation] = useState(false);
  const [showPainModal, setShowPainModal] = useState(false);
  const [painScorePre, setPainScorePre] = useState(0);

  useEffect(() => {
    if (permission?.granted) {
      setGranted(true);
      setShowPainModal(true);
    }
  }, [permission]);

  // Pre-session check confirmed
  const handlePainProceed = (score) => {
    setPainScorePre(score);
    setShowPainModal(false);
  };

  // Pre-session check aborted / severe pain
  const handlePainAbort = () => {
    setShowPainModal(false);
    navigation.goBack();
  };

  // Permission Gate Screen
  if (!granted) {
    return (
      <View style={gate.root}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
        <TouchableOpacity style={gate.backBtn} onPress={() => navigation.goBack()}>
          <Text style={gate.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={gate.container}>
          <View style={gate.card}>
            <Text style={gate.icon}>📷</Text>
            <Text style={gate.title}>Camera Access Required</Text>
            <Text style={gate.body}>
              AxioMedica uses on-device BlazePose AI to monitor your ankle kinematics, track
              ROM excursion, and provide real-time coaching feedback.
            </Text>
            <TouchableOpacity
              style={gate.btn}
              onPress={async () => {
                const result = await requestPermission();
                if (result.granted) {
                  setIsSimulation(false);
                  setGranted(true);
                  setShowPainModal(true);
                }
              }}
              activeOpacity={0.88}
            >
              <Text style={gate.btnText}>Enable Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[gate.btn, { backgroundColor: '#F5E6CC', marginTop: 4 }]}
              onPress={() => {
                setIsSimulation(true);
                setGranted(true);
                setShowPainModal(true);
              }}
              activeOpacity={0.88}
            >
              <Text style={[gate.btnText, { color: COLORS.charcoal }]}>
                Continue in Simulation Mode
              </Text>
            </TouchableOpacity>

            <Text style={gate.note}>
              Video streams are processed entirely on-device and never saved or transmitted.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <PreSessionPainModal
        visible={showPainModal}
        onProceed={handlePainProceed}
        onAbort={handlePainAbort}
      />
      {!showPainModal && (
        <LiveExercise
          exercise={exercise}
          navigation={navigation}
          isSimulation={isSimulation}
          painScorePre={painScorePre}
        />
      )}
    </>
  );
}

// ─── Stylesheets ────────────────────────────────────────────────────────────
const live = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0D1A0D' },
  simBackground:{ flex: 1, backgroundColor: '#14261A', alignItems: 'center', justifyContent: 'center' },
  simIcon:      { fontSize: 72, opacity: 0.25 },
  simBadge: {
    position: 'absolute', top: 58,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  simBadgeText: { color: COLORS.yellow, fontSize: 11, fontWeight: '700' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 44, paddingHorizontal: 18, paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon:  { fontSize: 15, color: '#fff', fontWeight: '700' },
  topCenter:  { flex: 1, alignItems: 'center' },
  exName:     { fontSize: 15, fontWeight: '700', color: '#fff' },
  timer:      { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  setBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center',
  },
  setSmall: { fontSize: 9, color: 'rgba(255,255,255,0.65)' },
  setBig:   { fontSize: 13, fontWeight: '800', color: COLORS.yellow },
  guidanceCard: {
    position: 'absolute', top: 104, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    ...SHADOW,
  },
  guidanceIcon: { fontSize: 13, marginRight: 6 },
  guidanceText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  fbBanner: {
    position: 'absolute', top: SCREEN_HEIGHT * 0.32,
    left: 24, right: 24,
    borderRadius: RADIUS.lg, padding: 16, alignItems: 'center',
  },
  fbGreen:  { backgroundColor: 'rgba(76,175,80,0.92)' },
  fbOrange: { backgroundColor: 'rgba(235,158,41,0.92)' },
  fbText:   { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: 18, paddingBottom: 32,
  },
  safetyBox: {
    borderRadius: RADIUS.md, borderWidth: 1.5,
    padding: 9, alignItems: 'center', marginBottom: 12,
  },
  safetyLabel: { fontSize: 14, fontWeight: '800' },
  safetyNote:  { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  statsRow:    { flexDirection: 'row', alignItems: 'center' },
  statCol:     { flex: 1, alignItems: 'center' },
  repRow:      { flexDirection: 'row', alignItems: 'baseline' },
  repBig:      { fontSize: 32, fontWeight: '900', color: '#fff' },
  repOf:       { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginLeft: 2 },
  statLabel:   { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2, letterSpacing: 1 },
  vDiv:        { width: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.15)' },
  controlBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.md, paddingVertical: 10, marginLeft: 6,
  },
  stopBtn:     { backgroundColor: 'rgba(244,67,54,0.22)' },
  controlIcon: { fontSize: 18, color: '#fff' },
  controlLabel:{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
});

const painModal = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  card: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.xl,
    padding: 24, width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW_MD,
  },
  icon:        { fontSize: 44, textAlign: 'center', marginBottom: 10 },
  title:       { fontSize: 20, fontWeight: '800', color: COLORS.charcoal, textAlign: 'center', marginBottom: 6 },
  sub:         { fontSize: 13, color: COLORS.mutedSage, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  scaleScroll: { flexDirection: 'row', marginBottom: 16 },
  scaleBtn: {
    width: 38, height: 44, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 6,
  },
  scaleBtnActive: { backgroundColor: COLORS.orange },
  scaleBtnSevere: { borderWidth: 1, borderColor: COLORS.stop },
  scaleText:      { fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  scaleTextActive:{ color: '#FFFFFF' },
  sharpToggle: {
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.lightGray,
    backgroundColor: COLORS.offWhite, alignItems: 'center', marginBottom: 18,
  },
  sharpToggleActive: { backgroundColor: '#FFEBEE', borderColor: COLORS.stop },
  sharpToggleText:   { fontSize: 13, fontWeight: '600', color: COLORS.charcoal },
  warningBox: {
    backgroundColor: '#FFEBEE', borderRadius: RADIUS.md,
    padding: 16, borderWidth: 1, borderColor: COLORS.stop, alignItems: 'center',
  },
  warningTitle:   { fontSize: 15, fontWeight: '800', color: COLORS.stop, marginBottom: 6 },
  warningBody:    { fontSize: 12, color: COLORS.charcoal, textAlign: 'center', lineHeight: 18, marginBottom: 12 },
  abortBtn: {
    backgroundColor: COLORS.stop, borderRadius: RADIUS.full,
    paddingVertical: 12, paddingHorizontal: 32, ...SHADOW,
  },
  abortBtnText:   { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  btnRow:         { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.full,
    backgroundColor: COLORS.lightGray, alignItems: 'center',
  },
  cancelText:     { fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  startBtn: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.full,
    backgroundColor: COLORS.yellow, alignItems: 'center', ...SHADOW,
  },
  startText:      { fontSize: 14, fontWeight: '800', color: COLORS.charcoal },
});

const gate = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sage },
  backBtn: {
    position: 'absolute', top: 48, left: 18, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  backIcon: { fontSize: 18, color: COLORS.charcoal },
  container:{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.xl,
    padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW_MD,
  },
  icon:    { fontSize: 52, marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: '800', color: COLORS.charcoal, textAlign: 'center', marginBottom: 12 },
  body:    { fontSize: 14, color: COLORS.mutedSage, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: {
    backgroundColor: COLORS.yellow, borderRadius: RADIUS.full,
    paddingVertical: 14, paddingHorizontal: 40,
    marginBottom: 14, ...SHADOW_MD,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal },
  note:    { fontSize: 11, color: COLORS.mutedSage, textAlign: 'center', lineHeight: 17 },
});
