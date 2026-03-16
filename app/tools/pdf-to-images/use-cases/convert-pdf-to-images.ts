import {
  MAX_QUALITY_LONG_EDGE_TARGET_PX,
  renderPdfToImages,
} from '~/tools/pdf-to-images/service/render-pdf-to-images';
import {
  createImagesArchiveName,
  zipImages,
} from '~/tools/pdf-to-images/service/zip-images';
import type {
  ImageOutputFormat,
  MaxDimensionCap,
  PdfImageBaseResolution,
  RenderProgress,
  ResolutionInfo,
} from '~/tools/pdf-to-images/models';

export interface PdfToImagesRunOptions {
  format: ImageOutputFormat;
  maxDimensionCap: MaxDimensionCap;
  pageNumbers?: number[];
  onProgress?: (progress: RenderProgress) => void;
}

export interface PdfToImagesResult {
  blob: Blob;
  fileName: string;
  pageCount: number;
}

export function isImageOutputFormat(value: unknown): value is ImageOutputFormat {
  return value === 'png' || value === 'jpeg' || value === 'webp';
}

export function isMaxDimensionCap(value: unknown): value is MaxDimensionCap {
  return (
    value === 3000 ||
    value === 4000 ||
    value === 5000 ||
    value === 6000 ||
    value === 8000
  );
}

function parsePageRangeToken(token: string, totalPages: number): number[] {
  const normalized = token.trim();
  if (!normalized) {
    return [];
  }

  if (/^\d+$/.test(normalized)) {
    const pageNumber = Number.parseInt(normalized, 10);
    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new Error(`Page ${String(pageNumber)} is outside the document range.`);
    }

    return [pageNumber];
  }

  const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(normalized);
  if (!rangeMatch) {
    throw new Error(`Invalid range token "${normalized}". Use formats like 1, 3-5, 8.`);
  }

  const start = Number.parseInt(rangeMatch[1], 10);
  const end = Number.parseInt(rangeMatch[2], 10);
  if (start > end) {
    throw new Error(`Invalid range "${normalized}". Start page must be before end page.`);
  }

  if (start < 1 || end > totalPages) {
    throw new Error(`Range "${normalized}" is outside the document range.`);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function parsePageRangeInput(value: string, totalPages: number): number[] {
  const pageNumbers = value
    .split(',')
    .flatMap((token) => parsePageRangeToken(token, totalPages));

  const uniqueSorted = [...new Set(pageNumbers)].sort((a, b) => a - b);
  if (uniqueSorted.length < 1) {
    throw new Error('Enter at least one page number.');
  }

  return uniqueSorted;
}

function isPdfToImagesRunOptions(value: unknown): value is PdfToImagesRunOptions {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const options = value as Partial<PdfToImagesRunOptions>;
  const onProgressIsValid =
    options.onProgress === undefined || typeof options.onProgress === 'function';

  return (
    isImageOutputFormat(options.format) &&
    isMaxDimensionCap(options.maxDimensionCap) &&
    (options.pageNumbers === undefined || Array.isArray(options.pageNumbers)) &&
    onProgressIsValid
  );
}

export function calculateResolutionInfo(
  base: PdfImageBaseResolution,
  maxDimensionCap: MaxDimensionCap,
): ResolutionInfo {
  const baseLongEdgePx = Math.max(base.baseWidthPx, base.baseHeightPx);
  const selectedLongEdgePx = Math.min(
    MAX_QUALITY_LONG_EDGE_TARGET_PX,
    maxDimensionCap,
  );
  const effectiveScale = selectedLongEdgePx / Math.max(1, baseLongEdgePx);

  return {
    ...base,
    scaledWidthPx: Math.max(1, Math.round(base.baseWidthPx * effectiveScale)),
    scaledHeightPx: Math.max(1, Math.round(base.baseHeightPx * effectiveScale)),
    selectedLongEdgePx,
    effectiveScale,
  };
}

export async function convertPdfToImagesArchive(
  { files }: { files: File[] },
  options?: PdfToImagesRunOptions,
): Promise<PdfToImagesResult> {
  const sourceFile = files.at(0);
  if (!sourceFile) {
    throw new Error('Select a PDF file before converting.');
  }

  if (!isPdfToImagesRunOptions(options)) {
    throw new Error('Select an output format before converting.');
  }

  const images = await renderPdfToImages({
    file: sourceFile,
    format: options.format,
    maxDimensionCap: options.maxDimensionCap,
    pageNumbers: options.pageNumbers,
    onProgress: options.onProgress,
  });

  const archiveBlob = await zipImages({ images });
  const archiveName = createImagesArchiveName(sourceFile.name, options.format);

  return {
    blob: archiveBlob,
    fileName: archiveName,
    pageCount: images.length,
  };
}
