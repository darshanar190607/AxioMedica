import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Play, Activity, ShieldCheck, CheckCircle2 } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { ProgressBar, PrimaryButton, Card } from '../components/UI';
import ReadAloudButton from '../components/ReadAloudButton';
import AnkleSimulationPlayer from '../components/AnkleSimulationPlayer';
import { plansApi } from '../api/plans';
import { isMockEnabled } from '../config/env';
import { assignedExercises as mockExercises } from '../data/patientData';

export default function ExerciseDetailScreen({ route, navigation }) {
  const routeExercise = route.params?.exercise || mockExercises[0];
  const [exercise, setExercise] = useState(routeExercise);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [demoFinished, setDemoFinished] = useState(false);

  useEffect(() => {
    // If only an exerciseId is passed without full details, fetch from API
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
            description: apiEx.description || 'Perform controlled ankle repetitions within prescribed safety limits.',
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

  const safeRangeText = exercise.safeRange || '0° – 30°';
  const progressPct = exercise.progress ?? 65;
  const completedSessions = exercise.completedSessions ?? 4;
  const totalSessions = exercise.totalSessions ?? 8;
  const completedReps = exercise.completedReps ?? 40;
  const totalReps = exercise.totalReps ?? 80;

  const handleSimulationComplete = useCallback(() => {
    setDemoFinished(true);
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <ArrowLeft size={22} color={COLORS.charcoal} />
          </TouchableOpacity>
          <View style={s.headerInfo}>
            <Text style={s.exName}>{exercise.name}</Text>
            <Text style={s.exMeta}>Week 3 · {exercise.sets || 3} Sets × {exercise.reps || 10} Reps</Text>
          </View>
        </View>

        {loading ? (
          <Card style={s.loadingCard}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={s.loadingText}>Loading clinical exercise data...</Text>
          </Card>
        ) : error ? (
          <Card style={s.errorCard}>
            <Text style={s.errorTitle}>Could not load details</Text>
            <Text style={s.errorSub}>{error}</Text>
          </Card>
        ) : null}

        {/* Biomechanical Kinematics Simulation Player */}
        <AnkleSimulationPlayer
          exerciseName={exercise.name}
          targetAngle={25}
          safeMin={0}
          safeMax={30}
          onComplete={handleSimulationComplete}
        />

        {/* Clinical Execution Instructions */}
        <View style={s.descCard}>
          <View style={s.descHeader}>
            <Text style={s.descTitle}>Clinical Instructions</Text>
            <ReadAloudButton
              text={exercise.description || 'Perform controlled ankle repetitions.'}
              compact
              label="Listen"
            />
          </View>
          <Text style={s.descText}>{exercise.description}</Text>
          <View style={s.rangeRow}>
            <Text style={s.rangeLabel}>Prescribed Safe Range</Text>
            <View style={s.rangePill}>
              <Text style={s.rangeVal}>{safeRangeText}</Text>
            </View>
          </View>
        </View>

        {/* Start button */}
        <PrimaryButton
          title={demoFinished ? '▶  Start Live Session' : 'Watch Simulation to Start'}
          onPress={() => navigation.navigate('LiveMonitor', { exercise })}
          disabled={!demoFinished}
          style={s.startBtn}
        />
        {!demoFinished && (
          <Text style={s.watchNote}>
            Interact with the biomechanical simulation above or tap Play to unlock the live session.
          </Text>
        )}

        {/* Patient Progress */}
        <View style={s.progressCard}>
          <Text style={s.progressTitle}>Your Protocol Progress</Text>
          <Text style={s.progressSub}>Adherence to physical therapy plan</Text>
          <ProgressBar
            percent={progressPct}
            color={COLORS.orange}
            height={8}
            style={{ marginVertical: 10 }}
          />
          <Text style={s.progressPct}>{progressPct}% completed</Text>
          <View style={s.statsRow}>
            <View style={s.pStat}>
              <Text style={s.pStatVal}>{completedSessions}/{totalSessions}</Text>
              <Text style={s.pStatLabel}>Sessions Done</Text>
            </View>
            <View style={s.pStatDiv} />
            <View style={s.pStat}>
              <Text style={s.pStatVal}>{completedReps}/{totalReps}</Text>
              <Text style={s.pStatLabel}>Total Reps</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 20 },

  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn:    {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    ...SHADOW,
  },
  headerInfo: { flex: 1 },
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

  descCard: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    ...SHADOW,
  },
  descHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  descTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal },
  descText:  { fontSize: 13, color: COLORS.charcoal, opacity: 0.75, lineHeight: 20 },
  rangeRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  rangeLabel:{ fontSize: 13, fontWeight: '600', color: COLORS.charcoal },
  rangePill: { backgroundColor: COLORS.cream, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  rangeVal:  { fontSize: 13, fontWeight: '800', color: COLORS.orange },

  startBtn:  { marginBottom: 8 },
  watchNote: { fontSize: 12, color: COLORS.mutedSage, textAlign: 'center', marginBottom: 16, paddingHorizontal: 10 },

  progressCard: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    ...SHADOW,
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
