import { describe, expect, it } from 'vitest';

import {
  validateFiles,
  validateImageFile,
  validatePageCountLimit,
  validatePdfFile,
} from '~/platform/files/security/file-validation';

function setFileSize(file: File, size: number): File {
  Object.defineProperty(file, 'size', {
    configurable: true,
    value: size,
  });
  return file;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function createPdfFile(
  name = 'sample.pdf',
  type = 'application/pdf',
  bytes: Uint8Array = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]),
): File {
  return new File([toArrayBuffer(bytes)], name, { type });
}

function createPngFile(name = 'sample.png'): File {
  return new File(
    [
      toArrayBuffer(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ],
    name,
    { type: 'image/png' },
  );
}

function createJpegFile(name = 'sample.jpg'): File {
  return new File(
    [toArrayBuffer(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))],
    name,
    {
      type: 'image/jpeg',
    },
  );
}

describe('file validation', () => {
  it('accepts PDFs without enforcing signature or size checks', async () => {
    await expect(validatePdfFile(createPdfFile())).resolves.toBeUndefined();
    await expect(
      validatePdfFile(
        createPdfFile(
          'spoofed.pdf',
          'application/pdf',
          new Uint8Array([0x6e, 0x6f, 0x74, 0x2d, 0x70, 0x64, 0x66]),
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it('accepts JPEG and PNG files by file hint', async () => {
    await expect(validateImageFile(createJpegFile())).resolves.toBe('image/jpeg');
    await expect(validateImageFile(createPngFile())).resolves.toBe('image/png');
  });

  it('rejects unsupported image types', async () => {
    const spoofed = new File(
      [toArrayBuffer(new Uint8Array([0x47, 0x49, 0x46, 0x38]))],
      'bad.gif',
      {
        type: 'image/gif',
      },
    );

    await expect(validateImageFile(spoofed)).rejects.toThrow(
      'Only JPG and PNG images are supported: bad.gif',
    );
  });

  it('allows oversized files and batches', async () => {
    const oversizedPdf = setFileSize(createPdfFile('large.pdf'), 500 * 1024 * 1024);
    const oversizedImage = setFileSize(createPngFile('large.png'), 300 * 1024 * 1024);
    const manyFiles = Array.from({ length: 50 }, (_, index) =>
      createPdfFile(`file-${String(index)}.pdf`),
    );

    await expect(validatePdfFile(oversizedPdf)).resolves.toBeUndefined();
    await expect(validateImageFile(oversizedImage)).resolves.toBe('image/png');
    await expect(validateFiles([oversizedImage], { kind: 'image' })).resolves.toBeUndefined();
    await expect(
      validateFiles(manyFiles, { kind: 'pdf', maxFiles: 20, maxBatchTotalBytes: 200 }),
    ).resolves.toBeUndefined();
  });

  it('caps page counts above the configured limit', () => {
    expect(() => {
      validatePageCountLimit(5000, 'too many pages');
    }).toThrow('too many pages');
  });
});
