import { PDFDocument, degrees } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { exportOrganizedPdf } from '~/tools/organize/service/export-organized-pdf';
import type { OrganizePageState } from '~/tools/organize/models';

async function createPdfFile(name: string): Promise<File> {
  const doc = await PDFDocument.create();

  const first = doc.addPage([111, 300]);
  first.drawText('Page 1', { x: 20, y: 100, size: 18 });

  const second = doc.addPage([222, 300]);
  second.drawText('Page 2', { x: 20, y: 100, size: 18 });

  const third = doc.addPage([333, 300]);
  third.setRotation(degrees(180));
  third.drawText('Page 3', { x: 20, y: 100, size: 18 });

  const bytes = await doc.save();
  const normalizedBytes = new Uint8Array(bytes.byteLength);
  normalizedBytes.set(bytes);
  return new File([normalizedBytes.buffer], name, { type: 'application/pdf' });
}

async function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const maybeBlob = blob as Blob & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };

  if (typeof maybeBlob.arrayBuffer === 'function') {
    return maybeBlob.arrayBuffer();
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error('Could not read organized blob'));
    };
    reader.onerror = () => {
      reject(new Error('Could not read organized blob'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

function createPages(): OrganizePageState[] {
  return [
    {
      id: 'page-1',
      sourcePageNumber: 1,
      rotationQuarterTurns: 1,
      isDeleted: false,
      thumbnailDataUrl: null,
      thumbnailStatus: 'idle',
    },
    {
      id: 'page-2',
      sourcePageNumber: 2,
      rotationQuarterTurns: 0,
      isDeleted: false,
      thumbnailDataUrl: null,
      thumbnailStatus: 'idle',
    },
    {
      id: 'page-3',
      sourcePageNumber: 3,
      rotationQuarterTurns: -1,
      isDeleted: true,
      thumbnailDataUrl: null,
      thumbnailStatus: 'idle',
    },
  ];
}

describe('exportOrganizedPdf', () => {
  it('exports reordered pages and excludes deleted pages', async () => {
    const file = await createPdfFile('sample.pdf');

    const result = await exportOrganizedPdf({
      file,
      pages: [createPages()[1], createPages()[0], createPages()[2]],
    });

    expect(result.pagesExported).toBe(2);
    expect(result.fileName).toMatch(/^sample-organized-\d{4}-\d{2}-\d{2}\.pdf$/);

    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(outputDocument.getPageCount()).toBe(2);
    expect(outputDocument.getPage(0).getWidth()).toBe(222);
    expect(outputDocument.getPage(1).getWidth()).toBe(111);
  });

  it('applies rotation deltas to copied pages', async () => {
    const file = await createPdfFile('sample.pdf');
    const pages = createPages();

    const result = await exportOrganizedPdf({
      file,
      pages,
    });

    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(outputDocument.getPage(0).getRotation().angle).toBe(90);
    expect(outputDocument.getPage(1).getRotation().angle).toBe(0);
  });

  it('throws when all pages are removed', async () => {
    const file = await createPdfFile('sample.pdf');
    const pages = createPages().map((page) => ({ ...page, isDeleted: true }));

    await expect(
      exportOrganizedPdf({
        file,
        pages,
      }),
    ).rejects.toThrow('Restore at least one page before downloading.');
  });
});
