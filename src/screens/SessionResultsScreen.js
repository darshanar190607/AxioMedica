import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { ProgressBar, PrimaryButton, SecondaryButton, GhostButton } from '../components/UI';

export default function SessionResultsScreen({ route, navigation }) {
  const { exercise, elapsed = 324 } = route.params || {};
  const exName    = exercise?.name || 'Dorsiflexion';
  const totalReps = exercise?.reps || 10;
  const totalSets = exercise?.sets || 3;
  const fmt = sec => `${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`;

  const items = [
    { icon: '🔄', label: 'Repetitions',       val: `${totalReps} / ${totalReps}` },
    { icon: '📋', label: 'Sets',              val: `${totalSets} / ${totalSets}` },
    { icon: '⏱',  label: 'Duration',          val: fmt(elapsed) },
    { icon: '✅', label: 'Correct Movements', val: '27' },
    { icon: '⚠️', label: 'Corrections',       val: '3' },
  ];

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Celebration */}
        <View style={s.celebArea}>
          <Text style={s.celebEmoji}>🎉</Text>
          <Text style={s.celebTitle}>Exercise Completed!</Text>
          <Text style={s.celebSub}>{exName}</Text>
        </View>

        {/* Score */}
        <View style={s.scoreCard}>
          <View style={s.scoreRing}>
            <Text style={s.scoreNum}>92%</Text>
          </View>
          <Text style={s.scoreLabel}>Performance Score</Text>
          <Text style={s.scoreNote}>Excellent work! Keep it up 💪</Text>
        </View>

        {/* Summary */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Session Summary</Text>
          {items.map((item, i) => (
            <View key={item.label} style={[s.row, i < items.length - 1 && s.rowBorder]}>
              <Text style={s.rowIcon}>{item.icon}</Text>
              <Text style={s.rowLabel}>{item.label}</Text>
              <Text style={s.rowVal}>{item.val}</Text>
            </View>
          ))}
        </View>

        {/* AI Feedback */}
        <View style={s.aiCard}>
          <View style={s.aiHeader}>
            <View style={s.aiIconBox}><Text style={s.aiIconEmoji}>🤖</Text></View>
            <Text style={s.aiTitle}>AI Feedback</Text>
          </View>
          <Text style={s.aiMain}>Excellent ankle control!</Text>
          <Text style={s.aiSub}>
            Keep maintaining your movement within the recommended range. Your ankle angle was
            consistent throughout the session.
          </Text>
        </View>

        {/* Exercise Progress */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Exercise Progress</Text>
          <ProgressBar
            percent={78}
            color={COLORS.orange}
            height={8}
            style={{ marginVertical: 10 }}
          />
          <View style={s.progressRow}>
            <Text style={s.progressPct}>78%</Text>
            <Text style={s.progressSub}>7 of 9 sessions completed</Text>
          </View>
        </View>

        <PrimaryButton
          title="Continue to Next Exercise"
          onPress={() => navigation.navigate('MyPlan')}
          style={s.btn}
        />
        <SecondaryButton
          title="View Progress"
          onPress={() => navigation.navigate('Progress')}
          style={s.btn}
        />
        <GhostButton title="Back to Dashboard" onPress={() => navigation.navigate('Main')} />

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 16 },

  celebArea:  { alignItems: 'center', marginBottom: 20 },
  celebEmoji: { fontSize: 54, marginBottom: 8 },
  celebTitle: { fontSize: 24, fontWeight: '900', color: COLORS.charcoal },
  celebSub:   { fontSize: 14, color: COLORS.charcoal, opacity: 0.65, marginTop: 4 },

  scoreCard: {
    backgroundColor: COLORS.mint, borderRadius: RADIUS.xl,
    padding: 24, alignItems: 'center', marginBottom: 14, ...SHADOW_MD,
  },
  scoreRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    borderWidth: 3, borderColor: COLORS.offWhite, ...SHADOW,
  },
  scoreNum:   { fontSize: 30, fontWeight: '900', color: COLORS.charcoal },
  scoreLabel: { fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  scoreNote:  { fontSize: 12, color: COLORS.charcoal, opacity: 0.65, marginTop: 4 },

  card: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal, marginBottom: 12 },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  rowIcon:   { fontSize: 15, marginRight: 10, width: 22 },
  rowLabel:  { flex: 1, fontSize: 13, color: COLORS.mutedSage },
  rowVal:    { fontSize: 13, fontWeight: '700', color: COLORS.charcoal },

  aiCard: {
    backgroundColor: COLORS.cream, borderRadius: RADIUS.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  aiHeader:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  aiIconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  aiIconEmoji: { fontSize: 16 },
  aiTitle:     { fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  aiMain:      { fontSize: 15, fontWeight: '700', color: COLORS.orange, marginBottom: 6 },
  aiSub:       { fontSize: 13, color: COLORS.mutedSage, lineHeight: 19 },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressPct: { fontSize: 15, fontWeight: '800', color: COLORS.orange },
  progressSub: { fontSize: 12, color: COLORS.mutedSage },

  btn: { marginBottom: 10 },
});
