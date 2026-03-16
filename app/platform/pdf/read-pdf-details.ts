import { PDFDocument } from 'pdf-lib';

import { loadPdfJsModule } from '~/platform/pdf/load-pdfjs';
import {
  isSecurityValidationError,
  validatePdfFile,
} from '~/platform/files/security/file-validation';

export async function readPdfDetails(
  file: File,
): Promise<{ pageCount: number | null; previewDataUrl: string | null }> {
  let bytes: ArrayBuffer;
  try {
    await validatePdfFile(file);
    bytes = await file.arrayBuffer();
  } catch (error) {
    if (isSecurityValidationError(error)) {
      return { pageCount: null, previewDataUrl: null };
    }

    throw error;
  }

  let pageCount: number | null | undefined;
  let previewDataUrl: string | null = null;

  try {
    const pdfjs = await loadPdfJsModule();
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdfDocument = await loadingTask.promise;

    try {
      pageCount = pdfDocument.numPages;
      const firstPage = await pdfDocument.getPage(1);
      const baseViewport = firstPage.getViewport({ scale: 1 });
      const maxWidth = 420;
      const maxHeight = 560;
      const scale = Math.min(
        maxWidth / baseViewport.width,
        maxHeight / baseViewport.height,
      );
      const viewport = firstPage.getViewport({
        scale: Number.isFinite(scale) && scale > 0 ? scale : 0.3,
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) {
        return { pageCount, previewDataUrl: null };
      }

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await firstPage.render({
        canvas,
        canvasContext: context,
        viewport,
        background: 'rgb(255,255,255)',
      }).promise;

      previewDataUrl = canvas.toDataURL('image/png');
    } finally {
      await pdfDocument.destroy();
      void loadingTask.destroy();
    }
  } catch {
    try {
      const fallbackDocument = await PDFDocument.load(bytes);
      pageCount = fallbackDocument.getPageCount();
    } catch {
      // Ignore fallback parsing failures and keep null values.
    }
  }

  return { pageCount: pageCount ?? null, previewDataUrl };
}
