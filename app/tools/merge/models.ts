export type PreviewStatus = 'loading' | 'ready' | 'unavailable';

export interface MergeInputFile {
  id: string;
  file: File;
  pageCount: number | null;
  previewDataUrl: string | null;
  previewStatus: PreviewStatus;
}

export interface MergeResult {
  blob: Blob;
  fileName: string;
}
