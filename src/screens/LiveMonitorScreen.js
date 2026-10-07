import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Animated, Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';

const { height } = Dimensions.get('window');

const CORRECT_MSGS  = ['GOOD!', 'VERY GOOD!', 'EXCELLENT!', 'AMAZING!'];
const INCORRECT_MSGS = [
  'Keep your ankle straight.',
  'Slow down your movement.',
  'Stay within the recommended range.',
  'Try to follow the demonstrated movement.',
];
const SAFETY = {
  SAFE:    { label: 'SAFE ✓',    color: COLORS.safe,    bg: 'rgba(76,175,80,0.20)',  note: '' },
  CAUTION: { label: 'CAUTION ⚠', color: COLORS.caution, bg: 'rgba(255,152,0,0.20)',  note: "You're approaching your safe range." },
  STOP:    { label: 'STOP ✕',    color: COLORS.stop,    bg: 'rgba(244,67,54,0.20)',  note: 'Return to the safe position.' },
};

// ─── Permission Gate ──────────────────────────────────────────────────────────
const gate = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sage },
  backBtn: {
    position: 'absolute', top: 48, left: 18, zIndex: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  backIcon: { fontSize: 18, color: COLORS.charcoal },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
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

// ─── Live Exercise ────────────────────────────────────────────────────────────
function LiveExercise({ exercise, navigation }) {
  const TARGET_REPS = exercise.reps;
  const TARGET_SETS = exercise.sets;
  const TOTAL       = TARGET_REPS * TARGET_SETS;

  const [reps,      setReps]      = useState(0);
  const [angle,     setAngle]     = useState(12);
  const [safetyKey, setSafetyKey] = useState('SAFE');
  const [feedback,  setFeedback]  = useState('');
  const [fbType,    setFbType]    = useState('correct');
  const [paused,    setPaused]    = useState(false);
  const [elapsed,   setElapsed]   = useState(0);

  const pausedRef = useRef(false);
  const repsRef   = useRef(0);
  const doneRef   = useRef(false);
  const fbOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const speak = msg => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(msg));
    }
  };

  const showFeedback = (msg, type) => {
    setFeedback(msg); setFbType(type);
    fbOpacity.setValue(1);
    Animated.timing(fbOpacity, {
      toValue: 0, duration: 2500, delay: 1200, useNativeDriver: true,
    }).start();
    speak(msg);
  };

  useEffect(() => {
    const clock = setInterval(() => {
      if (!pausedRef.current) setElapsed(e => e + 1);
    }, 1000);

    const repSim = setInterval(() => {
      if (pausedRef.current || doneRef.current) return;
      const a = Math.floor(Math.random() * 22) + 6;
      setAngle(a);
      setSafetyKey(a > 26 ? 'CAUTION' : 'SAFE');
      repsRef.current += 1;
      const next = repsRef.current;
      setReps(next);
      if (next % 2 === 0) {
        const ok   = Math.random() > 0.3;
        const pool = ok ? CORRECT_MSGS : INCORRECT_MSGS;
        showFeedback(pool[Math.floor(Math.random() * pool.length)], ok ? 'correct' : 'incorrect');
      }
      if (next >= TOTAL) {
        doneRef.current = true;
        clearInterval(repSim);
        clearInterval(clock);
        setTimeout(() => navigation.replace('SessionResults', { exercise, elapsed: next * 3 }), 900);
      }
    }, 3000);

    return () => { clearInterval(clock); clearInterval(repSim); };
  }, []);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  const displaySet  = Math.min(Math.floor(reps / TARGET_REPS) + 1, TARGET_SETS);
  const displayReps = reps >= TOTAL ? TARGET_REPS : reps % TARGET_REPS;
  const safety      = SAFETY[safetyKey];

  return (
    <View style={live.container}>
      <StatusBar hidden />

      {/* Live camera */}
      <CameraView style={StyleSheet.absoluteFill} facing="front" />

      {/* AI tracking overlay */}
      <View style={live.trackOverlay} pointerEvents="none">
        {[
          { top: '36%', left: '42%' }, { top: '46%', left: '36%' },
          { top: '54%', left: '50%' }, { top: '61%', left: '40%' },
          { top: '67%', left: '46%' },
        ].map((p, i) => (
          <View key={i} style={[live.dot, { top: p.top, left: p.left, backgroundColor: safety.color }]} />
        ))}
        <View style={[live.trackBox, { borderColor: safety.color }]} />
      </View>

      {/* Top bar */}
      <View style={live.topBar}>
        <TouchableOpacity style={live.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={live.closeIcon}>✕</Text>
        </TouchableOpacity>
        <View style={live.topCenter}>
          <Text style={live.exName}>{exercise.name}</Text>
          <Text style={live.timer}>{fmt(elapsed)}</Text>
        </View>
        <View style={live.setBadge}>
          <Text style={live.setSmall}>Set</Text>
          <Text style={live.setBig}>{displaySet}/{TARGET_SETS}</Text>
        </View>
      </View>

      {/* Feedback banner */}
      <Animated.View style={[
        live.fbBanner, { opacity: fbOpacity },
        fbType === 'correct' ? live.fbGreen : live.fbOrange,
      ]}>
        <Text style={live.fbText}>{feedback}</Text>
      </Animated.View>

      {/* Bottom panel */}
      <View style={live.bottomPanel}>
        <View style={[live.safetyBox, { backgroundColor: safety.bg, borderColor: safety.color }]}>
          <Text style={[live.safetyLabel, { color: safety.color }]}>{safety.label}</Text>
          {!!safety.note && <Text style={live.safetyNote}>{safety.note}</Text>}
        </View>
        <View style={live.statsRow}>
          <View style={live.statCol}>
            <View style={live.repRow}>
              <Text style={live.repBig}>{String(displayReps).padStart(2,'0')}</Text>
              <Text style={live.repOf}>/{TARGET_REPS}</Text>
            </View>
            <Text style={live.statLabel}>REPS</Text>
          </View>
          <View style={live.vDiv} />
          <View style={live.statCol}>
            <Text style={live.repBig}>{angle}°</Text>
            <Text style={live.statLabel}>ANGLE</Text>
          </View>
          <View style={live.vDiv} />
          <TouchableOpacity style={live.pauseBtn} onPress={() => setPaused(p => !p)}>
            <Text style={live.pauseIcon}>{paused ? '▶' : '⏸'}</Text>
            <Text style={live.pauseLabel}>{paused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const live = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0D1A0D' },
  trackOverlay: { ...StyleSheet.absoluteFillObject },
  dot: {
    position: 'absolute', width: 11, height: 11,
    borderRadius: 6, borderWidth: 2, borderColor: '#fff', opacity: 0.9,
  },
  trackBox: {
    position: 'absolute', top: '28%', left: '25%',
    width: '50%', height: '50%',
    borderWidth: 1.5, borderRadius: RADIUS.lg, opacity: 0.55,
  },
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
  setSmall: { fontSize: 9,  color: 'rgba(255,255,255,0.65)' },
  setBig:   { fontSize: 13, fontWeight: '800', color: COLORS.yellow },
  fbBanner: {
    position: 'absolute', top: height * 0.32,
    left: 24, right: 24,
    borderRadius: RADIUS.lg, padding: 16, alignItems: 'center',
  },
  fbGreen:  { backgroundColor: 'rgba(76,175,80,0.92)' },
  fbOrange: { backgroundColor: 'rgba(235,158,41,0.92)' },
  fbText:   { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.68)',
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: 18, paddingBottom: 34,
  },
  safetyBox: {
    borderRadius: RADIUS.md, borderWidth: 1.5,
    padding: 10, alignItems: 'center', marginBottom: 14,
  },
  safetyLabel: { fontSize: 15, fontWeight: '800' },
  safetyNote:  { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  statsRow:    { flexDirection: 'row', alignItems: 'center' },
  statCol:     { flex: 1, alignItems: 'center' },
  repRow:      { flexDirection: 'row', alignItems: 'baseline' },
  repBig:      { fontSize: 38, fontWeight: '900', color: '#fff' },
  repOf:       { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginLeft: 2 },
  statLabel:   { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2, letterSpacing: 1 },
  vDiv:        { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.18)' },
  pauseBtn: {
    flex: 1, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.md, paddingVertical: 12, marginLeft: 8,
  },
  pauseIcon:  { fontSize: 20, color: '#fff' },
  pauseLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
});

// ─── Main export — gates on camera permission ─────────────────────────────────
export default function LiveMonitorScreen({ route, navigation }) {
  const { exercise } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (permission?.granted) setGranted(true);
  }, [permission]);

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
              RehabStep AI needs your camera to monitor your ankle movements in real time and
              provide accurate AI feedback during the exercise.
            </Text>
            <TouchableOpacity
              style={gate.btn}
              onPress={async () => {
                const result = await requestPermission();
                if (result.granted) setGranted(true);
              }}
              activeOpacity={0.88}
            >
              <Text style={gate.btnText}>Enable Camera</Text>
            </TouchableOpacity>
            <Text style={gate.note}>
              Your camera feed is processed on-device and never stored or shared.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return <LiveExercise exercise={exercise} navigation={navigation} />;
}
