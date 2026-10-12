/**
 * mobile/src/components/SyncIndicator.js
 * Subtle badge showing offline sync status:
 *   - "Synced" (green/mint) when everything is uploaded
 *   - "Syncing..." (orange) during active upload
 *   - "X Pending" (yellow/cream) when offline sessions await sync
 * Reuses existing colors and styling.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { syncService } from '../services/syncService';
import { COLORS, RADIUS } from '../data/theme';

export default function SyncIndicator({ style }) {
  const [status, setStatus] = useState({
    isSyncing: false,
    pendingCount: 0,
  });

  useEffect(() => {
    const unsub = syncService.subscribe(newStatus => {
      setStatus({
        isSyncing: newStatus.isSyncing,
        pendingCount: newStatus.pendingCount,
      });
    });
    return unsub;
  }, []);

  const handlePress = () => {
    syncService.syncPendingSessions().catch(() => {});
  };

  const isPending = status.pendingCount > 0;
  const isSyncing = status.isSyncing;

  let text = 'Synced';
  let dotColor = '#2E7D32'; // Forest green
  let bgColor = COLORS.mintLight;
  let textColor = COLORS.charcoal;

  if (isSyncing) {
    text = 'Syncing...';
    dotColor = COLORS.orange;
    bgColor = COLORS.cream;
    textColor = COLORS.orange;
  } else if (isPending) {
    text = `${status.pendingCount} Pending`;
    dotColor = COLORS.orange;
    bgColor = '#FFF4E5';
    textColor = '#B25E00';
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: bgColor }, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.label, { color: textColor }]}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
