/**
 * mobile/src/engines/poseEngine.js
 * 
 * Core Pose Estimation Engine singleton for AxioMedica / RehabStep AI.
 * 
 * STRICT ARCHITECTURAL INVARIANT:
 * - Pure JavaScript: ZERO native imports.
 * - Integrates pure JS adapter (blazeposeAdapter.js) and pure JS smoothing (smoothing.js).
 * - Enforces the locked landmark schema contract (docs/step1/04_landmark_schema.md).
 * - Routes smoothed frames to downstream consumers (usePose, MetricEngine, RepCounter, etc.)
 *   without requiring any changes to downstream modules.
 */

import { KeypointSmoother } from '../pose/smoothing';
import { decodeBlazePoseTensors } from './adapters/blazeposeAdapter';
import { validateFrame } from '../../contracts/validateLandmarks';

export class PoseEngine {
  constructor(options = {}) {
    this.smoothingOptions = options.smoothing ?? { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 };
    this.smoother = new KeypointSmoother(this.smoothingOptions);
    this.subscribers = new Set();
    this.lastFrame = null;
    this.status = 'idle'; // 'idle' | 'tracking' | 'lost'
    this.enableValidation = options.enableValidation ?? true;
  }

  /**
   * Subscribes a listener to receives smoothed canonical landmark frames.
   * 
   * @param {Function} listener - Callback receiving smoothed frame
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /**
   * Unsubscribes a listener.
   * @param {Function} listener 
   */
  unsubscribe(listener) {
    this.subscribers.delete(listener);
  }

  /**
   * Ingests a canonical frame (from real camera provider, synthetic stream, or test fixture),
   * applies smoothing filter, updates tracking status, and notifies all subscribers.
   * 
   * @param {Object} rawFrame - Canonical frame conforming to docs/step1/04_landmark_schema.md
   * @returns {Object} Smoothed canonical frame
   */
  feedFrame(rawFrame) {
    if (!rawFrame || !rawFrame.landmarks) {
      this.status = 'lost';
      return null;
    }

    if (this.enableValidation) {
      validateFrame(rawFrame);
    }

    const timestamp = typeof rawFrame.timestamp === 'number' ? rawFrame.timestamp : Date.now();
    const source = rawFrame.source || 'camera';
    const rawStatus = rawFrame.status || 'tracking';
    const presence = typeof rawFrame.presence === 'number' ? rawFrame.presence : 1.0;

    // Handle tracking state transitions
    if (rawStatus === 'lost' || presence < 0.3) {
      this.status = 'lost';
      // Reset filter state when tracking is lost to prevent stale interpolation
      this.smoother.reset();

      const lostFrame = {
        timestamp,
        source,
        status: 'lost',
        presence,
        landmarks: rawFrame.landmarks,
      };
      this.lastFrame = lostFrame;
      this._notifySubscribers(lostFrame);
      return lostFrame;
    }

    // Tracking active: apply One Euro Filter smoothing
    this.status = 'tracking';
    const smoothedLandmarks = this.smoother.filter(rawFrame.landmarks, timestamp);

    const smoothedFrame = {
      timestamp,
      source,
      status: 'tracking',
      presence,
      landmarks: smoothedLandmarks,
    };

    if (rawFrame.worldLandmarks) {
      smoothedFrame.worldLandmarks = rawFrame.worldLandmarks;
    }

    this.lastFrame = smoothedFrame;
    this._notifySubscribers(smoothedFrame);
    return smoothedFrame;
  }

  /**
   * Ingests raw output tensors from VisionCamera / Fast-TFLite,
   * runs the blazeposeAdapter decoder, and feeds the resulting frame.
   * 
   * @param {Array<number>|Float32Array} rawLandmarksTensor - Identity tensor [1, 195]
   * @param {Object} [options={}] - Adapter decoding options
   * @returns {Object} Smoothed canonical frame
   */
  feedRawTensors(rawLandmarksTensor, options = {}) {
    const canonicalFrame = decodeBlazePoseTensors(rawLandmarksTensor, options);
    return this.feedFrame(canonicalFrame);
  }

  /**
   * Internal subscriber notification.
   * @private
   */
  _notifySubscribers(frame) {
    for (const listener of this.subscribers) {
      try {
        listener(frame);
      } catch (err) {
        // Prevent subscriber error from crashing engine loop
        console.warn('PoseEngine subscriber callback threw error:', err);
      }
    }
  }

  /**
   * Returns current tracking status.
   * @returns {'idle' | 'tracking' | 'lost'}
   */
  getStatus() {
    return this.status;
  }

  /**
   * Returns the most recent smoothed frame.
   * @returns {Object|null}
   */
  getLastFrame() {
    return this.lastFrame;
  }

  /**
   * Resets engine smoother and tracking state.
   */
  reset() {
    this.smoother.reset();
    this.lastFrame = null;
    this.status = 'idle';
  }

  /**
   * Clears all active subscribers.
   */
  clearSubscribers() {
    this.subscribers.clear();
  }
}

// Export singleton instance
export const poseEngine = new PoseEngine();
export default poseEngine;

