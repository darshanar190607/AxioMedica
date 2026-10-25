/**
 * mobile/src/pose/angleCalculator.js
 * Computes joint angles from landmark arrays.
 * Implemented using pure mathematical dot product from geometry.js.
 */
import { angle } from './geometry';

export function computeAngle(a, b, c) {
  return angle(a, b, c);
}

export default computeAngle;
