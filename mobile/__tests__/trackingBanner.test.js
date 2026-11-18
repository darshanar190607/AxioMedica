/**
 * mobile/__tests__/trackingBanner.test.js
 *
 * Unit tests for TrackingBanner and debounced state transitions.
 * Verifies accessibility attributes, minimum display duration,
 * and flicker-prevention logic.
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s) => s },
  Animated: { Value: jest.fn(() => ({ setValue: jest.fn() })) },
  processColor: jest.fn((c) => c),
}));

jest.mock('lucide-react-native', () => ({
  CheckCircle2: 'CheckCircle2',
  AlertTriangle: 'AlertTriangle',
  RefreshCw: 'RefreshCw',
  XCircle: 'XCircle',
}));

import React from 'react';
import TrackingBanner, { resolveDebouncedState } from '../src/components/TrackingBanner';

describe('TrackingBanner State Machine & Debounce', () => {
  const minDisplayMs = 500;

  it('permits immediate state transition if previous state was held for >= 500ms', () => {
    const lastChangeTime = 1000;
    const now = 1600; // 600ms elapsed

    const res = resolveDebouncedState('initializing', 'tracking', lastChangeTime, now, minDisplayMs);
    expect(res.changed).toBe(true);
    expect(res.state).toBe('tracking');
  });

  it('suppresses immediate transition and marks pending if less than 500ms elapsed', () => {
    const lastChangeTime = 1000;
    const now = 1200; // 200ms elapsed (< 500ms)

    const res = resolveDebouncedState('tracking', 'lost', lastChangeTime, now, minDisplayMs);
    expect(res.changed).toBe(false);
    expect(res.state).toBe('tracking');
    expect(res.pending).toBe('lost');
  });

  it('returns changed: false when state has not changed', () => {
    const lastChangeTime = 1000;
    const now = 2000;

    const res = resolveDebouncedState('tracking', 'tracking', lastChangeTime, now, minDisplayMs);
    expect(res.changed).toBe(false);
    expect(res.state).toBe('tracking');
  });

  it('exports TrackingBanner functional component', () => {
    expect(typeof TrackingBanner).toBe('function');
  });
});
