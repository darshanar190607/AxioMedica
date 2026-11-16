/**
 * mobile/__tests__/trackingQuality.test.js
 *
 * Unit tests for evaluateTrackingQuality and requiredJoints.
 * Tests tracking state evaluation against exercise requirements.
 */

import { evaluateTrackingQuality } from '../src/utils/trackingQuality';
import { getRequiredJoints, REQUIRED_JOINTS } from '../src/utils/requiredJoints';

describe('Required Joints Mapping', () => {
  it('returns heel_raise required joints correctly', () => {
    const joints = getRequiredJoints('Heel Raise');
    expect(joints).toEqual(REQUIRED_JOINTS.heel_raise);
    expect(joints).toContain('left_ankle');
    expect(joints).toContain('left_heel');
    expect(joints).toContain('left_foot_index');
  });

  it('returns ankle_pump required joints correctly', () => {
    const joints = getRequiredJoints('Ankle Pump');
    expect(joints).toEqual(REQUIRED_JOINTS.ankle_pump);
    expect(joints).toContain('left_knee');
    expect(joints).toContain('left_ankle');
  });

  it('defaults gracefully to ankle_pump for unknown exercise', () => {
    const joints = getRequiredJoints('Random Nonexistent Exercise');
    expect(joints).toEqual(REQUIRED_JOINTS.ankle_pump);
  });
});

describe('evaluateTrackingQuality', () => {
  const sampleLandmarks = {
    left_hip: { x: 0.5, y: 0.2, visibility: 0.95 },
    right_hip: { x: 0.52, y: 0.2, visibility: 0.95 },
    left_knee: { x: 0.49, y: 0.5, visibility: 0.92 },
    right_knee: { x: 0.51, y: 0.5, visibility: 0.91 },
    left_ankle: { x: 0.48, y: 0.8, visibility: 0.96 },
    right_ankle: { x: 0.50, y: 0.8, visibility: 0.94 },
    left_heel: { x: 0.45, y: 0.82, visibility: 0.93 },
    right_heel: { x: 0.47, y: 0.82, visibility: 0.91 },
    left_foot_index: { x: 0.56, y: 0.84, visibility: 0.94 },
    right_foot_index: { x: 0.58, y: 0.84, visibility: 0.92 },
  };

  const heelRaiseJoints = REQUIRED_JOINTS.heel_raise;

  it('reports "tracking" when all required joints have high visibility', () => {
    const quality = evaluateTrackingQuality(sampleLandmarks, heelRaiseJoints, 0.65);
    expect(quality.status).toBe('tracking');
    expect(quality.meanConfidence).toBeGreaterThanOrEqual(0.65);
    expect(quality.missingJoints).toHaveLength(0);
  });

  it('reports "partial" when mean confidence drops below threshold', () => {
    // Lower visibility across joints
    const lowVisLandmarks = { ...sampleLandmarks };
    heelRaiseJoints.forEach(joint => {
      lowVisLandmarks[joint] = { ...lowVisLandmarks[joint], visibility: 0.55 };
    });

    const quality = evaluateTrackingQuality(lowVisLandmarks, heelRaiseJoints, 0.65);
    expect(quality.status).toBe('partial');
    expect(quality.meanConfidence).toBeCloseTo(0.55, 1);
  });

  it('reports "partial" when a single required joint has low visibility (<0.40)', () => {
    const degradedLandmarks = {
      ...sampleLandmarks,
      left_heel: { x: 0.45, y: 0.82, visibility: 0.25 }, // Below 0.40
    };

    const quality = evaluateTrackingQuality(degradedLandmarks, heelRaiseJoints, 0.65);
    expect(quality.status).toBe('partial');
    expect(quality.missingJoints).toContain('left_heel');
  });

  it('reports "lost" when mean confidence is below 0.40', () => {
    const poorLandmarks = { ...sampleLandmarks };
    heelRaiseJoints.forEach(joint => {
      poorLandmarks[joint] = { ...poorLandmarks[joint], visibility: 0.20 };
    });

    const quality = evaluateTrackingQuality(poorLandmarks, heelRaiseJoints, 0.65);
    expect(quality.status).toBe('lost');
    expect(quality.meanConfidence).toBeCloseTo(0.20, 1);
  });

  it('reports "lost" when frame or landmarks is null / invalid', () => {
    const qualityNull = evaluateTrackingQuality(null, heelRaiseJoints, 0.65);
    expect(qualityNull.status).toBe('lost');
    expect(qualityNull.meanConfidence).toBe(0);
    expect(qualityNull.missingJoints).toEqual(heelRaiseJoints);

    const qualityEmpty = evaluateTrackingQuality({}, heelRaiseJoints, 0.65);
    expect(qualityEmpty.status).toBe('lost');
  });
});

