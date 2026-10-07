import React from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { ProgressBar } from '../components/UI';
import { patient, sessionHistory } from '../data/patientData';

export default function ProgressScreen() {
  const maxScore = Math.max(...sessionHistory.map(s => s.score));

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.sage} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.title}>Recovery Progress</Text>

        {/* A. Overall Recovery */}
        <View style={s.overallCard}>
          <View style={s.overallTop}>
            <View>
              <Text style={s.overallTitle}>Overall Recovery</Text>
              <Text style={s.overallSub}>Week {patient.currentWeek} of {patient.totalWeeks}</Text>
              <Text style={s.overallSub}>Recovery Stage {patient.recoveryStage}</Text>
            </View>
            <View style={s.bigRing}>
              <Text style={s.bigPct}>{patient.recoveryPercent}%</Text>
              <Text style={s.bigLabel}>Recovered</Text>
            </View>
          </View>
          <ProgressBar
            percent={patient.recoveryPercent}
            color={COLORS.yellow}
            height={8}
            style={{ marginTop: 16 }}
          />
        </View>

        {/* B. Exercise Completion */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Exercise Completion</Text>
          <View style={s.completionRow}>
            <Text style={s.completionBig}>24</Text>
            <Text style={s.completionOf}> / 30 sessions</Text>
          </View>
          <ProgressBar percent={80} color={COLORS.orange} height={8} style={{ marginTop: 10 }} />
          <Text style={s.completionSub}>80% complete</Text>
        </View>

        {/* C. Performance Trend */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Performance Trend</Text>
          <View style={s.chartArea}>
            <View style={s.yAxis}>
              {[100, 75, 50, 25].map(v => (
                <Text key={v} style={s.yLabel}>{v}</Text>
              ))}
            </View>
            <View style={s.chartBody}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[s.gridLine, { bottom: `${i * 25}%` }]} />
              ))}
              <View style={s.barsRow}>
                {sessionHistory.map((item, i) => (
                  <View key={i} style={s.barCol}>
                    <Text style={s.barScore}>{item.score}%</Text>
                    <View style={[s.bar, {
                      height: `${item.score}%`,
                      backgroundColor: item.score === maxScore ? COLORS.orange : COLORS.mint,
                    }]} />
                    <Text style={s.barLabel}>{item.session}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* D. Movement Quality */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Movement Quality</Text>
          {[
            { label: 'Accuracy',   pct: 91, val: '91%', color: COLORS.safe },
            { label: 'Safe Range', pct: 94, val: '94%', color: COLORS.orange },
          ].map(item => (
            <View key={item.label} style={s.qualityRow}>
              <Text style={s.qualityLabel}>{item.label}</Text>
              <View style={s.qualityBarWrap}>
                <ProgressBar percent={item.pct} color={item.color} height={7} />
              </View>
              <Text style={[s.qualityVal, { color: item.color }]}>{item.val}</Text>
            </View>
          ))}
          <View style={s.qualityStats}>
            <View style={s.qStat}>
              <Text style={s.qStatNum}>86</Text>
              <Text style={s.qStatLabel}>Correct{'\n'}Movements</Text>
            </View>
            <View style={s.qStatDiv} />
            <View style={s.qStat}>
              <Text style={[s.qStatNum, { color: COLORS.caution }]}>8</Text>
              <Text style={s.qStatLabel}>Corrections{'\n'}Made</Text>
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
  title:     { fontSize: 22, fontWeight: '800', color: COLORS.charcoal, marginBottom: 16 },

  overallCard: {
    backgroundColor: COLORS.mint, borderRadius: RADIUS.xl,
    padding: 20, marginBottom: 14, ...SHADOW_MD,
  },
  overallTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overallTitle:{ fontSize: 17, fontWeight: '800', color: COLORS.charcoal },
  overallSub:  { fontSize: 11, color: COLORS.charcoal, opacity: 0.65, marginTop: 3 },
  bigRing: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center', ...SHADOW,
  },
  bigPct:  { fontSize: 22, fontWeight: '900', color: COLORS.charcoal },
  bigLabel:{ fontSize: 9, color: COLORS.charcoal, opacity: 0.7 },

  card: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal, marginBottom: 12 },

  completionRow: { flexDirection: 'row', alignItems: 'baseline' },
  completionBig: { fontSize: 36, fontWeight: '900', color: COLORS.charcoal },
  completionOf:  { fontSize: 15, color: COLORS.mutedSage },
  completionSub: { fontSize: 12, color: COLORS.mutedSage, marginTop: 6 },

  chartArea: { flexDirection: 'row', height: 140, marginTop: 4 },
  yAxis:     { width: 26, justifyContent: 'space-between', paddingBottom: 24 },
  yLabel:    { fontSize: 9, color: COLORS.mutedSage, textAlign: 'right' },
  chartBody: { flex: 1, position: 'relative' },
  gridLine:  { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: COLORS.lightGray },
  barsRow:   { flexDirection: 'row', alignItems: 'flex-end', height: '100%', paddingBottom: 24 },
  barCol:    { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar:       { width: 26, borderRadius: 6, minHeight: 4 },
  barLabel:  { fontSize: 9, color: COLORS.mutedSage, marginTop: 4 },
  barScore:  { fontSize: 8, color: COLORS.mutedSage, marginBottom: 2 },

  qualityRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  qualityLabel:   { width: 80, fontSize: 13, color: COLORS.charcoal, fontWeight: '500' },
  qualityBarWrap: { flex: 1, marginHorizontal: 10 },
  qualityVal:     { width: 34, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  qualityStats: {
    flexDirection: 'row', marginTop: 8,
    backgroundColor: COLORS.cream, borderRadius: RADIUS.md,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.lightGray,
  },
  qStat:    { flex: 1, alignItems: 'center', paddingVertical: 16 },
  qStatDiv: { width: 1, backgroundColor: COLORS.lightGray },
  qStatNum: { fontSize: 28, fontWeight: '900', color: COLORS.charcoal },
  qStatLabel:{ fontSize: 10, color: COLORS.mutedSage, textAlign: 'center', marginTop: 3 },
});
