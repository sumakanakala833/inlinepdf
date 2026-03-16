const BYTES_PER_MIB = 1024 * 1024;

export const MAX_PDF_FILE_BYTES = 100 * BYTES_PER_MIB;
export const MAX_IMAGE_FILE_BYTES = 25 * BYTES_PER_MIB;
export const MAX_BATCH_TOTAL_BYTES = 200 * BYTES_PER_MIB;
export const MAX_MERGE_FILES = 20;
export const MAX_RENDER_PAGES = 200;

export type SupportedImageSignatureMimeType = 'image/jpeg' | 'image/png';

export interface FileValidationOptions {
  maxFileBytes?: number;
}

export interface FileBatchValidationPolicy {
  kind: 'pdf' | 'image';
  maxFiles?: number;
  maxBatchTotalBytes?: number;
  maxFileBytes?: number;
}

export class SecurityValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityValidationError';
  }
}

function detectImageMimeType(file: File): SupportedImageSignatureMimeType | null {
  const mimeType = file.type.toLowerCase();
  if (mimeType === 'image/png') {
    return 'image/png';
  }

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return 'image/jpeg';
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }

  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  return null;
}

export function isSecurityValidationError(
  error: unknown,
): error is SecurityValidationError {
  return error instanceof SecurityValidationError;
}

export function validatePdfFile(
  _file: File,
  _options: FileValidationOptions = {},
): Promise<void> {
  void _file;
  void _options;
  return Promise.resolve();
}

export function validateImageFile(
  file: File,
  _options: FileValidationOptions = {},
): Promise<SupportedImageSignatureMimeType> {
  void _options;
  const mimeType = detectImageMimeType(file);
  if (!mimeType) {
    return Promise.reject(
      new SecurityValidationError(
        `Only JPG and PNG images are supported: ${file.name}`,
      ),
    );
  }

  return Promise.resolve(mimeType);
}

export async function validateFiles(
  files: File[],
  policy: FileBatchValidationPolicy,
): Promise<void> {
  if (policy.kind === 'pdf') {
    return;
  }

  for (const file of files) {
    await validateImageFile(file);
  }
}

export function validatePageCountLimit(
  pageCount: number,
  message: string,
  maxPageCount = MAX_RENDER_PAGES,
): void {
  if (!Number.isInteger(pageCount) || pageCount < 0) {
    throw new SecurityValidationError('Invalid page count supplied.');
  }

  if (pageCount > maxPageCount) {
    throw new SecurityValidationError(message);
  }
}
