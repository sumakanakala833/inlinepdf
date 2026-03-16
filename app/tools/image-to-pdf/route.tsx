import type { MetaFunction } from 'react-router';

import { getActionErrorMessage, type ToolActionResult } from '~/shared/tool-ui/action-result';
import { getFiles, getString } from '~/platform/files/read-form-data';
import { takeClientActionFallback } from '~/platform/files/client-action-fallback';
import {
  MAX_BATCH_TOTAL_BYTES,
  validateFiles,
} from '~/platform/files/security/file-validation';
import { triggerFileDownload } from '~/platform/files/trigger-file-download';

import { imageToPdfToolDefinition } from './definition';
import { ImageToPdfToolScreen } from './screen';
import {
  convertImagesToPdfDocument,
  isImageToPdfQuality,
} from './use-cases/convert-images-to-pdf';

interface ImageToPdfActionPayload {
  files: File[];
  quality: string;
}

export const meta: MetaFunction = () => [
  { title: `${imageToPdfToolDefinition.title} | InlinePDF` },
  {
    name: 'description',
    content: imageToPdfToolDefinition.shortDescription,
  },
];

export function HydrateFallback() {
  return <p className="text-sm text-muted-foreground">Loading image-to-PDF tool...</p>;
}

export async function clientAction({
  request,
}: {
  request: Request;
}): Promise<ToolActionResult> {
  const formData = await request.formData();
  const submissionId = getString(formData, 'submissionId');
  const fallbackPayload = submissionId
    ? (takeClientActionFallback(submissionId) as ImageToPdfActionPayload | null)
    : null;
  const files = getFiles(formData, 'files[]');
  const resolvedFiles = files.length > 0 ? files : (fallbackPayload?.files ?? []);
  const quality = getString(formData, 'quality') ?? fallbackPayload?.quality ?? '';

  if (resolvedFiles.length < 1) {
    return { ok: false, message: 'Select at least one image before converting.' };
  }

  if (!isImageToPdfQuality(quality)) {
    return { ok: false, message: 'Select an output quality before converting.' };
  }

  try {
    await validateFiles(resolvedFiles, {
      kind: 'image',
      maxBatchTotalBytes: MAX_BATCH_TOTAL_BYTES,
    });
    const result = await convertImagesToPdfDocument(
      { files: resolvedFiles },
      { quality },
    );
    triggerFileDownload(result.blob, result.fileName);
    return {
      ok: true,
      message: `PDF download started with ${String(result.pagesExported)} page${result.pagesExported === 1 ? '' : 's'}.`,
    };
  } catch (error: unknown) {
    return getActionErrorMessage(error, 'Failed to convert images to PDF.');
  }
}

export default function ImageToPdfRoute() {
  return <ImageToPdfToolScreen />;
}
