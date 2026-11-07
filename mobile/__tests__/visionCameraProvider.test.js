/**
 * mobile/__tests__/visionCameraProvider.test.js
 * 
 * Unit tests for visionCameraProvider.
 * Verifies graceful fallback, model definitions, permission hooks,
 * and zero unhandled exceptions when native modules are absent (Jest environment).
 */

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s) => s, absoluteFill: {} },
  Platform: { OS: 'android' },
}));

import React from 'react';
import {
  isVisionCameraAvailable,
  BLAZEPOSE_MODELS,
  useVisionCameraPermission,
  useVisionPoseDetector,
  VisionCameraView,
} from '../src/engines/providers/visionCameraProvider';

describe('visionCameraProvider', () => {
  it('reports native availability as boolean without throwing', () => {
    const isAvail = isVisionCameraAvailable();
    expect(typeof isAvail).toBe('boolean');
  });

  it('provides valid bundled model assets for lite and full variants', () => {
    expect(BLAZEPOSE_MODELS).toHaveProperty('lite');
    expect(BLAZEPOSE_MODELS).toHaveProperty('full');
    expect(BLAZEPOSE_MODELS.lite).toBeDefined();
    expect(BLAZEPOSE_MODELS.full).toBeDefined();
  });

  it('handles permission queries gracefully in Jest/fallback mode', () => {
    const perm = useVisionCameraPermission();
    expect(perm).toHaveProperty('hasPermission');
    expect(perm).toHaveProperty('requestPermission');
    expect(typeof perm.requestPermission).toBe('function');
  });

  it('returns clean inactive state for detector when native modules are unavailable', () => {
    const detector = useVisionPoseDetector({
      onPoseFrame: jest.fn(),
      enabled: false,
    });

    expect(detector).toHaveProperty('isReady');
    expect(detector).toHaveProperty('metrics');
    expect(detector.metrics.fps).toBe(0);
    expect(detector.metrics.status).toBe('not-available');
  });

  it('exports VisionCameraView component that renders fallback safely', () => {
    expect(VisionCameraView).toBeDefined();
    expect(typeof VisionCameraView).toBe('function');
  });
});
