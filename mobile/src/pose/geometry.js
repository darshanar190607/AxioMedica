/**
 * mobile/src/pose/geometry.js
 * Pure mathematical geometry primitives for landmark processing.
 *
 * Rules:
 *   - Follows units.md: angles in degrees [0, 180], coordinates normalized [0, 1].
 *   - vertical_delta = reference.y - target.y (positive when target is higher on screen).
 *   - Time Complexity: O(1) for all primitive operations.
 */

/**
 * Computes the interior angle (in degrees, 0 to 180) at vertex B
 * formed by rays BA and BC using the law of cosines / dot product.
 *
 * @param {{x: number, y: number}} a - First landmark point
 * @param {{x: number, y: number}} b - Pivot/vertex landmark point
 * @param {{x: number, y: number}} c - Third landmark point
 * @returns {number} Angle in degrees [0, 180]
 */
export function angle(a, b, c) {
  if (!a || !b || !c) return 0;

  const abX = a.x - b.x;
  const abY = a.y - b.y;
  const cbX = c.x - b.x;
  const cbY = c.y - b.y;

  const dot = abX * cbX + abY * cbY;
  const magAB = Math.hypot(abX, abY);
  const magCB = Math.hypot(cbX, cbY);

  if (magAB === 0 || magCB === 0) return 0;

  // Numerical clamping to avoid NaN with acos domain [-1, 1]
  const cosTheta = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  const rad = Math.acos(cosTheta);
  return (rad * 180) / Math.PI;
}

/**
 * Computes vertical delta between a tracked landmark and a reference landmark.
 * In normalized image space (y=0 at top, y=1 at bottom), a target that is higher
 * on screen than the reference yields a positive delta.
 *
 * formula: vertical_delta = reference.y - target.y
 *
 * @param {{y: number}} target - Tracked landmark
 * @param {{y: number}} reference - Reference landmark
 * @returns {number} Vertical displacement (approx -1 to +1)
 */
export function verticalDelta(target, reference) {
  if (!target || !reference) return 0;
  return reference.y - target.y;
}

/**
 * Computes Euclidean distance between two landmarks in 2D.
 *
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number} Euclidean distance
 */
export function distance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Normalizes all landmarks against a reference limb length (e.g. knee to ankle).
 * Keeps displacement metrics invariant to patient distance from camera.
 *
 * @param {Record<string, {x: number, y: number}>} landmarks - Map of landmark points
 * @param {string} jointA - Name of starting reference joint
 * @param {string} jointB - Name of ending reference joint
 * @returns {{ scale: number, normalized: Record<string, {x: number, y: number}> }}
 */
export function normalizeLandmarks(landmarks, jointA, jointB) {
  if (!landmarks || !landmarks[jointA] || !landmarks[jointB]) {
    return { scale: 1.0, normalized: { ...landmarks } };
  }

  const limbLen = distance(landmarks[jointA], landmarks[jointB]);
  const scale = limbLen > 0.001 ? 1.0 / limbLen : 1.0;

  const normalized = {};
  for (const [name, pt] of Object.entries(landmarks)) {
    if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
      normalized[name] = {
        ...pt,
        x: pt.x * scale,
        y: pt.y * scale,
      };
    }
  }

  return { scale, normalized, ...normalized };
}

/**
 * Computes midpoint between two landmarks.
 *
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {{x: number, y: number}}
 */
export function midpoint(a, b) {
  if (!a && !b) return { x: 0, y: 0 };
  if (!a) return { x: b.x, y: b.y };
  if (!b) return { x: a.x, y: a.y };
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}
