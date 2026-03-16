import { hasValidRect } from '~/tools/crop/domain/coordinate-math';
import type { CropResult, NormalizedRect } from '~/tools/crop/models';

import { exportCroppedPdf } from './export-cropped-pdf-file';

export interface CropNewRunOptions {
  pageNumber: number;
  cropRect: NormalizedRect | null;
}

function isCropNewRunOptions(value: unknown): value is CropNewRunOptions {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const options = value as Partial<CropNewRunOptions>;
  return (
    Number.isInteger(options.pageNumber) &&
    typeof options.cropRect === 'object' &&
    options.cropRect !== null
  );
}

export async function exportCroppedPdfFromSelection(
  { files }: { files: File[] },
  options?: CropNewRunOptions,
): Promise<CropResult> {
  const sourceFile = files.at(0);
  if (!sourceFile) {
    throw new Error('Select a PDF file before cropping.');
  }

  if (!isCropNewRunOptions(options) || !hasValidRect(options.cropRect)) {
    throw new Error('Set a valid crop area before downloading.');
  }

  const pageNumber = Math.max(1, options.pageNumber);

  return exportCroppedPdf({
    file: sourceFile,
    selectedPages: [pageNumber],
    pageCrops: {
      [pageNumber]: options.cropRect,
    },
  });
}
