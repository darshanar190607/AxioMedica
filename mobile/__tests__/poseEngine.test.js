/**
 * mobile/__tests__/poseEngine.test.js
 * Comprehensive unit and integration test suite for the AxioMedica Pose Engine.
 *
 * Covers:
 *  - Geometry primitives (angle, verticalDelta, distance, limb normalization)
 *  - One Euro Filter smoothing & jitter suppression
 *  - pose_config contract validation and side-awareness
 *  - metricEngine calculation
 *  - formChecker safe expression evaluation without eval()
 *  - repCounter hysteresis state machine for heel_raise & ankle_pump
 *  - Edge cases: jitter, low confidence, partial reps
 *  - calibration tracker baseline recording
 *  - sessionBuilder payload generation matching session_payload contract
 */

const {
  angle,
  verticalDelta,
  distance,
  normalizeLandmarks,
  OneEuroFilter,
  KeypointSmoother,
  validatePoseConfig,
  resolveJointName,
  MetricEngine,
  evaluateCondition,
  FormChecker,
  RepCounter,
  CalibrationTracker,
  buildExerciseResult,
  buildSessionPayload,
} = require('../src/pose');

// Sample valid configs matching docs/contracts/pose_config.schema.json
const heelRaiseConfig = {
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
      cue: 'Rise higher onto the ball of your foot.',
    },
    {
      id: 'hip_hike',
      check: { metric: 'hip_vertical_delta', operator: 'gt', value: 0.04 },
      cue: "Keep your hips level — don't hike one side.",
    },
  ],
  min_pose_confidence: 0.65,
};

const anklePumpConfig = {
  camera_view: 'side_either',
  side_aware: true,
  landmarks: {
    left_knee: 25,
    right_knee: 26,
    left_ankle: 27,
    right_ankle: 28,
    left_foot_index: 31,
    right_foot_index: 32,
  },
  metrics: [
    {
      name: 'ankle_angle',
      type: 'angle',
      joints: ['left_knee', 'left_ankle', 'left_foot_index'],
    },
  ],
  phases: [
    {
      name: 'neutral',
      condition: { metric: 'ankle_angle', operator: 'between', value: 85, value_max: 95 },
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
      cue: 'Slow it down — move steadily.',
    },
  ],
  min_pose_confidence: 0.60,
};

// ==========================================
// 1. GEOMETRY TESTS
// ==========================================
describe('Geometry Module (geometry.js)', () => {
  test('angle(A, B, C) calculates 90 degrees correctly', () => {
    // Vertex at (0, 0), A along positive Y (0, 1), C along positive X (1, 0)
    const A = { x: 0, y: 1 };
    const B = { x: 0, y: 0 };
    const C = { x: 1, y: 0 };
    const deg = angle(A, B, C);
    expect(deg).toBeCloseTo(90, 1);
  });

  test('angle(A, B, C) calculates 180 degrees (straight line)', () => {
    const A = { x: -1, y: 0 };
    const B = { x: 0, y: 0 };
    const C = { x: 1, y: 0 };
    const deg = angle(A, B, C);
    expect(deg).toBeCloseTo(180, 1);
  });

  test('verticalDelta returns positive when target rises above reference', () => {
    // Camera coordinates: y = 0 at top, 1 at bottom.
    // When heel rises from y=0.8 to y=0.7 while ankle is at y=0.8,
    // delta = reference.y - target.y = 0.8 - 0.7 = +0.10.
    const ankle = { x: 0.5, y: 0.8 };
    const heel = { x: 0.5, y: 0.7 };
    expect(verticalDelta(heel, ankle)).toBeCloseTo(0.1, 4);
  });

  test('distance calculates Euclidean 2D distance', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };
    expect(distance(p1, p2)).toBeCloseTo(5.0, 4);
  });

  test('normalizeLandmarks scales coordinates by limb segment length', () => {
    const landmarks = {
      25: { x: 0.5, y: 0.4 }, // knee
      27: { x: 0.5, y: 0.8 }, // ankle (shank length = 0.4)
    };
    const normalized = normalizeLandmarks(landmarks, 25, 27);
    const shankLength = distance(normalized[25], normalized[27]);
    expect(shankLength).toBeCloseTo(1.0, 4);
  });
});

// ==========================================
// 2. SMOOTHING (ONE EURO FILTER) TESTS
// ==========================================
describe('Smoothing Module (smoothing.js)', () => {
  test('suppresses high-frequency jitter while preserving steady signal', () => {
    const filter = new OneEuroFilter(1.0, 0.007);
    const trueValue = 0.5;
    const noisySamples = [
      trueValue + 0.08,
      trueValue - 0.07,
      trueValue + 0.06,
      trueValue - 0.05,
      trueValue + 0.07,
      trueValue - 0.06,
      trueValue + 0.05,
      trueValue,
    ];

    let smoothedVal = trueValue;
    noisySamples.forEach((val, i) => {
      smoothedVal = filter.filter(val, i * 33.3);
    });

    // Smoothed value should be significantly closer to 0.5 than noisy peaks
    expect(Math.abs(smoothedVal - trueValue)).toBeLessThan(0.03);
  });

  test('KeypointSmoother tracks multiple landmark coordinates', () => {
    const smoother = new KeypointSmoother();
    const landmarks = {
      27: { x: 0.5, y: 0.8, visibility: 0.95 },
    };
    const s1 = smoother.filterLandmarks(landmarks, 0);
    expect(s1[27].x).toBeCloseTo(0.5, 2);
    expect(s1[27].visibility).toBe(0.95);
  });
});

// ==========================================
// 3. POSE CONFIG & CONTRACT VALIDATION
// ==========================================
describe('Pose Config & Contract (poseConfig.js)', () => {
  test('validates valid heel_raise and ankle_pump configs without error', () => {
    expect(() => validatePoseConfig(heelRaiseConfig)).not.toThrow();
    expect(() => validatePoseConfig(anklePumpConfig)).not.toThrow();
  });

  test('throws validation error on missing required fields', () => {
    expect(() => validatePoseConfig({ camera_view: 'side_either' })).toThrow(/missing required property/i);
  });

  test('resolveJointName swaps side prefix according to injured_side', () => {
    expect(resolveJointName('left_ankle', 'right')).toBe('right_ankle');
    expect(resolveJointName('left_knee', 'left')).toBe('left_knee');
    expect(resolveJointName('right_heel', 'left')).toBe('left_heel');
  });
});

// ==========================================
// 4. METRIC ENGINE TESTS
// ==========================================
describe('Metric Engine (metricEngine.js)', () => {
  test('computes heel_height vertical delta and ankle_angle', () => {
    const engine = new MetricEngine(heelRaiseConfig, { injuredSide: 'left' });
    const landmarks = {
      25: { x: 0.5, y: 0.4, visibility: 0.9 }, // left_knee
      27: { x: 0.5, y: 0.8, visibility: 0.9 }, // left_ankle
      29: { x: 0.45, y: 0.72, visibility: 0.9 }, // left_heel (raised 0.08 above ankle)
      31: { x: 0.6, y: 0.8, visibility: 0.9 }, // left_foot_index
      23: { x: 0.5, y: 0.1, visibility: 0.9 }, // left_hip
    };

    const metrics = engine.computeMetrics(landmarks);
    expect(metrics.heel_height).toBeCloseTo(0.08, 2);
    expect(metrics.ankle_angle).toBeGreaterThan(0);
  });

  test('side-aware metric engine maps to right landmarks when injuredSide=right', () => {
    const engine = new MetricEngine(heelRaiseConfig, { injuredSide: 'right' });
    const landmarks = {
      26: { x: 0.5, y: 0.4, visibility: 0.9 }, // right_knee
      28: { x: 0.5, y: 0.8, visibility: 0.9 }, // right_ankle
      30: { x: 0.45, y: 0.75, visibility: 0.9 }, // right_heel
      32: { x: 0.6, y: 0.8, visibility: 0.9 }, // right_foot_index
      24: { x: 0.5, y: 0.1, visibility: 0.9 }, // right_hip
    };

    const metrics = engine.computeMetrics(landmarks);
    expect(metrics.heel_height).toBeCloseTo(0.05, 2);
  });
});

// ==========================================
// 5. FORM CHECKER & EXPRESSION PARSER
// ==========================================
describe('Form Checker (formChecker.js)', () => {
  test('evaluates safe relational operators without eval()', () => {
    expect(evaluateCondition({ metric: 'rom', operator: 'lt', value: 10 }, { rom: 5 })).toBe(true);
    expect(evaluateCondition({ metric: 'rom', operator: 'gte', value: 20 }, { rom: 25 })).toBe(true);
    expect(evaluateCondition({ metric: 'rom', operator: 'between', value: 10, value_max: 20 }, { rom: 15 })).toBe(true);
    expect(evaluateCondition({ metric: 'rom', operator: 'between', value: 10, value_max: 20 }, { rom: 25 })).toBe(false);
  });

  test('penalizes form score when rules are violated', () => {
    const checker = new FormChecker(heelRaiseConfig);
    checker.checkFrame({ rep_duration_ms: 1000, heel_height: 0.05, hip_vertical_delta: 0.05 });
    const result = checker.finalizeRep();

    expect(result.errors).toContain('too_fast');
    expect(result.errors).toContain('hip_hike');
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ==========================================
// 6. REP COUNTER & SIMULATED SEQUENCES
// ==========================================
describe('Rep Counter & Exercise Simulations (repCounter.js)', () => {
  test('heel_raise: counts clean repetitions matching phase cycle [down, up, down]', () => {
    const counter = new RepCounter(heelRaiseConfig);
    let t = 1000;

    // Start in 'down' phase
    counter.processFrame({ heel_height: 0.01, ankle_angle: 90 }, 0.95, t);
    expect(counter.currentPhase).toBe('down');
    expect(counter.repsDone).toBe(0);

    // Transition to 'up' phase after 1000ms
    t += 1000;
    counter.processFrame({ heel_height: 0.09, ankle_angle: 135 }, 0.95, t);
    expect(counter.currentPhase).toBe('up');

    // Return to 'down' phase after 1000ms (total duration 2000ms > min 1500ms)
    t += 1000;
    const res = counter.processFrame({ heel_height: 0.01, ankle_angle: 90 }, 0.95, t);

    expect(res.repCompleted).toBe(true);
    expect(res.repsDone).toBe(1);
    expect(res.completedRep.duration_ms).toBeGreaterThanOrEqual(1500);
    expect(res.completedRep.rom_deg).toBeCloseTo(45, 1);
    expect(res.completedRep.errors).toEqual([]);
    expect(res.completedRep.form_score).toBe(100);
  });

  test('ankle_pump: counts repetitions through 5-phase cycle [neutral, dorsi, neutral, plantar, neutral]', () => {
    const counter = new RepCounter(anklePumpConfig);
    let t = 1000;

    // Phase 1: neutral
    counter.processFrame({ ankle_angle: 90 }, 0.90, t);
    expect(counter.currentPhase).toBe('neutral');

    // Phase 2: dorsiflexed (< 78 deg)
    t += 400;
    counter.processFrame({ ankle_angle: 70 }, 0.90, t);
    expect(counter.currentPhase).toBe('dorsiflexed');

    // Phase 3: neutral
    t += 400;
    counter.processFrame({ ankle_angle: 90 }, 0.90, t);
    expect(counter.currentPhase).toBe('neutral');

    // Phase 4: plantarflexed (> 108 deg)
    t += 400;
    counter.processFrame({ ankle_angle: 120 }, 0.90, t);
    expect(counter.currentPhase).toBe('plantarflexed');

    // Phase 5: return to neutral (completion)
    t += 400;
    const res = counter.processFrame({ ankle_angle: 90 }, 0.90, t);

    expect(res.repCompleted).toBe(true);
    expect(res.repsDone).toBe(1);
    expect(res.completedRep.duration_ms).toBe(1600);
    expect(res.completedRep.rom_deg).toBe(50); // 120 - 70 = 50 deg excursion
    expect(res.completedRep.errors).toEqual([]);
  });

  // ==========================================
  // 7. EDGE CASES
  // ==========================================
  test('Edge case: too fast rep incurs penalty and error flag', () => {
    const counter = new RepCounter(heelRaiseConfig);
    let t = 1000;

    counter.processFrame({ heel_height: 0.01, ankle_angle: 90 }, 0.95, t);
    t += 300; // Only 300ms! (min required is 1500ms)
    counter.processFrame({ heel_height: 0.09, ankle_angle: 135 }, 0.95, t);
    t += 300;
    const res = counter.processFrame({ heel_height: 0.01, ankle_angle: 90 }, 0.95, t);

    expect(res.repCompleted).toBe(true);
    expect(res.completedRep.errors).toContain('too_fast');
    expect(res.completedRep.form_score).toBeLessThan(100);
  });

  test('Edge case: low confidence frames flag low_confidence error', () => {
    const counter = new RepCounter(heelRaiseConfig);
    let t = 1000;

    counter.processFrame({ heel_height: 0.01, ankle_angle: 90 }, 0.40, t); // 0.40 < min 0.65
    t += 800;
    counter.processFrame({ heel_height: 0.09, ankle_angle: 135 }, 0.40, t);
    t += 800;
    const res = counter.processFrame({ heel_height: 0.01, ankle_angle: 90 }, 0.40, t);

    expect(res.repCompleted).toBe(true);
    expect(res.completedRep.errors).toContain('low_confidence');
    expect(res.completedRep.confidence).toBe(0.4);
  });

  test('Edge case: partial rep does not trigger completion', () => {
    const counter = new RepCounter(heelRaiseConfig);
    let t = 1000;

    counter.processFrame({ heel_height: 0.01, ankle_angle: 90 }, 0.95, t);
    t += 800;
    counter.processFrame({ heel_height: 0.04, ankle_angle: 110 }, 0.95, t); // Heel height 0.04 never reached 'up' threshold of 0.08
    t += 800;
    const res = counter.processFrame({ heel_height: 0.01, ankle_angle: 90 }, 0.95, t);

    expect(res.repCompleted).toBe(false);
    expect(res.repsDone).toBe(0);
  });
});

// ==========================================
// 8. CALIBRATION & SESSION BUILDER
// ==========================================
describe('Calibration & Session Builder (calibration.js & sessionBuilder.js)', () => {
  test('CalibrationTracker records baseline ROM and neutral angles', () => {
    const tracker = new CalibrationTracker(heelRaiseConfig, { targetFrames: 5 });
    for (let i = 0; i < 5; i++) {
      tracker.addFrame({ ankle_angle: 90 + i, heel_height: 0.01 }, 0.9);
    }

    const baseline = tracker.getBaseline();
    expect(baseline.isCalibrated).toBe(true);
    expect(baseline.neutralAngles.ankle_angle).toBe(92);
    expect(baseline.meanConfidence).toBe(0.9);
  });

  test('buildSessionPayload builds schema-compliant payload matching session_payload contract', () => {
    const reps = [
      {
        set_no: 1,
        rep_no: 1,
        duration_ms: 2000,
        rom_deg: 45.0,
        form_score: 95.0,
        errors: [],
        confidence: 0.95,
      },
    ];

    const exerciseResult = buildExerciseResult({
      exerciseId: 'ex-101',
      side: 'left',
      completedReps: reps,
      targetReps: 10,
      targetHoldSec: 0,
      baselineRomDeg: 42.0,
      clientUuid: 'ex-client-uuid-1',
    });

    const sessionPayload = buildSessionPayload({
      planId: 'plan-001',
      startedAt: '2026-10-11T20:00:00.000Z',
      endedAt: '2026-10-11T20:15:00.000Z',
      painScorePre: 3,
      painScorePost: 2,
      exerciseResults: [exerciseResult],
      clientUuid: 'sess-uuid-001',
    });

    expect(sessionPayload.plan_id).toBe('plan-001');
    expect(sessionPayload.exercises).toHaveLength(1);
    expect(sessionPayload.exercises[0].pain_before).toBe(3);
    expect(sessionPayload.exercises[0].reps).toHaveLength(1);
    expect(sessionPayload.exercises[0].reps[0].rom_deg).toBe(45.0);
  });
});
