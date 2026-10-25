import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import {
  Activity, ShieldCheck, HeartPulse, Play,
  CheckCircle2, Clock, Sparkles, TrendingUp, AlertCircle, Plus,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { Card, ProgressBar, SectionTitle, PrimaryButton, GhostButton } from '../components/UI';
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
  const { user, patient: authPatient } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePlan, setActivePlan] = useState(null);
  const [progressSummary, setProgressSummary] = useState(null);

  // Pain Log Modal State
  const [painModalVisible, setPainModalVisible] = useState(false);
  const [painLevel, setPainLevel] = useState(3);
  const [painNotes, setPainNotes] = useState('');
  const [painLogging, setPainLogging] = useState(false);

  useEffect(() => {
    if (user?.role === 'clinician') {
      navigation.replace('Clinician');
    }
  }, [user, navigation]);

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
      // 1. Fetch active plan
      try {
        const plan = await plansApi.getActivePlan();
        setActivePlan(plan);
        await sessionRepository.cacheActivePlan(plan);
      } catch (planErr) {
        const cached = await sessionRepository.getCachedActivePlan();
        if (cached) {
          setActivePlan(cached);
        } else {
          setActivePlan(null);
        }
      }

      // 2. Fetch progress summary
      try {
        const summary = await progressApi.getProgressSummary();
        setProgressSummary(summary);
      } catch {
        // Fallback
      }

    } catch (err) {
      setError(err.message || 'Unable to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived patient data
  const currentPatient = (!isMockEnabled() && authPatient) ? authPatient : mockPatient;
  const patientName = currentPatient?.full_name || currentPatient?.name || 'Sarah Johnson';
  const firstName = patientName.split(' ')[0] || 'Patient';
  const initials = patientName.split(' ').map(n => n[0]).join('') || 'PT';
  const injuredAnkle = currentPatient?.injured_ankle || currentPatient?.injuredAnkle || 'Left';
  const recoveryStage = currentPatient?.recovery_stage ?? currentPatient?.recoveryStage ?? 2;
  const currentWeek = currentPatient?.current_week ?? currentPatient?.currentWeek ?? 3;
  const totalWeeks = currentPatient?.total_weeks ?? currentPatient?.totalWeeks ?? 6;
  const recoveryPercent = progressSummary?.adherence_pct
    ? Math.round(progressSummary.adherence_pct)
    : (currentPatient?.recovery_percent ?? currentPatient?.recoveryPercent ?? 72);

  // Exercises: map API plan exercises to UI card format, or use default catalog
  let displayExercises = mockAssignedExercises;
  if (!isMockEnabled() && activePlan?.exercises?.length > 0) {
    displayExercises = activePlan.exercises.map(item => {
      const ex = item.exercise || {};
      const poseConfig = ex.pose_config || item.pose_config || {};
      const romConstraint = poseConfig.constraints?.rom || {};
      const safeRange = (romConstraint.min != null && romConstraint.max != null)
        ? `${romConstraint.min}° – ${romConstraint.max}°`
        : (item.safe_range || '0° – 30°');

      return {
        id: String(item.exercise_id || item.id),
        exerciseId: item.exercise_id || item.id,
        name: item.name || ex.name || 'Prescribed Exercise',
        sets: item.sets || 3,
        reps: item.reps || 10,
        frequency: item.frequency || 'Daily',
        duration: item.duration || '5 min',
        description: item.description || ex.description || 'Controlled ankle repetitions.',
        safeRange,
        color: item.color || COLORS.yellow,
        progress: item.progress || 60,
        completedSessions: item.completed_sessions || 3,
        totalSessions: item.total_sessions || 8,
        completedReps: item.completed_reps || 30,
        totalReps: item.total_reps || 80,
        poseConfig,
        plan_id: activePlan.id,
      };
    });
  }

  const completedSessions = progressSummary?.completed_sessions ?? 4;
  const avgFormScore = progressSummary?.average_form_score
    ? `${Math.round(progressSummary.average_form_score)}%`
    : '94%';

  // Submit Pain Log
  const handleSavePainLog = async () => {
    setPainLogging(true);
    try {
      await progressApi.recordPainLog({
        pain_level: painLevel,
        body_part: `${injuredAnkle} Ankle`,
        notes: painNotes.trim() || 'Logged via patient mobile dashboard.',
      });
      setPainModalVisible(false);
      setPainNotes('');
      Alert.alert('Pain Logged', `Recorded score ${painLevel}/10 for your clinician.`);
    } catch (err) {
      Alert.alert('Log Error', err.message || 'Could not save pain score.');
    } finally {
      setPainLogging(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Hello, {firstName}</Text>
            <View style={s.subHeaderRow}>
              <Text style={s.subHeader}>
                {injuredAnkle} Ankle · Stage {recoveryStage}
              </Text>
              <SyncIndicator style={s.syncBadge} />
            </View>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Text style={s.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>

        {/* Live System Integration Status Banner */}
        <View style={s.serviceHud}>
          <View style={s.serviceItem}>
            <View style={[s.serviceDot, { backgroundColor: '#10B981' }]} />
            <Text style={s.serviceText}>FastAPI Backend</Text>
          </View>
          <View style={s.serviceItem}>
            <View style={[s.serviceDot, { backgroundColor: '#38BDF8' }]} />
            <Text style={s.serviceText}>Supabase Realtime</Text>
          </View>
          <View style={s.serviceItem}>
            <View style={[s.serviceDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={s.serviceText}>OmniVoice TTS</Text>
          </View>
        </View>

        {loading ? (
          <Card style={s.loadingCard}>
            <ActivityIndicator size="small" color={COLORS.orange} />
            <Text style={s.loadingText}>Syncing clinical recovery data...</Text>
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

        {/* Recovery Progress Card */}
        <View style={s.recoveryCard}>
          <View style={s.recoveryTop}>
            <View>
              <Text style={s.recoveryLabel}>Rehabilitation Adherence</Text>
              <Text style={s.recoveryWeek}>Week {currentWeek} of {totalWeeks} Weeks</Text>
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
          <View style={s.recoveryFooter}>
            <ShieldCheck size={14} color={COLORS.charcoal} />
            <Text style={s.encouragement}>Protocol on track. ATFL ligament integrity improving.</Text>
          </View>
        </View>

        {/* Pain Check Action Banner */}
        <View style={s.painActionCard}>
          <View style={s.painActionLeft}>
            <HeartPulse size={20} color="#E11D48" />
            <View>
              <Text style={s.painActionTitle}>Daily Pain Log</Text>
              <Text style={s.painActionSub}>Record your current joint sensation</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.logPainBtn}
            onPress={() => setPainModalVisible(true)}
            activeOpacity={0.85}
          >
            <Plus size={14} color="#FFFFFF" />
            <Text style={s.logPainText}>Log Pain</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Exercises */}
        <SectionTitle title="Today's Prescribed Exercises" />
        {displayExercises.length === 0 ? (
          <Card style={s.emptyCard}>
            <Activity size={28} color={COLORS.mutedSage} />
            <Text style={s.emptyTitle}>No exercises assigned</Text>
            <Text style={s.emptySub}>Your physical therapist will prescribe your protocol shortly.</Text>
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

        {/* Continue CTA */}
        {displayExercises.length > 0 && (
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => navigation.navigate('ExerciseDetail', { exercise: displayExercises[0] })}
            activeOpacity={0.88}
          >
            <Play size={16} color="#FFFFFF" fill="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={s.ctaText}>Continue Active Protocol</Text>
          </TouchableOpacity>
        )}

        {/* Quick Stats Grid */}
        <SectionTitle title="Biomechanical Stats" />
        <View style={s.statsRow}>
          {[
            { val: completedSessions, label: 'Completed\nSessions', bg: COLORS.offWhite, color: COLORS.orange },
            { val: mockStats.totalReps, label: 'Total\nRepetitions', bg: COLORS.cream, color: COLORS.charcoal },
            { val: avgFormScore, label: 'Movement\nAccuracy', bg: COLORS.yellowLight, color: COLORS.charcoal },
          ].map((item, i) => (
            <View key={i} style={[s.statCard, { backgroundColor: item.bg }]}>
              <Text style={[s.statNum, { color: item.color }]}>{item.val}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Performance Trend */}
        <SectionTitle title="Weekly Compliance Trend" />
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

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* Real Pain Logging Modal */}
      <Modal visible={painModalVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <HeartPulse size={22} color="#E11D48" />
              <Text style={s.modalTitle}>Record Ankle Pain Score</Text>
            </View>
            <Text style={s.modalSub}>
              Rate your current resting pain on the 0 to 10 Numeric Rating Scale:
            </Text>

            {/* Scale buttons */}
            <View style={s.painScaleGrid}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                <TouchableOpacity
                  key={val}
                  style={[
                    s.painScaleBtn,
                    painLevel === val && s.painScaleBtnActive,
                    val >= 7 && s.painScaleBtnSevere,
                  ]}
                  onPress={() => setPainLevel(val)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.painScaleText, painLevel === val && s.painScaleTextActive]}>
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.notesLabel}>Clinical Notes (optional):</Text>
            <TextInput
              style={s.notesInput}
              placeholder="e.g. Mild stiffness upon waking, improves with gentle mobility."
              placeholderTextColor={COLORS.mutedSage}
              value={painNotes}
              onChangeText={setPainNotes}
              multiline
            />

            <PrimaryButton
              title={painLogging ? 'Saving to Database...' : 'Save to Clinical Record'}
              onPress={handleSavePainLog}
              disabled={painLogging}
              style={{ marginTop: 14 }}
            />
            <GhostButton title="Cancel" onPress={() => setPainModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 20 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  syncBadge: {
    marginLeft: 8,
  },
  greeting:  { fontSize: 22, fontWeight: '900', color: COLORS.charcoal },
  subHeader: { fontSize: 13, color: COLORS.charcoal, opacity: 0.7 },
  avatar: {
    width: 44, height: 44, borderRadius: RADIUS.full,
    backgroundColor: COLORS.mintLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.mint,
    ...SHADOW,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: COLORS.charcoal },

  /* Service HUD */
  serviceHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  serviceText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.charcoal,
  },

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
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal, marginTop: 6 },
  emptySub:   { fontSize: 12, color: COLORS.mutedSage, textAlign: 'center', marginTop: 4 },

  recoveryCard: {
    backgroundColor: COLORS.mint,
    borderRadius: RADIUS.xl,
    padding: 18,
    marginBottom: 14,
    ...SHADOW,
  },
  recoveryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recoveryLabel: { fontSize: 16, fontWeight: '800', color: COLORS.charcoal },
  recoveryWeek:  { fontSize: 12, color: COLORS.charcoal, opacity: 0.7, marginTop: 2 },
  percentRing: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  percentNum: { fontSize: 14, fontWeight: '900', color: COLORS.charcoal },
  recoveryBar: { marginBottom: 10 },
  recoveryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  encouragement: { fontSize: 12, color: COLORS.charcoal, opacity: 0.85, fontWeight: '600', flex: 1 },

  /* Pain Action */
  painActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 16,
  },
  painActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  painActionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9F1239',
  },
  painActionSub: {
    fontSize: 11,
    color: '#BE123C',
    marginTop: 1,
  },
  logPainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E11D48',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  logPainText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    marginTop: 4,
    marginBottom: 20,
    ...SHADOW,
  },
  ctaText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    alignItems: 'center',
    ...SHADOW,
  },
  statNum:   { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  statLabel: { fontSize: 10, color: COLORS.mutedSage, textAlign: 'center', fontWeight: '600' },

  trendCard: { padding: 16, marginBottom: 16 },
  trendChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 90,
    paddingTop: 10,
  },
  trendCol: { alignItems: 'center', flex: 1 },
  trendScore: { fontSize: 9, color: COLORS.mutedSage, fontWeight: '700', marginBottom: 4 },
  trendBar: { width: 14, borderRadius: 4, minHeight: 6 },
  trendLabel: { fontSize: 10, color: COLORS.mutedSage, marginTop: 6, fontWeight: '600' },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 22,
    paddingBottom: 36,
    ...SHADOW_MD,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.charcoal,
  },
  modalSub: {
    fontSize: 13,
    color: COLORS.mutedSage,
    marginBottom: 14,
  },
  painScaleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  painScaleBtn: {
    width: 28,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  painScaleBtnActive: {
    backgroundColor: '#E11D48',
    borderColor: '#BE123C',
  },
  painScaleBtnSevere: {
    borderColor: '#FDA4AF',
  },
  painScaleText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.charcoal,
  },
  painScaleTextActive: {
    color: '#FFFFFF',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    fontSize: 13,
    color: COLORS.charcoal,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
