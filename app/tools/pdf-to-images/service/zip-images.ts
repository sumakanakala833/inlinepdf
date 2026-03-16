import JSZip from 'jszip';

import type { ImageOutputFormat, RenderedImageFile } from '~/tools/pdf-to-images/models';

interface ZipImagesInput {
  images: RenderedImageFile[];
}

function sanitizeBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.pdf$/i, '').trim();
  const normalized = withoutExtension
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'document';
}

export function createImagesArchiveName(
  sourceFileName: string,
  format: ImageOutputFormat,
): string {
  return `${sanitizeBaseName(sourceFileName)}-images-${format}-max.zip`;
}

export async function zipImages({ images }: ZipImagesInput): Promise<Blob> {
  if (images.length < 1) {
    throw new Error('No images were produced to archive.');
  }

  const zip = new JSZip();
  images.forEach((entry) => {
    zip.file(entry.fileName, entry.bytes, { binary: true });
  });

  return zip.generateAsync({
    type: 'blob',
    compression: 'STORE',
  });
}
