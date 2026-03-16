import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';

const { getDocumentMock } = vi.hoisted(() => ({
  getDocumentMock: vi.fn(),
}));

vi.mock('~/platform/pdf/load-pdfjs', () => ({
  loadPdfJsModule: vi.fn(() =>
    Promise.resolve({
      getDocument: getDocumentMock,
    }),
  ),
}));

import { exportCroppedPdf } from '~/tools/crop/use-cases/export-cropped-pdf-file';

async function createPdfFile(name: string): Promise<File> {
  const doc = await PDFDocument.create();
  const first = doc.addPage([200, 100]);
  first.drawText('Page 1', { x: 20, y: 40, size: 18 });
  const second = doc.addPage([300, 150]);
  second.drawText('Page 2', { x: 30, y: 60, size: 18 });
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

      reject(new Error('Could not read blob'));
    };
    reader.onerror = () => {
      reject(new Error('Could not read blob'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

function createPdfJsLoadingTask() {
  const loadingTaskDestroy = vi.fn();
  const documentDestroy = vi.fn(() => Promise.resolve(undefined));

  const loadingTask = {
    destroy: loadingTaskDestroy,
    promise: Promise.resolve({
      destroy: documentDestroy,
      getPage: vi.fn((pageNumber: number) =>
        Promise.resolve({
          getViewport: ({ scale }: { scale: number }) => ({
            width: (pageNumber === 1 ? 200 : 300) * scale,
            height: (pageNumber === 1 ? 100 : 150) * scale,
            rotation: 0,
            viewBox: [0, 0, pageNumber === 1 ? 200 : 300, pageNumber === 1 ? 100 : 150],
            convertToPdfPoint: (x: number, y: number) => [
              x,
              (pageNumber === 1 ? 100 : 150) - y,
            ],
          }),
        }),
      ),
    }),
  };

  return { loadingTask, loadingTaskDestroy, documentDestroy };
}

describe('exportCroppedPdf', () => {
  it('exports selected pages in source order with hard-cropped dimensions', async () => {
    const file = await createPdfFile('sample.pdf');
    const { loadingTask, loadingTaskDestroy } = createPdfJsLoadingTask();
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await exportCroppedPdf({
      file,
      selectedPages: [2, 1],
      pageCrops: {
        1: { x: 0, y: 0, width: 0.5, height: 1 },
        2: { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      },
    });

    expect(result.pagesExported).toBe(2);
    expect(result.fileName).toMatch(/^sample-cropped-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(loadingTaskDestroy).toHaveBeenCalled();

    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );
    expect(outputDocument.getPageCount()).toBe(2);
    expect(outputDocument.getPage(0).getWidth()).toBeCloseTo(100, 4);
    expect(outputDocument.getPage(0).getHeight()).toBeCloseTo(100, 4);
    expect(outputDocument.getPage(1).getWidth()).toBeCloseTo(150, 4);
    expect(outputDocument.getPage(1).getHeight()).toBeCloseTo(75, 4);
  });

  it('throws if a selected page has no crop rectangle', async () => {
    const file = await createPdfFile('sample.pdf');
    const { loadingTask } = createPdfJsLoadingTask();
    getDocumentMock.mockReturnValueOnce(loadingTask);

    await expect(
      exportCroppedPdf({
        file,
        selectedPages: [1],
        pageCrops: { 1: null },
      }),
    ).rejects.toThrow('Set a crop area for page 1.');
  });
});
