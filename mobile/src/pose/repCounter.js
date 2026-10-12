/**
 * mobile/src/pose/repCounter.js
 * Hysteresis state machine driven by pose_config.phases and rep_cycle.
 *
 * Rules:
 *   - No hardcoded exercise thresholds or phase names.
 *   - Honors min_rep_duration_ms and min_pose_confidence.
 *   - Tracks peak ROM excursion per repetition.
 *   - Prevents double-counting and false transitions via hysteresis state sequencing.
 *   - Time Complexity: O(P) per frame where P is phases count (P <= 5 -> O(1)).
 */
import { evaluateCondition, FormChecker } from './formChecker';

export class RepCounter {
  /**
   * @param {object} config - Validated pose_config
   * @param {object} [options]
   * @param {number} [options.setNo=1] - 1-based set number
   */
  constructor(config, options = {}) {
    this.config = config;
    this.setNo = options.setNo ?? 1;
    this.phasesMap = new Map((config.phases || []).map(p => [p.name, p]));
    this.repCycle = config.rep_cycle || [];

    if (this.repCycle.length < 2) {
      throw new Error('rep_cycle must contain at least 2 phase entries.');
    }

    this.minRepDurationMs = config.min_rep_duration_ms ?? 1000;
    this.minPoseConfidence = config.min_pose_confidence ?? 0.60;

    this.formChecker = new FormChecker(config);

    // State machine tracking
    this.cycleIndex = 0;
    this.currentPhase = this.repCycle[0];
    this.repsDone = 0;
    this.completedReps = [];

    // Current rep accumulator
    this.repStartTime = null;
    this.currentRepMetrics = [];
    this.confidences = [];
    this.minMetricVal = Infinity;
    this.maxMetricVal = -Infinity;
  }

  /**
   * Identifies the primary angular or excursion metric for ROM calculation.
   *
   * @returns {string}
   */
  getPrimaryRomMetricName() {
    const angleMetric = (this.config.metrics || []).find(m => m.type === 'angle');
    if (angleMetric) return angleMetric.name;
    const deltaMetric = (this.config.metrics || []).find(m => m.type === 'vertical_delta');
    if (deltaMetric) return deltaMetric.name;
    return this.config.metrics?.[0]?.name || 'angle';
  }

  /**
   * Evaluates if a named phase's condition is met by current metrics.
   *
   * @param {string} phaseName
   * @param {Record<string, number>} metrics
   * @returns {boolean}
   */
  matchesPhase(phaseName, metrics) {
    const phaseDef = this.phasesMap.get(phaseName);
    if (!phaseDef) return false;
    return evaluateCondition(phaseDef.condition, metrics);
  }

  /**
   * Processes a single frame of computed metrics and confidence score.
   *
   * @param {Record<string, number>} metrics - Frame metrics
   * @param {number} confidence - Mean BlazePose frame visibility/confidence [0, 1]
   * @param {number} [timestamp] - Current timestamp in ms
   * @returns {{
   *   repCompleted: boolean,
   *   repsDone: number,
   *   currentPhase: string,
   *   completedRep: object|null,
   *   cues: string[]
   * }}
   */
  processFrame(metrics, confidence = 1.0, timestamp = Date.now()) {
    // 1. Skip or flag low confidence frames
    this.confidences.push(confidence);

    if (this.repStartTime === null) {
      this.repStartTime = timestamp;
    }

    // 2. Track ROM excursion for primary metric
    const romMetric = this.getPrimaryRomMetricName();
    const metricVal = metrics[romMetric];
    if (typeof metricVal === 'number' && !isNaN(metricVal)) {
      if (metricVal < this.minMetricVal) this.minMetricVal = metricVal;
      if (metricVal > this.maxMetricVal) this.maxMetricVal = metricVal;
    }

    // 3. Evaluate form rules during the rep (without premature duration checking)
    const { cues } = this.formChecker.checkFrame(metrics);

    // 4. Hysteresis phase transition
    const nextPhaseIndex = (this.cycleIndex + 1) % this.repCycle.length;
    const nextPhaseName = this.repCycle[nextPhaseIndex];

    let repCompleted = false;
    let completedRep = null;

    if (this.matchesPhase(nextPhaseName, metrics)) {
      this.cycleIndex = nextPhaseIndex;
      this.currentPhase = nextPhaseName;

      // When the cycle reaches the final phase in rep_cycle
      if (this.cycleIndex === this.repCycle.length - 1) {
        repCompleted = true;
        this.repsDone += 1;
        this.cycleIndex = 0;
        this.currentPhase = this.repCycle[0];

        const durationMs = Math.max(0, timestamp - this.repStartTime);
        const meanConfidence =
          this.confidences.length > 0
            ? this.confidences.reduce((a, b) => a + b, 0) / this.confidences.length
            : confidence;

        // Check min duration violation
        if (durationMs < this.minRepDurationMs) {
          this.formChecker.firedErrors.add('too_fast');
        }

        // Check confidence floor
        if (meanConfidence < this.minPoseConfidence) {
          this.formChecker.firedErrors.add('low_confidence');
        }

        // Check peak excursion rules (e.g. low_height)
        for (const rule of this.config.form_rules || []) {
          if (rule.check?.operator === 'lt' && (rule.id.includes('height') || rule.id.includes('rom'))) {
            const peakVal = this.maxMetricVal;
            if (peakVal !== -Infinity && evaluateCondition(rule.check, { [rule.check.metric]: peakVal })) {
              this.formChecker.firedErrors.add(rule.id);
            }
          }
        }

        const { errors, score } = this.formChecker.finalizeRep();

        // Calculate absolute angular ROM excursion in degrees (clamped [0, 180])
        let romDeg = 0;
        if (this.maxMetricVal !== -Infinity && this.minMetricVal !== Infinity) {
          romDeg = Math.max(0, Math.min(180, this.maxMetricVal - this.minMetricVal));
        }

        completedRep = {
          set_no: this.setNo,
          rep_no: this.repsDone,
          duration_ms: Math.round(durationMs),
          rom_deg: Math.round(romDeg * 10) / 10,
          form_score: Math.round(score * 10) / 10,
          errors,
          confidence: Math.round(meanConfidence * 100) / 100,
        };

        this.completedReps.push(completedRep);

        // Reset for next repetition
        this.repStartTime = timestamp;
        this.confidences = [];
        this.minMetricVal = metricVal ?? Infinity;
        this.maxMetricVal = metricVal ?? -Infinity;
        this.formChecker.resetRep();
      }
    }

    return {
      repCompleted,
      repsDone: this.repsDone,
      currentPhase: this.currentPhase,
      completedRep,
      cues,
    };
  }

  /**
   * Resets counter state.
   */
  reset() {
    this.cycleIndex = 0;
    this.currentPhase = this.repCycle[0];
    this.repsDone = 0;
    this.completedReps = [];
    this.repStartTime = null;
    this.confidences = [];
    this.minMetricVal = Infinity;
    this.maxMetricVal = -Infinity;
    this.formChecker.resetRep();
  }
}
