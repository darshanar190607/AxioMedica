import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, Activity, TrendingUp, User } from 'lucide-react-native';
import { COLORS, RADIUS } from '../data/theme';

const TABS = [
  { key: 'Dashboard', label: 'Home',      Icon: Home },
  { key: 'MyPlan',    label: 'Exercises', Icon: Activity },
  { key: 'Progress',  label: 'Progress',  Icon: TrendingUp },
  { key: 'Profile',   label: 'Profile',   Icon: User },
];

export default function BottomNav({ active, onPress }) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const IconComponent = tab.Icon;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onPress(tab.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, isActive && styles.activeWrap]}>
              <IconComponent
                size={20}
                color={isActive ? COLORS.charcoal : COLORS.mutedSage}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </View>
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {tab.label}
            </Text>
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
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  iconWrap: {
    width: 44,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeWrap: {
    backgroundColor: COLORS.yellow,
  },
  label: {
    fontSize: 11,
    color: COLORS.mutedSage,
    marginTop: 2,
    fontWeight: '600',
  },
  activeLabel: {
    color: COLORS.charcoal,
    fontWeight: '800',
  },
});
