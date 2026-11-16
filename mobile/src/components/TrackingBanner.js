/**
 * mobile/src/components/TrackingBanner.js
 *
 * Real-time debounced tracking status banner.
 *
 * INVARIANTS:
 * - Minimum 500ms display duration per state transition to eliminate visual flicker.
 * - Accessible: screen-reader compatible (accessibilityRole="alert", accessibilityLiveRegion="polite").
 * - Never color-only: distinct text, icons, and contrast-checked styling.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { CheckCircle2, AlertTriangle, RefreshCw, XCircle } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOW } from '../data/theme';

const STATUS_CONFIG = {
  tracking: {
    label: 'TRACKING ACTIVE',
    icon: CheckCircle2,
    color: '#4CAF50',
    bgColor: 'rgba(76, 175, 80, 0.20)',
    borderColor: '#4CAF50',
    defaultMessage: 'Good position ✓ Begin movement',
  },
  partial: {
    label: 'PARTIAL VIEW',
    icon: AlertTriangle,
    color: '#FF9800',
    bgColor: 'rgba(255, 152, 0, 0.22)',
    borderColor: '#FF9800',
    defaultMessage: 'Keep lower leg & ankle clearly visible',
  },
  lost: {
    label: 'SUBJECT LOST',
    icon: XCircle,
    color: '#F44336',
    bgColor: 'rgba(244, 67, 54, 0.25)',
    borderColor: '#F44336',
    defaultMessage: 'Step back into camera view',
  },
  reacquiring: {
    label: 'REACQUIRING',
    icon: RefreshCw,
    color: '#38BDF8',
    bgColor: 'rgba(56, 189, 248, 0.22)',
    borderColor: '#38BDF8',
    defaultMessage: 'Reacquiring camera pose...',
  },
  initializing: {
    label: 'INITIALIZING',
    icon: RefreshCw,
    color: '#94A3B8',
    bgColor: 'rgba(148, 163, 184, 0.20)',
    borderColor: '#94A3B8',
    defaultMessage: 'Positioning camera...',
  },
};

/**
 * Pure debounce resolution helper for testability.
 */
export function resolveDebouncedState(currentState, nextState, lastChangeTime, now = Date.now(), minDisplayMs = 500) {
  if (currentState === nextState) return { state: currentState, changed: false };
  if (now - lastChangeTime < minDisplayMs) {
    return { state: currentState, changed: false, pending: nextState };
  }
  return { state: nextState, changed: true };
}

/**
 * @param {Object} props
 * @param {'tracking'|'partial'|'lost'|'reacquiring'|'initializing'} props.status
 * @param {string} [props.message]
 * @param {number} [props.minDisplayMs=500] - Minimum duration to show a status before transitioning
 * @param {object} [props.style]
 */
export default function TrackingBanner({
  status = 'initializing',
  message,
  minDisplayMs = 500,
  style,
}) {
  const [displayedStatus, setDisplayedStatus] = useState(status);
  const [displayedMessage, setDisplayedMessage] = useState(message);

  const lastStatusChangeRef = useRef(Date.now());
  const pendingStatusRef = useRef(null);
  const pendingMessageRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastChange = now - lastStatusChangeRef.current;

    if (status === displayedStatus) {
      // Just update message if status hasn't changed
      setDisplayedMessage(message);
      return;
    }

    if (timeSinceLastChange >= minDisplayMs) {
      // Immediate transition allowed
      setDisplayedStatus(status);
      setDisplayedMessage(message);
      lastStatusChangeRef.current = now;
      pendingStatusRef.current = null;
      pendingMessageRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      // Enforce 500ms minimum display window to avoid rapid flickering
      pendingStatusRef.current = status;
      pendingMessageRef.current = message;

      if (timerRef.current) clearTimeout(timerRef.current);
      const remainingTime = minDisplayMs - timeSinceLastChange;

      timerRef.current = setTimeout(() => {
        if (pendingStatusRef.current) {
          setDisplayedStatus(pendingStatusRef.current);
          setDisplayedMessage(pendingMessageRef.current || message);
          lastStatusChangeRef.current = Date.now();
          pendingStatusRef.current = null;
          pendingMessageRef.current = null;
        }
      }, remainingTime);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, message, displayedStatus, minDisplayMs]);

  const config = STATUS_CONFIG[displayedStatus] || STATUS_CONFIG.initializing;
  const IconComponent = config.icon;
  const bannerText = displayedMessage || config.defaultMessage;
  const a11yLabel = `${config.label}: ${bannerText}`;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
        },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.iconContainer}>
        <IconComponent size={16} color={config.color} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.statusLabel, { color: config.color }]}>
          {config.label}
        </Text>
        <Text style={styles.messageText} numberOfLines={1}>
          {bannerText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    ...SHADOW,
    zIndex: 20,
  },
  iconContainer: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flexShrink: 1,
    flexDirection: 'column',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
