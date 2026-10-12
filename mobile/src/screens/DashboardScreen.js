import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { Card, ProgressBar, SectionTitle, PrimaryButton } from '../components/UI';
import ExerciseCard from '../components/ExerciseCard';
import SyncIndicator from '../components/SyncIndicator';
import { useAuth } from '../context/AuthContext';
import { plansApi } from '../api/plans';
import { progressApi } from '../api/progress';
import { sessionRepository } from '../db/sessionRepository';
import { isMockEnabled } from '../config/env';
import {
  patient as mockPatient,
  assignedExercises as mockAssignedExercises,
  stats as mockStats,
  sessionHistory as mockSessionHistory,
} from '../data/patientData';

export default function DashboardScreen({ navigation }) {
  const { patient: authPatient, refreshPatient } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [progressSummary, setProgressSummary] = useState(null);

  const loadData = useCallback(async () => {
    if (isMockEnabled()) {
      setActivePlan(null);
      setProgressSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch active plan (or load cached if offline)
      try {
        const plan = await plansApi.getActivePlan();
        setActivePlan(plan);
        await sessionRepository.cacheActivePlan(plan);
      } catch (planErr) {
        const cached = await sessionRepository.getCachedActivePlan();
        if (cached) {
          setActivePlan(cached);
        } else {
          // If no plan found
          setActivePlan(null);
        }
      }

      // 2. Fetch progress summary
      try {
        const summary = await progressApi.getProgressSummary();
        setProgressSummary(summary);
      } catch {
        // Optional summary
      }

      // 3. Refresh patient
      await refreshPatient().catch(() => {});
    } catch (err) {
      setError(err.message || 'Unable to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [refreshPatient]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived patient data: real patient or mock fallback
  const currentPatient = (!isMockEnabled() && authPatient) ? authPatient : mockPatient;
  const patientName = currentPatient?.full_name || currentPatient?.name || 'Sarah Johnson';
  const firstName = patientName.split(' ')[0] || 'Patient';
  const initials = patientName.split(' ').map(n => n[0]).join('') || 'PT';
  const injuredAnkle = currentPatient?.injured_ankle || currentPatient?.injuredAnkle || 'Right';
  const recoveryStage = currentPatient?.recovery_stage ?? currentPatient?.recoveryStage ?? 2;
  const currentWeek = currentPatient?.current_week ?? currentPatient?.currentWeek ?? 3;
  const totalWeeks = currentPatient?.total_weeks ?? currentPatient?.totalWeeks ?? 8;
  const recoveryPercent = progressSummary?.adherence_pct
    ? Math.round(progressSummary.adherence_pct)
    : (currentPatient?.recoveryPercent ?? Math.round((currentWeek / totalWeeks) * 100));

  // Exercises: map API plan exercises to UI card format, or use mock
  let displayExercises = mockAssignedExercises;
  if (!isMockEnabled() && activePlan?.exercises?.length > 0) {
    displayExercises = activePlan.exercises.map(item => {
      const ex = item.exercise || {};
      const poseConfig = ex.pose_config || {};
      const romConstraint = poseConfig.constraints?.rom || {};
      const safeRange = (romConstraint.min != null && romConstraint.max != null)
        ? `${romConstraint.min}° – ${romConstraint.max}°`
        : '0° – 45°';

      return {
        id: String(ex.id || item.exercise_id),
        exerciseId: ex.id || item.exercise_id,
        name: ex.name || 'Exercise',
        sets: item.prescribed_sets || 3,
        reps: item.prescribed_reps || 10,
        frequency: 'Daily',
        progress: 75,
        duration: '5 min',
        description: ex.description || 'Perform controlled ankle repetitions.',
        safeRange,
        color: COLORS.yellow,
        poseConfig,
      };
    });
  }

  // Quick stats: real or mock
  const completedSessions = progressSummary?.completed_sessions ?? mockStats.completedSessions;
  const avgFormScore = progressSummary?.avg_form_score
    ? `${Math.round(progressSummary.avg_form_score)}%`
    : `${mockStats.accuracy}%`;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Good Morning, {firstName} 👋</Text>
            <View style={s.subHeaderRow}>
              <Text style={s.subHeader}>
                {injuredAnkle} Ankle · Recovery Stage {recoveryStage}
              </Text>
              <SyncIndicator style={s.syncBadge} />
            </View>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => navigation.navigate('Profile')}>
            <Text style={s.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Card style={s.loadingCard}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={s.loadingText}>Loading recovery data...</Text>
          </Card>
        ) : error ? (
          <Card style={s.errorCard}>
            <Text style={s.errorTitle}>Could not refresh data</Text>
            <Text style={s.errorSub}>{error}</Text>
            <TouchableOpacity onPress={loadData} style={s.retryBtn}>
              <Text style={s.retryText}>Tap to Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* ── Recovery Card ── */}
        <View style={s.recoveryCard}>
          <View style={s.recoveryTop}>
            <View>
              <Text style={s.recoveryLabel}>Your Recovery</Text>
              <Text style={s.recoveryWeek}>Week {currentWeek} of {totalWeeks}</Text>
            </View>
            <View style={s.percentRing}>
              <Text style={s.percentNum}>{recoveryPercent}%</Text>
            </View>
          </View>
          <ProgressBar
            percent={recoveryPercent}
            color={COLORS.yellow}
            height={8}
            style={s.recoveryBar}
          />
          <Text style={s.encouragement}>Keep going! You're making great progress. 💪</Text>
        </View>

        {/* ── Today's Exercises ── */}
        <SectionTitle title="Today's Exercises" />
        {displayExercises.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.emptyEmoji}>📋</Text>
            <Text style={s.emptyTitle}>No exercises assigned</Text>
            <Text style={s.emptySub}>Your clinician will prescribe your rehabilitation protocol shortly.</Text>
          </Card>
        ) : (
          displayExercises.slice(0, 2).map(ex => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onPress={() => navigation.navigate('ExerciseDetail', { exercise: ex })}
            />
          ))
        )}

        {/* ── Continue CTA ── */}
        {displayExercises.length > 0 && (
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => navigation.navigate('ExerciseDetail', { exercise: displayExercises[0] })}
            activeOpacity={0.88}
          >
            <Text style={s.ctaText}>▶  Continue Exercise</Text>
          </TouchableOpacity>
        )}

        {/* ── Quick Stats ── */}
        <SectionTitle title="Quick Stats" />
        <View style={s.statsRow}>
          {[
            { val: completedSessions, label: 'Completed\nSessions', bg: COLORS.offWhite, color: COLORS.orange },
            { val: mockStats.totalReps, label: 'Total\nRepetitions', bg: COLORS.cream, color: COLORS.charcoal },
            { val: avgFormScore, label: 'Exercise\nAccuracy', bg: COLORS.yellowLight, color: COLORS.charcoal },
          ].map((item, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: item.bg }]}>
              <Text style={[s.statNum, { color: item.color }]}>{item.val}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Recent Session ── */}
        <SectionTitle title="Recent Session" />
        <Card style={s.recentCard}>
          <View style={s.recentLeft}>
            <View style={s.recentIconBox}>
              <Text style={s.recentEmoji}>🦶</Text>
            </View>
            <View>
              <Text style={s.recentName}>Plantarflexion</Text>
              <Text style={s.recentDate}>Recent session</Text>
              <Text style={s.recentReps}>12 repetitions</Text>
            </View>
          </View>
          <View style={s.scoreBadge}>
            <Text style={s.scoreNum}>88%</Text>
            <Text style={s.scoreLabel}>Score</Text>
          </View>
        </Card>

        {/* ── Performance Trend ── */}
        <SectionTitle title="Performance Trend" />
        <Card style={s.trendCard}>
          <View style={s.trendChart}>
            {mockSessionHistory.map((item, i) => (
              <View key={i} style={s.trendCol}>
                <Text style={s.trendScore}>{item.score}%</Text>
                <View style={[s.trendBar, {
                  height: (item.score / 100) * 64,
                  backgroundColor: i === mockSessionHistory.length - 1 ? COLORS.orange : COLORS.mint,
                }]} />
                <Text style={s.trendLabel}>{item.session}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* ── Sensor Status ── */}
        <SectionTitle title="System Status" />
        <Card style={s.sensorCard}>
          <View style={s.sensorLeft}>
            <View style={s.sensorDot} />
            <View>
              <Text style={s.sensorName}>Vision Pose Engine</Text>
              <Text style={s.sensorBattery}>BlazePose 33-Keypoints Active</Text>
            </View>
          </View>
          <View style={s.sensorBadge}>
            <Text style={s.sensorBadgeText}>Ready</Text>
          </View>
        </Card>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 52, paddingBottom: 16 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  syncBadge: {
    marginLeft: 8,
  },
  greeting:  { fontSize: 20, fontWeight: '800', color: COLORS.charcoal },
  subHeader: { fontSize: 13, color: COLORS.charcoal, opacity: 0.65 },
  avatar: {
    width: 44, height: 44, borderRadius: RADIUS.full,
    backgroundColor: COLORS.mintLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.mint,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: COLORS.charcoal },

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
  retryBtn:   { marginTop: 8, alignSelf: 'flex-start' },
  retryText:  { fontSize: 12, fontWeight: '700', color: COLORS.orange },

  emptyCard: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 16,
  },
  emptyEmoji: { fontSize: 32, marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal },
  emptySub:   { fontSize: 12, color: COLORS.mutedSage, textAlign: 'center', marginTop: 4 },

  recoveryCard: {
    backgroundColor: COLORS.mint,
    borderRadius: RADIUS.xl,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.mintDark,
    ...SHADOW_MD,
  },
  recoveryTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recoveryLabel:{ fontSize: 13, fontWeight: '600', color: COLORS.charcoal, opacity: 0.7 },
  recoveryWeek: { fontSize: 20, fontWeight: '800', color: COLORS.charcoal, marginTop: 2 },
  percentRing: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.yellow,
    ...SHADOW,
  },
  percentNum:   { fontSize: 15, fontWeight: '800', color: COLORS.charcoal },
  recoveryBar:  { marginTop: 14, marginBottom: 8 },
  encouragement:{ fontSize: 12, color: COLORS.charcoal, opacity: 0.65 },

  ctaBtn: {
    backgroundColor: COLORS.yellow,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: -4,
    ...SHADOW_MD,
  },
  ctaText: { color: COLORS.charcoal, fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, borderRadius: RADIUS.lg, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.lightGray,
    ...SHADOW,
  },
  statNum:   { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  statLabel: { fontSize: 11, color: COLORS.mutedSage, textAlign: 'center', lineHeight: 14 },

  recentCard: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  recentLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentIconBox:{
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cream,
    alignItems: 'center', justifyContent: 'center',
  },
  recentEmoji: { fontSize: 22 },
  recentName:  { fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  recentDate:  { fontSize: 11, color: COLORS.mutedSage, marginTop: 2 },
  recentReps:  { fontSize: 11, color: COLORS.charcoal, opacity: 0.6, marginTop: 1 },
  scoreBadge: {
    alignItems: 'center', backgroundColor: COLORS.mintLight,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md,
  },
  scoreNum:   { fontSize: 16, fontWeight: '800', color: COLORS.charcoal },
  scoreLabel: { fontSize: 10, color: COLORS.mutedSage },

  trendCard: { marginBottom: 20 },
  trendChart:{
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', height: 80, paddingTop: 10,
  },
  trendCol:  { alignItems: 'center', flex: 1 },
  trendScore:{ fontSize: 9, color: COLORS.mutedSage, marginBottom: 4 },
  trendBar:  { width: 20, borderRadius: 4 },
  trendLabel:{ fontSize: 10, color: COLORS.mutedSage, marginTop: 6 },

  sensorCard: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  sensorLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sensorDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  sensorName:   { fontSize: 13, fontWeight: '700', color: COLORS.charcoal },
  sensorBattery:{ fontSize: 11, color: COLORS.mutedSage, marginTop: 2 },
  sensorBadge:  { backgroundColor: COLORS.mintLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  sensorBadgeText: { fontSize: 11, color: COLORS.charcoal, fontWeight: '700' },
});
