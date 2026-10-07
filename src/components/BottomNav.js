import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../data/theme';

const TABS = [
  { key: 'Dashboard', label: 'Home',      icon: '🏠' },
  { key: 'MyPlan',    label: 'Exercises', icon: '🦶' },
  { key: 'Progress',  label: 'Progress',  icon: '📊' },
  { key: 'Profile',   label: 'Profile',   icon: '👤' },
];

export default function BottomNav({ active, onPress }) {
  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onPress(tab.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, isActive && styles.activeWrap]}>
              <Text style={styles.icon}>{tab.icon}</Text>
            </View>
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.offWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  iconWrap: {
    width: 44, height: 38, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  activeWrap: { backgroundColor: COLORS.yellow },
  icon: { fontSize: 18 },
  label: { fontSize: 10, color: COLORS.mutedSage, marginTop: 2, fontWeight: '500' },
  activeLabel: { color: COLORS.charcoal, fontWeight: '700' },
});
