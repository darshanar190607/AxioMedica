/**
 * mobile/src/pose/fixtures.js
 * Default pose configurations for ankle rehabilitation exercises.
 * Conforms strictly to docs/contracts/pose_config.schema.json.
 */

export const HEEL_RAISE_CONFIG = {
  camera_view: 'side_either',
  side_aware: true,
  landmarks: {
    left_hip: 23,
    right_hip: 24,
    left_knee: 25,
    right_knee: 26,
    left_ankle: 27,
    right_ankle: 28,
    left_heel: 29,
    right_heel: 30,
    left_foot_index: 31,
    right_foot_index: 32,
  },
  metrics: [
    {
      name: 'heel_height',
      type: 'vertical_delta',
      landmark: 'left_heel',
      reference_landmark: 'left_ankle',
    },
    {
      name: 'ankle_angle',
      type: 'angle',
      joints: ['left_knee', 'left_ankle', 'left_foot_index'],
    },
    {
      name: 'hip_vertical_delta',
      type: 'vertical_delta',
      landmark: 'left_hip',
      reference_landmark: 'left_knee',
    },
  ],
  phases: [
    {
      name: 'down',
      condition: { metric: 'heel_height', operator: 'lte', value: 0.02 },
    },
    {
      name: 'up',
      condition: { metric: 'heel_height', operator: 'gte', value: 0.08 },
    },
  ],
  rep_cycle: ['down', 'up', 'down'],
  min_rep_duration_ms: 1500,
  form_rules: [
    {
      id: 'too_fast',
      check: { metric: 'rep_duration_ms', operator: 'lt', value: 1500 },
      cue: 'Slow down — aim for 2 seconds up, hold, then 2 seconds down.',
    },
    {
      id: 'low_height',
      check: { metric: 'heel_height', operator: 'lt', value: 0.06 },
      cue: 'Rise higher onto the ball of your foot — push through the big toe.',
    },
    {
      id: 'hip_hike',
      check: { metric: 'hip_vertical_delta', operator: 'gt', value: 0.04 },
      cue: "Keep your hips level — don't let one side hike up.",
    },
  ],
  min_pose_confidence: 0.65,
};

export const ANKLE_PUMP_CONFIG = {
  camera_view: 'side_either',
  side_aware: true,
  landmarks: {
    left_knee: 25,
    right_knee: 26,
    left_ankle: 27,
    right_ankle: 28,
    left_heel: 29,
    right_heel: 30,
    left_foot_index: 31,
    right_foot_index: 32,
  },
  metrics: [
    {
      name: 'ankle_angle',
      type: 'angle',
      joints: ['left_knee', 'left_ankle', 'left_foot_index'],
    },
    {
      name: 'ankle_angle_delta',
      type: 'vertical_delta',
      landmark: 'left_foot_index',
      reference_landmark: 'left_ankle',
    },
  ],
  phases: [
    {
      name: 'neutral',
      condition: { metric: 'ankle_angle', operator: 'between', value: 82, value_max: 98 },
    },
    {
      name: 'dorsiflexed',
      condition: { metric: 'ankle_angle', operator: 'lte', value: 78 },
    },
    {
      name: 'plantarflexed',
      condition: { metric: 'ankle_angle', operator: 'gte', value: 108 },
    },
  ],
  rep_cycle: ['neutral', 'dorsiflexed', 'neutral', 'plantarflexed', 'neutral'],
  min_rep_duration_ms: 1200,
  form_rules: [
    {
      id: 'too_fast',
      check: { metric: 'rep_duration_ms', operator: 'lt', value: 1200 },
      cue: 'Slow it down — move steadily through the full range.',
    },
  ],
  min_pose_confidence: 0.6,
};

export const DEFAULT_EXERCISE_CONFIGS = {
  'heel raise': HEEL_RAISE_CONFIG,
  'heel_raise': HEEL_RAISE_CONFIG,
  'ankle pump': ANKLE_PUMP_CONFIG,
  'ankle_pump': ANKLE_PUMP_CONFIG,
  'dorsiflexion': ANKLE_PUMP_CONFIG,
};

export function getPoseConfigForExercise(exerciseName) {
  if (!exerciseName) return HEEL_RAISE_CONFIG;
  const key = String(exerciseName).toLowerCase().trim();
  for (const [pattern, cfg] of Object.entries(DEFAULT_EXERCISE_CONFIGS)) {
    if (key.includes(pattern)) return cfg;
  }
  return HEEL_RAISE_CONFIG;
}
