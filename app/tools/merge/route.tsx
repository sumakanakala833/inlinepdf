import type { MetaFunction } from 'react-router';

import { getActionErrorMessage, type ToolActionResult } from '~/shared/tool-ui/action-result';
import { getFiles, getString } from '~/platform/files/read-form-data';
import { takeClientActionFallback } from '~/platform/files/client-action-fallback';
import {
  MAX_BATCH_TOTAL_BYTES,
  MAX_MERGE_FILES,
  validateFiles,
} from '~/platform/files/security/file-validation';
import { triggerFileDownload } from '~/platform/files/trigger-file-download';

import { mergeToolDefinition } from './definition';
import { MergeToolScreen } from './screen';
import { mergePdf } from './use-cases/merge-pdf';

interface MergeActionPayload {
  files: File[];
}

export const meta: MetaFunction = () => [
  { title: `${mergeToolDefinition.title} | InlinePDF` },
  {
    name: 'description',
    content: mergeToolDefinition.shortDescription,
  },
];

export function HydrateFallback() {
  return <p className="text-sm text-muted-foreground">Loading merge tool...</p>;
}

export async function clientAction({
  request,
}: {
  request: Request;
}): Promise<ToolActionResult> {
  const formData = await request.formData();
  const submissionId = getString(formData, 'submissionId');
  const fallbackPayload = submissionId
    ? (takeClientActionFallback(submissionId) as MergeActionPayload | null)
    : null;
  const files = getFiles(formData, 'files[]');
  const resolvedFiles = files.length > 0 ? files : (fallbackPayload?.files ?? []);

  if (resolvedFiles.length < 2) {
    return { ok: false, message: 'Add at least two PDF files before merging.' };
  }

  try {
    await validateFiles(resolvedFiles, {
      kind: 'pdf',
      maxFiles: MAX_MERGE_FILES,
      maxBatchTotalBytes: MAX_BATCH_TOTAL_BYTES,
    });
    const result = await mergePdf({ files: resolvedFiles });
    triggerFileDownload(result.blob, result.fileName);
    return { ok: true, message: 'Merged PDF is ready and download has started.' };
  } catch (error: unknown) {
    return getActionErrorMessage(
      error,
      'Merge failed. Please check your PDF files and try again.',
    );
  }
}

export default function MergeRoute() {
  return <MergeToolScreen />;
}
