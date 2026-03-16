import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { mergeWithPdfLib } from '~/tools/merge/service/merge-with-pdf-lib';

async function createPdfFile(name: string, pageWidth: number): Promise<File> {
  const doc = await PDFDocument.create();
  doc.addPage([pageWidth, 200]);
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

      reject(new Error('Could not read merged blob'));
    };
    reader.onerror = () => {
      reject(new Error('Could not read merged blob'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

describe('mergeWithPdfLib', () => {
  it('merges valid PDFs and returns a non-empty blob', async () => {
    const fileA = await createPdfFile('a.pdf', 200);
    const fileB = await createPdfFile('b.pdf', 300);

    const result = await mergeWithPdfLib([fileA, fileB]);

    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.fileName.endsWith('.pdf')).toBe(true);

    const mergedDoc = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );
    expect(mergedDoc.getPageCount()).toBe(2);
  });

  it('throws when fewer than two files are provided', async () => {
    const fileA = await createPdfFile('single.pdf', 200);

    await expect(mergeWithPdfLib([fileA])).rejects.toThrow(
      'Select at least two PDF files to merge.',
    );
  });

  it('preserves file order in the merged output', async () => {
    const first = await createPdfFile('first.pdf', 111);
    const second = await createPdfFile('second.pdf', 222);

    const result = await mergeWithPdfLib([first, second]);
    const mergedDoc = await PDFDocument.load(
      await readBlobAsArrayBuffer(result.blob),
    );

    expect(mergedDoc.getPage(0).getWidth()).toBe(111);
    expect(mergedDoc.getPage(1).getWidth()).toBe(222);
  });
});
