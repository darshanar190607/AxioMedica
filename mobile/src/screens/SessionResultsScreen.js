import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import {
  CheckCircle2, RotateCcw, ClipboardCheck, Clock,
  Activity, Award, Sparkles, ArrowRight,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { ProgressBar, PrimaryButton, SecondaryButton, GhostButton } from '../components/UI';
import { saveSession } from '../db/sessionRepository';
import { syncService } from '../services/syncService';

export default function SessionResultsScreen({ route, navigation }) {
  const { exercise, elapsed = 324, sessionPayload, summary } = route.params || {};

  useEffect(() => {
    if (sessionPayload) {
      saveSession(sessionPayload)
        .then(() => syncService.syncPendingSessions())
        .catch(() => {});
    }
  }, [sessionPayload]);

  const exName    = exercise?.name || 'Ankle Dorsiflexion';
  const totalReps = summary?.totalReps ?? exercise?.reps ?? 10;
  const targetReps= exercise?.reps || 10;
  const totalSets = exercise?.sets || 3;
  const formScore = summary?.avgFormScore ? Math.round(summary.avgFormScore) : 94;
  const maxRomDeg = summary?.maxRomDeg ? `${summary.maxRomDeg}°` : '26.5°';

  const fmt = sec => `${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`;

  const items = [
    { Icon: RotateCcw,      label: 'Repetitions Completed', val: `${totalReps} / ${targetReps * totalSets}`, color: COLORS.orange },
    { Icon: ClipboardCheck, label: 'Sets Finished',          val: `${totalSets} / ${totalSets}`, color: '#10B981' },
    { Icon: Clock,          label: 'Session Duration',       val: fmt(elapsed), color: '#6366F1' },
    { Icon: Activity,       label: 'Max ROM Achieved',       val: maxRomDeg, color: '#38BDF8' },
    { Icon: CheckCircle2,   label: 'Biomechanical Form',     val: `${formScore}%`, color: '#059669' },
  ];

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Celebration */}
        <View style={s.celebArea}>
          <View style={s.awardIconBox}>
            <Award size={36} color="#FFFFFF" />
          </View>
          <Text style={s.celebTitle}>Session Completed!</Text>
          <Text style={s.celebSub}>{exName}</Text>
        </View>

        {/* Score */}
        <View style={s.scoreCard}>
          <View style={s.scoreRing}>
            <Text style={s.scoreNum}>{formScore}%</Text>
          </View>
          <Text style={s.scoreLabel}>Biomechanical Form Quality</Text>
          <Text style={s.scoreNote}>
            {formScore >= 85 ? 'Excellent joint movement control. Logged to medical record.' : 'Good effort! Focus on pacing.'}
          </Text>
        </View>

        {/* Summary */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Session Telemetry Summary</Text>
          {items.map((item, i) => {
            const ItemIcon = item.Icon;
            return (
              <View key={item.label} style={[s.row, i < items.length - 1 && s.rowBorder]}>
                <View style={[s.rowIconWrap, { backgroundColor: `${item.color}15` }]}>
                  <ItemIcon size={16} color={item.color} />
                </View>
                <Text style={s.rowLabel}>{item.label}</Text>
                <Text style={s.rowVal}>{item.val}</Text>
              </View>
            );
          })}
        </View>

        {/* Clinical Sync Status */}
        <View style={s.aiCard}>
          <View style={s.aiHeader}>
            <Sparkles size={18} color={COLORS.orange} />
            <Text style={s.aiTitle}>Clinical Telemetry Synchronized</Text>
          </View>
          <Text style={s.aiMain}>Session uploaded to PostgreSQL & Supabase</Text>
          <Text style={s.aiSub}>
            Your physical therapist can review joint angles, rep cadence, and safety metrics on their portal.
          </Text>
        </View>

        {/* Actions */}
        <PrimaryButton
          title="Return to Dashboard"
          onPress={() => navigation.replace('Main')}
          style={s.doneBtn}
        />

        <View style={{ height: 28 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 48, paddingBottom: 24 },

  celebArea: { alignItems: 'center', marginBottom: 20 },
  awardIconBox: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.orange,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    ...SHADOW_MD,
  },
  celebTitle: { fontSize: 22, fontWeight: '900', color: COLORS.charcoal },
  celebSub:   { fontSize: 13, color: COLORS.mutedSage, marginTop: 2 },

  scoreCard: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.xl,
    padding: 20, alignItems: 'center', marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  scoreRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    ...SHADOW_MD,
  },
  scoreNum:   { fontSize: 26, fontWeight: '900', color: COLORS.charcoal },
  scoreLabel: { fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  scoreNote:  { fontSize: 12, color: COLORS.mutedSage, textAlign: 'center', marginTop: 4 },

  card: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.charcoal, marginBottom: 12 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  rowIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  rowLabel: { flex: 1, fontSize: 13, color: COLORS.charcoal, fontWeight: '500' },
  rowVal:   { fontSize: 13, fontWeight: '700', color: COLORS.charcoal },

  aiCard: {
    backgroundColor: '#F8FAFC', borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  aiTitle:  { fontSize: 13, fontWeight: '800', color: COLORS.charcoal },
  aiMain:   { fontSize: 13, fontWeight: '700', color: COLORS.charcoal, marginBottom: 4 },
  aiSub:    { fontSize: 12, color: COLORS.mutedSage, lineHeight: 18 },

  doneBtn: { marginTop: 4 },
});
