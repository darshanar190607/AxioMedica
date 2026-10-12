import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, ActivityIndicator, TouchableOpacity } from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { ProgressBar, Card } from '../components/UI';
import ExerciseCard from '../components/ExerciseCard';
import { useAuth } from '../context/AuthContext';
import { plansApi } from '../api/plans';
import { sessionRepository } from '../db/sessionRepository';
import { isMockEnabled } from '../config/env';
import { patient as mockPatient, assignedExercises as mockAssignedExercises } from '../data/patientData';

export default function MyPlanScreen({ navigation }) {
  const { patient: authPatient } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePlan, setActivePlan] = useState(null);

  const loadPlan = useCallback(async () => {
    if (isMockEnabled()) {
      setActivePlan(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      try {
        const plan = await plansApi.getActivePlan();
        setActivePlan(plan);
        await sessionRepository.cacheActivePlan(plan);
      } catch (netErr) {
        // Offline fallback from SQLite cached plan
        const cached = await sessionRepository.getCachedActivePlan();
        if (cached) {
          setActivePlan(cached);
        } else {
          setActivePlan(null);
        }
      }
    } catch (err) {
      setError(err.message || 'Unable to load rehabilitation plan');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Derived patient info
  const currentPatient = (!isMockEnabled() && authPatient) ? authPatient : mockPatient;
  const recoveryStage = currentPatient?.recovery_stage ?? currentPatient?.recoveryStage ?? 2;
  const currentWeek = currentPatient?.current_week ?? currentPatient?.currentWeek ?? 3;
  const totalWeeks = currentPatient?.total_weeks ?? currentPatient?.totalWeeks ?? 8;
  const clinicianName = activePlan?.clinician_name || currentPatient?.doctor?.name || 'Dr. Michael Torres';

  // Exercises mapping
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
        progress: 70,
        duration: '5 min',
        description: ex.description || 'Follow live pose guidance to complete repetitions.',
        safeRange,
        color: COLORS.yellow,
        poseConfig,
      };
    });
  }

  const completionPercent = Math.min(Math.round((currentWeek / totalWeeks) * 100), 100);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.title}>My Rehabilitation Plan</Text>

        {loading ? (
          <Card style={s.loadingCard}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={s.loadingText}>Loading prescribed exercises...</Text>
          </Card>
        ) : error ? (
          <Card style={s.errorCard}>
            <Text style={s.errorTitle}>Could not load latest plan</Text>
            <Text style={s.errorSub}>{error}</Text>
            <TouchableOpacity onPress={loadPlan} style={s.retryBtn}>
              <Text style={s.retryText}>Tap to Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* Plan summary card */}
        <View style={s.planCard}>
          <View style={s.planRow}>
            {[
              { val: `Stage ${recoveryStage}`, label: 'Recovery Stage' },
              { val: `Wk ${currentWeek}/${totalWeeks}`, label: 'Current Week' },
              { val: `${totalWeeks} Wks`, label: 'Total Duration' },
            ].map((item, i, arr) => (
              <React.Fragment key={item.label}>
                <View style={s.planItem}>
                  <Text style={s.planVal}>{item.val}</Text>
                  <Text style={s.planLabel}>{item.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.planDivider} />}
              </React.Fragment>
            ))}
          </View>
          <ProgressBar
            percent={completionPercent}
            color={COLORS.yellow}
            height={6}
            style={{ marginTop: 16 }}
          />
          <Text style={s.planSub}>
            {currentWeek} of {totalWeeks} weeks completed
          </Text>
        </View>

        {/* Section header */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Assigned Exercises</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>{displayExercises.length}</Text>
          </View>
        </View>
        <Text style={s.note}>Assigned by {clinicianName} for your recovery plan.</Text>

        {displayExercises.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.emptyEmoji}>📋</Text>
            <Text style={s.emptyTitle}>No exercises found</Text>
            <Text style={s.emptySub}>Your care team will add exercises to your protocol soon.</Text>
          </Card>
        ) : (
          displayExercises.map(ex => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              onPress={() => navigation.navigate('ExerciseDetail', { exercise: ex })}
            />
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 16 },
  title:     { fontSize: 22, fontWeight: '800', color: COLORS.charcoal, marginBottom: 16 },

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

  planCard: {
    backgroundColor: COLORS.mint, borderRadius: RADIUS.xl,
    padding: 20, marginBottom: 22, ...SHADOW_MD,
  },
  planRow:    { flexDirection: 'row', alignItems: 'center' },
  planItem:   { flex: 1, alignItems: 'center' },
  planVal:    { fontSize: 15, fontWeight: '800', color: COLORS.charcoal },
  planLabel:  { fontSize: 10, color: COLORS.charcoal, opacity: 0.65, marginTop: 3 },
  planDivider:{ width: 1, height: 32, backgroundColor: 'rgba(20,23,23,0.15)' },
  planSub:    { fontSize: 11, color: COLORS.charcoal, opacity: 0.65, marginTop: 8, textAlign: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.charcoal },
  badge: {
    backgroundColor: COLORS.yellow, borderRadius: RADIUS.full,
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: COLORS.charcoal },
  note: { fontSize: 12, color: COLORS.charcoal, opacity: 0.6, marginBottom: 14, lineHeight: 18 },
});
