import type { MetaFunction } from 'react-router';

import { getActionErrorMessage, type ToolActionResult } from '~/shared/tool-ui/action-result';
import { getFile, getJson, getString } from '~/platform/files/read-form-data';
import { takeClientActionFallback } from '~/platform/files/client-action-fallback';
import { validatePdfFile } from '~/platform/files/security/file-validation';
import { triggerFileDownload } from '~/platform/files/trigger-file-download';

import { pdfToImagesToolDefinition } from './definition';
import { PdfToImagesToolScreen } from './screen';
import {
  convertPdfToImagesArchive,
  isImageOutputFormat,
  isMaxDimensionCap,
} from './use-cases/convert-pdf-to-images';

interface PdfToImagesActionPayload {
  file: File;
  format: string;
  maxDimensionCap: number;
  pageNumbers?: number[];
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePageNumbers(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const pageNumbers = value.filter(
    (item): item is number => Number.isInteger(item) && item > 0,
  );
  return pageNumbers.length === value.length ? pageNumbers : undefined;
}

export const meta: MetaFunction = () => [
  { title: `${pdfToImagesToolDefinition.title} | InlinePDF` },
  {
    name: 'description',
    content: pdfToImagesToolDefinition.shortDescription,
  },
];

export function HydrateFallback() {
  return <p className="text-sm text-muted-foreground">Loading PDF-to-images tool...</p>;
}

export async function clientAction({
  request,
}: {
  request: Request;
}): Promise<ToolActionResult> {
  const formData = await request.formData();
  const submissionId = getString(formData, 'submissionId');
  const fallbackPayload = submissionId
    ? (takeClientActionFallback(submissionId) as PdfToImagesActionPayload | null)
    : null;
  const file = getFile(formData, 'file') ?? fallbackPayload?.file;
  const format = getString(formData, 'format') ?? fallbackPayload?.format;
  const maxDimensionCap =
    parsePositiveInteger(getString(formData, 'maxDimensionCap')) ??
    fallbackPayload?.maxDimensionCap ??
    null;
  const pageNumbers =
    parsePageNumbers(getJson(formData, 'pageNumbers')) ?? fallbackPayload?.pageNumbers;

  if (!file) {
    return { ok: false, message: 'Select a PDF file before converting.' };
  }

  if (!isImageOutputFormat(format)) {
    return { ok: false, message: 'Select an output format before converting.' };
  }

  if (!isMaxDimensionCap(maxDimensionCap)) {
    return { ok: false, message: 'Select a valid max dimension cap before converting.' };
  }

  try {
    await validatePdfFile(file);
    const result = await convertPdfToImagesArchive(
      { files: [file] },
      {
        format,
        maxDimensionCap,
        pageNumbers: Array.isArray(pageNumbers) ? pageNumbers : undefined,
      },
    );

    triggerFileDownload(result.blob, result.fileName);
    return {
      ok: true,
      message: `ZIP download started with ${String(result.pageCount)} image${result.pageCount === 1 ? '' : 's'}.`,
    };
  } catch (error: unknown) {
    return getActionErrorMessage(error, 'Failed to convert PDF into images.');
  }
}

export default function PdfToImagesRoute() {
  return <PdfToImagesToolScreen />;
}
