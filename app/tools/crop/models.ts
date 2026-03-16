export type CropStep = 'select' | 'crop';

export type CropPreset = 'free' | 'a4' | 'letter' | '1:1' | '4:3' | '16:9';

export type CropInteractionMode = 'crop' | 'pan';

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PageCropState = Record<number, NormalizedRect | null>;

export interface CropRunOptions {
  selectedPages: number[];
  pageCrops: PageCropState;
}

export interface CropResult {
  blob: Blob;
  fileName: string;
  pagesExported: number;
}

export interface CropPagePreview {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  thumbnailDataUrl: string | null;
}

export interface CropDocumentPreview {
  pageCount: number;
  pages: CropPagePreview[];
}
