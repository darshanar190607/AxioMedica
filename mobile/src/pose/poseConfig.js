/**
 * mobile/src/pose/poseConfig.js
 * Loads, normalizes, and validates exercise pose_config specifications.
 * Enforces strict compliance with docs/contracts/pose_config.schema.json.
 *
 * Rules:
 *   - No hardcoded exercise logic. Everything drives from pose_config.
 *   - Side-aware joint resolution converts left_/right_ landmarks based on patient's injured_side.
 *   - Time Complexity: O(M + P + R) for initial load/validation (small constants, ~1ms).
 */

const VALID_CAMERA_VIEWS = new Set(['front', 'side_left', 'side_right', 'side_either']);
const VALID_OPERATORS = new Set(['lt', 'lte', 'gt', 'gte', 'between']);
const VALID_METRIC_TYPES = new Set(['angle', 'vertical_delta', 'distance']);

/**
 * Validates a pose_config object against contract requirements.
 * Throws a descriptive Error if any required field or structural rule fails.
 *
 * @param {object} config - The raw pose_config
 * @returns {object} Validated config
 */
export function validatePoseConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('pose_config must be a non-null object.');
  }

  // 1. Required top-level fields
  const requiredFields = [
    'camera_view',
    'side_aware',
    'landmarks',
    'metrics',
    'phases',
    'rep_cycle',
    'min_rep_duration_ms',
    'form_rules',
    'min_pose_confidence',
  ];

  for (const field of requiredFields) {
    if (config[field] === undefined || config[field] === null) {
      throw new Error(`pose_config missing required property/field: '${field}'`);
    }
  }

  // 2. Camera view validation
  if (!VALID_CAMERA_VIEWS.has(config.camera_view)) {
    throw new Error(
      `Invalid camera_view '${config.camera_view}'. Expected one of: ${[...VALID_CAMERA_VIEWS].join(', ')}`
    );
  }

  // 3. Landmarks validation
  if (typeof config.landmarks !== 'object' || Array.isArray(config.landmarks)) {
    throw new Error('pose_config.landmarks must be an object map.');
  }
  const landmarkEntries = Object.entries(config.landmarks);
  if (landmarkEntries.length === 0) {
    throw new Error('pose_config.landmarks must contain at least 1 landmark mapping.');
  }
  for (const [name, index] of landmarkEntries) {
    if (typeof index !== 'number' || index < 0 || index > 32) {
      throw new Error(`Invalid landmark index '${index}' for '${name}'. Must be 0-32.`);
    }
  }

  // 4. Metrics validation
  if (!Array.isArray(config.metrics) || config.metrics.length === 0) {
    throw new Error('pose_config.metrics must be a non-empty array.');
  }
  const declaredMetricNames = new Set(['rep_duration_ms']);
  for (const metric of config.metrics) {
    if (!metric.name || !metric.type) {
      throw new Error("Metric must have 'name' and 'type'.");
    }
    if (!VALID_METRIC_TYPES.has(metric.type)) {
      throw new Error(`Invalid metric type '${metric.type}' for metric '${metric.name}'.`);
    }
    if (metric.type === 'angle' && (!Array.isArray(metric.joints) || metric.joints.length !== 3)) {
      throw new Error(`Angle metric '${metric.name}' must specify exactly 3 joints.`);
    }
    if (metric.type === 'vertical_delta' && (!metric.landmark || !metric.reference_landmark)) {
      throw new Error(
        `Vertical delta metric '${metric.name}' requires 'landmark' and 'reference_landmark'.`
      );
    }
    declaredMetricNames.add(metric.name);
  }

  // 5. Phases validation
  if (!Array.isArray(config.phases) || config.phases.length < 2) {
    throw new Error('pose_config.phases must be an array with at least 2 phases.');
  }
  const phaseNames = new Set();
  for (const phase of config.phases) {
    if (!phase.name || !phase.condition) {
      throw new Error("Phase must have 'name' and 'condition'.");
    }
    validateThresholdCheck(phase.condition, declaredMetricNames, `Phase '${phase.name}'`);
    phaseNames.add(phase.name);
  }

  // 6. Rep cycle validation
  if (!Array.isArray(config.rep_cycle) || config.rep_cycle.length < 2) {
    throw new Error('pose_config.rep_cycle must contain at least 2 phase transitions.');
  }
  for (const phaseName of config.rep_cycle) {
    if (!phaseNames.has(phaseName)) {
      throw new Error(`rep_cycle refers to undeclared phase '${phaseName}'.`);
    }
  }

  // 7. Form rules validation
  if (!Array.isArray(config.form_rules)) {
    throw new Error('pose_config.form_rules must be an array.');
  }
  for (const rule of config.form_rules) {
    if (!rule.id || !rule.check) {
      throw new Error("FormRule must have 'id' and 'check'.");
    }
    validateThresholdCheck(rule.check, declaredMetricNames, `FormRule '${rule.id}'`);
  }

  // 8. Confidence validation
  if (
    typeof config.min_pose_confidence !== 'number' ||
    config.min_pose_confidence < 0 ||
    config.min_pose_confidence > 1
  ) {
    throw new Error('min_pose_confidence must be a number between 0 and 1.');
  }

  return config;
}

function validateThresholdCheck(check, declaredMetrics, context) {
  if (!check || typeof check !== 'object') {
    throw new Error(`${context}: check condition must be an object.`);
  }
  if (!declaredMetrics.has(check.metric)) {
    throw new Error(`${context}: refers to undeclared metric '${check.metric}'.`);
  }
  if (!VALID_OPERATORS.has(check.operator)) {
    throw new Error(
      `${context}: invalid operator '${check.operator}'. Expected: ${[...VALID_OPERATORS].join(', ')}`
    );
  }
  if (typeof check.value !== 'number') {
    throw new Error(`${context}: threshold value must be a number.`);
  }
  if (check.operator === 'between' && typeof check.value_max !== 'number') {
    throw new Error(`${context}: operator 'between' requires 'value_max'.`);
  }
}

/**
 * Resolves joint name according to patient's injured side.
 * When side_aware is true and the patient's injured side is 'right',
 * converts 'left_' joint references to 'right_' (and vice-versa).
 *
 * @param {string} jointName - e.g. 'left_ankle'
 * @param {string} injuredSide - 'left' or 'right'
 * @param {boolean} sideAware - config.side_aware
 * @returns {string} Resolved landmark key
 */
export function resolveJointName(jointName, injuredSide = 'left', sideAware = true) {
  if (!sideAware || !jointName) return jointName;

  const targetSide = String(injuredSide).toLowerCase().trim();
  if (targetSide === 'right' && jointName.startsWith('left_')) {
    return jointName.replace(/^left_/, 'right_');
  }
  if (targetSide === 'left' && jointName.startsWith('right_')) {
    return jointName.replace(/^right_/, 'left_');
  }
  return jointName;
}
