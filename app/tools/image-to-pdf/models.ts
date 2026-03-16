export type ImageToPdfQuality = 'high' | 'medium' | 'low';

export type SupportedImageMimeType = 'image/jpeg' | 'image/png';

export interface ImageToPdfQualityProfile {
  scale: number;
  jpegQuality?: number;
  reencode: boolean;
}

export interface ImageToPdfPreparedImage {
  fileName: string;
  bytes: Uint8Array;
  mimeType: SupportedImageMimeType;
  width: number;
  height: number;
}

export interface ImageToPdfProgress {
  currentFile: number;
  totalFiles: number;
  fileName: string;
}

export interface ImageToPdfRunOptions {
  quality: ImageToPdfQuality;
  onProgress?: (progress: ImageToPdfProgress) => void;
}

export interface ImageToPdfResult {
  blob: Blob;
  fileName: string;
  pagesExported: number;
}
