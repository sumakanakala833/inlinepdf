import type { MetaFunction } from 'react-router';

import { getActionErrorMessage, type ToolActionResult } from '~/shared/tool-ui/action-result';
import { getFile, getString } from '~/platform/files/read-form-data';
import { takeClientActionFallback } from '~/platform/files/client-action-fallback';
import { validatePdfFile } from '~/platform/files/security/file-validation';

import { infoToolDefinition } from './definition';
import type { PdfInfoResult } from './models';
import { PdfInfoToolScreen } from './screen';
import { extractPdfInfoForFile } from './use-cases/extract-pdf-info';

interface PdfInfoActionPayload {
  file: File;
}

export const meta: MetaFunction = () => [
  { title: `${infoToolDefinition.title} | InlinePDF` },
  {
    name: 'description',
    content: infoToolDefinition.shortDescription,
  },
];

export function HydrateFallback() {
  return <p className="text-sm text-muted-foreground">Loading PDF info tool...</p>;
}

export async function clientAction({
  request,
}: {
  request: Request;
}): Promise<ToolActionResult<PdfInfoResult>> {
  const formData = await request.formData();
  const submissionId = getString(formData, 'submissionId');
  const fallbackPayload = submissionId
    ? (takeClientActionFallback(submissionId) as PdfInfoActionPayload | null)
    : null;
  const file = getFile(formData, 'file') ?? fallbackPayload?.file;

  if (!file) {
    return { ok: false, message: 'Select a PDF file before extracting details.' };
  }

  try {
    await validatePdfFile(file);
    const result = await extractPdfInfoForFile({ files: [file] });
    return { ok: true, message: 'PDF details extracted.', result };
  } catch (error: unknown) {
    return getActionErrorMessage(error, 'Failed to extract PDF information.');
  }
}

export default function InfoRoute() {
  return <PdfInfoToolScreen />;
}
