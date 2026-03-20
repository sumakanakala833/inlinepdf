import {
  cleanupPdfJsPage,
  openPdfJsDocument,
  type PdfJsDocumentSession,
} from '~/platform/pdf/pdfjs-session';
import type { OrganizePreviewSession } from '~/tools/organize/models';
import {
  MAX_RENDER_PAGES,
  validatePageCountLimit,
  validatePdfFile,
} from '~/platform/files/security/file-validation';

const THUMBNAIL_MAX_WIDTH = 360;
const THUMBNAIL_MAX_HEIGHT = 480;

function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return 0.2;
  }

  return scale;
}

export async function readOrganizePreview(
  file: File,
): Promise<OrganizePreviewSession> {
  await validatePdfFile(file);
  let session: PdfJsDocumentSession;
  try {
    session = await openPdfJsDocument(file);
  } catch {
    throw new Error(
      'Unable to read this PDF. It may be password-protected or corrupted.',
    );
  }
  const pdfDocument = session.document;

  try {
    validatePageCountLimit(
      pdfDocument.numPages,
      `Organize preview supports up to ${String(MAX_RENDER_PAGES)} pages per document.`,
    );
  } catch (error) {
    await session.destroy();
    throw error;
  }

  const thumbnailCache = new Map<number, string | null>();
  let isDestroyed = false;

  async function getPageThumbnail(pageNumber: number): Promise<string | null> {
    if (isDestroyed) {
      throw new Error('Preview session is no longer available.');
    }

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > pdfDocument.numPages
    ) {
      throw new Error(
        `Page ${String(pageNumber)} is outside the document range.`,
      );
    }

    const cached = thumbnailCache.get(pageNumber);
    if (cached !== undefined) {
      return cached;
    }

    const page = await pdfDocument.getPage(pageNumber);
    try {
      const baseViewport = page.getViewport({ scale: 1 });
      const thumbnailScale = clampScale(
        Math.min(
          THUMBNAIL_MAX_WIDTH / baseViewport.width,
          THUMBNAIL_MAX_HEIGHT / baseViewport.height,
        ),
      );
      const viewport = page.getViewport({ scale: thumbnailScale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) {
        thumbnailCache.set(pageNumber, null);
        return null;
      }

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
        background: 'rgb(255,255,255)',
      }).promise;

      const thumbnailDataUrl = canvas.toDataURL('image/png');
      thumbnailCache.set(pageNumber, thumbnailDataUrl);
      return thumbnailDataUrl;
    } finally {
      cleanupPdfJsPage(page);
    }
  }

  async function destroy(): Promise<void> {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;
    thumbnailCache.clear();

    await session.destroy();
  }

  return {
    pageCount: pdfDocument.numPages,
    getPageThumbnail,
    destroy,
  };
}
