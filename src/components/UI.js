7import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, RADIUS, SHADOW, SHADOW_MD } from '../data/theme';

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({ title, onPress, disabled, style }) {
  return (
    <TouchableOpacity
      style={[styles.primary, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
    >
      <Text style={[styles.primaryText, disabled && styles.disabledText]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ title, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.secondary, style]} onPress={onPress} activeOpacity={0.82}>
      <Text style={styles.secondaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function GhostButton({ title, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.ghost, style]} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.ghostText}>{title}</Text>
    </TouchableOpacity>
  );
}

export function ProgressBar({ percent, color, height = 8, style }) {
  return (
    <View style={[styles.barBg, { height }, style]}>
      <View style={[
        styles.barFill,
        { width: `${Math.min(Math.max(percent, 0), 100)}%`, backgroundColor: color || COLORS.yellow, height },
      ]} />
    </View>
  );
}

export function SectionTitle({ title, style }) {
  return <Text style={[styles.sectionTitle, style]}>{title}</Text>;
}

export function Chip({ label, color, bg }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg || COLORS.mintLight }]}>
      <Text style={[styles.chipText, { color: color || COLORS.charcoal }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    ...SHADOW,
  },
  primary: {
    backgroundColor: COLORS.yellow,
    borderRadius: RADIUS.full,
    paddingVertical: 15,
    alignItems: 'center',
    ...SHADOW_MD,
  },
  disabled: {
    backgroundColor: COLORS.lightGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryText: {
    color: COLORS.charcoal,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  disabledText: { color: COLORS.mutedSage },
  secondary: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.orange,
  },
  secondaryText: {
    color: COLORS.orange,
    fontWeight: '700',
    fontSize: 15,
  },
  ghost: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostText: {
    color: COLORS.mutedSage,
    fontWeight: '600',
    fontSize: 14,
  },
  barBg: {
    backgroundColor: COLORS.lightGray,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: RADIUS.full,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginBottom: 12,
  },
  chip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
