/**
 * mobile/__tests__/blazeposeAdapter.test.js
 * 
 * Unit tests for the BlazePose pure JS adapter.
 * Verifies mathematical correctness, coordinate scaling, logit activations,
 * letterbox un-padding, front camera mirroring, and strict contract compliance.
 */

import {
  decodeBlazePoseTensors,
  computeLetterboxParams,
  sigmoid,
  BLAZEPOSE_KEYPOINT_NAMES,
  TOTAL_CANONICAL_LANDMARKS,
  EXPECTED_RAW_TENSOR_LENGTH,
} from '../src/engines/adapters/blazeposeAdapter';
import { validateFrame } from '../contracts/validateLandmarks';

describe('blazeposeAdapter', () => {
  describe('sigmoid activation function', () => {
    it('returns 0.5 for logit = 0.0', () => {
      expect(sigmoid(0.0)).toBeCloseTo(0.5, 6);
    });

    it('maps high positive logit to probability close to 1.0', () => {
      // logit 2.944 comes from empirical BlazePose high-confidence output
      const prob = sigmoid(2.944);
      expect(prob).toBeGreaterThan(0.94);
      expect(prob).toBeLessThan(1.0);
    });

    it('maps negative logit to probability close to 0.0', () => {
      // logit -3.5 represents an occluded landmark
      const prob = sigmoid(-3.5);
      expect(prob).toBeLessThan(0.05);
      expect(prob).toBeGreaterThan(0.0);
    });

    it('clamps extreme positive and negative values without overflow', () => {
      expect(sigmoid(100)).toBe(1.0);
      expect(sigmoid(-100)).toBe(0.0);
    });

    it('handles non-numeric or NaN inputs safely', () => {
      expect(sigmoid(NaN)).toBe(0.0);
      expect(sigmoid(null)).toBe(0.0);
      expect(sigmoid(undefined)).toBe(0.0);
    });
  });

  describe('computeLetterboxParams', () => {
    it('returns no padding for square frames', () => {
      const res = computeLetterboxParams(1080, 1080);
      expect(res.padX).toBe(0);
      expect(res.padY).toBe(0);
      expect(res.scaleX).toBe(1.0);
      expect(res.scaleY).toBe(1.0);
    });

    it('calculates horizontal padding for portrait frames (1080x1920)', () => {
      const res = computeLetterboxParams(1080, 1920, 256);
      expect(res.padY).toBe(0);
      expect(res.scaleY).toBe(1.0);
      expect(res.padX).toBeGreaterThan(0);
      expect(res.scaleX).toBeLessThan(1.0);
      // scaleX + 2 * padX should equal 1.0
      expect(res.scaleX + 2 * res.padX).toBeCloseTo(1.0, 5);
    });

    it('calculates vertical padding for landscape frames (1920x1080)', () => {
      const res = computeLetterboxParams(1920, 1080, 256);
      expect(res.padX).toBe(0);
      expect(res.scaleX).toBe(1.0);
      expect(res.padY).toBeGreaterThan(0);
      expect(res.scaleY).toBeLessThan(1.0);
      // scaleY + 2 * padY should equal 1.0
      expect(res.scaleY + 2 * res.padY).toBeCloseTo(1.0, 5);
    });

    it('handles invalid or zero dimensions without division by zero', () => {
      const res = computeLetterboxParams(0, 0);
      expect(res.scaleX).toBe(1.0);
      expect(res.scaleY).toBe(1.0);
      expect(res.padX).toBe(0);
      expect(res.padY).toBe(0);
    });
  });

  describe('decodeBlazePoseTensors', () => {
    /**
     * Helper to create a synthetic 195-element raw landmark tensor.
     * All 39 keypoints (33 canonical + 6 aux) * 5 values.
     */
    function createRawTensor(pointTransform = () => ({ x: 128, y: 128, z: 0, visLogit: 3.0, presLogit: 3.0 })) {
      const tensor = new Float32Array(EXPECTED_RAW_TENSOR_LENGTH);
      for (let i = 0; i < 39; i++) {
        const pt = pointTransform(i);
        const k = i * 5;
        tensor[k + 0] = pt.x;
        tensor[k + 1] = pt.y;
        tensor[k + 2] = pt.z;
        tensor[k + 3] = pt.visLogit;
        tensor[k + 4] = pt.presLogit;
      }
      return tensor;
    }

    it('throws error when input tensor is missing or incomplete', () => {
      expect(() => decodeBlazePoseTensors(null)).toThrow('rawLandmarksTensor is required');
      expect(() => decodeBlazePoseTensors([])).toThrow('Invalid rawLandmarksTensor length');
      expect(() => decodeBlazePoseTensors(new Float32Array(50))).toThrow('Invalid rawLandmarksTensor length');
    });

    it('decodes all 33 canonical landmarks and matches BLAZEPOSE_KEYPOINT_NAMES exactly', () => {
      const raw = createRawTensor();
      const frame = decodeBlazePoseTensors(raw);

      expect(Object.keys(frame.landmarks).length).toBe(TOTAL_CANONICAL_LANDMARKS);
      BLAZEPOSE_KEYPOINT_NAMES.forEach((key) => {
        expect(frame.landmarks).toHaveProperty(key);
        const lm = frame.landmarks[key];
        expect(typeof lm.x).toBe('number');
        expect(typeof lm.y).toBe('number');
        expect(typeof lm.z).toBe('number');
        expect(typeof lm.visibility).toBe('number');
      });
    });

    it('normalizes pixel coordinates [0, 256] to [0.0, 1.0]', () => {
      const raw = createRawTensor((idx) => {
        if (idx === 0) return { x: 0, y: 0, z: 0, visLogit: 2.0, presLogit: 2.0 };
        if (idx === 1) return { x: 256, y: 256, z: 256, visLogit: 2.0, presLogit: 2.0 };
        return { x: 128, y: 64, z: 32, visLogit: 2.0, presLogit: 2.0 };
      });

      const frame = decodeBlazePoseTensors(raw);
      expect(frame.landmarks.nose.x).toBe(0.0);
      expect(frame.landmarks.nose.y).toBe(0.0);
      expect(frame.landmarks.nose.z).toBe(0.0);

      expect(frame.landmarks.left_eye_inner.x).toBe(1.0);
      expect(frame.landmarks.left_eye_inner.y).toBe(1.0);
      expect(frame.landmarks.left_eye_inner.z).toBe(1.0);

      expect(frame.landmarks.left_eye.x).toBeCloseTo(0.5, 4);
      expect(frame.landmarks.left_eye.y).toBeCloseTo(0.25, 4);
      expect(frame.landmarks.left_eye.z).toBeCloseTo(0.125, 4);
    });

    it('computes visibility probabilities from raw logits', () => {
      const raw = createRawTensor((idx) => {
        // High visibility logit for left_knee (25)
        if (idx === 25) return { x: 128, y: 128, z: 0, visLogit: 3.5, presLogit: 3.5 };
        // Occluded visibility logit for right_knee (26)
        if (idx === 26) return { x: 128, y: 128, z: 0, visLogit: -3.5, presLogit: -3.5 };
        return { x: 128, y: 128, z: 0, visLogit: 0.0, presLogit: 0.0 };
      });

      const frame = decodeBlazePoseTensors(raw);
      expect(frame.landmarks.left_knee.visibility).toBeGreaterThan(0.95);
      expect(frame.landmarks.right_knee.visibility).toBeLessThan(0.05);
      expect(frame.landmarks.nose.visibility).toBeCloseTo(0.5, 2);
    });

    it('evaluates status as tracking or lost based on presence logit', () => {
      const raw = createRawTensor();

      // Confident presence: logit +2.5 -> probability > 0.92
      const trackingFrame = decodeBlazePoseTensors(raw, { rawPresence: [2.5], presenceThreshold: 0.5 });
      expect(trackingFrame.status).toBe('tracking');
      expect(trackingFrame.presence).toBeGreaterThan(0.9);

      // Lost presence: logit -2.5 -> probability < 0.08
      const lostFrame = decodeBlazePoseTensors(raw, { rawPresence: [-2.5], presenceThreshold: 0.5 });
      expect(lostFrame.status).toBe('lost');
      expect(lostFrame.presence).toBeLessThan(0.1);
    });

    it('applies horizontal mirroring when isMirrored is true', () => {
      const raw = createRawTensor((idx) => {
        if (idx === 25) return { x: 64, y: 128, z: 0, visLogit: 2.0, presLogit: 2.0 }; // x=0.25
        return { x: 128, y: 128, z: 0, visLogit: 2.0, presLogit: 2.0 };
      });

      const standardFrame = decodeBlazePoseTensors(raw, { isMirrored: false });
      expect(standardFrame.landmarks.left_knee.x).toBeCloseTo(0.25, 4);

      const mirroredFrame = decodeBlazePoseTensors(raw, { isMirrored: true });
      expect(mirroredFrame.landmarks.left_knee.x).toBeCloseTo(0.75, 4);
    });

    it('un-pads coordinates when letterbox params are provided', () => {
      const letterbox = computeLetterboxParams(1080, 1920, 256);
      // An object centered in the padded 256x256 image should still unpad to x=0.5
      const raw = createRawTensor(() => ({ x: 128, y: 128, z: 0, visLogit: 2.0, presLogit: 2.0 }));

      const frame = decodeBlazePoseTensors(raw, { letterbox });
      expect(frame.landmarks.nose.x).toBeCloseTo(0.5, 3);
      expect(frame.landmarks.nose.y).toBeCloseTo(0.5, 3);
    });

    it('accepts batch dimension [[195 values]] as well as flat array', () => {
      const raw = createRawTensor();
      const nested = [raw]; // shape [1, 195]

      const frame = decodeBlazePoseTensors(nested);
      expect(frame.landmarks).toHaveProperty('left_heel');
      expect(frame.status).toBe('tracking');
    });

    it('decodes optional world 3D landmarks tensor if provided', () => {
      const raw = createRawTensor();
      const worldTensor = new Float32Array(117); // 39 keypoints * 3
      // Set left_ankle (index 27): world coordinates in meters
      worldTensor[27 * 3 + 0] = -0.15; // X
      worldTensor[27 * 3 + 1] = 0.85;  // Y
      worldTensor[27 * 3 + 2] = 0.02;  // Z

      const frame = decodeBlazePoseTensors(raw, { rawWorldLandmarks: worldTensor });
      expect(frame.worldLandmarks).toBeDefined();
      expect(frame.worldLandmarks.left_ankle.x).toBeCloseTo(-0.15, 3);
      expect(frame.worldLandmarks.left_ankle.y).toBeCloseTo(0.85, 3);
      expect(frame.worldLandmarks.left_ankle.z).toBeCloseTo(0.02, 3);
    });

    it('STRICT CONTRACT CHECK: fully satisfies contracts/validateLandmarks.js', () => {
      const raw = createRawTensor();
      const frame = decodeBlazePoseTensors(raw, {
        timestamp: 1730960000000,
        source: 'camera',
        rawPresence: [3.0],
      });

      // Must not throw
      expect(() => validateFrame(frame)).not.toThrow();
      expect(validateFrame(frame)).toBe(true);
    });

    it('verifies realistic anatomical standing posture relationships', () => {
      // Create standing person tensor where hip is above knee, knee above ankle
      const raw = createRawTensor((idx) => {
        let yPixel = 128;
        if (idx === 0) yPixel = 30;   // nose
        if (idx === 11) yPixel = 60;  // left_shoulder
        if (idx === 23) yPixel = 110; // left_hip
        if (idx === 25) yPixel = 160; // left_knee
        if (idx === 27) yPixel = 220; // left_ankle
        if (idx === 29) yPixel = 225; // left_heel
        if (idx === 31) yPixel = 230; // left_foot_index
        return { x: 128, y: yPixel, z: 0, visLogit: 3.0, presLogit: 3.0 };
      });

      const frame = decodeBlazePoseTensors(raw);
      expect(frame.landmarks.nose.y).toBeLessThan(frame.landmarks.left_shoulder.y);
      expect(frame.landmarks.left_shoulder.y).toBeLessThan(frame.landmarks.left_hip.y);
      expect(frame.landmarks.left_hip.y).toBeLessThan(frame.landmarks.left_knee.y);
      expect(frame.landmarks.left_knee.y).toBeLessThan(frame.landmarks.left_ankle.y);
      expect(frame.landmarks.left_ankle.y).toBeLessThanOrEqual(frame.landmarks.left_heel.y);
    });
  });
});
