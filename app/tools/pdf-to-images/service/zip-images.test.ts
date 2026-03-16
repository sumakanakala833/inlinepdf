import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
  createImagesArchiveName,
  zipImages,
} from '~/tools/pdf-to-images/service/zip-images';

describe('zip-images service', () => {
  it('builds an archive name from source file and format', () => {
    const name = createImagesArchiveName('Quarterly Report 2026.pdf', 'jpeg');

    expect(name).toBe('Quarterly-Report-2026-images-jpeg-max.zip');
  });

  it('archives every image using STORE compression', async () => {
    const blob = await zipImages({
      images: [
        {
          fileName: 'page-001.png',
          bytes: new Uint8Array([1, 2, 3]),
          mimeType: 'image/png',
          width: 100,
          height: 200,
        },
        {
          fileName: 'page-002.png',
          bytes: new Uint8Array([4, 5, 6]),
          mimeType: 'image/png',
          width: 100,
          height: 200,
        },
      ],
    });

    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const entries = Object.keys(archive.files).sort();

    expect(entries).toEqual(['page-001.png', 'page-002.png']);

    const firstFile = archive.file('page-001.png');
    expect(firstFile).not.toBeNull();

    const compressionMagic = (
      firstFile as JSZip.JSZipObject & {
        _data?: { compression?: { magic?: string } };
      }
    )._data?.compression?.magic;

    expect(compressionMagic).toBe('\x00\x00');
  });
});
