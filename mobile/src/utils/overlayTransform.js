/**
 * mobile/src/utils/overlayTransform.js
 *
 * Pure JS coordinate mapping for BlazePose overlays.
 * Maps normalized landmark coordinates [0, 1] to screen pixel coordinates,
 * handling camera aspect ratio scaling ('cover' or 'contain') and display mirroring.
 *
 * DISPLAY MIRRORING ONLY:
 * Only transforms coordinates for rendering overlay visuals; never swaps left/right
 * labels and never modifies coordinates fed to kinematic analysis.
 */

/**
 * Creates a coordinate transformation function for a specific camera frame and viewport.
 *
 * @param {Object} options
 * @param {number} options.frameW - Width of the camera frame (e.g. 720 or 1280)
 * @param {number} options.frameH - Height of the camera frame (e.g. 1280 or 720)
 * @param {number} options.viewW  - Viewport width in screen pixels (e.g. 360 or 390)
 * @param {number} options.viewH  - Viewport height in screen pixels (e.g. 780 or 844)
 * @param {'cover' | 'contain'} [options.resizeMode='cover'] - Scaling mode
 * @param {boolean} [options.mirror=false] - Whether to mirror horizontally for front camera display
 * @returns {(lm: { x: number, y: number }) => { px: number, py: number }}
 */
export function makeTransform({
  frameW,
  frameH,
  viewW,
  viewH,
  resizeMode = 'cover',
  mirror = false,
} = {}) {
  // Guard against invalid or unmeasured dimensions
  if (!frameW || !frameH || !viewW || !viewH || frameW <= 0 || frameH <= 0) {
    const w = viewW || 1;
    const h = viewH || 1;
    return (lm) => {
      if (!lm) return { px: 0, py: 0 };
      const nx = mirror ? 1.0 - (lm.x ?? 0) : (lm.x ?? 0);
      return { px: nx * w, py: (lm.y ?? 0) * h };
    };
  }

  const sx = viewW / frameW;
  const sy = viewH / frameH;
  const s = resizeMode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  const drawnW = frameW * s;
  const drawnH = frameH * s;
  const offX = (viewW - drawnW) / 2;
  const offY = (viewH - drawnH) / 2;

  const transform = (lm) => {
    if (!lm) return { px: 0, py: 0 };
    let nx = typeof lm.x === 'number' ? lm.x : 0;
    if (mirror) {
      nx = 1.0 - nx;
    }
    const ny = typeof lm.y === 'number' ? lm.y : 0;
    return {
      px: offX + nx * drawnW,
      py: offY + ny * drawnH,
    };
  };

  // Attach metadata for inspection / testing
  transform.meta = {
    scale: s,
    drawnW,
    drawnH,
    offX,
    offY,
    mirror,
    resizeMode,
  };

  return transform;
}
