import { loadPdfJsModule } from '~/platform/pdf/load-pdfjs';
import type {
  CropDocumentPreview,
  CropPagePreview,
} from '~/tools/crop/models';
import {
  isSecurityValidationError,
  MAX_RENDER_PAGES,
  validatePageCountLimit,
  validatePdfFile,
} from '~/platform/files/security/file-validation';

const THUMBNAIL_MAX_WIDTH = 1080;
const THUMBNAIL_MAX_HEIGHT = 1440;

function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return 0.2;
  }

  return scale;
}

export async function readPdfPages(file: File): Promise<CropDocumentPreview> {
  await validatePdfFile(file);
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const bytes = new Uint8Array(originalBytes.byteLength);
  bytes.set(originalBytes);

  const pdfjs = await loadPdfJsModule();
  const loadingTask = pdfjs.getDocument({ data: bytes });

  try {
    const pdfDocument = await loadingTask.promise;
    const pages: CropPagePreview[] = [];

    try {
      validatePageCountLimit(
        pdfDocument.numPages,
        `Crop preview supports up to ${String(MAX_RENDER_PAGES)} pages per document.`,
      );

      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const thumbnailScale = clampScale(
          Math.min(
            THUMBNAIL_MAX_WIDTH / baseViewport.width,
            THUMBNAIL_MAX_HEIGHT / baseViewport.height,
          ),
        );
        const thumbnailViewport = page.getViewport({ scale: thumbnailScale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(thumbnailViewport.width));
        canvas.height = Math.max(1, Math.floor(thumbnailViewport.height));

        const context = canvas.getContext('2d', { alpha: false });
        let thumbnailDataUrl: string | null = null;

        if (context) {
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvas,
            canvasContext: context,
            viewport: thumbnailViewport,
            background: 'rgb(255,255,255)',
          }).promise;

          thumbnailDataUrl = canvas.toDataURL('image/png');
        }

        pages.push({
          pageNumber,
          width: baseViewport.width,
          height: baseViewport.height,
          rotation: baseViewport.rotation,
          thumbnailDataUrl,
        });
      }
    } finally {
      await pdfDocument.destroy();
      void loadingTask.destroy();
    }

    return {
      pageCount: pages.length,
      pages,
    };
  } catch (error) {
    if (isSecurityValidationError(error)) {
      throw error;
    }

    throw new Error(
      'Unable to read this PDF. It may be password-protected or corrupted.',
      { cause: error },
    );
  }
}
