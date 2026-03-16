export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';

export type MaxDimensionCap = 3000 | 4000 | 5000 | 6000 | 8000;

export interface PdfImageBaseResolution {
  pageCount: number;
  baseWidthPx: number;
  baseHeightPx: number;
}

export interface ResolutionInfo extends PdfImageBaseResolution {
  scaledWidthPx: number;
  scaledHeightPx: number;
  selectedLongEdgePx: number;
  effectiveScale: number;
}

export interface RenderProgress {
  currentPage: number;
  totalPages: number;
}

export interface RenderedImageFile {
  fileName: string;
  bytes: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
}
