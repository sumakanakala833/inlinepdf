import { PDFDocument } from 'pdf-lib';

import type {
  ImageToPdfPreparedImage,
  ImageToPdfQuality,
  ImageToPdfQualityProfile,
  ImageToPdfResult,
  ImageToPdfRunOptions,
  SupportedImageMimeType,
} from '~/tools/image-to-pdf/models';
import {
  MAX_BATCH_TOTAL_BYTES,
  type SupportedImageSignatureMimeType,
  validateFiles,
  validateImageFile,
} from '~/platform/files/security/file-validation';

const QUALITY_PROFILES: Record<ImageToPdfQuality, ImageToPdfQualityProfile> = {
  high: {
    scale: 1,
    reencode: false,
  },
  medium: {
    scale: 0.8,
    jpegQuality: 0.82,
    reencode: true,
  },
  low: {
    scale: 0.6,
    jpegQuality: 0.68,
    reencode: true,
  },
};

export interface ConvertImagesToPdfInput extends ImageToPdfRunOptions {
  files: File[];
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface ConvertImagesToPdfDependencies {
  prepareImage: (
    file: File,
    quality: ImageToPdfQuality,
  ) => Promise<ImageToPdfPreparedImage>;
}

function toNormalizedBytes(source: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(source.byteLength);
  bytes.set(source);
  return bytes;
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  return toNormalizedBytes(new Uint8Array(await file.arrayBuffer()));
}

function normalizeDimension(value: number): number {
  return Math.max(1, Math.round(value));
}

function getFileExtension(fileName: string): string {
  const segments = fileName.toLowerCase().split('.');
  if (segments.length < 2) {
    return '';
  }

  return segments.at(-1) ?? '';
}

function resolveSupportedMimeType(file: File): SupportedImageMimeType | null {
  const mimeType = file.type.toLowerCase();

  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return 'image/jpeg';
  }

  if (mimeType === 'image/png') {
    return 'image/png';
  }

  const extension = getFileExtension(file.name);
  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg';
  }

  if (extension === 'png') {
    return 'image/png';
  }

  return null;
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to decode image file: ${file.name}`));
    };

    image.src = objectUrl;
  });
}

async function detectSupportedImageMimeType(
  file: File,
): Promise<SupportedImageSignatureMimeType> {
  return validateImageFile(file);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: SupportedImageMimeType,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

function createImagePdfFileName(firstFileName: string): string {
  const baseName = firstFileName.replace(/\.[^.]+$/u, '') || 'images';
  const stamp = new Date().toISOString().slice(0, 10);
  return `${baseName}-images-${stamp}.pdf`;
}

export function getImageToPdfQualityProfile(
  quality: ImageToPdfQuality,
): ImageToPdfQualityProfile {
  return QUALITY_PROFILES[quality];
}

export function isSupportedImageFile(file: File): boolean {
  return resolveSupportedMimeType(file) !== null;
}

export async function readImageDimensions(file: File): Promise<ImageDimensions> {
  await detectSupportedImageMimeType(file);
  const image = await loadImageElement(file);

  return {
    width: normalizeDimension(image.naturalWidth || image.width),
    height: normalizeDimension(image.naturalHeight || image.height),
  };
}

export async function prepareImageForPdf(
  file: File,
  quality: ImageToPdfQuality,
): Promise<ImageToPdfPreparedImage> {
  const mimeType = await detectSupportedImageMimeType(file);
  const profile = getImageToPdfQualityProfile(quality);
  const image = await loadImageElement(file);
  const sourceWidth = normalizeDimension(image.naturalWidth || image.width);
  const sourceHeight = normalizeDimension(image.naturalHeight || image.height);
  const sourceBytes = await readFileBytes(file);

  if (!profile.reencode) {
    return {
      fileName: file.name,
      bytes: sourceBytes,
      mimeType,
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  const targetWidth = normalizeDimension(sourceWidth * profile.scale);
  const targetHeight = normalizeDimension(sourceHeight * profile.scale);
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d', {
    alpha: mimeType === 'image/png',
  });
  if (!context) {
    throw new Error('Failed to initialize canvas context for image conversion.');
  }

  if (mimeType === 'image/jpeg') {
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, targetWidth, targetHeight);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const encodedBlob = await canvasToBlob(
    canvas,
    mimeType,
    mimeType === 'image/jpeg' ? profile.jpegQuality : undefined,
  );
  if (!encodedBlob) {
    throw new Error(`This browser could not encode ${mimeType} output.`);
  }

  const encodedBytes = toNormalizedBytes(
    new Uint8Array(await encodedBlob.arrayBuffer()),
  );

  return {
    fileName: file.name,
    bytes: encodedBytes,
    mimeType,
    width: targetWidth,
    height: targetHeight,
  };
}

export async function convertImagesToPdf(
  { files, quality, onProgress }: ConvertImagesToPdfInput,
  dependencies: Partial<ConvertImagesToPdfDependencies> = {},
): Promise<ImageToPdfResult> {
  if (!files.length) {
    throw new Error('Select at least one image to convert.');
  }

  await validateFiles(files, {
    kind: 'image',
    maxBatchTotalBytes: MAX_BATCH_TOTAL_BYTES,
  });

  const prepareImage = dependencies.prepareImage ?? prepareImageForPdf;
  const outputDocument = await PDFDocument.create();

  for (const [index, file] of files.entries()) {
    const prepared = await prepareImage(file, quality);
    const image =
      prepared.mimeType === 'image/jpeg'
        ? await outputDocument.embedJpg(prepared.bytes)
        : await outputDocument.embedPng(prepared.bytes);
    const page = outputDocument.addPage([prepared.width, prepared.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: prepared.width,
      height: prepared.height,
    });

    onProgress?.({
      currentFile: index + 1,
      totalFiles: files.length,
      fileName: file.name,
    });
  }

  const savedBytes = await outputDocument.save();
  const normalizedOutputBytes = toNormalizedBytes(new Uint8Array(savedBytes));
  const outputBuffer = new ArrayBuffer(normalizedOutputBytes.byteLength);
  new Uint8Array(outputBuffer).set(normalizedOutputBytes);

  return {
    blob: new Blob([outputBuffer], { type: 'application/pdf' }),
    fileName: createImagePdfFileName(files[0]?.name ?? 'images'),
    pagesExported: files.length,
  };
}
