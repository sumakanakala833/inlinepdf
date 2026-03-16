import { exportOrganizedPdf } from '~/tools/organize/service/export-organized-pdf';
import type {
  OrganizePageState,
  OrganizeResult,
  OrganizeRunOptions,
} from '~/tools/organize/models';

function isOrganizePageState(value: unknown): value is OrganizePageState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<OrganizePageState>;
  return (
    typeof candidate.id === 'string' &&
    Number.isInteger(candidate.sourcePageNumber) &&
    typeof candidate.rotationQuarterTurns === 'number' &&
    typeof candidate.isDeleted === 'boolean'
  );
}

function isOrganizeRunOptions(value: unknown): value is OrganizeRunOptions {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const options = value as Partial<OrganizeRunOptions>;
  return Array.isArray(options.pages) && options.pages.every(isOrganizePageState);
}

export async function organizePdfDocument(
  { files }: { files: File[] },
  options?: OrganizeRunOptions,
): Promise<OrganizeResult> {
  const sourceFile = files.at(0);
  if (!sourceFile) {
    throw new Error('Select a PDF file before organizing.');
  }

  if (!isOrganizeRunOptions(options)) {
    throw new Error('Missing organize settings. Arrange pages before downloading.');
  }

  return exportOrganizedPdf({
    file: sourceFile,
    pages: options.pages,
  });
}
