/**
 * mobile/__tests__/overlayTransform.test.js
 *
 * Table-driven unit tests for overlayTransform.
 * Verifies exact coordinate mapping, scaling ('cover' & 'contain'),
 * display horizontal mirroring, and boundary coordinates.
 */

import { makeTransform } from '../src/utils/overlayTransform';

describe('overlayTransform.makeTransform', () => {
  describe('Canonical Vector: 720x1280 in 360x780 View (Portrait Cover)', () => {
    // 720x1280 frame in 360x780 viewport
    const transform = makeTransform({
      frameW: 720,
      frameH: 1280,
      viewW: 360,
      viewH: 780,
      resizeMode: 'cover',
      mirror: false,
    });

    it('maps center landmark (0.5, 0.5) precisely to view center (180, 390)', () => {
      const { px, py } = transform({ x: 0.5, y: 0.5 });
      expect(px).toBeCloseTo(180, 2);
      expect(py).toBeCloseTo(390, 2);
    });

    it('preserves vertical coverage with zero vertical offset', () => {
      expect(transform.meta.offY).toBeCloseTo(0, 2);
      expect(transform.meta.drawnH).toBeCloseTo(780, 2);
    });

    it('crops symmetrically horizontally in cover mode', () => {
      const topCenter = transform({ x: 0.5, y: 0.0 });
      expect(topCenter.px).toBeCloseTo(180, 2);
      expect(topCenter.py).toBeCloseTo(0, 2);

      const bottomCenter = transform({ x: 0.5, y: 1.0 });
      expect(bottomCenter.px).toBeCloseTo(180, 2);
      expect(bottomCenter.py).toBeCloseTo(780, 2);
    });
  });

  describe('Canonical Vector: 1280x720 Frame in 390x844 View (Landscape Sensor Cover)', () => {
    const transform = makeTransform({
      frameW: 1280,
      frameH: 720,
      viewW: 390,
      viewH: 844,
      resizeMode: 'cover',
      mirror: false,
    });

    it('maps center landmark (0.5, 0.5) to view center (195, 422)', () => {
      const { px, py } = transform({ x: 0.5, y: 0.5 });
      expect(px).toBeCloseTo(195, 2);
      expect(py).toBeCloseTo(422, 2);
    });
  });

  describe('Display Mirroring', () => {
    const unmirrored = makeTransform({
      frameW: 720,
      frameH: 1280,
      viewW: 360,
      viewH: 780,
      resizeMode: 'cover',
      mirror: false,
    });

    const mirrored = makeTransform({
      frameW: 720,
      frameH: 1280,
      viewW: 360,
      viewH: 780,
      resizeMode: 'cover',
      mirror: true,
    });

    it('keeps center landmark at view center when mirrored', () => {
      const res = mirrored({ x: 0.5, y: 0.5 });
      expect(res.px).toBeCloseTo(180, 2);
      expect(res.py).toBeCloseTo(390, 2);
    });

    it('mirrors x symmetrically: point at 0.25 in mirrored equals 0.75 in unmirrored', () => {
      const p1 = mirrored({ x: 0.25, y: 0.4 });
      const p2 = unmirrored({ x: 0.75, y: 0.4 });
      expect(p1.px).toBeCloseTo(p2.px, 2);
      expect(p1.py).toBeCloseTo(p2.py, 2);
    });
  });

  describe('ResizeMode: contain', () => {
    const transformContain = makeTransform({
      frameW: 720,
      frameH: 1280,
      viewW: 360,
      viewH: 780,
      resizeMode: 'contain',
      mirror: false,
    });

    it('fits entire frame inside viewport with letterbox offset', () => {
      // sx = 360/720 = 0.5, sy = 780/1280 = 0.609375 -> s = 0.5
      expect(transformContain.meta.scale).toBeCloseTo(0.5, 3);
      expect(transformContain.meta.drawnW).toBeCloseTo(360, 2);
      expect(transformContain.meta.drawnH).toBeCloseTo(640, 2);
      // Vertical letterbox offset = (780 - 640) / 2 = 70
      expect(transformContain.meta.offY).toBeCloseTo(70, 2);
      expect(transformContain.meta.offX).toBeCloseTo(0, 2);
    });

    it('maps center landmark to center of letterboxed view', () => {
      const { px, py } = transformContain({ x: 0.5, y: 0.5 });
      expect(px).toBeCloseTo(180, 2);
      expect(py).toBeCloseTo(390, 2);
    });
  });

  describe('Edge Cases and Resilience', () => {
    it('handles null or missing landmark point gracefully', () => {
      const transform = makeTransform({
        frameW: 720,
        frameH: 1280,
        viewW: 360,
        viewH: 780,
      });

      expect(transform(null)).toEqual({ px: 0, py: 0 });
      expect(transform(undefined)).toEqual({ px: 0, py: 0 });
      expect(transform({})).toEqual({ px: transform.meta.offX, py: transform.meta.offY });
    });

    it('handles zero or missing dimensions with fallback without throwing', () => {
      const fallback = makeTransform({
        frameW: 0,
        frameH: 0,
        viewW: 360,
        viewH: 780,
      });

      const pt = fallback({ x: 0.5, y: 0.5 });
      expect(pt.px).toBe(180);
      expect(pt.py).toBe(390);
    });
  });
});
