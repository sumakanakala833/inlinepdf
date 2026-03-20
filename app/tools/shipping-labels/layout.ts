import {
  getPageSizeDimensionsInPoints,
  type StandardPageSizeId,
} from '~/platform/pdf/page-size-options';

import type { ShippingLabelBrand } from './models';

const MIN_PAGE_PADDING_POINTS = 10;
const MAX_PAGE_PADDING_POINTS = 24;
const MIN_CELL_GAP_POINTS = 6;
const MAX_CELL_GAP_POINTS = 18;
const MAX_LABELS_PER_PAGE_SEARCH = 24;

interface LabelSize {
  width: number;
  height: number;
}

interface ShippingLabelBrandLayoutProfile {
  sampleLabelSize: LabelSize;
  minReadableScale: number;
  maxLabelsPerPageByPageSize?: Partial<Record<StandardPageSizeId, number>>;
  sortOptions: {
    sku: boolean;
    pickupPartner: boolean;
  };
}

export interface ShippingLabelGridLayout {
  columns: number;
  rows: number;
  capacity: number;
  pageWidth: number;
  pageHeight: number;
  cellWidth: number;
  cellHeight: number;
  pagePadding: number;
  cellGap: number;
  scale: number;
  rotatePage: boolean;
}

const SHIPPING_LABEL_BRAND_LAYOUT_PROFILES: Record<
  ShippingLabelBrand,
  ShippingLabelBrandLayoutProfile
> = {
  meesho: {
    sampleLabelSize: {
      width: 595,
      height: 320,
    },
    minReadableScale: 0.6,
    sortOptions: {
      sku: true,
      pickupPartner: true,
    },
  },
  amazon: {
    sampleLabelSize: {
      width: 288,
      height: 432,
    },
    minReadableScale: 0.22,
    maxLabelsPerPageByPageSize: {
      a4: 4,
    },
    sortOptions: {
      sku: false,
      pickupPartner: false,
    },
  },
  flipkart: {
    sampleLabelSize: {
      width: 595,
      height: 384,
    },
    minReadableScale: 0.7,
    sortOptions: {
      sku: true,
      pickupPartner: false,
    },
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getLayoutSpacing(pageSize: LabelSize) {
  const minDimension = Math.min(pageSize.width, pageSize.height);

  return {
    pagePadding: clamp(
      Math.round(minDimension * 0.022),
      MIN_PAGE_PADDING_POINTS,
      MAX_PAGE_PADDING_POINTS,
    ),
    cellGap: clamp(
      Math.round(minDimension * 0.013),
      MIN_CELL_GAP_POINTS,
      MAX_CELL_GAP_POINTS,
    ),
  };
}

function compareLayouts(
  left: ShippingLabelGridLayout | null,
  right: ShippingLabelGridLayout,
): ShippingLabelGridLayout {
  if (!left) {
    return right;
  }

  if (right.scale !== left.scale) {
    return right.scale > left.scale ? right : left;
  }

  if (right.capacity !== left.capacity) {
    return right.capacity < left.capacity ? right : left;
  }

  const leftShapeGap = Math.abs(left.columns - left.rows);
  const rightShapeGap = Math.abs(right.columns - right.rows);

  if (rightShapeGap !== leftShapeGap) {
    return rightShapeGap < leftShapeGap ? right : left;
  }

  return right.rows < left.rows ? right : left;
}

export function getShippingLabelBrandProfile(brand: ShippingLabelBrand) {
  return SHIPPING_LABEL_BRAND_LAYOUT_PROFILES[brand];
}

export function getShippingLabelSortOptions(brand: ShippingLabelBrand) {
  return getShippingLabelBrandProfile(brand).sortOptions;
}

export function getBestGridLayoutForCount(args: {
  pageSize: LabelSize;
  labelSize: LabelSize;
  count: number;
}): ShippingLabelGridLayout | null {
  const { count, labelSize, pageSize } = args;

  if (
    count < 1 ||
    labelSize.width <= 0 ||
    labelSize.height <= 0 ||
    pageSize.width <= 0 ||
    pageSize.height <= 0
  ) {
    return null;
  }

  let bestLayout: ShippingLabelGridLayout | null = null;

  const pageOrientations = [
    {
      width: pageSize.width,
      height: pageSize.height,
      rotatePage: false,
    },
    {
      width: pageSize.height,
      height: pageSize.width,
      rotatePage: true,
    },
  ];

  for (const orientation of pageOrientations) {
    const { cellGap, pagePadding } = getLayoutSpacing(orientation);

    for (let columns = 1; columns <= count; columns += 1) {
      const rows = Math.ceil(count / columns);
      const usableWidth =
        orientation.width - pagePadding * 2 - cellGap * (columns - 1);
      const usableHeight =
        orientation.height - pagePadding * 2 - cellGap * (rows - 1);

      if (usableWidth <= 0 || usableHeight <= 0) {
        continue;
      }

      const cellWidth = usableWidth / columns;
      const cellHeight = usableHeight / rows;
      const scale = Math.min(
        cellWidth / labelSize.width,
        cellHeight / labelSize.height,
      );

      if (!Number.isFinite(scale) || scale <= 0) {
        continue;
      }

      bestLayout = compareLayouts(bestLayout, {
        columns,
        rows,
        capacity: columns * rows,
        pageWidth: orientation.width,
        pageHeight: orientation.height,
        cellWidth,
        cellHeight,
        pagePadding,
        cellGap,
        scale,
        rotatePage: orientation.rotatePage,
      });
    }
  }

  return bestLayout;
}

export function getSafeMaxLabelsPerPage(args: {
  brand: ShippingLabelBrand;
  pageSizeId: StandardPageSizeId;
  labelSize?: LabelSize;
}): number {
  const { brand, pageSizeId } = args;
  const brandProfile = getShippingLabelBrandProfile(brand);
  const pageSize = getPageSizeDimensionsInPoints(pageSizeId);
  const labelSize = args.labelSize ?? brandProfile.sampleLabelSize;
  const hardMaxLabelsPerPage =
    brandProfile.maxLabelsPerPageByPageSize?.[pageSizeId] ??
    MAX_LABELS_PER_PAGE_SEARCH;

  let maxLabelsPerPage = 1;

  for (let count = 1; count <= hardMaxLabelsPerPage; count += 1) {
    const layout = getBestGridLayoutForCount({
      count,
      labelSize,
      pageSize,
    });

    if (!layout || layout.scale < brandProfile.minReadableScale) {
      break;
    }

    maxLabelsPerPage = count;
  }

  return maxLabelsPerPage;
}

export function getLabelsPerPageOptions(
  brand: ShippingLabelBrand,
  pageSizeId: StandardPageSizeId,
) {
  const maxLabelsPerPage = getSafeMaxLabelsPerPage({
    brand,
    pageSizeId,
  });

  return Array.from({ length: maxLabelsPerPage }, (_, index) => index + 1);
}
