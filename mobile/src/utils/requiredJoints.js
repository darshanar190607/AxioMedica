/**
 * mobile/src/utils/requiredJoints.js
 *
 * Exercise-to-required-joints mapping table.
 * Derived from what MetricEngine, RepCounter, and FormChecker actually read
 * for each rehabilitation exercise (fixtures.js & poseConfig.js).
 */

export const REQUIRED_JOINTS = {
  heel_raise: [
    'left_hip',
    'right_hip',
    'left_knee',
    'right_knee',
    'left_ankle',
    'right_ankle',
    'left_heel',
    'right_heel',
    'left_foot_index',
    'right_foot_index',
  ],
  ankle_pump: [
    'left_knee',
    'right_knee',
    'left_ankle',
    'right_ankle',
    'left_heel',
    'right_heel',
    'left_foot_index',
    'right_foot_index',
  ],
};

/**
 * Returns array of required landmark names for a given exercise name.
 * Defaults to 'ankle_pump' joints if unknown.
 *
 * @param {string} exerciseName
 * @returns {string[]}
 */
export function getRequiredJoints(exerciseName) {
  if (!exerciseName || typeof exerciseName !== 'string') {
    return REQUIRED_JOINTS.ankle_pump;
  }
  const key = exerciseName.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return REQUIRED_JOINTS[key] || REQUIRED_JOINTS.ankle_pump;
}

