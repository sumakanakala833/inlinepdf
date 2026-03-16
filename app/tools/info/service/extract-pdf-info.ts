import { PDFDocument } from 'pdf-lib';

import { loadPdfJsModule } from '~/platform/pdf/load-pdfjs';
import { validatePdfFile } from '~/platform/files/security/file-validation';
import type { PdfInfoResult } from '~/tools/info/models';

interface MetadataLike {
  getRaw: () => unknown;
}

interface FontObjectLike {
  name?: string;
  fallbackName?: string;
  loadedName?: string;
  systemFontInfo?: {
    baseFontName?: string;
    css?: string;
  };
  cssFontInfo?: {
    fontFamily?: string;
  };
}

interface PdfOperatorListLike {
  fnArray: number[];
  argsArray: unknown[];
}

function isPdfOperatorListLike(value: unknown): value is PdfOperatorListLike {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return Array.isArray(record.fnArray) && Array.isArray(record.argsArray);
}

function splitKeywords(keywords: string | undefined): string[] {
  if (!keywords) {
    return [];
  }

  return keywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

function formatDate(date: Date | undefined): string | null {
  return date ? date.toISOString() : null;
}

function hasGetRaw(value: unknown): value is MetadataLike {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.getRaw === 'function';
}

function normalizeObjectToStringMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const normalized = entries.map(([key, rawValue]) => [key, String(rawValue)]);

  return Object.fromEntries(normalized) as Record<string, string>;
}

function normalizeRawMetadata(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === 'string') {
    return raw;
  }

  if (
    typeof raw === 'number' ||
    typeof raw === 'boolean' ||
    typeof raw === 'bigint'
  ) {
    return raw.toString();
  }

  if (typeof raw === 'object') {
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return null;
    }
  }

  return null;
}

function decodePdfHexEscapes(value: string): string {
  return value.replace(/#([0-9a-fA-F]{2})/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function normalizeFontNameToken(value: string): string | null {
  const trimmed = value.trim().replace(/^["']+|["']+$/g, '');
  if (trimmed.length === 0) {
    return null;
  }

  const decoded = decodePdfHexEscapes(trimmed).replace(/^\/+/, '');
  const withoutSubsetPrefix = decoded.replace(/^[A-Z]{6}\+/, '');
  const normalized = withoutSubsetPrefix.trim();

  if (normalized.length === 0) {
    return null;
  }

  if (/^g_d\d+_f\d+$/i.test(normalized) || /^g_font_/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractCandidateFontNames(rawValue: string): string[] {
  const candidates = rawValue
    .split(',')
    .map((token) => normalizeFontNameToken(token))
    .filter((token): token is string => token !== null);

  return [...new Set(candidates)];
}

function readFontObjectFontNames(fontObject: unknown): string[] {
  if (typeof fontObject !== 'object' || fontObject === null) {
    return [];
  }

  const font = fontObject as FontObjectLike;
  const rawCandidates = [
    font.name,
    font.fallbackName,
    font.systemFontInfo?.baseFontName,
    font.systemFontInfo?.css,
    font.cssFontInfo?.fontFamily,
  ].filter((value): value is string => typeof value === 'string');

  const parsed = rawCandidates.flatMap((value) =>
    extractCandidateFontNames(value),
  );
  return [...new Set(parsed)];
}

function getFontRefNamesFromOperatorList(
  operatorList: PdfOperatorListLike,
  setFontOperationCode: number,
): string[] {
  const names = new Set<string>();

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    if (operatorList.fnArray[index] !== setFontOperationCode) {
      continue;
    }

    const args = operatorList.argsArray[index];
    if (!Array.isArray(args) || args.length === 0) {
      continue;
    }

    const fontRefName: unknown = args[0];
    if (typeof fontRefName === 'string') {
      names.add(fontRefName);
    }
  }

  return [...names];
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  const maybeBlob = file as Blob & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };

  if (typeof maybeBlob.arrayBuffer === 'function') {
    return maybeBlob.arrayBuffer();
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error(`Failed to read PDF bytes: ${file.name}`));
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read PDF bytes: ${file.name}`));
    };

    reader.readAsArrayBuffer(file);
  });
}

async function extractFontsAndRawMetadata(pdfBytes: Uint8Array): Promise<{
  internalNames: string[];
  fontFamilies: string[];
  infoDictionary: Record<string, string>;
  rawXmpMetadata: string | null;
}> {
  const pdfjs = await loadPdfJsModule();
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });

  const internalNames = new Set<string>();
  const fontFamilies = new Set<string>();
  let infoDictionary: Record<string, string>;
  let rawXmpMetadata: string | null;

  try {
    const document = await loadingTask.promise;

    try {
      const metadata = await document.getMetadata();
      infoDictionary = normalizeObjectToStringMap(metadata.info);

      if (hasGetRaw(metadata.metadata)) {
        const rawXmp = metadata.metadata.getRaw() as unknown;
        rawXmpMetadata = normalizeRawMetadata(rawXmp);
      } else {
        rawXmpMetadata = null;
      }
    } catch {
      infoDictionary = {};
      rawXmpMetadata = null;
    }

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const operatorList = await page.getOperatorList();
      const fontRefNames = isPdfOperatorListLike(operatorList)
        ? getFontRefNamesFromOperatorList(operatorList, pdfjs.OPS.setFont)
        : [];

      for (const fontRefName of fontRefNames) {
        internalNames.add(fontRefName);

        if (!page.commonObjs.has(fontRefName)) {
          continue;
        }

        try {
          const fontObject: unknown = page.commonObjs.get(fontRefName);
          for (const fontName of readFontObjectFontNames(fontObject)) {
            fontFamilies.add(fontName);
          }
        } catch {
          // Ignore unresolved font object entries and continue extraction.
        }
      }

      const textContent = await page.getTextContent();

      for (const item of textContent.items) {
        if (!('fontName' in item)) {
          continue;
        }

        internalNames.add(item.fontName);

        if (Object.hasOwn(textContent.styles, item.fontName)) {
          const style = textContent.styles[item.fontName];
          for (const fontName of extractCandidateFontNames(style.fontFamily)) {
            fontFamilies.add(fontName);
          }
        }
      }

      page.cleanup();
    }

    await document.cleanup();
    await document.destroy();
  } finally {
    await loadingTask.destroy();
  }

  return {
    internalNames: [...internalNames].sort((a, b) => a.localeCompare(b)),
    fontFamilies: [...fontFamilies].sort((a, b) => a.localeCompare(b)),
    infoDictionary,
    rawXmpMetadata,
  };
}

export async function extractPdfInfo(file: File): Promise<PdfInfoResult> {
  await validatePdfFile(file);

  const bytes = await readFileBytes(file);

  let document: PDFDocument;
  try {
    document = await PDFDocument.load(bytes);
  } catch {
    throw new Error('Unable to parse this PDF file.');
  }

  const pdfBytes = new Uint8Array(bytes);
  const extracted = await extractFontsAndRawMetadata(pdfBytes);

  return {
    core: {
      title: document.getTitle() ?? null,
      author: document.getAuthor() ?? null,
      subject: document.getSubject() ?? null,
      keywords: splitKeywords(document.getKeywords()),
      creator: document.getCreator() ?? null,
      producer: document.getProducer() ?? null,
      creationDate: formatDate(document.getCreationDate()),
      modificationDate: formatDate(document.getModificationDate()),
    },
    document: {
      fileName: file.name,
      fileSizeBytes: file.size,
      pageCount: document.getPageCount(),
      isEncrypted: document.isEncrypted,
    },
    fonts: {
      internalNames: extracted.internalNames,
      fontFamilies: extracted.fontFamilies,
    },
    infoDictionary: extracted.infoDictionary,
    rawXmpMetadata: extracted.rawXmpMetadata,
  };
}
