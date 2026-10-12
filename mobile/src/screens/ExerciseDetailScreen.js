import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { ProgressBar, PrimaryButton, Card } from '../components/UI';
import { plansApi } from '../api/plans';
import { isMockEnabled } from '../config/env';
import { assignedExercises as mockExercises } from '../data/patientData';

const DEMO_DURATION = 8000;

export default function ExerciseDetailScreen({ route, navigation }) {
  const routeExercise = route.params?.exercise || mockExercises[0];
  const [exercise, setExercise] = useState(routeExercise);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [demoFinished, setDemoFinished] = useState(false);
  const [playing,      setPlaying]      = useState(false);
  const [progress,     setProgress]     = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => {
    // If only an exerciseId is passed without name or details, fetch from API
    if (!isMockEnabled() && route.params?.exerciseId && (!routeExercise.name || !routeExercise.poseConfig)) {
      setLoading(true);
      plansApi.getExerciseById(route.params.exerciseId)
        .then(apiEx => {
          const poseConfig = apiEx.pose_config || {};
          const romConstraint = poseConfig.constraints?.rom || {};
          const safeRange = (romConstraint.min != null && romConstraint.max != null)
            ? `${romConstraint.min}° – ${romConstraint.max}°`
            : '0° – 45°';

          setExercise({
            id: String(apiEx.id),
            exerciseId: apiEx.id,
            name: apiEx.name,
            sets: 3,
            reps: 10,
            duration: '5 min',
            description: apiEx.description || 'Perform controlled ankle repetitions.',
            safeRange,
            color: COLORS.yellow,
            progress: 65,
            completedSessions: 4,
            totalSessions: 8,
            completedReps: 40,
            totalReps: 80,
            poseConfig,
          });
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [route.params?.exerciseId]);

  const handlePlay = () => {
    if (demoFinished || playing) return;
    setPlaying(true);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / DEMO_DURATION) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(timerRef.current);
        setPlaying(false);
        setDemoFinished(true);
      }
    }, 80);
  };

  const fmtTime = pct => {
    const sec = Math.floor((pct / 100) * (DEMO_DURATION / 1000));
    return `0:0${sec}`;
  };

  const safeRangeText = exercise.safeRange || '0° – 30°';
  const progressPct = exercise.progress ?? 60;
  const completedSessions = exercise.completedSessions ?? 3;
  const totalSessions = exercise.totalSessions ?? 8;
  const completedReps = exercise.completedReps ?? 30;
  const totalReps = exercise.totalReps ?? 80;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={s.headerInfo}>
            <Text style={s.exName}>{exercise.name}</Text>
            <Text style={s.exMeta}>Week 3 · {exercise.sets || 3} Sets × {exercise.reps || 10} Reps</Text>
          </View>
        </View>

        {loading ? (
          <Card style={s.loadingCard}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={s.loadingText}>Loading exercise instructions...</Text>
          </Card>
        ) : error ? (
          <Card style={s.errorCard}>
            <Text style={s.errorTitle}>Could not load details</Text>
            <Text style={s.errorSub}>{error}</Text>
          </Card>
        ) : null}

        {/* Video player */}
        <View style={s.videoCard}>
          <View style={s.videoArea}>
            <View style={s.videoContent}>
              <Text style={s.videoEmoji}>🦶</Text>
              <Text style={s.videoLabel}>
                {demoFinished ? 'Demo Completed ✓'
                  : playing ? 'Playing demonstration...'
                  : 'Tap ▶ to watch demo'}
              </Text>
            </View>
            {!playing && !demoFinished && (
              <TouchableOpacity style={s.playOverlay} onPress={handlePlay}>
                <View style={s.playBtn}>
                  <Text style={s.playIcon}>▶</Text>
                </View>
              </TouchableOpacity>
            )}
            {demoFinished && (
              <View style={s.doneChip}>
                <Text style={s.doneChipText}>✓ Done</Text>
              </View>
            )}
          </View>
          <View style={s.videoControls}>
            <Text style={s.timeText}>{fmtTime(progress)}</Text>
            <View style={s.videoBar}>
              <View style={[s.videoFill, { width: `${progress}%` }]} />
            </View>
            <Text style={s.timeText}>0:08</Text>
          </View>
          {demoFinished && (
            <View style={s.demoBanner}>
              <Text style={s.demoBannerText}>✓  Demo complete — you can now start!</Text>
            </View>
          )}
        </View>

        {/* How to perform */}
        <View style={s.descCard}>
          <Text style={s.descTitle}>How to Perform</Text>
          <Text style={s.descText}>{exercise.description}</Text>
          <View style={s.rangeRow}>
            <Text style={s.rangeLabel}>Safe Range</Text>
            <View style={s.rangePill}>
              <Text style={s.rangeVal}>{safeRangeText}</Text>
            </View>
          </View>
        </View>

        {/* Start button */}
        <PrimaryButton
          title={demoFinished ? '▶  Start Exercise' : 'Watch Demo First'}
          onPress={() => demoFinished && navigation.navigate('LiveMonitor', { exercise })}
          disabled={!demoFinished}
          style={s.startBtn}
        />
        {!demoFinished && (
          <Text style={s.watchNote}>Watch the full demo to unlock the exercise.</Text>
        )}

        {/* Your Progress */}
        <View style={s.progressCard}>
          <Text style={s.progressTitle}>Your Progress</Text>
          <Text style={s.progressSub}>Exercise Completion</Text>
          <ProgressBar
            percent={progressPct}
            color={COLORS.orange}
            height={8}
            style={{ marginVertical: 10 }}
          />
          <Text style={s.progressPct}>{progressPct}% complete</Text>
          <View style={s.statsRow}>
            <View style={s.pStat}>
              <Text style={s.pStatVal}>{completedSessions}/{totalSessions}</Text>
              <Text style={s.pStatLabel}>Sessions</Text>
            </View>
            <View style={s.pStatDiv} />
            <View style={s.pStat}>
              <Text style={s.pStatVal}>{completedReps}/{totalReps}</Text>
              <Text style={s.pStatLabel}>Reps</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 16 },

  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backBtn:    { width: 40, height: 40, justifyContent: 'center' },
  backIcon:   { fontSize: 24, color: COLORS.charcoal },
  headerInfo: { flex: 1, marginLeft: 4 },
  exName:     { fontSize: 18, fontWeight: '800', color: COLORS.charcoal },
  exMeta:     { fontSize: 12, color: COLORS.charcoal, opacity: 0.65, marginTop: 2 },

  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 13,
    color: COLORS.charcoal,
    fontWeight: '600',
  },
  errorCard: {
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#FDECEA',
    borderColor: '#F5C6CB',
  },
  errorTitle: { fontSize: 13, fontWeight: '700', color: '#D32F2F' },
  errorSub:   { fontSize: 12, color: COLORS.charcoal, marginTop: 2 },

  videoCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    overflow: 'hidden', marginBottom: 16, borderWidth: 1,
    borderColor: COLORS.lightGray, ...SHADOW_MD,
  },
  videoArea: {
    height: 190, backgroundColor: COLORS.charcoal,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  videoContent:{ alignItems: 'center' },
  videoEmoji:  { fontSize: 52, marginBottom: 8 },
  videoLabel:  { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  playBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW_MD,
  },
  playIcon: { fontSize: 22, color: COLORS.charcoal, marginLeft: 3 },
  doneChip: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: COLORS.mint, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: RADIUS.full,
  },
  doneChipText: { fontSize: 12, fontWeight: '800', color: COLORS.charcoal },

  videoControls:{
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  timeText: { fontSize: 11, color: COLORS.mutedSage, fontWeight: '600' },
  videoBar: { flex: 1, height: 4, backgroundColor: COLORS.lightGray, borderRadius: 2 },
  videoFill:{ height: 4, backgroundColor: COLORS.orange, borderRadius: 2 },

  demoBanner: {
    backgroundColor: COLORS.mintLight, paddingVertical: 8,
    paddingHorizontal: 14, borderTopWidth: 1, borderColor: COLORS.mint,
  },
  demoBannerText: { fontSize: 12, color: COLORS.charcoal, fontWeight: '700', textAlign: 'center' },

  descCard: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 18, marginBottom: 16, borderWidth: 1,
    borderColor: COLORS.lightGray, ...SHADOW,
  },
  descTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal, marginBottom: 8 },
  descText:  { fontSize: 13, color: COLORS.charcoal, opacity: 0.75, lineHeight: 20 },
  rangeRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  rangeLabel:{ fontSize: 13, fontWeight: '600', color: COLORS.charcoal },
  rangePill: { backgroundColor: COLORS.cream, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  rangeVal:  { fontSize: 13, fontWeight: '800', color: COLORS.orange },

  startBtn:  { marginBottom: 8 },
  watchNote: { fontSize: 12, color: COLORS.mutedSage, textAlign: 'center', marginBottom: 16 },

  progressCard: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 18, marginTop: 4, borderWidth: 1,
    borderColor: COLORS.lightGray, ...SHADOW,
  },
  progressTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal },
  progressSub:   { fontSize: 12, color: COLORS.mutedSage, marginTop: 2 },
  progressPct:   { fontSize: 12, color: COLORS.mutedSage, textAlign: 'right' },
  statsRow:  { flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderColor: COLORS.lightGray },
  pStat:     { flex: 1, alignItems: 'center' },
  pStatVal:  { fontSize: 16, fontWeight: '800', color: COLORS.charcoal },
  pStatLabel:{ fontSize: 11, color: COLORS.mutedSage, marginTop: 2 },
  pStatDiv:  { width: 1, height: 30, backgroundColor: COLORS.lightGray },
});
