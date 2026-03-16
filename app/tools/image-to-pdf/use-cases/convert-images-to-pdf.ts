import {
  convertImagesToPdf,
  type ConvertImagesToPdfInput,
} from '~/tools/image-to-pdf/service/convert-images-to-pdf';
import type {
  ImageToPdfQuality,
  ImageToPdfResult,
  ImageToPdfRunOptions,
} from '~/tools/image-to-pdf/models';

export function isImageToPdfQuality(value: unknown): value is ImageToPdfQuality {
  return value === 'high' || value === 'medium' || value === 'low';
}

function isImageToPdfRunOptions(value: unknown): value is ImageToPdfRunOptions {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const options = value as Partial<ImageToPdfRunOptions>;
  return (
    isImageToPdfQuality(options.quality) &&
    (options.onProgress === undefined || typeof options.onProgress === 'function')
  );
}

export async function convertImagesToPdfDocument(
  { files }: { files: File[] },
  options?: ImageToPdfRunOptions,
): Promise<ImageToPdfResult> {
  if (!isImageToPdfRunOptions(options)) {
    throw new Error('Select an output quality before converting.');
  }

  const input: ConvertImagesToPdfInput = {
    files,
    quality: options.quality,
    onProgress: options.onProgress,
  };
  return convertImagesToPdf(input);
}
