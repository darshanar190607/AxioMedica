/**
 * mobile/src/pose/calibration.js
 * Captures and records baseline Range of Motion (ROM) from the initial session.
 *
 * Rules:
 *   - Follows units.md: ROM in degrees [0, 180].
 *   - Neutral stance estimation + maximum voluntary excursion calibration.
 *   - Time Complexity: O(F) where F is the number of calibration sample frames.
 */

export class CalibrationTracker {
  /**
   * @param {object} [options]
   * @param {number} [options.minSamples=15] - Minimum frames needed to establish baseline
   */
  constructor(configOrOptions = {}, maybeOptions = {}) {
    const options =
      typeof configOrOptions === 'object' && configOrOptions?.landmarks
        ? maybeOptions
        : (configOrOptions || {});
    this.minSamples = options.minSamples ?? options.targetFrames ?? 15;
    this.samples = [];
    this.confidences = [];
    this.isCalibrated = false;
  }

  /**
   * Adds a sample frame's joint angle or excursion metric.
   *
   * @param {number} metricVal - Measured angle or delta
   * @param {number} [confidence=1.0] - Landmark confidence score
   */
  addSample(metricVal, confidence = 1.0) {
    if (typeof metricVal === 'number' && !isNaN(metricVal)) {
      this.samples.push(metricVal);
      this.confidences.push(confidence);
    }
  }

  /**
   * Finalizes baseline calibration and returns the baseline profile.
   *
   * @returns {{
   *   isCalibrated: boolean,
   *   baselineRomDeg: number,
   *   neutralAngleDeg: number,
   *   minAngleDeg: number,
   *   maxAngleDeg: number,
   *   meanConfidence: number,
   *   sampleCount: number,
   *   calibratedAt: string
   * }}
   */
  /**
   * Adds a full frame of metrics.
   *
   * @param {Record<string, number>} metrics - Frame metrics
   * @param {number} [confidence=1.0] - Frame confidence
   */
  addFrame(metrics, confidence = 1.0) {
    if (!metrics) return;
    this.confidences.push(confidence);

    for (const [key, val] of Object.entries(metrics)) {
      if (typeof val === 'number' && !isNaN(val)) {
        if (!this.metricSamples) this.metricSamples = new Map();
        if (!this.metricSamples.has(key)) this.metricSamples.set(key, []);
        this.metricSamples.get(key).push(val);
      }
    }

    // Default primary sample tracking
    const firstMetric = Object.values(metrics)[0];
    if (typeof firstMetric === 'number') {
      this.samples.push(firstMetric);
    }
  }

  /**
   * Finalizes baseline calibration and returns the baseline profile.
   *
   * @returns {{
   *   isCalibrated: boolean,
   *   baselineRomDeg: number,
   *   neutralAngleDeg: number,
   *   neutralAngles: Record<string, number>,
   *   minAngleDeg: number,
   *   maxAngleDeg: number,
   *   meanConfidence: number,
   *   sampleCount: number,
   *   calibratedAt: string
   * }}
   */
  finalize() {
    const neutralAngles = {};
    if (this.metricSamples) {
      for (const [metric, arr] of this.metricSamples.entries()) {
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
        neutralAngles[metric] = Math.round(avg * 10) / 10;
      }
    }

    const count = this.samples.length || (this.metricSamples ? this.confidences.length : 0);
    const targetMin = this.minSamples ?? 5;

    if (count < targetMin) {
      return {
        isCalibrated: false,
        baselineRomDeg: 0,
        neutralAngleDeg: 0,
        neutralAngles,
        minAngleDeg: 0,
        maxAngleDeg: 0,
        meanConfidence: 0,
        sampleCount: count,
        calibratedAt: new Date().toISOString(),
      };
    }

    const min = this.samples.length > 0 ? Math.min(...this.samples) : 0;
    const max = this.samples.length > 0 ? Math.max(...this.samples) : 0;
    const sum = this.samples.reduce((a, b) => a + b, 0);
    const neutralAngle = this.samples.length > 0 ? sum / this.samples.length : 0;
    const baselineRom = Math.max(0, Math.min(180, max - min));

    const meanConf =
      this.confidences.length > 0
        ? this.confidences.reduce((a, b) => a + b, 0) / this.confidences.length
        : 1.0;

    this.isCalibrated = true;

    return {
      isCalibrated: true,
      baselineRomDeg: Math.round(baselineRom * 10) / 10,
      neutralAngleDeg: Math.round(neutralAngle * 10) / 10,
      neutralAngles,
      minAngleDeg: Math.round(min * 10) / 10,
      maxAngleDeg: Math.round(max * 10) / 10,
      meanConfidence: Math.round(meanConf * 100) / 100,
      sampleCount: count,
      calibratedAt: new Date().toISOString(),
    };
  }

  getBaseline() {
    return this.finalize();
  }

  reset() {
    this.samples = [];
    this.confidences = [];
    this.isCalibrated = false;
  }
}
