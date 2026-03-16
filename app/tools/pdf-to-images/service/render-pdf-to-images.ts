import {
  loadPdfJsModule,
  type PdfJsModule,
} from '~/platform/pdf/load-pdfjs';
import {
  MAX_RENDER_PAGES,
  validatePageCountLimit,
  validatePdfFile,
} from '~/platform/files/security/file-validation';
import type {
  ImageOutputFormat,
  MaxDimensionCap,
  PdfImageBaseResolution,
  RenderProgress,
  RenderedImageFile,
} from '~/tools/pdf-to-images/models';

type PdfJsLoadingTask = ReturnType<PdfJsModule['getDocument']>;
type PdfJsDocument = Awaited<PdfJsLoadingTask['promise']>;

interface RenderPdfToImagesInput {
  file: File;
  format: ImageOutputFormat;
  maxDimensionCap: MaxDimensionCap;
  pageNumbers?: number[];
  onProgress?: (progress: RenderProgress) => void;
}

export const MAX_QUALITY_LONG_EDGE_TARGET_PX = 8000;

const MIME_BY_FORMAT: Record<ImageOutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const EXTENSION_BY_FORMAT: Record<ImageOutputFormat, string> = {
  png: 'png',
  jpeg: 'jpeg',
  webp: 'webp',
};

async function withPdfDocument<T>(
  file: File,
  callback: (pdfDocument: PdfJsDocument) => Promise<T>,
): Promise<T> {
  await validatePdfFile(file);
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const bytes = new Uint8Array(sourceBytes.byteLength);
  bytes.set(sourceBytes);

  const pdfjs = await loadPdfJsModule();
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdfDocument = await loadingTask.promise;

  try {
    return await callback(pdfDocument);
  } finally {
    await pdfDocument.destroy();
    void loadingTask.destroy();
  }
}

function toPixelSize(value: number): number {
  return Math.max(1, Math.round(value));
}

function computeRenderScale(
  baseViewport: { width: number; height: number },
  maxDimensionCap: MaxDimensionCap,
): number {
  const longEdge = Math.max(baseViewport.width, baseViewport.height);
  const selectedLongEdge = Math.min(
    MAX_QUALITY_LONG_EDGE_TARGET_PX,
    maxDimensionCap,
  );

  const renderScale = selectedLongEdge / Math.max(1, longEdge);
  if (!Number.isFinite(renderScale) || renderScale <= 0) {
    return 1;
  }

  return renderScale;
}

function getSelectedPageNumbers(
  totalPages: number,
  pageNumbers?: number[],
): number[] {
  if (!pageNumbers || pageNumbers.length === 0) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const unique = [...new Set(pageNumbers)];
  const invalidPage = unique.find(
    (pageNumber) => !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > totalPages,
  );
  if (invalidPage) {
    throw new Error(`Page ${String(invalidPage)} is out of range for this PDF.`);
  }

  return unique;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const source = new Uint8Array(await blob.arrayBuffer());
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return bytes;
}

export async function readPdfImageBaseResolution(
  file: File,
): Promise<PdfImageBaseResolution> {
  return withPdfDocument(file, async (pdfDocument) => {
    if (pdfDocument.numPages < 1) {
      throw new Error('This PDF has no pages to convert.');
    }

    const firstPage = await pdfDocument.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });

    return {
      pageCount: pdfDocument.numPages,
      baseWidthPx: toPixelSize(baseViewport.width),
      baseHeightPx: toPixelSize(baseViewport.height),
    };
  });
}

export async function renderPdfToImages({
  file,
  format,
  maxDimensionCap,
  pageNumbers,
  onProgress,
}: RenderPdfToImagesInput): Promise<RenderedImageFile[]> {
  return withPdfDocument(file, async (pdfDocument) => {
    if (pdfDocument.numPages < 1) {
      throw new Error('This PDF has no pages to convert.');
    }

    const rendered: RenderedImageFile[] = [];
    const mimeType = MIME_BY_FORMAT[format];
    const extension = EXTENSION_BY_FORMAT[format];
    const quality = format === 'png' ? undefined : 1;
    const selectedPageNumbers = getSelectedPageNumbers(
      pdfDocument.numPages,
      pageNumbers,
    );
    validatePageCountLimit(
      selectedPageNumbers.length,
      `PDF to images supports converting up to ${String(MAX_RENDER_PAGES)} pages at a time.`,
    );

    for (const [index, pageNumber] of selectedPageNumbers.entries()) {
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const renderScale = computeRenderScale(baseViewport, maxDimensionCap);
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement('canvas');
      canvas.width = toPixelSize(viewport.width);
      canvas.height = toPixelSize(viewport.height);

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) {
        throw new Error('Failed to initialize canvas context for PDF rendering.');
      }

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
        background: 'rgb(255,255,255)',
      }).promise;

      const blob = await canvasToBlob(canvas, mimeType, quality);
      if (!blob) {
        throw new Error(
          `This browser could not encode ${format.toUpperCase()} output. Try another format.`,
        );
      }

      rendered.push({
        fileName: `page-${String(pageNumber).padStart(3, '0')}.${extension}`,
        bytes: await blobToBytes(blob),
        mimeType,
        width: canvas.width,
        height: canvas.height,
      });

      onProgress?.({
        currentPage: index + 1,
        totalPages: selectedPageNumbers.length,
      });
    }

    return rendered;
  });
}
