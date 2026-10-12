/**
 * mobile/src/pose/sessionBuilder.js
 * Converts real-time rep telemetry into the exact JSON format defined in
 * docs/contracts/session_payload.schema.json.
 *
 * Rules:
 *   - Strictly adheres to JSON Schema: never includes raw video or PII landmarks.
 *   - Clamps numeric bounds per units.md (pain 0-10, confidence 0-1, ROM 0-180, form 0-100).
 *   - Time Complexity: O(R) where R is total reps across all exercises.
 */

/**
 * Simple client-side UUID v4 generator (RFC 4122 compliant).
 * Works in standard JS without external crypto packages.
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Builds an ExerciseResult object from recorded repetitions.
 *
 * @param {object} params
 * @param {number} params.exerciseId - Database FK -> exercises.id
 * @param {Array<object>} params.reps - Array of RepResult telemetry
 * @param {number} [params.setsDone=1]
 * @param {number} [params.painBefore=0]
 * @param {number} [params.painAfter=0]
 * @param {string} [params.side='right']
 * @returns {object} Formatted ExerciseResult
 */
export function buildExerciseResult({
  exerciseId,
  reps = null,
  completedReps = null,
  setsDone = 1,
  painBefore = 0,
  painAfter = 0,
  side = 'right',
  ...rest
}) {
  const actualReps = reps || completedReps || rest.reps || [];
  const repsDone = actualReps.length;
  let avgFormScore = 100.0;
  let maxRomDeg = 0.0;
  let avgRomDeg = 0.0;

  if (repsDone > 0) {
    const totalScore = actualReps.reduce((sum, r) => sum + (r.form_score ?? 100), 0);
    avgFormScore = Math.round((totalScore / repsDone) * 10) / 10;

    const roms = actualReps.map(r => r.rom_deg ?? 0);
    maxRomDeg = Math.round(Math.max(...roms) * 10) / 10;
    avgRomDeg = Math.round((roms.reduce((a, b) => a + b, 0) / repsDone) * 10) / 10;
  }

  // Format reps adhering to RepResult schema
  const formattedReps = actualReps.map((r, i) => ({
    set_no: Math.max(1, r.set_no ?? 1),
    rep_no: Math.max(1, r.rep_no ?? i + 1),
    duration_ms: Math.max(0, Math.round(r.duration_ms ?? 0)),
    rom_deg: Math.max(0, Math.min(180, Math.round((r.rom_deg ?? 0) * 10) / 10)),
    form_score: Math.max(0, Math.min(100, Math.round((r.form_score ?? 100) * 10) / 10)),
    errors: Array.isArray(r.errors) ? r.errors : [],
    confidence: Math.max(0, Math.min(1, Math.round((r.confidence ?? 0.95) * 100) / 100)),
  }));

  return {
    exercise_id: isNaN(Number(exerciseId)) ? 1 : Number(exerciseId),
    sets_done: Math.max(0, setsDone),
    reps_done: repsDone,
    avg_form_score: Math.max(0, Math.min(100, avgFormScore)),
    max_rom_deg: Math.max(0, Math.min(180, maxRomDeg)),
    avg_rom_deg: Math.max(0, Math.min(180, avgRomDeg)),
    pain_before: Math.max(0, Math.min(10, Math.round(painBefore))),
    pain_after: Math.max(0, Math.min(10, Math.round(painAfter))),
    side: side === 'left' || side === 'right' || side === 'bilateral' ? side : 'right',
    reps: formattedReps,
  };
}

/**
 * Builds the complete SessionPayload for sync upload.
 *
 * @param {object} params
 * @param {string} [params.clientUuid] - UUID v4 (generated if omitted)
 * @param {string} [params.startedAt] - ISO-8601 string
 * @param {string} [params.endedAt] - ISO-8601 string
 * @param {string} [params.poseModelVer='1.0.0']
 * @param {string} [params.appVersion='1.0.0']
 * @param {string|null} [params.planId=null]
 * @param {Array<object>} params.exercises - Array of ExerciseResult objects
 * @returns {object} Valid SessionPayload
 */
export function buildSessionPayload({
  clientUuid = null,
  startedAt = null,
  endedAt = null,
  poseModelVer = '1.0.0',
  appVersion = '1.0.0',
  planId = null,
  exercises = null,
  exerciseResults = null,
  ...rest
}) {
  const exercisesList = exercises || exerciseResults || rest.exercises || [];
  if (!Array.isArray(exercisesList) || exercisesList.length === 0) {
    throw new Error('SessionPayload requires at least one exercise.');
  }

  const now = new Date();
  const startTime = startedAt ? new Date(startedAt) : new Date(now.getTime() - 10 * 60000);
  const endTime = endedAt ? new Date(endedAt) : now;

  // Aggregate overall form score across all exercises
  const totalScore = exercisesList.reduce((sum, ex) => sum + (ex.avg_form_score ?? 100), 0);
  const overallScore = Math.round((totalScore / exercisesList.length) * 10) / 10;

  const payload = {
    client_uuid: clientUuid || generateUUID(),
    started_at: startTime.toISOString(),
    ended_at: endTime.toISOString(),
    pose_model_ver: poseModelVer,
    app_version: appVersion,
    overall_score: Math.max(0, Math.min(100, overallScore)),
    exercises: exercisesList.map(ex => ({
      ...ex,
      pain_before: ex.pain_before || (rest.painScorePre ?? rest.pain_score_pre ?? 0),
      pain_after: ex.pain_after || (rest.painScorePost ?? rest.pain_score_post ?? 0),
    })),
  };

  if (planId) {
    payload.plan_id = planId;
  }

  return payload;
}
