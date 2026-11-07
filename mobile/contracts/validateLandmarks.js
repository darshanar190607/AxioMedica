/**
 * mobile/contracts/validateLandmarks.js
 * Contract validator for on-device pose landmark frames.
 * Ensures any pose engine (synthetic, fixture, or real VisionCamera BlazePose)
 * produces strictly compliant frames before feeding usePose.
 */

export function validateFrame(f) {
  if (!f || typeof f !== 'object') {
    throw new Error('Frame must be a non-null object');
  }
  if (typeof f.timestamp !== 'number' || isNaN(f.timestamp)) {
    throw new Error('timestamp missing or not a valid number');
  }
  if (!f.source || typeof f.source !== 'string') {
    throw new Error('source missing or not a valid string');
  }
  const lm = f.landmarks;
  if (!lm || typeof lm !== 'object' || Array.isArray(lm)) {
    throw new Error('landmarks missing or must be a named dictionary/map');
  }

  for (const [name, p] of Object.entries(lm)) {
    if (!p || typeof p !== 'object') {
      throw new Error(`Landmark ${name} must be an object`);
    }
    if (typeof p.x !== 'number' || isNaN(p.x)) {
      throw new Error(`${name}.x invalid or not a number`);
    }
    if (typeof p.y !== 'number' || isNaN(p.y)) {
      throw new Error(`${name}.y invalid or not a number`);
    }
    if (p.z !== undefined && (typeof p.z !== 'number' || isNaN(p.z))) {
      throw new Error(`${name}.z invalid or not a number`);
    }
    if (typeof p.visibility !== 'number' || isNaN(p.visibility)) {
      throw new Error(`${name}.visibility invalid or not a number`);
    }
    if (p.visibility < 0 || p.visibility > 1) {
      throw new Error(`${name}.visibility out of range [0, 1]: ${p.visibility}`);
    }
  }

  return true;
}
