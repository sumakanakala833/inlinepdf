import type { MergeResult } from '~/tools/merge/models';
import { BrowserPdfLibMergeService } from '~/platform/pdf/merge-pdf-files';

const pdfMergeService = new BrowserPdfLibMergeService();

export async function mergeWithPdfLib(files: File[]): Promise<MergeResult> {
  return pdfMergeService.merge(files);
}
