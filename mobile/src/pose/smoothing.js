/**
 * mobile/src/pose/smoothing.js
 * One Euro Filter implementation for landmark jitter reduction and lag-free tracking.
 *
 * Reference:
 *   Gery Casiez, Nicolas Roussel, Daniel Vogel.
 *   "1 € filter: a simple speed-based low-pass filter for noisy input in interactive systems."
 *   ACM CHI 2012.
 *
 * Time Complexity: O(1) per coordinate update; O(N) for N keypoints.
 */

/**
 * Standard 1st-order low-pass filter helper.
 */
class LowPassFilter {
  constructor(alpha = 0.5, initVal = 0) {
    this.alpha = alpha;
    this.s = initVal;
    this.hasValue = false;
  }

  filter(value, alpha = this.alpha) {
    if (!this.hasValue) {
      this.s = value;
      this.hasValue = true;
      return value;
    }
    this.s = alpha * value + (1.0 - alpha) * this.s;
    return this.s;
  }

  last() {
    return this.s;
  }

  reset() {
    this.hasValue = false;
    this.s = 0;
  }
}

/**
 * 1D One Euro Filter for adaptive signal smoothing.
 */
export class OneEuroFilter {
  /**
   * @param {object} [options]
   * @param {number} [options.minCutoff=1.0] - Minimum cutoff frequency in Hz (f_c_min)
   * @param {number} [options.beta=0.007] - Speed coefficient for adaptive cutoff
   * @param {number} [options.dCutoff=1.0] - Cutoff frequency for derivative (f_c_d)
   */
  constructor(minCutoffOrOptions = 1.0, beta = 0.007, dCutoff = 1.0) {
    if (typeof minCutoffOrOptions === 'object' && minCutoffOrOptions !== null) {
      this.minCutoff = minCutoffOrOptions.minCutoff ?? 1.0;
      this.beta = minCutoffOrOptions.beta ?? 0.007;
      this.dCutoff = minCutoffOrOptions.dCutoff ?? 1.0;
    } else {
      this.minCutoff = minCutoffOrOptions ?? 1.0;
      this.beta = beta ?? 0.007;
      this.dCutoff = dCutoff ?? 1.0;
    }

    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
    this.lastTime = null;
  }

  static getAlpha(rate, cutoff) {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  /**
   * Filters a scalar value at time t.
   *
   * @param {number} value - Raw noisy measurement
   * @param {number} [timestamp] - Current timestamp in milliseconds (defaults to performance.now() or Date.now())
   * @returns {number} Filtered value
   */
  filter(value, timestamp = Date.now()) {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilter.filter(value);
    }

    const dt = Math.max((timestamp - this.lastTime) / 1000.0, 0.0001); // in seconds
    this.lastTime = timestamp;
    const rate = 1.0 / dt;

    // Estimate derivative (velocity)
    const prevX = this.xFilter.hasValue ? this.xFilter.last() : value;
    const dx = (value - prevX) * rate;
    const dAlpha = OneEuroFilter.getAlpha(rate, this.dCutoff);
    const edx = this.dxFilter.filter(dx, dAlpha);

    // Dynamic adaptive cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const xAlpha = OneEuroFilter.getAlpha(rate, cutoff);

    return this.xFilter.filter(value, xAlpha);
  }

  reset() {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

/**
 * KeypointSmoother applies independent One Euro Filters to all (x, y) coordinates
 * of a landmark collection.
 */
export class KeypointSmoother {
  constructor(options = {}) {
    this.options = options;
    this.filters = new Map();
  }

  /**
   * Filters a full map or array of landmarks.
   *
   * @param {Record<string, {x: number, y: number, z?: number, visibility?: number}>} landmarks
   * @param {number} [timestamp]
   * @returns {Record<string, {x: number, y: number, z?: number, visibility?: number}>} Smoothed landmarks
   */
  filter(landmarks, timestamp = Date.now()) {
    if (!landmarks) return {};

    const smoothed = {};
    for (const [key, pt] of Object.entries(landmarks)) {
      if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') {
        smoothed[key] = pt;
        continue;
      }

      if (!this.filters.has(key)) {
        this.filters.set(key, {
          x: new OneEuroFilter(this.options),
          y: new OneEuroFilter(this.options),
        });
      }

      const f = this.filters.get(key);
      smoothed[key] = {
        ...pt,
        x: f.x.filter(pt.x, timestamp),
        y: f.y.filter(pt.y, timestamp),
      };
    }

    return smoothed;
  }

  filterLandmarks(landmarks, timestamp = Date.now()) {
    return this.filter(landmarks, timestamp);
  }

  reset() {
    this.filters.clear();
  }
}
