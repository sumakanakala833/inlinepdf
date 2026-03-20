import { PDFDocument } from 'pdf-lib';

import {
  cleanupPdfJsPage,
  openPdfJsDocument,
} from '~/platform/pdf/pdfjs-session';
import { validatePdfFile } from '~/platform/files/security/file-validation';
import type { CropResult, CropRunOptions } from '~/tools/crop/models';
import {
  hasValidRect,
  normalizedRectToPdfBoundingBox,
} from '~/tools/crop/domain/coordinate-math';

interface ExportCroppedPdfInput extends CropRunOptions {
  file: File;
  keepUncroppedPages?: boolean;
}

function createCroppedFileName(originalName: string): string {
  const baseName = originalName.replace(/\.pdf$/i, '') || 'document';
  const stamp = new Date().toISOString().slice(0, 10);
  return `${baseName}-cropped-${stamp}.pdf`;
}

function normalizeSelectedPages(pageNumbers: number[]): number[] {
  return [...new Set(pageNumbers)]
    .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber > 0)
    .sort((a, b) => a - b);
}

function readPdfPoint(
  point: unknown,
  pageNumber: number,
): [number, number] {
  if (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === 'number' &&
    typeof point[1] === 'number'
  ) {
    return [point[0], point[1]];
  }

  throw new Error(
    `Unable to map crop coordinates for page ${String(pageNumber)}.`,
  );
}

export async function exportCroppedPdf({
  file,
  selectedPages,
  pageCrops,
  keepUncroppedPages = false,
}: ExportCroppedPdfInput): Promise<CropResult> {
  await validatePdfFile(file);
  const normalizedPageNumbers = normalizeSelectedPages(selectedPages);

  if (normalizedPageNumbers.length === 0) {
    throw new Error('Select at least one page to crop.');
  }

  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const outputDocument = await PDFDocument.create();
  const [sourceDocument, previewSession] = await Promise.all([
    PDFDocument.load(sourceBytes),
    openPdfJsDocument(sourceBytes),
  ]);
  const previewDocument = previewSession.document;

  try {
    for (const pageNumber of normalizedPageNumbers) {
      const cropRect = pageCrops[pageNumber];
      if (!cropRect || !hasValidRect(cropRect)) {
        if (keepUncroppedPages) {
          const [copiedPage] = await outputDocument.copyPages(sourceDocument, [
            pageNumber - 1,
          ]);
          outputDocument.addPage(copiedPage);
          continue;
        }

        throw new Error(`Set a crop area for page ${String(pageNumber)}.`);
      }

      const sourcePage = sourceDocument.getPage(pageNumber - 1);
      const previewPage = await previewDocument.getPage(pageNumber);
      try {
        const viewport = previewPage.getViewport({ scale: 1 });
        const boundingBox = normalizedRectToPdfBoundingBox(cropRect, {
          width: viewport.width,
          height: viewport.height,
          viewBox: viewport.viewBox,
          convertToPdfPoint: (x, y) =>
            readPdfPoint(viewport.convertToPdfPoint(x, y), pageNumber),
        });
        const width = boundingBox.right - boundingBox.left;
        const height = boundingBox.top - boundingBox.bottom;

        if (width <= 0 || height <= 0) {
          throw new Error(
            `Crop area for page ${String(pageNumber)} is too small.`,
          );
        }

        const embeddedPage = await outputDocument.embedPage(
          sourcePage,
          boundingBox,
        );
        const page = outputDocument.addPage([width, height]);
        page.drawPage(embeddedPage, {
          x: 0,
          y: 0,
          width,
          height,
        });
      } finally {
        cleanupPdfJsPage(previewPage);
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Unable to crop this PDF. Try another file.', {
      cause: error,
    });
  } finally {
    await previewSession.destroy();
  }

  const outputBytes = await outputDocument.save();
  const normalizedOutputBytes = new Uint8Array(outputBytes.byteLength);
  normalizedOutputBytes.set(outputBytes);

  return {
    blob: new Blob([normalizedOutputBytes.buffer], { type: 'application/pdf' }),
    fileName: createCroppedFileName(file.name),
    pagesExported: normalizedPageNumbers.length,
  };
}
