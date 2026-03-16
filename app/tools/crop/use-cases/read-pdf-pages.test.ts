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

import { readPdfPages } from '~/tools/crop/use-cases/read-pdf-pages';

function createPdfFile(): File {
  return new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' });
}

function createPdfJsLoadingTask(pageCount: number) {
  const loadingTaskDestroy = vi.fn();
  const documentDestroy = vi.fn(() => Promise.resolve(undefined));

  return {
    loadingTask: {
      destroy: loadingTaskDestroy,
      promise: Promise.resolve({
        numPages: pageCount,
        getPage: vi.fn(),
        destroy: documentDestroy,
      }),
    },
    loadingTaskDestroy,
    documentDestroy,
  };
}

describe('readPdfPages', () => {
  it('rejects documents that exceed the preview page cap', async () => {
    const { loadingTask, loadingTaskDestroy, documentDestroy } =
      createPdfJsLoadingTask(201);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    await expect(readPdfPages(createPdfFile())).rejects.toThrow(
      'Crop preview supports up to 200 pages per document.',
    );
    expect(documentDestroy).toHaveBeenCalledTimes(1);
    expect(loadingTaskDestroy).toHaveBeenCalledTimes(1);
  });
});
