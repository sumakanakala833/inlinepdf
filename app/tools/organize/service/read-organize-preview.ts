import { loadPdfJsModule } from '~/platform/pdf/load-pdfjs';
import type { PdfJsModule } from '~/platform/pdf/load-pdfjs';
import type { OrganizePreviewSession } from '~/tools/organize/models';
import {
  MAX_RENDER_PAGES,
  validatePageCountLimit,
  validatePdfFile,
} from '~/platform/files/security/file-validation';

const THUMBNAIL_MAX_WIDTH = 360;
const THUMBNAIL_MAX_HEIGHT = 480;

type PdfJsLoadingTask = ReturnType<PdfJsModule['getDocument']>;
type PdfJsDocument = Awaited<PdfJsLoadingTask['promise']>;

function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return 0.2;
  }

  return scale;
}

export async function readOrganizePreview(file: File): Promise<OrganizePreviewSession> {
  await validatePdfFile(file);
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const bytes = new Uint8Array(sourceBytes.byteLength);
  bytes.set(sourceBytes);

  const pdfjs = await loadPdfJsModule();
  const loadingTask = pdfjs.getDocument({ data: bytes });

  let pdfDocument: PdfJsDocument;
  try {
    pdfDocument = await loadingTask.promise;
  } catch {
    throw new Error('Unable to read this PDF. It may be password-protected or corrupted.');
  }

  try {
    validatePageCountLimit(
      pdfDocument.numPages,
      `Organize preview supports up to ${String(MAX_RENDER_PAGES)} pages per document.`,
    );
  } catch (error) {
    await pdfDocument.destroy();
    void loadingTask.destroy();
    throw error;
  }

  const thumbnailCache = new Map<number, string | null>();
  let isDestroyed = false;

  async function getPageThumbnail(pageNumber: number): Promise<string | null> {
    if (isDestroyed) {
      throw new Error('Preview session is no longer available.');
    }

    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdfDocument.numPages) {
      throw new Error(`Page ${String(pageNumber)} is outside the document range.`);
    }

    const cached = thumbnailCache.get(pageNumber);
    if (cached !== undefined) {
      return cached;
    }

    const page = await pdfDocument.getPage(pageNumber);
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
  }

  async function destroy(): Promise<void> {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;
    thumbnailCache.clear();

    await pdfDocument.destroy();
    void loadingTask.destroy();
  }

  return {
    pageCount: pdfDocument.numPages,
    getPageThumbnail,
    destroy,
  };
}
