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

import {
  readPdfImageBaseResolution,
  renderPdfToImages,
} from '~/tools/pdf-to-images/service/render-pdf-to-images';

interface PdfJsLoadingTaskBundle {
  loadingTask: {
    destroy: ReturnType<typeof vi.fn>;
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getViewport: (input: { scale: number }) => { width: number; height: number };
        render: (input: unknown) => { promise: Promise<void> };
      }>;
      destroy: () => Promise<void>;
    }>;
  };
  loadingTaskDestroy: ReturnType<typeof vi.fn>;
  documentDestroy: ReturnType<typeof vi.fn>;
}

interface CanvasMock {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
  toBlob: ReturnType<typeof vi.fn>;
}

function createPdfFile(name: string): File {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

function createPdfJsLoadingTask(
  pageSizes: { width: number; height: number }[],
): PdfJsLoadingTaskBundle {
  const loadingTaskDestroy = vi.fn();
  const documentDestroy = vi.fn(() => Promise.resolve());

  const getPage = vi.fn((pageNumber: number) => {
    const size = pageSizes[pageNumber - 1];
    return Promise.resolve({
      getViewport: ({ scale }: { scale: number }) => ({
        width: size.width * scale,
        height: size.height * scale,
      }),
      render: vi.fn(() => ({
        promise: Promise.resolve(),
      })),
    });
  });

  return {
    loadingTask: {
      destroy: loadingTaskDestroy,
      promise: Promise.resolve({
        numPages: pageSizes.length,
        getPage,
        destroy: documentDestroy,
      }),
    },
    loadingTaskDestroy,
    documentDestroy,
  };
}

function installCanvasMocks(
  toBlobFactory?: (canvas: CanvasMock) => CanvasMock['toBlob'],
) {
  const originalCreateElement = (tagName: string): HTMLElement =>
    document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
  const canvases: CanvasMock[] = [];

  const createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string): HTMLElement => {
      if (tagName === 'canvas') {
        const defaultToBlob = vi.fn(
          (
            callback: BlobCallback,
            mimeType?: string,
            quality?: number,
          ) => {
            callback(
              new Blob(
                [
                  `${mimeType ?? 'unknown'}:${quality === undefined ? 'none' : String(quality)}`,
                ],
                { type: mimeType ?? 'application/octet-stream' },
              ),
            );
          },
        );

        const canvas: CanvasMock = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({
            fillStyle: '#FFFFFF',
            fillRect: vi.fn(),
          })),
          toBlob: defaultToBlob,
        };

        if (toBlobFactory) {
          canvas.toBlob = toBlobFactory(canvas);
        }

        canvases.push(canvas);
        return canvas as unknown as HTMLElement;
      }

      return originalCreateElement(tagName);
    });

  return {
    canvases,
    restore: () => {
      createElementSpy.mockRestore();
    },
  };
}

describe('render-pdf-to-images service', () => {
  it('reads first-page base resolution and page count', async () => {
    const file = createPdfFile('sample.pdf');
    const { loadingTask, loadingTaskDestroy, documentDestroy } =
      createPdfJsLoadingTask([
        { width: 800, height: 1200 },
        { width: 600, height: 900 },
      ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await readPdfImageBaseResolution(file);

    expect(result).toEqual({
      pageCount: 2,
      baseWidthPx: 800,
      baseHeightPx: 1200,
    });
    expect(documentDestroy).toHaveBeenCalledTimes(1);
    expect(loadingTaskDestroy).toHaveBeenCalledTimes(1);
  });

  it('renders all pages at maximum quality with naming for PNG', async () => {
    const file = createPdfFile('book.pdf');
    const { loadingTask } = createPdfJsLoadingTask([
      { width: 100, height: 200 },
      { width: 120, height: 240 },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const canvasHarness = installCanvasMocks();
    const onProgress = vi.fn();

    try {
      const result = await renderPdfToImages({
        file,
        format: 'png',
        maxDimensionCap: 5000,
        onProgress,
      });

      expect(result.map((item) => item.fileName)).toEqual([
        'page-001.png',
        'page-002.png',
      ]);
      expect(result.map((item) => [item.width, item.height])).toEqual([
        [2500, 5000],
        [2500, 5000],
      ]);
      expect(onProgress).toHaveBeenNthCalledWith(1, {
        currentPage: 1,
        totalPages: 2,
      });
      expect(onProgress).toHaveBeenNthCalledWith(2, {
        currentPage: 2,
        totalPages: 2,
      });
      expect(canvasHarness.canvases).toHaveLength(2);
      expect(canvasHarness.canvases[0].toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/png',
        undefined,
      );
    } finally {
      canvasHarness.restore();
    }
  });

  it('uses max quality for JPEG and WEBP encoding', async () => {
    const file = createPdfFile('sample.pdf');

    const jpegTask = createPdfJsLoadingTask([{ width: 64, height: 64 }]);
    getDocumentMock.mockReturnValueOnce(jpegTask.loadingTask);
    const jpegHarness = installCanvasMocks();

    try {
      await renderPdfToImages({
        file,
        format: 'jpeg',
        maxDimensionCap: 5000,
      });
      expect(jpegHarness.canvases[0].toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/jpeg',
        1,
      );
    } finally {
      jpegHarness.restore();
    }

    const webpTask = createPdfJsLoadingTask([{ width: 64, height: 64 }]);
    getDocumentMock.mockReturnValueOnce(webpTask.loadingTask);
    const webpHarness = installCanvasMocks();

    try {
      await renderPdfToImages({
        file,
        format: 'webp',
        maxDimensionCap: 5000,
      });
      expect(webpHarness.canvases[0].toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/webp',
        1,
      );
    } finally {
      webpHarness.restore();
    }
  });

  it('throws if canvas cannot encode the selected format', async () => {
    const file = createPdfFile('sample.pdf');
    const { loadingTask } = createPdfJsLoadingTask([{ width: 64, height: 64 }]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const canvasHarness = installCanvasMocks(() =>
      vi.fn((callback: BlobCallback) => {
        callback(null);
      }),
    );

    try {
      await expect(
        renderPdfToImages({
          file,
          format: 'webp',
          maxDimensionCap: 5000,
        }),
      ).rejects.toThrow('This browser could not encode WEBP output.');
    } finally {
      canvasHarness.restore();
    }
  });

  it('limits output by max dimension cap', async () => {
    const file = createPdfFile('cap.pdf');
    const { loadingTask } = createPdfJsLoadingTask([{ width: 200, height: 100 }]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const canvasHarness = installCanvasMocks();

    try {
      const result = await renderPdfToImages({
        file,
        format: 'png',
        maxDimensionCap: 5000,
      });

      expect(result[0]?.width).toBe(5000);
      expect(result[0]?.height).toBe(2500);
    } finally {
      canvasHarness.restore();
    }
  });

  it('renders only selected custom page numbers', async () => {
    const file = createPdfFile('pages.pdf');
    const { loadingTask } = createPdfJsLoadingTask([
      { width: 200, height: 100 },
      { width: 300, height: 150 },
      { width: 400, height: 200 },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const canvasHarness = installCanvasMocks();

    try {
      const result = await renderPdfToImages({
        file,
        format: 'png',
        maxDimensionCap: 5000,
        pageNumbers: [3, 1],
      });

      expect(result.map((item) => item.fileName)).toEqual([
        'page-003.png',
        'page-001.png',
      ]);
    } finally {
      canvasHarness.restore();
    }
  });

  it('rejects requests above the render page cap', async () => {
    const file = createPdfFile('pages.pdf');
    const { loadingTask, loadingTaskDestroy, documentDestroy } =
      createPdfJsLoadingTask(Array.from({ length: 201 }, () => ({ width: 200, height: 100 })));
    getDocumentMock.mockReturnValueOnce(loadingTask);

    await expect(
      renderPdfToImages({
        file,
        format: 'png',
        maxDimensionCap: 5000,
      }),
    ).rejects.toThrow('PDF to images supports converting up to 200 pages at a time.');
    expect(documentDestroy).toHaveBeenCalledTimes(1);
    expect(loadingTaskDestroy).toHaveBeenCalledTimes(1);
  });
});
