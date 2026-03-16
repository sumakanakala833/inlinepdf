import type { MetaFunction } from 'react-router';

import { getActionErrorMessage, type ToolActionResult } from '~/shared/tool-ui/action-result';
import { getFile, getJson, getString } from '~/platform/files/read-form-data';
import { takeClientActionFallback } from '~/platform/files/client-action-fallback';
import { validatePdfFile } from '~/platform/files/security/file-validation';
import { triggerFileDownload } from '~/platform/files/trigger-file-download';

import { cropToolDefinition } from './definition';
import { hasValidRect } from './domain/coordinate-math';
import type { NormalizedRect } from './models';
import { CropToolScreen } from './screen';
import { exportCroppedPdf } from './use-cases/export-cropped-pdf-file';

interface CropActionPayload {
  file: File;
  pageNumber: number;
  totalPages: number;
  mode: 'current' | 'allWithOriginalOthers';
  cropRect: NormalizedRect;
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseCropRect(value: unknown): NormalizedRect | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<NormalizedRect>;
  if (
    typeof candidate.x !== 'number' ||
    typeof candidate.y !== 'number' ||
    typeof candidate.width !== 'number' ||
    typeof candidate.height !== 'number'
  ) {
    return null;
  }

  return {
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
  };
}

export const meta: MetaFunction = () => [
  { title: `${cropToolDefinition.title} | InlinePDF` },
  {
    name: 'description',
    content: cropToolDefinition.shortDescription,
  },
];

export function HydrateFallback() {
  return <p className="text-sm text-muted-foreground">Loading crop tool...</p>;
}

export async function clientAction({
  request,
}: {
  request: Request;
}): Promise<ToolActionResult> {
  const formData = await request.formData();
  const submissionId = getString(formData, 'submissionId');
  const fallbackPayload = submissionId
    ? (takeClientActionFallback(submissionId) as CropActionPayload | null)
    : null;
  const file = getFile(formData, 'file') ?? fallbackPayload?.file;
  const cropRect = parseCropRect(getJson(formData, 'cropRect')) ?? fallbackPayload?.cropRect ?? null;
  const modeValue = getString(formData, 'mode');
  const mode =
    modeValue === 'current' || modeValue === 'allWithOriginalOthers'
      ? modeValue
      : (fallbackPayload?.mode ?? null);
  const pageNumber =
    parsePositiveInteger(getString(formData, 'pageNumber')) ??
    fallbackPayload?.pageNumber ??
    null;
  const totalPages =
    parsePositiveInteger(getString(formData, 'totalPages')) ??
    fallbackPayload?.totalPages ??
    null;

  if (!file) {
    return { ok: false, message: 'Select a PDF file before cropping.' };
  }

  if (!cropRect || !hasValidRect(cropRect)) {
    return { ok: false, message: 'Set a valid crop area before downloading.' };
  }

  if (!mode || !pageNumber || !totalPages) {
    return { ok: false, message: 'Missing crop settings. Please try again.' };
  }

  try {
    await validatePdfFile(file);
    const result =
      mode === 'allWithOriginalOthers'
        ? await exportCroppedPdf({
            file,
            selectedPages: Array.from({ length: totalPages }, (_, index) => index + 1),
            pageCrops: { [pageNumber]: cropRect },
            keepUncroppedPages: true,
          })
        : await exportCroppedPdf({
            file,
            selectedPages: [pageNumber],
            pageCrops: { [pageNumber]: cropRect },
          });

    triggerFileDownload(result.blob, result.fileName);
    return { ok: true, message: 'Cropped PDF is ready and download has started.' };
  } catch (error: unknown) {
    return getActionErrorMessage(error, 'Failed to crop this page.');
  }
}

export default function CropRoute() {
  return <CropToolScreen />;
}
