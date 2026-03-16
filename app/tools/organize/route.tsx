import type { MetaFunction } from 'react-router';

import { getActionErrorMessage, type ToolActionResult } from '~/shared/tool-ui/action-result';
import { getFile, getJson, getString } from '~/platform/files/read-form-data';
import { takeClientActionFallback } from '~/platform/files/client-action-fallback';
import { validatePdfFile } from '~/platform/files/security/file-validation';
import { triggerFileDownload } from '~/platform/files/trigger-file-download';

import { organizeToolDefinition } from './definition';
import type { OrganizePageState } from './models';
import { OrganizeToolScreen } from './screen';
import { organizePdfDocument } from './use-cases/export-organized-pdf';

interface OrganizeActionPayload {
  file: File;
  pages: OrganizePageState[];
}

export const meta: MetaFunction = () => [
  { title: `${organizeToolDefinition.title} | InlinePDF` },
  {
    name: 'description',
    content: organizeToolDefinition.shortDescription,
  },
];

export function HydrateFallback() {
  return <p className="text-sm text-muted-foreground">Loading organize tool...</p>;
}

export async function clientAction({
  request,
}: {
  request: Request;
}): Promise<ToolActionResult> {
  const formData = await request.formData();
  const submissionId = getString(formData, 'submissionId');
  const fallbackPayload = submissionId
    ? (takeClientActionFallback(submissionId) as OrganizeActionPayload | null)
    : null;
  const file = getFile(formData, 'file') ?? fallbackPayload?.file;
  const pagesData = getJson(formData, 'pages');
  const pages =
    Array.isArray(pagesData)
      ? (pagesData as OrganizePageState[])
      : (fallbackPayload?.pages ?? null);

  if (!file) {
    return { ok: false, message: 'Select a PDF file before organizing.' };
  }

  if (!pages) {
    return {
      ok: false,
      message: 'Missing organize settings. Arrange pages before downloading.',
    };
  }

  try {
    await validatePdfFile(file);
    const result = await organizePdfDocument({ files: [file] }, { pages });
    triggerFileDownload(result.blob, result.fileName);
    return {
      ok: true,
      message: `Organized PDF ready. Exported ${String(result.pagesExported)} page${result.pagesExported === 1 ? '' : 's'}.`,
    };
  } catch (error: unknown) {
    return getActionErrorMessage(error, 'Failed to organize this PDF.');
  }
}

export default function OrganizeRoute() {
  return <OrganizeToolScreen />;
}
