import type { NormalizedRect } from '~/tools/crop/models';

const EPSILON = 0.001;

interface ViewportLike {
  width: number;
  height: number;
  viewBox: number[];
  convertToPdfPoint: (x: number, y: number) => [number, number];
}

export interface PdfBoundingBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeRectInput(rect: NormalizedRect): NormalizedRect {
  const x = clamp(Number.isFinite(rect.x) ? rect.x : 0, 0, 1);
  const y = clamp(Number.isFinite(rect.y) ? rect.y : 0, 0, 1);
  const width = clamp(Number.isFinite(rect.width) ? rect.width : 0, 0, 1 - x);
  const height = clamp(Number.isFinite(rect.height) ? rect.height : 0, 0, 1 - y);

  return { x, y, width, height };
}

export function hasValidRect(rect: NormalizedRect | null | undefined): boolean {
  if (!rect) {
    return false;
  }

  return rect.width > 0 && rect.height > 0;
}

export function percentToNormalizedRect(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): NormalizedRect {
  return normalizeRectInput({
    x: rect.x / 100,
    y: rect.y / 100,
    width: rect.width / 100,
    height: rect.height / 100,
  });
}

export function normalizedToPercentRect(rect: NormalizedRect): {
  unit: '%';
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const normalized = normalizeRectInput(rect);
  return {
    unit: '%',
    x: normalized.x * 100,
    y: normalized.y * 100,
    width: normalized.width * 100,
    height: normalized.height * 100,
  };
}

export function normalizedRectToPdfBoundingBox(
  rect: NormalizedRect,
  viewport: ViewportLike,
): PdfBoundingBox {
  const normalized = normalizeRectInput(rect);
  const leftX = normalized.x * viewport.width;
  const topY = normalized.y * viewport.height;
  const rightX = (normalized.x + normalized.width) * viewport.width;
  const bottomY = (normalized.y + normalized.height) * viewport.height;

  const [pdfX1, pdfY1] = viewport.convertToPdfPoint(leftX, topY);
  const [pdfX2, pdfY2] = viewport.convertToPdfPoint(rightX, bottomY);

  const rawLeft = Math.min(pdfX1, pdfX2);
  const rawRight = Math.max(pdfX1, pdfX2);
  const rawBottom = Math.min(pdfY1, pdfY2);
  const rawTop = Math.max(pdfY1, pdfY2);

  const [viewX1, viewY1, viewX2, viewY2] = viewport.viewBox;
  const pageMinX = Math.min(viewX1, viewX2);
  const pageMaxX = Math.max(viewX1, viewX2);
  const pageMinY = Math.min(viewY1, viewY2);
  const pageMaxY = Math.max(viewY1, viewY2);

  let left = clamp(rawLeft, pageMinX, pageMaxX);
  let right = clamp(rawRight, pageMinX, pageMaxX);
  let bottom = clamp(rawBottom, pageMinY, pageMaxY);
  let top = clamp(rawTop, pageMinY, pageMaxY);

  if (right - left < EPSILON) {
    if (right >= pageMaxX) {
      left = Math.max(pageMinX, right - EPSILON);
    } else {
      right = Math.min(pageMaxX, left + EPSILON);
    }
  }

  if (top - bottom < EPSILON) {
    if (top >= pageMaxY) {
      bottom = Math.max(pageMinY, top - EPSILON);
    } else {
      top = Math.min(pageMaxY, bottom + EPSILON);
    }
  }

  return { left, right, bottom, top };
}
