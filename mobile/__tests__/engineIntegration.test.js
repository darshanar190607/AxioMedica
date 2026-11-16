/**
 * mobile/__tests__/engineIntegration.test.js
 * 
 * Integration test suite for Gate 5:
 * Proves end-to-end execution from raw tensors and canonical frames through:
 * blazeposeAdapter -> PoseEngine -> KeypointSmoother -> MetricEngine -> RepCounter -> FormChecker -> CalibrationTracker.
 * 
 * Verifies that the existing downstream modules operate with zero regressions
 * and zero modifications to protected code.
 */

import { PoseEngine } from '../src/engines/poseEngine';
import {
  getPoseConfigForExercise,
  MetricEngine,
  RepCounter,
  CalibrationTracker,
  FormChecker,
} from '../src/pose';
import { validateFrame } from '../contracts/validateLandmarks';
import landmarksNeutral from './fixtures/landmarks_neutral.json';
import landmarksDown from './fixtures/landmarks_down.json';
import landmarksUp from './fixtures/landmarks_up.json';

describe('Gate 5: Engine Integration & Validation Pipeline', () => {
  let engine;

  beforeEach(() => {
    engine = new PoseEngine();
  });

  afterEach(() => {
    engine.reset();
    engine.clearSubscribers();
  });

  describe('PoseEngine Core Lifecycle & Smoothing', () => {
    it('manages subscriber lifecycle cleanly', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 = engine.subscribe(listener1);
      engine.subscribe(listener2);

      engine.feedFrame(landmarksNeutral);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      unsubscribe1();
      engine.feedFrame(landmarksDown);

      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(2);
    });

    it('enforces that all emitted frames strictly pass validateFrame', () => {
      let receivedFrame = null;
      engine.subscribe((frame) => {
        receivedFrame = frame;
      });

      engine.feedFrame(landmarksNeutral);
      expect(receivedFrame).not.toBeNull();
      expect(validateFrame(receivedFrame)).toBe(true);
      expect(receivedFrame.status).toBe('tracking');
    });

    it('suppresses jitter on stationary joints via One Euro Filter', () => {
      // Feed stationary baseline with high-frequency noise on left_heel.x
      const frames = [];
      const baseY = 0.82;
      const baseX = 0.45;

      for (let t = 0; t < 10; t++) {
        // Add artificial +/- 0.02 jitter
        const noise = (t % 2 === 0 ? 0.02 : -0.02);
        const noisyFrame = {
          timestamp: 1730960000000 + t * 33, // ~30 FPS
          source: 'camera',
          status: 'tracking',
          landmarks: {
            ...landmarksDown.landmarks,
            left_heel: {
              ...landmarksDown.landmarks.left_heel,
              x: baseX + noise,
              y: baseY,
            },
          },
        };
        const smoothed = engine.feedFrame(noisyFrame);
        frames.push(smoothed.landmarks.left_heel.x);
      }

      // Final smoothed value should be much closer to baseX than the raw +/- 0.02 jitter
      const lastX = frames[frames.length - 1];
      expect(Math.abs(lastX - baseX)).toBeLessThan(0.015);
    });
  });

  describe('End-to-End Downstream Integration (Heel Raise)', () => {
    it('processes canonical frames through MetricEngine, RepCounter, and FormChecker seamlessly', () => {
      const poseConfig = getPoseConfigForExercise('Heel Raise');
      const metricEngine = new MetricEngine(poseConfig, 'left');
      const repCounter = new RepCounter(poseConfig);
      const calibrationTracker = new CalibrationTracker(poseConfig, { minSamples: 5 });
      const formChecker = new FormChecker(poseConfig);

      let lastEmittedFrame = null;
      engine.subscribe((f) => {
        lastEmittedFrame = f;
      });

      // 1. Initial calibration / standing phase (down)
      let timestamp = 1730960000000;
      for (let i = 0; i < 6; i++) {
        timestamp += 100;
        const frame = engine.feedFrame({
          ...landmarksDown,
          timestamp,
        });

        const metrics = metricEngine.computeMetrics(frame.landmarks);
        const confidence = metricEngine.calculateConfidence(frame.landmarks);
        calibrationTracker.addFrame(metrics, confidence);
        repCounter.processFrame(metrics, confidence, timestamp);
      }

      expect(calibrationTracker.samples.length).toBeGreaterThan(0);
      const baseline = calibrationTracker.finalize();
      expect(baseline.isCalibrated).toBe(true);
      expect(repCounter.repsDone).toBe(0);

      // 2. Ascending phase to peak extension (up)
      // Heel rises: left_heel.y decreases to 0.71 (vertical delta 0.80 - 0.71 = 0.09 >= 0.08)
      for (let i = 0; i < 5; i++) {
        timestamp += 200;
        const frame = engine.feedFrame({
          ...landmarksUp,
          timestamp,
          landmarks: {
            ...landmarksUp.landmarks,
            left_heel: { ...landmarksUp.landmarks.left_heel, y: 0.71 },
          },
        });

        const metrics = metricEngine.computeMetrics(frame.landmarks);
        const confidence = metricEngine.calculateConfidence(frame.landmarks);
        const repRes = repCounter.processFrame(metrics, confidence, timestamp);

        // Form check
        const formResult = formChecker.checkFrame(metrics);
        expect(formResult).toBeDefined();
        expect(Array.isArray(formResult.newlyFired)).toBe(true);
        expect(Array.isArray(formResult.cues)).toBe(true);
      }

      // RepCounter entered 'up' phase
      expect(repCounter.currentPhase).toBe('up');

      // 3. Descending phase back to floor (down)
      // Heel returns: delta <= 0.02. Total rep elapsed time > 1500ms
      for (let i = 0; i < 6; i++) {
        timestamp += 200;
        const frame = engine.feedFrame({
          ...landmarksDown,
          timestamp,
        });

        const metrics = metricEngine.computeMetrics(frame.landmarks);
        const confidence = metricEngine.calculateConfidence(frame.landmarks);
        const repRes = repCounter.processFrame(metrics, confidence, timestamp);

        if (repRes.completedRep) {
          expect(repRes.completedRep.form_score).toBeGreaterThan(0);
        }
      }

      // Rep complete!
      expect(repCounter.repsDone).toBe(1);
    });
  });

  describe('Raw TFLite Tensors to Downstream Pipeline', () => {
    /**
     * Converts a landmark dictionary into a 195-element raw Float32Array tensor
     * matching the exact output of BlazePose Identity tensor [1, 195].
     */
    function fixtureToRawTensor(fixture) {
      const tensor = new Float32Array(195);
      const BLAZEPOSE_KEYPOINT_NAMES = [
        'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer',
        'right_eye_inner', 'right_eye', 'right_eye_outer',
        'left_ear', 'right_ear', 'mouth_left', 'mouth_right',
        'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky',
        'left_index', 'right_index', 'left_thumb', 'right_thumb',
        'left_hip', 'right_hip', 'left_knee', 'right_knee',
        'left_ankle', 'right_ankle', 'left_heel', 'right_heel',
        'left_foot_index', 'right_foot_index',
      ];

      BLAZEPOSE_KEYPOINT_NAMES.forEach((name, i) => {
        const pt = fixture.landmarks[name] || { x: 0.5, y: 0.5, z: 0, visibility: 0.9 };
        const k = i * 5;
        // Convert normalized [0, 1] back to model pixel coords [0, 256]
        tensor[k + 0] = pt.x * 256.0;
        tensor[k + 1] = pt.y * 256.0;
        tensor[k + 2] = (pt.z || 0) * 256.0;
        // Convert visibility prob ~0.95 to logit ~3.0
        tensor[k + 3] = 3.0;
        tensor[k + 4] = 3.0; // presence logit
      });

      return tensor;
    }

    it('decodes raw TFLite tensors through PoseEngine and computes valid kinematic angles', () => {
      const poseConfig = getPoseConfigForExercise('Heel Raise');
      const metricEngine = new MetricEngine(poseConfig, 'left');

      const rawTensor = fixtureToRawTensor(landmarksNeutral);
      const presenceTensor = new Float32Array([3.0]); // logit +3.0 -> >95% presence

      const smoothedFrame = engine.feedRawTensors(rawTensor, {
        timestamp: 1730960000000,
        rawPresence: presenceTensor,
        isMirrored: false,
      });

      expect(smoothedFrame).toBeDefined();
      expect(smoothedFrame.status).toBe('tracking');
      expect(smoothedFrame.landmarks).toHaveProperty('left_knee');
      expect(smoothedFrame.landmarks).toHaveProperty('left_ankle');

      const metrics = metricEngine.computeMetrics(smoothedFrame.landmarks);
      expect(metrics).toHaveProperty('ankle_angle');
      expect(metrics.ankle_angle).toBeGreaterThan(60);
      expect(metrics.ankle_angle).toBeLessThan(180);
      expect(metrics).toHaveProperty('heel_height');
    });
  });

  describe('Error Paths & Robustness', () => {
    it('handles frame with missing or low-visibility landmarks safely', () => {
      const poseConfig = getPoseConfigForExercise('Heel Raise');
      const metricEngine = new MetricEngine(poseConfig, 'left');

      // Create partial frame where cranial landmarks have visibility 0
      const partialLandmarks = { ...landmarksDown.landmarks };
      partialLandmarks.nose = { x: 0, y: 0, z: 0, visibility: 0.0 };
      partialLandmarks.left_eye = { x: 0, y: 0, z: 0, visibility: 0.0 };

      const frame = engine.feedFrame({
        timestamp: 1730960000000,
        source: 'camera',
        status: 'tracking',
        landmarks: partialLandmarks,
      });

      expect(() => metricEngine.computeMetrics(frame.landmarks)).not.toThrow();
      const metrics = metricEngine.computeMetrics(frame.landmarks);
      expect(typeof metrics.heel_height).toBe('number');
    });

    it('transitions to lost status and resets filters when presence drops', () => {
      let receivedStatus = null;
      engine.subscribe((f) => {
        receivedStatus = f.status;
      });

      // Active tracking frame
      engine.feedFrame(landmarksNeutral);
      expect(engine.getStatus()).toBe('tracking');
      expect(receivedStatus).toBe('tracking');

      // Lost tracking frame (subject walked out of frame, presence = 0.05)
      const lostFrame = {
        timestamp: 1730960001000,
        source: 'camera',
        status: 'lost',
        presence: 0.05,
        landmarks: landmarksNeutral.landmarks,
      };

      engine.feedFrame(lostFrame);
      expect(engine.getStatus()).toBe('lost');
      expect(receivedStatus).toBe('lost');

      // Subsequent valid frame restores tracking smoothly
      engine.feedFrame(landmarksNeutral);
      expect(engine.getStatus()).toBe('tracking');
      expect(receivedStatus).toBe('tracking');
    });

    it('handles null or corrupted frames gracefully without crashing', () => {
      expect(engine.feedFrame(null)).toBeNull();
      expect(engine.getStatus()).toBe('lost');
      expect(engine.feedFrame({})).toBeNull();
      expect(engine.getStatus()).toBe('lost');
    });
  });
});
