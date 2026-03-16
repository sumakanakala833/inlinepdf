import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';

import {
  convertImagesToPdf,
  getImageToPdfQualityProfile,
} from '~/tools/image-to-pdf/service/convert-images-to-pdf';

const ONE_BY_ONE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlB3xkAAAAASUVORK5CYII=';

function pngBytes(): Uint8Array {
  return new Uint8Array(Buffer.from(ONE_BY_ONE_PNG_BASE64, 'base64'));
}

function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

describe('convert-images-to-pdf service', () => {
  it('rejects empty file selection', async () => {
    await expect(
      convertImagesToPdf({
        files: [],
        quality: 'medium',
      }),
    ).rejects.toThrow('Select at least one image to convert.');
  });

  it('rejects unsupported input files', async () => {
    const file = new File(['gif'], 'animated.gif', { type: 'image/gif' });

    await expect(
      convertImagesToPdf({
        files: [file],
        quality: 'medium',
      }),
    ).rejects.toThrow('Only JPG and PNG images are supported: animated.gif');
  });

  it('creates one PDF page per selected image', async () => {
    const prepareImage = vi.fn((file: File) =>
      Promise.resolve({
        fileName: file.name,
        bytes: pngBytes(),
        mimeType: 'image/png' as const,
        width: 20,
        height: 30,
      }),
    );

    const first = new File([toArrayBuffer(jpegBytes())], 'one.jpg', {
      type: 'image/jpeg',
    });
    const second = new File([toArrayBuffer(pngBytes())], 'two.png', {
      type: 'image/png',
    });

    const result = await convertImagesToPdf(
      {
        files: [first, second],
        quality: 'low',
      },
      { prepareImage },
    );

    const outputDocument = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(outputDocument.getPageCount()).toBe(2);
    expect(prepareImage).toHaveBeenCalledTimes(2);
    expect(prepareImage).toHaveBeenNthCalledWith(1, first, 'low');
    expect(prepareImage).toHaveBeenNthCalledWith(2, second, 'low');
  });

  it('maps quality profiles with expected scale and JPEG quality', () => {
    expect(getImageToPdfQualityProfile('high')).toEqual({
      scale: 1,
      reencode: false,
    });

    expect(getImageToPdfQualityProfile('medium')).toEqual({
      scale: 0.8,
      jpegQuality: 0.82,
      reencode: true,
    });

    expect(getImageToPdfQualityProfile('low')).toEqual({
      scale: 0.6,
      jpegQuality: 0.68,
      reencode: true,
    });
  });
});
