import { extractPdfInfo } from '~/tools/info/service/extract-pdf-info';
import type { PdfInfoResult } from '~/tools/info/models';

export async function extractPdfInfoForFile({
  files,
}: {
  files: File[];
}): Promise<PdfInfoResult> {
  const firstFile = files.at(0);
  if (!firstFile) {
    throw new Error('Select a PDF file before extracting details.');
  }

  return extractPdfInfo(firstFile);
}
