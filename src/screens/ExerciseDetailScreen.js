import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';
import { ProgressBar, PrimaryButton } from '../components/UI';

const DEMO_DURATION = 8000;

export default function ExerciseDetailScreen({ route, navigation }) {
  const { exercise } = route.params;
  const [demoFinished, setDemoFinished] = useState(false);
  const [playing,      setPlaying]      = useState(false);
  const [progress,     setProgress]     = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

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
            <Text style={s.exMeta}>Week 3 · {exercise.sets} Sets × {exercise.reps} Reps</Text>
          </View>
        </View>

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
              <Text style={s.rangeVal}>{exercise.safeRange}</Text>
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
            percent={exercise.progress}
            color={COLORS.orange}
            height={8}
            style={{ marginVertical: 10 }}
          />
          <Text style={s.progressPct}>{exercise.progress}% complete</Text>
          <View style={s.statsRow}>
            <View style={s.pStat}>
              <Text style={s.pStatVal}>{exercise.completedSessions}/{exercise.totalSessions}</Text>
              <Text style={s.pStatLabel}>Sessions</Text>
            </View>
            <View style={s.pStatDiv} />
            <View style={s.pStat}>
              <Text style={s.pStatVal}>{exercise.completedReps}/{exercise.totalReps}</Text>
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
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
    marginRight: 12, borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  backIcon:   { fontSize: 18, color: COLORS.charcoal },
  headerInfo: { flex: 1 },
  exName:     { fontSize: 19, fontWeight: '800', color: COLORS.charcoal },
  exMeta:     { fontSize: 12, color: COLORS.charcoal, opacity: 0.65, marginTop: 2 },

  videoCard: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.xl,
    overflow: 'hidden', marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  videoArea: {
    height: 200, backgroundColor: '#1C2B1C',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  videoContent: { alignItems: 'center' },
  videoEmoji:   { fontSize: 50, marginBottom: 10 },
  videoLabel:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  playOverlay:  { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', ...SHADOW_MD,
  },
  playIcon:  { fontSize: 22, color: COLORS.charcoal, marginLeft: 4 },
  doneChip: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: COLORS.safe, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  doneChipText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  videoControls: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
  },
  timeText: { fontSize: 11, color: COLORS.mutedSage, width: 28 },
  videoBar: { flex: 1, height: 3, backgroundColor: COLORS.lightGray, borderRadius: 2, overflow: 'hidden' },
  videoFill:{ height: 3, backgroundColor: COLORS.orange, borderRadius: 2 },
  demoBanner: { backgroundColor: COLORS.safe, paddingVertical: 9, alignItems: 'center' },
  demoBannerText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  descCard: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  descTitle: { fontSize: 14, fontWeight: '700', color: COLORS.charcoal, marginBottom: 8 },
  descText:  { fontSize: 13, color: COLORS.mutedSage, lineHeight: 20 },
  rangeRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  rangeLabel:{ fontSize: 13, color: COLORS.charcoal, fontWeight: '600', marginRight: 8 },
  rangePill: {
    backgroundColor: COLORS.cream, borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  rangeVal: { fontSize: 12, fontWeight: '700', color: COLORS.orange },

  startBtn:  { marginBottom: 8 },
  watchNote: { fontSize: 12, color: COLORS.charcoal, opacity: 0.55, textAlign: 'center', marginBottom: 14 },

  progressCard: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    padding: 16, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.lightGray, ...SHADOW,
  },
  progressTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal, marginBottom: 2 },
  progressSub:   { fontSize: 12, color: COLORS.mutedSage, marginBottom: 2 },
  progressPct:   { fontSize: 12, color: COLORS.mutedSage, marginBottom: 12 },
  statsRow: {
    flexDirection: 'row', backgroundColor: COLORS.cream,
    borderRadius: RADIUS.md, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  pStat:     { flex: 1, alignItems: 'center', paddingVertical: 14 },
  pStatDiv:  { width: 1, backgroundColor: COLORS.lightGray },
  pStatVal:  { fontSize: 19, fontWeight: '800', color: COLORS.charcoal },
  pStatLabel:{ fontSize: 11, color: COLORS.mutedSage, marginTop: 3 },
});
