import { PDFDocument, degrees } from 'pdf-lib';

import { validatePdfFile } from '~/platform/files/security/file-validation';
import type { OrganizePageState, OrganizeResult } from '~/tools/organize/models';
import { normalizeQuarterTurns } from '~/tools/organize/models';

interface ExportOrganizedPdfInput {
  file: File;
  pages: OrganizePageState[];
}

function createOrganizedFileName(originalName: string): string {
  const baseName = originalName.replace(/\.pdf$/i, '') || 'document';
  const stamp = new Date().toISOString().slice(0, 10);
  return `${baseName}-organized-${stamp}.pdf`;
}

function toNormalizedPageAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 0;
  }

  const normalized = ((angle % 360) + 360) % 360;
  return normalized;
}

function toValidSourcePageNumbers(pages: OrganizePageState[]): OrganizePageState[] {
  return pages.filter(
    (page) => Number.isInteger(page.sourcePageNumber) && page.sourcePageNumber > 0,
  );
}

export async function exportOrganizedPdf({
  file,
  pages,
}: ExportOrganizedPdfInput): Promise<OrganizeResult> {
  await validatePdfFile(file);
  const validPages = toValidSourcePageNumbers(pages);
  if (validPages.length < 1) {
    throw new Error('No pages are available to organize.');
  }

  const activePages = validPages.filter((page) => !page.isDeleted);
  if (activePages.length < 1) {
    throw new Error('Restore at least one page before downloading.');
  }

  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const sourceDocument = await PDFDocument.load(sourceBytes);
  const sourcePageCount = sourceDocument.getPageCount();

  const outOfRangePage = activePages.find(
    (page) => page.sourcePageNumber > sourcePageCount,
  );
  if (outOfRangePage) {
    throw new Error(
      `Page ${String(outOfRangePage.sourcePageNumber)} is outside the document range.`,
    );
  }

  const outputDocument = await PDFDocument.create();

  for (const pageState of activePages) {
    const [copiedPage] = await outputDocument.copyPages(sourceDocument, [
      pageState.sourcePageNumber - 1,
    ]);

    const currentAngle = copiedPage.getRotation().angle;
    const rotationDelta = normalizeQuarterTurns(pageState.rotationQuarterTurns) * 90;
    const nextAngle = toNormalizedPageAngle(currentAngle + rotationDelta);
    copiedPage.setRotation(degrees(nextAngle));

    outputDocument.addPage(copiedPage);
  }

  const outputBytes = await outputDocument.save();
  const normalizedOutputBytes = new Uint8Array(outputBytes.byteLength);
  normalizedOutputBytes.set(outputBytes);

  return {
    blob: new Blob([normalizedOutputBytes.buffer], { type: 'application/pdf' }),
    fileName: createOrganizedFileName(file.name),
    pagesExported: activePages.length,
  };
}
