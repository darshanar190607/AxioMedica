import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { Card, ProgressBar, SectionTitle } from '../components/UI';
import ExerciseCard from '../components/ExerciseCard';
import { patient, assignedExercises, stats, sessionHistory } from '../data/patientData';

export default function DashboardScreen({ navigation }) {
  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Good Morning, {patient.name.split(' ')[0]} 👋</Text>
            <Text style={s.subHeader}>
              {patient.injuredAnkle} Ankle · Recovery Stage {patient.recoveryStage}
            </Text>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => navigation.navigate('Profile')}>
            <Text style={s.avatarText}>{patient.name.split(' ').map(n => n[0]).join('')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recovery Card ── */}
        <View style={s.recoveryCard}>
          <View style={s.recoveryTop}>
            <View>
              <Text style={s.recoveryLabel}>Your Recovery</Text>
              <Text style={s.recoveryWeek}>Week {patient.currentWeek} of {patient.totalWeeks}</Text>
            </View>
            <View style={s.percentRing}>
              <Text style={s.percentNum}>{patient.recoveryPercent}%</Text>
            </View>
          </View>
          <ProgressBar
            percent={patient.recoveryPercent}
            color={COLORS.yellow}
            height={8}
            style={s.recoveryBar}
          />
          <Text style={s.encouragement}>Keep going! You're making great progress. 💪</Text>
        </View>

        {/* ── Today's Exercises ── */}
        <SectionTitle title="Today's Exercises" />
        {assignedExercises.slice(0, 2).map(ex => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            onPress={() => navigation.navigate('ExerciseDetail', { exercise: ex })}
          />
        ))}

        {/* ── Continue CTA ── */}
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() => navigation.navigate('ExerciseDetail', { exercise: assignedExercises[0] })}
          activeOpacity={0.88}
        >
          <Text style={s.ctaText}>▶  Continue Exercise</Text>
        </TouchableOpacity>

        {/* ── Quick Stats ── */}
        <SectionTitle title="Quick Stats" />
        <View style={s.statsRow}>
          {[
            { val: stats.completedSessions, label: 'Completed\nSessions', bg: COLORS.offWhite,    color: COLORS.orange },
            { val: stats.totalReps,         label: 'Total\nRepetitions',  bg: COLORS.cream,       color: COLORS.charcoal },
            { val: `${stats.accuracy}%`,    label: 'Exercise\nAccuracy',  bg: COLORS.yellowLight, color: COLORS.charcoal },
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
              <Text style={s.recentDate}>Yesterday, 6:10 PM</Text>
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
            {sessionHistory.map((item, i) => (
              <View key={i} style={s.trendCol}>
                <Text style={s.trendScore}>{item.score}%</Text>
                <View style={[s.trendBar, {
                  height: (item.score / 100) * 64,
                  backgroundColor: i === sessionHistory.length - 1 ? COLORS.orange : COLORS.mint,
                }]} />
                <Text style={s.trendLabel}>{item.session}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* ── Sensor Status ── */}
        <SectionTitle title="Sensor Status" />
        <Card>
          {[
            { name: 'Camera',     icon: '📷', connected: true },
            { name: 'IMU Sensor', icon: '📡', connected: true },
            { name: 'EMG Sensor', icon: '⚡', connected: false },
          ].map((item, i, arr) => (
            <View key={item.name} style={[s.sensorRow, i < arr.length - 1 && s.sensorBorder]}>
              <Text style={s.sensorIcon}>{item.icon}</Text>
              <Text style={s.sensorName}>{item.name}</Text>
              <View style={[s.sensorPill, {
                backgroundColor: item.connected ? COLORS.mintLight : COLORS.lightGray,
              }]}>
                <View style={[s.sensorDot, { backgroundColor: item.connected ? COLORS.safe : COLORS.mutedSage }]} />
                <Text style={[s.sensorStatus, { color: item.connected ? COLORS.safe : COLORS.mutedSage }]}>
                  {item.connected ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.sage },
  scroll:    { paddingHorizontal: 18, paddingTop: 50, paddingBottom: 16 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 18,
  },
  greeting:  { fontSize: 19, fontWeight: '800', color: COLORS.charcoal },
  subHeader: { fontSize: 12, color: COLORS.charcoal, opacity: 0.65, marginTop: 3 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center', ...SHADOW,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: COLORS.charcoal },

  recoveryCard: {
    backgroundColor: COLORS.mint, borderRadius: RADIUS.xl,
    padding: 20, marginBottom: 20, ...SHADOW_MD,
  },
  recoveryTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recoveryLabel:{ fontSize: 17, fontWeight: '800', color: COLORS.charcoal },
  recoveryWeek: { fontSize: 12, color: COLORS.charcoal, opacity: 0.7, marginTop: 3 },
  percentRing: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center', ...SHADOW,
  },
  percentNum:   { fontSize: 20, fontWeight: '900', color: COLORS.charcoal },
  recoveryBar:  { marginTop: 14, marginBottom: 8 },
  encouragement:{ fontSize: 12, color: COLORS.charcoal, opacity: 0.75, fontStyle: 'italic' },

  ctaBtn: {
    backgroundColor: COLORS.yellow, borderRadius: RADIUS.full,
    paddingVertical: 14, alignItems: 'center',
    marginBottom: 22, ...SHADOW_MD,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1, borderRadius: RADIUS.lg, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  statNum:   { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 10, color: COLORS.mutedSage, textAlign: 'center', marginTop: 4, lineHeight: 14 },

  recentCard: { marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  recentIconBox: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cream,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  recentEmoji: { fontSize: 20 },
  recentName:  { fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  recentDate:  { fontSize: 11, color: COLORS.mutedSage, marginTop: 2 },
  recentReps:  { fontSize: 11, color: COLORS.mutedSage, marginTop: 1 },
  scoreBadge: {
    backgroundColor: COLORS.cream, borderRadius: RADIUS.md,
    padding: 10, alignItems: 'center', minWidth: 54,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  scoreNum:   { fontSize: 17, fontWeight: '800', color: COLORS.orange },
  scoreLabel: { fontSize: 10, color: COLORS.mutedSage },

  trendCard:  { marginBottom: 20 },
  trendChart: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-around', height: 88, paddingTop: 8,
  },
  trendCol:   { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  trendScore: { fontSize: 9, color: COLORS.mutedSage, marginBottom: 3 },
  trendBar:   { width: 24, borderRadius: 6, marginBottom: 5 },
  trendLabel: { fontSize: 10, color: COLORS.mutedSage },

  sensorRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  sensorBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  sensorIcon:   { fontSize: 16, marginRight: 10 },
  sensorName:   { flex: 1, fontSize: 13, color: COLORS.charcoal, fontWeight: '500' },
  sensorPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  sensorDot:    { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  sensorStatus: { fontSize: 11, fontWeight: '600' },
});
