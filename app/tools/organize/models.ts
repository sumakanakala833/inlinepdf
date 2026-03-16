export type ThumbnailStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface OrganizePageState {
  id: string;
  sourcePageNumber: number;
  rotationQuarterTurns: number;
  isDeleted: boolean;
  thumbnailDataUrl: string | null;
  thumbnailStatus: ThumbnailStatus;
}

export interface OrganizeRunOptions {
  pages: OrganizePageState[];
}

export interface OrganizeResult {
  blob: Blob;
  fileName: string;
  pagesExported: number;
}

export interface OrganizePreviewSession {
  pageCount: number;
  getPageThumbnail: (pageNumber: number) => Promise<string | null>;
  destroy: () => Promise<void>;
}

export function normalizeQuarterTurns(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value);
  let normalized = rounded;

  while (normalized > 3) {
    normalized -= 4;
  }

  while (normalized < -3) {
    normalized += 4;
  }

  return normalized;
}

export function quarterTurnsToDegrees(quarterTurns: number): number {
  return normalizeQuarterTurns(quarterTurns) * 90;
}
