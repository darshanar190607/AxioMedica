/**
 * mobile/src/pose/formChecker.js
 * Safely evaluates form_rules without eval().
 * Returns fired errors, actionable coaching cues, and a 0-100 form score.
 *
 * Rules:
 *   - Strictly no eval() or new Function(). Safe AST/operator lookup.
 *   - Follows units.md scoring formula: form_score = 100 - sum(penalty_per_rule_fired), clamped >= 0.
 *   - First violation wins for a given error id per rep.
 *   - Time Complexity: O(R) where R is count of form_rules (R <= 10 -> O(1)).
 */

export function evaluateCondition(condition, metrics) {
  if (!condition || !metrics) return false;

  const val = metrics[condition.metric];
  if (typeof val !== 'number' || isNaN(val)) {
    return false;
  }

  const target = condition.value;

  switch (condition.operator) {
    case 'lt':
      return val < target;
    case 'lte':
      return val <= target;
    case 'gt':
      return val > target;
    case 'gte':
      return val >= target;
    case 'between':
      return val >= target && val <= condition.value_max;
    default:
      return false;
  }
}

export class FormChecker {
  /**
   * @param {object} config - Validated pose_config
   * @param {number} [penaltyPerRule=10] - Default score penalty per fired error rule
   */
  constructor(config, penaltyPerRule = 10) {
    this.config = config;
    this.penaltyPerRule = penaltyPerRule;
    this.rules = config.form_rules || [];
    this.firedErrors = new Set();
    this.activeCues = [];
  }

  /**
   * Resets error state for the start of a new repetition.
   */
  resetRep() {
    this.firedErrors.clear();
    this.activeCues = [];
  }

  /**
   * Evaluates all form rules against current frame metrics.
   *
   * @param {Record<string, number>} metrics - Frame metrics
   * @returns {{ newlyFired: string[], cues: string[] }}
   */
  checkFrame(metrics) {
    const newlyFired = [];

    for (const rule of this.rules) {
      if (this.firedErrors.has(rule.id)) {
        continue; // First violation wins for this rule in current rep
      }

      // rep_duration_ms is skipped during initial frame (when duration is 0)
      if (rule.check?.metric === 'rep_duration_ms' && (!metrics.rep_duration_ms || metrics.rep_duration_ms === 0)) {
        continue;
      }

      // Peak target metrics (e.g. low_height where operator is 'lt') are evaluated against peak excursion at rep completion
      if (rule.check?.operator === 'lt' && (rule.id.includes('height') || rule.id.includes('rom'))) {
        continue;
      }

      if (evaluateCondition(rule.check, metrics)) {
        this.firedErrors.add(rule.id);
        newlyFired.push(rule.id);
        if (rule.cue && !this.activeCues.includes(rule.cue)) {
          this.activeCues.push(rule.cue);
        }
      }
    }

    return {
      newlyFired,
      cues: [...this.activeCues],
    };
  }

  /**
   * Computes final form quality evaluation for a completed rep.
   *
   * @returns {{ errors: string[], cues: string[], score: number }}
   */
  finalizeRep() {
    const errors = Array.from(this.firedErrors);
    const totalPenalty = errors.length * this.penaltyPerRule;
    const score = Math.max(0, Math.min(100, 100 - totalPenalty));

    return {
      errors,
      cues: [...this.activeCues],
      score,
    };
  }
}
