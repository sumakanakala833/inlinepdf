import { describe, expect, it } from 'vitest';

import {
  normalizeRectInput,
  normalizedRectToPdfBoundingBox,
  percentToNormalizedRect,
} from '~/tools/crop/domain/coordinate-math';

describe('coordinate math', () => {
  it('converts a normalized crop to an unrotated PDF bounding box', () => {
    const bounds = normalizedRectToPdfBoundingBox(
      { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
      {
        width: 200,
        height: 100,
        viewBox: [0, 0, 200, 100],
        convertToPdfPoint: (x, y) => [x, 100 - y],
      },
    );

    expect(bounds.left).toBeCloseTo(20, 5);
    expect(bounds.right).toBeCloseTo(120, 5);
    expect(bounds.bottom).toBeCloseTo(40, 5);
    expect(bounds.top).toBeCloseTo(80, 5);
  });

  it('supports rotated transforms by using convertToPdfPoint output', () => {
    const bounds = normalizedRectToPdfBoundingBox(
      { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
      {
        width: 200,
        height: 100,
        viewBox: [0, 0, 100, 200],
        convertToPdfPoint: (x, y) => [y, x],
      },
    );

    expect(bounds.left).toBeCloseTo(20, 5);
    expect(bounds.right).toBeCloseTo(60, 5);
    expect(bounds.bottom).toBeCloseTo(20, 5);
    expect(bounds.top).toBeCloseTo(120, 5);
  });

  it('clamps invalid or out-of-range rectangles safely', () => {
    const normalized = normalizeRectInput({
      x: -0.25,
      y: 0.75,
      width: 2,
      height: 4,
    });

    expect(normalized).toEqual({
      x: 0,
      y: 0.75,
      width: 1,
      height: 0.25,
    });
  });

  it('converts percentage crops to normalized values', () => {
    const normalized = percentToNormalizedRect({
      x: 25,
      y: 10,
      width: 50,
      height: 80,
    });

    expect(normalized).toEqual({
      x: 0.25,
      y: 0.1,
      width: 0.5,
      height: 0.8,
    });
  });
});
