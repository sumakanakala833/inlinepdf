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

import { readOrganizePreview } from '~/tools/organize/service/read-organize-preview';

function createPdfFile(): File {
  return new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' });
}

function createPdfJsLoadingTask(pageCount: number) {
  const getPageMock = vi.fn((pageNumber: number) =>
    Promise.resolve({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 200 * scale,
        height: 300 * scale,
        rotation: 0,
      }),
      render: vi.fn(() => ({
        promise: Promise.resolve(undefined),
      })),
      pageNumber,
    }),
  );

  const documentDestroy = vi.fn(() => Promise.resolve(undefined));
  const loadingTaskDestroy = vi.fn();

  const loadingTask = {
    destroy: loadingTaskDestroy,
    promise: Promise.resolve({
      numPages: pageCount,
      getPage: getPageMock,
      destroy: documentDestroy,
    }),
  };

  return {
    loadingTask,
    getPageMock,
    documentDestroy,
    loadingTaskDestroy,
  };
}

describe('readOrganizePreview', () => {
  it('returns pageCount and caches rendered thumbnails', async () => {
    const { loadingTask, getPageMock, documentDestroy, loadingTaskDestroy } =
      createPdfJsLoadingTask(3);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        fillStyle: '#FFFFFF',
        fillRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
    const toDataUrlSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,mock-thumb');

    const session = await readOrganizePreview(createPdfFile());

    expect(session.pageCount).toBe(3);

    const first = await session.getPageThumbnail(1);
    const second = await session.getPageThumbnail(1);

    expect(first).toBe('data:image/png;base64,mock-thumb');
    expect(second).toBe('data:image/png;base64,mock-thumb');
    expect(getPageMock).toHaveBeenCalledTimes(1);

    await session.destroy();

    expect(documentDestroy).toHaveBeenCalledTimes(1);
    expect(loadingTaskDestroy).toHaveBeenCalledTimes(1);

    toDataUrlSpy.mockRestore();
    getContextSpy.mockRestore();
  });

  it('supports repeated destroy calls and rejects thumbnail reads after destroy', async () => {
    const { loadingTask, documentDestroy, loadingTaskDestroy } =
      createPdfJsLoadingTask(2);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);

    const session = await readOrganizePreview(createPdfFile());

    await session.destroy();
    await session.destroy();

    expect(documentDestroy).toHaveBeenCalledTimes(1);
    expect(loadingTaskDestroy).toHaveBeenCalledTimes(1);

    await expect(session.getPageThumbnail(1)).rejects.toThrow(
      'Preview session is no longer available.',
    );

    getContextSpy.mockRestore();
  });

  it('rejects documents that exceed the preview page cap', async () => {
    const { loadingTask, documentDestroy, loadingTaskDestroy } =
      createPdfJsLoadingTask(201);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    await expect(readOrganizePreview(createPdfFile())).rejects.toThrow(
      'Organize preview supports up to 200 pages per document.',
    );
    expect(documentDestroy).toHaveBeenCalledTimes(1);
    expect(loadingTaskDestroy).toHaveBeenCalledTimes(1);
  });
});
