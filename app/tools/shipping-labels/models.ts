import {
  SHIPPING_LABEL_PAGE_SIZE_IDS,
  type PageSizeSelectId,
} from '~/platform/pdf/page-size-options';

export const SHIPPING_LABEL_BRANDS = ['meesho', 'amazon', 'flipkart'] as const;

export type ShippingLabelBrand = (typeof SHIPPING_LABEL_BRANDS)[number];

export const SHIPPING_LABEL_OUTPUT_PAGE_SIZES =
  SHIPPING_LABEL_PAGE_SIZE_IDS satisfies readonly PageSizeSelectId[];

export type ShippingLabelOutputPageSize =
  (typeof SHIPPING_LABEL_OUTPUT_PAGE_SIZES)[number];

export const SHIPPING_LABEL_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type ShippingLabelSortDirection =
  (typeof SHIPPING_LABEL_SORT_DIRECTIONS)[number];

export interface ShippingLabelSortOptions {
  pickupPartnerDirection: ShippingLabelSortDirection | null;
  skuDirection: ShippingLabelSortDirection | null;
}

export interface ShippingLabelPreparationResult {
  blob: Blob;
  fileName: string;
  pagesProcessed: number;
  labelsPrepared: number;
  outputPagesCreated: number;
  pagesSkipped: number;
  skippedPageNumbers: number[];
  elapsedMs: number;
}

export interface ShippingLabelPreparationSummary {
  pagesProcessed: number;
  labelsPrepared: number;
  outputPagesCreated: number;
  pagesSkipped: number;
  skippedPageNumbers: number[];
  elapsedMs: number;
  fileName: string;
}
