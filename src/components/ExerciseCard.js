import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../data/theme';
import { ProgressBar } from './UI';

export default function ExerciseCard({ exercise, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.iconBox}>
        <Text style={styles.iconEmoji}>🦶</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{exercise.name}</Text>
        <Text style={styles.meta}>{exercise.sets} Sets × {exercise.reps} Reps  ·  {exercise.frequency}</Text>
        <ProgressBar percent={exercise.progress} color={COLORS.orange} height={5} style={{ marginTop: 8 }} />
        <Text style={styles.pct}>{exercise.progress}% complete</Text>
      </View>
      <TouchableOpacity style={styles.startBtn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.startText}>Start</Text>
      </TouchableOpacity>
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
    width: 46, height: 46, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  iconEmoji: { fontSize: 22 },
  body: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  meta: { fontSize: 11, color: COLORS.charcoal, opacity: 0.7, marginTop: 2 },
  pct:  { fontSize: 10, color: COLORS.charcoal, opacity: 0.65, marginTop: 3 },
  startBtn: {
    backgroundColor: COLORS.yellow,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 8,
    marginLeft: 10,
  },
  startText: { fontSize: 12, fontWeight: '700', color: COLORS.charcoal },
});
