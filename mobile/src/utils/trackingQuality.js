/**
 * mobile/src/utils/trackingQuality.js
 *
 * Real-time tracking quality evaluator.
 * Maps incoming landmark frame and required joints into:
 * status: 'tracking' | 'partial' | 'lost'
 * alongside human-readable guidance and diagnostic metadata.
 */

/**
 * Evaluates tracking quality of a frame against required anatomical joints.
 *
 * @param {Object} frame - Canonical frame or landmarks named map
 * @param {string[]} requiredJoints - Array of required landmark keys
 * @param {number} [minConfidence=0.60] - Target confidence threshold
 * @returns {{
 *   status: 'tracking' | 'partial' | 'lost',
 *   message: string,
 *   meanConfidence: number,
 *   missingJoints: string[],
 * }}
 */
export function evaluateTrackingQuality(frame, requiredJoints = [], minConfidence = 0.60) {
  const landmarks = frame?.landmarks || frame;

  if (!landmarks || typeof landmarks !== 'object') {
    return {
      status: 'lost',
      message: 'Step back into camera view',
      meanConfidence: 0,
      missingJoints: [...requiredJoints],
    };
  }

  if (!requiredJoints || requiredJoints.length === 0) {
    return {
      status: 'tracking',
      message: 'Tracking active',
      meanConfidence: 1.0,
      missingJoints: [],
    };
  }

  let totalVisibility = 0;
  const missingJoints = [];

  for (const joint of requiredJoints) {
    const pt = landmarks[joint];
    const vis = pt && typeof pt.visibility === 'number' ? pt.visibility : (pt ? 1.0 : 0.0);
    totalVisibility += vis;

    if (!pt || vis < 0.40) {
      missingJoints.push(joint);
    }
  }

  const meanConfidence = totalVisibility / requiredJoints.length;

  // Lost: mean confidence below 0.40 OR more than 40% of required joints missing
  if (meanConfidence < 0.40 || missingJoints.length > requiredJoints.length * 0.4) {
    let msg = 'Step back into camera view';
    if (missingJoints.some(j => j.includes('ankle') || j.includes('heel') || j.includes('foot'))) {
      msg = 'Ankle not detected — adjust camera angle';
    }
    return {
      status: 'lost',
      message: msg,
      meanConfidence: Number(meanConfidence.toFixed(2)),
      missingJoints,
    };
  }

  // Partial: mean confidence below target threshold or key joint obscured
  if (meanConfidence < minConfidence || missingJoints.length > 0) {
    return {
      status: 'partial',
      message: 'Keep lower leg & ankle clearly visible',
      meanConfidence: Number(meanConfidence.toFixed(2)),
      missingJoints,
    };
  }

  // Tracking: all required joints visible with high confidence
  return {
    status: 'tracking',
    message: 'Good position ✓ Begin movement',
    meanConfidence: Number(meanConfidence.toFixed(2)),
    missingJoints: [],
  };
}

