import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Activity, Play, ChevronRight } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW } from '../data/theme';
import { ProgressBar } from './UI';

export default function ExerciseCard({ exercise, onPress }) {
  const isDorsi = exercise.name?.toLowerCase().includes('dorsi');
  const isPlantar = exercise.name?.toLowerCase().includes('plantar');
  const isInversion = exercise.name?.toLowerCase().includes('inversion');

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.iconBox}>
        <Activity size={22} color={COLORS.charcoal} strokeWidth={2.2} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{exercise.name}</Text>
        <Text style={styles.meta}>
          {exercise.sets || 3} Sets × {exercise.reps || 10} Reps · {exercise.frequency || 'Daily'}
        </Text>
        <ProgressBar
          percent={exercise.progress || 60}
          color={COLORS.orange}
          height={5}
          style={{ marginTop: 8 }}
        />
        <Text style={styles.pct}>{exercise.progress || 60}% complete</Text>
      </View>
      <View style={styles.startBtn}>
        <Play size={12} color={COLORS.charcoal} fill={COLORS.charcoal} style={{ marginRight: 4 }} />
        <Text style={styles.startText}>Start</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.mint,
    borderRadius: RADIUS.lg,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    ...SHADOW,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  meta: { fontSize: 11, color: COLORS.charcoal, opacity: 0.7, marginTop: 2 },
  pct:  { fontSize: 10, color: COLORS.charcoal, opacity: 0.65, marginTop: 3 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.yellow,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 10,
  },
  startText: { fontSize: 12, fontWeight: '800', color: COLORS.charcoal },
});
