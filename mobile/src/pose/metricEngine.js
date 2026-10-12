/**
 * mobile/src/pose/metricEngine.js
 * Computes named metrics (angle, vertical_delta) from landmarks per pose_config.metrics.
 *
 * Rules:
 *   - Completely driven by pose_config.metrics — no hardcoded joints.
 *   - Side-aware: swaps left/right joints based on patient injured side.
 *   - Time Complexity: O(M) where M is the number of declared metrics (M <= 10, essentially O(1)).
 */
import { angle, distance, verticalDelta } from './geometry';
import { resolveJointName } from './poseConfig';

export class MetricEngine {
  /**
   * @param {object} config - Validated pose_config
   * @param {string} [injuredSide='left'] - 'left' or 'right'
   */
  constructor(config, options = {}) {
    this.config = config;
    const injuredSide = typeof options === 'string' ? options : (options?.injuredSide ?? 'left');
    this.injuredSide = injuredSide;
    this.sideAware = Boolean(config.side_aware);
  }

  /**
   * Resolves a landmark coordinate from either a named map or raw BlazePose 33-landmark array.
   *
   * @param {string} jointName - e.g. 'left_ankle'
   * @param {object|Array} landmarks - Named map or indexed array of landmarks
   * @returns {{x: number, y: number, z?: number, visibility?: number}|null}
   */
  resolveLandmark(jointName, landmarks) {
    if (!landmarks) return null;

    const resolvedName = resolveJointName(jointName, this.injuredSide, this.sideAware);

    // 1. Direct name match (e.g. landmarks['left_heel'] or landmarks['right_heel'])
    if (landmarks[resolvedName]) return landmarks[resolvedName];
    if (landmarks[jointName]) return landmarks[jointName];

    // 2. Numeric index match via config.landmarks mapping
    if (this.config.landmarks) {
      const idx = this.config.landmarks[resolvedName] ?? this.config.landmarks[jointName];
      if (idx !== undefined && landmarks[idx]) {
        return landmarks[idx];
      }
    }

    return null;
  }

  /**
   * Computes all declared metrics for a single frame.
   *
   * @param {object|Array} landmarks - Frame landmarks
   * @param {object} [context] - Contextual data (e.g. { rep_duration_ms: 1400 })
   * @returns {Record<string, number>} Map of { [metricName]: value }
   */
  computeMetrics(landmarks, context = {}) {
    const results = {};

    // Built-in metrics
    if (typeof context.rep_duration_ms === 'number') {
      results.rep_duration_ms = context.rep_duration_ms;
    }

    for (const def of this.config.metrics) {
      switch (def.type) {
        case 'angle': {
          const ptA = this.resolveLandmark(def.joints[0], landmarks);
          const ptB = this.resolveLandmark(def.joints[1], landmarks); // pivot
          const ptC = this.resolveLandmark(def.joints[2], landmarks);
          results[def.name] = angle(ptA, ptB, ptC);
          break;
        }

        case 'vertical_delta': {
          const target = this.resolveLandmark(def.landmark, landmarks);
          const ref = this.resolveLandmark(def.reference_landmark, landmarks);
          results[def.name] = verticalDelta(target, ref);
          break;
        }

        case 'distance': {
          const ptA = this.resolveLandmark(def.joints[0], landmarks);
          const ptB = this.resolveLandmark(def.joints[1], landmarks);
          results[def.name] = distance(ptA, ptB);
          break;
        }

        default:
          results[def.name] = 0;
          break;
      }
    }

    return results;
  }

  /**
   * Calculates mean landmark confidence for this frame.
   *
   * @param {object|Array} landmarks
   * @returns {number} Mean confidence [0, 1]
   */
  calculateConfidence(landmarks) {
    if (!landmarks) return 0;

    let sum = 0;
    let count = 0;

    if (Array.isArray(landmarks)) {
      for (const pt of landmarks) {
        if (pt && typeof pt.visibility === 'number') {
          sum += pt.visibility;
          count++;
        }
      }
    } else if (typeof landmarks === 'object') {
      for (const pt of Object.values(landmarks)) {
        if (pt && typeof pt.visibility === 'number') {
          sum += pt.visibility;
          count++;
        }
      }
    }

    return count > 0 ? sum / count : 1.0;
  }
}
