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

import { getSafeMaxLabelsPerPage } from '../layout';
import { prepareShippingLabelPdf } from './prepare-shipping-labels';

interface MockTextItem {
  str: string;
  transform: number[];
  height?: number;
}

async function createPdfFile(
  name: string,
  pageSizes: [number, number][],
): Promise<File> {
  const document = await PDFDocument.create();

  for (const [width, height] of pageSizes) {
    const page = document.addPage([width, height]);
    page.drawText('Shipping label test page', {
      x: 12,
      y: height / 2,
      size: 12,
    });
  }

  const bytes = await document.save();
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

function createPdfJsLoadingTask(
  pages: { width: number; height: number; items: MockTextItem[] }[],
) {
  const loadingTaskDestroy = vi.fn();
  const documentDestroy = vi.fn(() => Promise.resolve(undefined));
  const documentCleanup = vi.fn(() => Promise.resolve(undefined));
  const pageCleanupMocks = pages.map(() => vi.fn());

  const loadingTask = {
    destroy: loadingTaskDestroy,
    promise: Promise.resolve({
      numPages: pages.length,
      cleanup: documentCleanup,
      destroy: documentDestroy,
      getPage: vi.fn((pageNumber: number) => {
        const page = pages[pageNumber - 1];
        const pageCleanup = pageCleanupMocks[pageNumber - 1];

        return Promise.resolve({
          getTextContent: vi.fn(() => Promise.resolve({ items: page.items })),
          getViewport: ({ scale }: { scale: number }) => ({
            width: page.width * scale,
            height: page.height * scale,
            rotation: 0,
            viewBox: [0, 0, page.width, page.height],
            convertToPdfPoint: (x: number, y: number) => [x, page.height - y],
          }),
          cleanup: pageCleanup,
        });
      }),
    }),
  };

  return {
    loadingTask,
    loadingTaskDestroy,
    documentCleanup,
    documentDestroy,
    pageCleanupMocks,
  };
}

describe('prepareShippingLabelPdf', () => {
  it('prepares a Meesho label page at the auto size with bottom padding', async () => {
    const file = await createPdfFile('meesho.pdf', [[200, 200]]);
    const { loadingTask, loadingTaskDestroy } = createPdfJsLoadingTask([
      {
        width: 200,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'meesho',
      outputPageSize: 'auto',
    });

    expect(result.pagesProcessed).toBe(1);
    expect(result.labelsPrepared).toBe(1);
    expect(result.outputPagesCreated).toBe(1);
    expect(result.pagesSkipped).toBe(0);
    expect(result.skippedPageNumbers).toEqual([]);
    expect(result.elapsedMs).toBeGreaterThan(0);
    expect(result.fileName).toMatch(
      /^meesho-meesho-labels-\d{4}-\d{2}-\d{2}\.pdf$/,
    );
    expect(loadingTaskDestroy).toHaveBeenCalledTimes(1);

    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );
    expect(outputDocument.getPageCount()).toBe(1);
    expect(outputDocument.getPage(0).getWidth()).toBeCloseTo(200, 4);
    expect(outputDocument.getPage(0).getHeight()).toBeCloseTo(49, 4);
  });

  it('prefers the top-most TAX INVOICE match on pages with duplicates', async () => {
    const file = await createPdfFile('duplicates.pdf', [[200, 200]]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 200,
        height: 200,
        items: [
          { str: 'TAX INVOICE', transform: [10, 0, 0, 10, 40, 60], height: 10 },
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'meesho',
      outputPageSize: 'auto',
    });
    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(outputDocument.getPage(0).getHeight()).toBeCloseTo(49, 4);
  });

  it('skips pages without a TAX INVOICE anchor and preserves matched page order', async () => {
    const file = await createPdfFile('mixed.pdf', [
      [200, 200],
      [150, 150],
    ]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 200,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
        ],
      },
      {
        width: 150,
        height: 150,
        items: [
          {
            str: 'Order summary',
            transform: [10, 0, 0, 10, 20, 60],
            height: 10,
          },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'meesho',
      outputPageSize: 'auto',
    });
    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(result.pagesProcessed).toBe(2);
    expect(result.labelsPrepared).toBe(1);
    expect(result.pagesSkipped).toBe(1);
    expect(result.skippedPageNumbers).toEqual([2]);
    expect(outputDocument.getPageCount()).toBe(1);
    expect(outputDocument.getPage(0).getWidth()).toBeCloseTo(200, 4);
  });

  it('fits prepared label pages onto an A4 sheet when A4 mode is selected', async () => {
    const file = await createPdfFile('a4.pdf', [[220, 200]]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 220,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'meesho',
      outputPageSize: 'a4',
    });
    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    const outputPage = outputDocument.getPage(0);
    const dimensions = [outputPage.getWidth(), outputPage.getHeight()].sort(
      (left, right) => left - right,
    );

    expect(dimensions[0]).toBeCloseTo(595, 4);
    expect(dimensions[1]).toBeCloseTo(842, 4);
    expect(result.outputPagesCreated).toBe(1);
  });

  it('throws when no Meesho labels are found in the source PDF', async () => {
    const file = await createPdfFile('empty.pdf', [[200, 200]]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 200,
        height: 200,
        items: [
          {
            str: 'Packing slip',
            transform: [10, 0, 0, 10, 20, 60],
            height: 10,
          },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    await expect(
      prepareShippingLabelPdf(file, {
        brand: 'meesho',
        outputPageSize: 'auto',
      }),
    ).rejects.toThrow('No Meesho label pages were found in this PDF.');
  });

  it('sorts prepared label pages by SKU when SKU sorting is enabled', async () => {
    const file = await createPdfFile('sku-sort.pdf', [
      [120, 200],
      [180, 200],
    ]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 120,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
          { str: 'SKU', transform: [10, 0, 0, 10, 19, 130], height: 10 },
          { str: 'Size', transform: [10, 0, 0, 10, 203, 130], height: 10 },
          { str: 'Zulu', transform: [10, 0, 0, 10, 19, 114], height: 10 },
        ],
      },
      {
        width: 180,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
          { str: 'SKU', transform: [10, 0, 0, 10, 19, 130], height: 10 },
          { str: 'Size', transform: [10, 0, 0, 10, 203, 130], height: 10 },
          { str: 'Alpha', transform: [10, 0, 0, 10, 19, 114], height: 10 },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'meesho',
      outputPageSize: 'auto',
      sort: {
        pickupPartnerDirection: null,
        skuDirection: 'asc',
      },
    });
    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(outputDocument.getPageCount()).toBe(2);
    expect(outputDocument.getPage(0).getWidth()).toBeCloseTo(180, 4);
    expect(outputDocument.getPage(1).getWidth()).toBeCloseTo(120, 4);
  });

  it('sorts prepared label pages by pickup partner before SKU when both sorts are enabled', async () => {
    const file = await createPdfFile('combined-sort.pdf', [
      [110, 200],
      [140, 200],
      [170, 200],
    ]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 110,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
          { str: 'Shadowfax', transform: [10, 0, 0, 10, 265, 182], height: 10 },
          { str: 'Pickup', transform: [10, 0, 0, 10, 269, 160], height: 10 },
          { str: 'SKU', transform: [10, 0, 0, 10, 19, 130], height: 10 },
          { str: 'Size', transform: [10, 0, 0, 10, 203, 130], height: 10 },
          { str: 'Zulu', transform: [10, 0, 0, 10, 19, 114], height: 10 },
        ],
      },
      {
        width: 140,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
          { str: 'Shadowfax', transform: [10, 0, 0, 10, 265, 182], height: 10 },
          { str: 'Pickup', transform: [10, 0, 0, 10, 269, 160], height: 10 },
          { str: 'SKU', transform: [10, 0, 0, 10, 19, 130], height: 10 },
          { str: 'Size', transform: [10, 0, 0, 10, 203, 130], height: 10 },
          { str: 'Alpha', transform: [10, 0, 0, 10, 19, 114], height: 10 },
        ],
      },
      {
        width: 170,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
          { str: 'Valmo', transform: [10, 0, 0, 10, 269, 160], height: 10 },
          { str: 'Pickup', transform: [10, 0, 0, 10, 327, 162], height: 10 },
          { str: 'SKU', transform: [10, 0, 0, 10, 19, 130], height: 10 },
          { str: 'Size', transform: [10, 0, 0, 10, 203, 130], height: 10 },
          { str: 'Bravo', transform: [10, 0, 0, 10, 19, 114], height: 10 },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'meesho',
      outputPageSize: 'auto',
      sort: {
        pickupPartnerDirection: 'desc',
        skuDirection: 'desc',
      },
    });
    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(outputDocument.getPageCount()).toBe(3);
    expect(outputDocument.getPage(0).getWidth()).toBeCloseTo(170, 4);
    expect(outputDocument.getPage(1).getWidth()).toBeCloseTo(110, 4);
    expect(outputDocument.getPage(2).getWidth()).toBeCloseTo(140, 4);
  });

  it('groups four Meesho labels onto one A4 page when labels-per-page is enabled', async () => {
    const file = await createPdfFile('meesho-grid.pdf', [
      [220, 200],
      [220, 200],
      [220, 200],
      [220, 200],
    ]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 220,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
        ],
      },
      {
        width: 220,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
        ],
      },
      {
        width: 220,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
        ],
      },
      {
        width: 220,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'meesho',
      outputPageSize: 'a4',
      labelsPerPage: 4,
    });
    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(result.labelsPrepared).toBe(4);
    expect(result.outputPagesCreated).toBe(1);
    expect(outputDocument.getPageCount()).toBe(1);
  });

  it('rejects labels-per-page values that exceed the readable A4 limit for Meesho', async () => {
    const file = await createPdfFile('meesho-limit.pdf', [[220, 200]]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 220,
        height: 200,
        items: [
          {
            str: 'TAX INVOICE',
            transform: [10, 0, 0, 10, 40, 150],
            height: 10,
          },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    await expect(
      prepareShippingLabelPdf(file, {
        brand: 'meesho',
        outputPageSize: 'a4',
        labelsPerPage: 5,
      }),
    ).rejects.toThrow(
      'Choose 4 or fewer labels per A4 page for Meesho labels.',
    );
  });

  it('treats Amazon pages as full-page labels and groups them on fixed paper sizes', async () => {
    const file = await createPdfFile('amazon.pdf', [
      [288, 432],
      [288, 432],
      [288, 432],
      [288, 432],
    ]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 288,
        height: 432,
        items: [{ str: 'Amazon label', transform: [10, 0, 0, 10, 24, 380] }],
      },
      {
        width: 288,
        height: 432,
        items: [{ str: 'Amazon label', transform: [10, 0, 0, 10, 24, 380] }],
      },
      {
        width: 288,
        height: 432,
        items: [{ str: 'Amazon label', transform: [10, 0, 0, 10, 24, 380] }],
      },
      {
        width: 288,
        height: 432,
        items: [{ str: 'Amazon label', transform: [10, 0, 0, 10, 24, 380] }],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'amazon',
      outputPageSize: 'a4',
      labelsPerPage: 4,
    });
    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(result.labelsPrepared).toBe(2);
    expect(result.outputPagesCreated).toBe(1);
    expect(result.pagesSkipped).toBe(2);
    expect(result.skippedPageNumbers).toEqual([2, 4]);
    expect(outputDocument.getPageCount()).toBe(1);
  });

  it('fits four large Amazon labels on one A4 page', async () => {
    const file = await createPdfFile('amazon-large.pdf', [
      [595, 842],
      [595, 842],
      [595, 842],
      [595, 842],
      [595, 842],
      [595, 842],
      [595, 842],
      [595, 842],
    ]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 595,
        height: 842,
        items: [{ str: 'Label', transform: [10, 0, 0, 10, 24, 780] }],
      },
      {
        width: 595,
        height: 842,
        items: [{ str: 'Amazon', transform: [10, 0, 0, 10, 24, 780] }],
      },
      {
        width: 595,
        height: 842,
        items: [{ str: 'Label', transform: [10, 0, 0, 10, 24, 780] }],
      },
      {
        width: 595,
        height: 842,
        items: [{ str: 'Invoice', transform: [10, 0, 0, 10, 24, 780] }],
      },
      {
        width: 595,
        height: 842,
        items: [{ str: 'Label', transform: [10, 0, 0, 10, 24, 780] }],
      },
      {
        width: 595,
        height: 842,
        items: [{ str: 'Invoice', transform: [10, 0, 0, 10, 24, 780] }],
      },
      {
        width: 595,
        height: 842,
        items: [{ str: 'Label', transform: [10, 0, 0, 10, 24, 780] }],
      },
      {
        width: 595,
        height: 842,
        items: [{ str: 'Invoice', transform: [10, 0, 0, 10, 24, 780] }],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'amazon',
      outputPageSize: 'a4',
      labelsPerPage: 4,
    });
    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(result.labelsPrepared).toBe(4);
    expect(result.outputPagesCreated).toBe(1);
    expect(outputDocument.getPageCount()).toBe(1);
  });

  it('rejects Amazon uploads when the second page does not contain Amazon text', async () => {
    const file = await createPdfFile('not-amazon.pdf', [[288, 432], [288, 432]]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 288,
        height: 432,
        items: [{ str: 'Amazon label', transform: [10, 0, 0, 10, 24, 380] }],
      },
      {
        width: 288,
        height: 432,
        items: [{ str: 'Invoice', transform: [10, 0, 0, 10, 24, 380] }],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    await expect(
      prepareShippingLabelPdf(file, {
        brand: 'amazon',
        outputPageSize: 'auto',
      }),
    ).rejects.toThrow(
      'This file does not appear to be a supported Amazon label PDF.',
    );
  });

  it('sorts Flipkart labels by SKU without showing pickup-partner sorting', async () => {
    const file = await createPdfFile('flipkart.pdf', [
      [595, 842],
      [595, 842],
    ]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 595,
        height: 842,
        items: [
          {
            str: 'E-Kart Logistics',
            transform: [6, 0, 0, 6, 216, 801.5],
            height: 6,
          },
          {
            str: 'SKU ID | Description',
            transform: [6, 0, 0, 6, 258, 557],
            height: 6,
          },
          {
            str: '1 Zulu | Demo product',
            transform: [6, 0, 0, 6, 192, 548],
            height: 6,
          },
        ],
      },
      {
        width: 595,
        height: 842,
        items: [
          {
            str: 'SKU ID | Description',
            transform: [6, 0, 0, 6, 258, 557],
            height: 6,
          },
          {
            str: '1 Alpha | Demo product',
            transform: [6, 0, 0, 6, 192, 548],
            height: 6,
          },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    const result = await prepareShippingLabelPdf(file, {
      brand: 'flipkart',
      outputPageSize: 'auto',
      sort: {
        pickupPartnerDirection: null,
        skuDirection: 'asc',
      },
    });
    const outputDocument = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(outputDocument.getPageCount()).toBe(2);
    expect(outputDocument.getPage(0).getWidth()).toBeCloseTo(595, 4);
    expect(outputDocument.getPage(0).getHeight()).toBeCloseTo(395.11, 2);
    expect(outputDocument.getPage(1).getWidth()).toBeCloseTo(595, 4);
  });

  it('rejects Flipkart uploads when the first page does not contain E-Kart Logistics', async () => {
    const file = await createPdfFile('not-flipkart.pdf', [[595, 842]]);
    const { loadingTask } = createPdfJsLoadingTask([
      {
        width: 595,
        height: 842,
        items: [
          {
            str: 'SKU ID | Description',
            transform: [6, 0, 0, 6, 258, 557],
            height: 6,
          },
        ],
      },
    ]);
    getDocumentMock.mockReturnValueOnce(loadingTask);

    await expect(
      prepareShippingLabelPdf(file, {
        brand: 'flipkart',
        outputPageSize: 'auto',
      }),
    ).rejects.toThrow(
      'This file does not appear to be a supported Flipkart label PDF.',
    );
  });
});

describe('getSafeMaxLabelsPerPage', () => {
  it('keeps the A4 limit at four labels for Meesho', () => {
    expect(
      getSafeMaxLabelsPerPage({
        brand: 'meesho',
        pageSizeId: 'a4',
      }),
    ).toBe(4);
  });

  it('allows four A4-sized Amazon labels per A4 page', () => {
    expect(
      getSafeMaxLabelsPerPage({
        brand: 'amazon',
        pageSizeId: 'a4',
        labelSize: {
          width: 595,
          height: 842,
        },
      }),
    ).toBe(4);
  });
});
