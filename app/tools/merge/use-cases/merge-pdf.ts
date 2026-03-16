import { mergeWithPdfLib } from '~/tools/merge/service/merge-with-pdf-lib';
import type { MergeResult } from '~/tools/merge/models';

export async function mergePdf({
  files,
}: {
  files: File[];
}): Promise<MergeResult> {
  return mergeWithPdfLib(files);
}
