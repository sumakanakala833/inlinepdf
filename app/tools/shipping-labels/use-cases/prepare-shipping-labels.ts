import { PDFDocument } from 'pdf-lib';

import {
  getPageSizeDimensionsInPoints,
  isPageSizeSelectId,
} from '~/platform/pdf/page-size-options';
import { validatePdfFile } from '~/platform/files/security/file-validation';
import {
  cleanupPdfJsPage,
  openPdfJsDocument,
} from '~/platform/pdf/pdfjs-session';
import { normalizedRectToPdfBoundingBox } from '~/tools/crop/domain/coordinate-math';

import {
  getBestGridLayoutForCount,
  getShippingLabelBrandProfile,
  getShippingLabelSortOptions,
  getSafeMaxLabelsPerPage,
} from '../layout';
import {
  SHIPPING_LABEL_BRANDS,
  SHIPPING_LABEL_SORT_DIRECTIONS,
  type ShippingLabelBrand,
  type ShippingLabelPreparationResult,
  type ShippingLabelOutputPageSize,
  type ShippingLabelSortDirection,
  type ShippingLabelSortOptions,
} from '../models';

const TAX_INVOICE_ANCHOR = 'TAX INVOICE';
const TAX_INVOICE_TOP_OFFSET = 3;
const AUTO_PAGE_BOTTOM_PADDING = 12;
const SKU_CONTENT_MAX_VERTICAL_DISTANCE = 60;
const FLIPKART_PDF_ANCHOR = 'E-KART LOGISTICS';
const FLIPKART_SKU_HEADER = 'SKU ID | DESCRIPTION';
const FLIPKART_LABEL_HEIGHT_RATIO = 0.44;
const FLIPKART_TOP_TRIM_POINTS = 10;
const FLIPKART_SKU_CONTENT_MAX_VERTICAL_DISTANCE = 24;
const PICKUP_PARTNER_MAX_VERTICAL_DISTANCE = 40;
const PICKUP_PARTNER_MAX_HORIZONTAL_DISTANCE = 120;
const PICKUP_PARTNER_LEFT_SIDE_VERTICAL_TOLERANCE = 8;

interface TextContentItemLike {
  str?: string;
  height?: number;
  transform?: number[];
}

interface MeeshoAnchorMatch {
  top: number;
}

interface AmazonValidationResult {
  isAmazonPdf: boolean;
}

interface FlipkartValidationResult {
  isFlipkartPdf: boolean;
}

interface PreparedLabelPage {
  pageNumber: number;
  boundingBox: {
    left: number;
    right: number;
    bottom: number;
    top: number;
  };
  width: number;
  height: number;
  sku: string | null;
  pickupPartner: string | null;
}

function createOutputFileName(
  originalName: string,
  brand: ShippingLabelBrand,
): string {
  const baseName = originalName.replace(/\.pdf$/i, '') || 'document';
  const stamp = new Date().toISOString().slice(0, 10);
  return `${baseName}-${brand}-labels-${stamp}.pdf`;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function readPdfPoint(point: unknown): [number, number] {
  if (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === 'number' &&
    typeof point[1] === 'number'
  ) {
    return [point[0], point[1]];
  }

  throw new Error('Unable to map shipping label crop coordinates.');
}

function isTextContentItemLike(value: unknown): value is TextContentItemLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as TextContentItemLike;
  return (
    typeof candidate.str === 'string' && Array.isArray(candidate.transform)
  );
}

function getItemHeight(item: TextContentItemLike): number {
  const transformHeight =
    Array.isArray(item.transform) && typeof item.transform[3] === 'number'
      ? Math.abs(item.transform[3])
      : 0;
  const declaredHeight = typeof item.height === 'number' ? item.height : 0;
  return Math.max(transformHeight, declaredHeight, 0);
}

function findMeeshoAnchor(items: unknown[]): MeeshoAnchorMatch | null {
  let bestMatch: MeeshoAnchorMatch | null = null;

  for (const item of items) {
    if (!isTextContentItemLike(item) || !item.transform) {
      continue;
    }

    if (!normalizeText(item.str ?? '').includes(TAX_INVOICE_ANCHOR)) {
      continue;
    }

    const y = item.transform[5];
    if (typeof y !== 'number') {
      continue;
    }

    const top = y + getItemHeight(item);
    if (!Number.isFinite(top)) {
      continue;
    }

    if (!bestMatch || top > bestMatch.top) {
      bestMatch = { top };
    }
  }

  return bestMatch;
}

function validateAmazonPage(items: unknown[]): AmazonValidationResult {
  const isAmazonPdf = items.some((item) => {
    if (!isTextContentItemLike(item)) {
      return false;
    }

    return normalizeText(item.str ?? '').includes('AMAZON');
  });

  return { isAmazonPdf };
}

function validateFlipkartPage(items: unknown[]): FlipkartValidationResult {
  const isFlipkartPdf = items.some((item) => {
    if (!isTextContentItemLike(item)) {
      return false;
    }

    return normalizeText(item.str ?? '').includes(FLIPKART_PDF_ANCHOR);
  });

  return { isFlipkartPdf };
}

function isShippingLabelBrand(
  value: string | null | undefined,
): value is ShippingLabelBrand {
  return SHIPPING_LABEL_BRANDS.includes(value as ShippingLabelBrand);
}

export function isShippingLabelOutputPageSize(
  value: string | null | undefined,
): value is ShippingLabelOutputPageSize {
  return typeof value === 'string' && isPageSizeSelectId(value);
}

export function isShippingLabelSortDirection(
  value: string | null | undefined,
): value is ShippingLabelSortDirection {
  return SHIPPING_LABEL_SORT_DIRECTIONS.includes(
    value as ShippingLabelSortDirection,
  );
}

export { isShippingLabelBrand };

function parseLabelsPerPage(value: string | null | undefined): number {
  if (!value) {
    return 1;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    throw new Error('Choose a valid labels-per-page value.');
  }

  return parsedValue;
}

interface PrepareShippingLabelsInput {
  file: File | null;
  brand: ShippingLabelBrand;
  outputPageSize: string | null | undefined;
  labelsPerPage: string | null | undefined;
  pickupPartnerDirection: string | null | undefined;
  skuDirection: string | null | undefined;
}

export async function prepareShippingLabels({
  file,
  brand,
  outputPageSize,
  labelsPerPage,
  pickupPartnerDirection,
  skuDirection,
}: PrepareShippingLabelsInput): Promise<ShippingLabelPreparationResult> {
  if (!file) {
    throw new Error('Select a PDF file before preparing label pages.');
  }

  if (!isShippingLabelOutputPageSize(outputPageSize)) {
    throw new Error('Select an output page size.');
  }

  const sortOptions = getShippingLabelSortOptions(brand);

  return prepareShippingLabelPdf(file, {
    brand,
    outputPageSize,
    labelsPerPage: parseLabelsPerPage(labelsPerPage),
    sort: {
      pickupPartnerDirection:
        sortOptions.pickupPartner &&
        isShippingLabelSortDirection(pickupPartnerDirection)
          ? pickupPartnerDirection
          : null,
      skuDirection:
        sortOptions.sku && isShippingLabelSortDirection(skuDirection)
          ? skuDirection
          : null,
    },
  });
}

function getItemPosition(
  item: TextContentItemLike,
): { x: number; y: number } | null {
  if (!Array.isArray(item.transform)) {
    return null;
  }

  const [, , , , x, y] = item.transform;
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : null;
}

function findTopMostExactText(
  items: unknown[],
  text: string,
): (TextContentItemLike & { transform: number[] }) | null {
  let bestMatch: (TextContentItemLike & { transform: number[] }) | null = null;

  for (const item of items) {
    if (!isTextContentItemLike(item) || !item.transform) {
      continue;
    }

    if (normalizeText(item.str ?? '') !== text) {
      continue;
    }

    const position = getItemPosition(item);
    if (!position) {
      continue;
    }

    if (
      !bestMatch ||
      position.y > (bestMatch.transform[5] ?? Number.NEGATIVE_INFINITY)
    ) {
      bestMatch = item as TextContentItemLike & { transform: number[] };
    }
  }

  return bestMatch;
}

function collectRowsWithinBounds(args: {
  items: unknown[];
  topY: number;
  bottomY: number;
  minX?: number;
  maxX?: number;
}): { y: number; texts: string[] }[] {
  const contentItems = args.items
    .filter((item): item is TextContentItemLike & { transform: number[] } => {
      if (!isTextContentItemLike(item) || !item.transform) {
        return false;
      }

      const rawText = normalizeWhitespace(item.str ?? '');
      if (rawText.length === 0) {
        return false;
      }

      const position = getItemPosition(item);
      if (!position) {
        return false;
      }

      if (position.y > args.topY || position.y < args.bottomY) {
        return false;
      }

      if (typeof args.minX === 'number' && position.x < args.minX) {
        return false;
      }

      if (typeof args.maxX === 'number' && position.x >= args.maxX) {
        return false;
      }

      return true;
    })
    .map((item) => {
      const position = getItemPosition(item);
      return position
        ? {
            text: normalizeWhitespace(item.str ?? ''),
            position,
          }
        : null;
    })
    .filter(
      (item): item is { text: string; position: { x: number; y: number } } =>
        item !== null,
    )
    .sort((a, b) => b.position.y - a.position.y || a.position.x - b.position.x);

  const rowGroups: { y: number; texts: string[] }[] = [];

  for (const item of contentItems) {
    const currentGroup = rowGroups.at(-1);

    if (!currentGroup || Math.abs(currentGroup.y - item.position.y) > 3) {
      rowGroups.push({ y: item.position.y, texts: [item.text] });
      continue;
    }

    currentGroup.texts.push(item.text);
  }

  return rowGroups;
}

function readSku(items: unknown[]): string | null {
  const skuHeader = findTopMostExactText(items, 'SKU');
  if (!skuHeader) {
    return null;
  }

  const skuHeaderPosition = getItemPosition(skuHeader);
  if (!skuHeaderPosition) {
    return null;
  }

  const sizeHeader = items.find((item) => {
    if (!isTextContentItemLike(item) || !item.transform) {
      return false;
    }

    if (normalizeText(item.str ?? '') !== 'SIZE') {
      return false;
    }

    const position = getItemPosition(item);
    return (
      !!position &&
      Math.abs(position.y - skuHeaderPosition.y) < 4 &&
      position.x > skuHeaderPosition.x
    );
  }) as (TextContentItemLike & { transform: number[] }) | undefined;

  const sizeHeaderPosition = sizeHeader ? getItemPosition(sizeHeader) : null;
  const maxX = sizeHeaderPosition
    ? sizeHeaderPosition.x - 4
    : Number.POSITIVE_INFINITY;
  const rowGroups = collectRowsWithinBounds({
    items,
    minX: skuHeaderPosition.x - 1,
    maxX,
    topY: skuHeaderPosition.y - 1,
    bottomY: skuHeaderPosition.y - SKU_CONTENT_MAX_VERTICAL_DISTANCE,
  });

  if (rowGroups.length === 0) {
    return null;
  }

  const value = rowGroups
    .map((group) => group.texts.join(' '))
    .join(' ')
    .trim();

  return value.length > 0 ? value : null;
}

function readFlipkartSku(items: unknown[]): string | null {
  const skuHeader = findTopMostExactText(items, FLIPKART_SKU_HEADER);
  if (!skuHeader) {
    return null;
  }

  const skuHeaderPosition = getItemPosition(skuHeader);
  if (!skuHeaderPosition) {
    return null;
  }

  const rowGroups = collectRowsWithinBounds({
    items,
    topY: skuHeaderPosition.y - 1,
    bottomY: skuHeaderPosition.y - FLIPKART_SKU_CONTENT_MAX_VERTICAL_DISTANCE,
  });

  const value = rowGroups.at(0)?.texts.join(' ').trim();
  if (!value) {
    return null;
  }

  const [rawSku] = value.split('|');
  const sku = rawSku.replace(/^\d+\s+/, '').trim();
  return sku && sku.length > 0 ? sku : null;
}

function readPickupPartner(items: unknown[]): string | null {
  const pickup = findTopMostExactText(items, 'PICKUP');
  if (!pickup) {
    return null;
  }

  const pickupPosition = getItemPosition(pickup);
  if (!pickupPosition) {
    return null;
  }

  const candidates = items
    .filter((item): item is TextContentItemLike & { transform: number[] } => {
      if (!isTextContentItemLike(item) || !item.transform) {
        return false;
      }

      const rawText = normalizeWhitespace(item.str ?? '');
      if (rawText.length === 0) {
        return false;
      }

      const normalized = normalizeText(rawText);
      if (normalized === 'PICKUP' || normalized.includes('PICKUP ADDRESS')) {
        return false;
      }

      const position = getItemPosition(item);
      if (!position) {
        return false;
      }

      return (
        position.x <= pickupPosition.x &&
        pickupPosition.x - position.x <=
          PICKUP_PARTNER_MAX_HORIZONTAL_DISTANCE &&
        ((position.y >= pickupPosition.y &&
          position.y <=
            pickupPosition.y + PICKUP_PARTNER_MAX_VERTICAL_DISTANCE) ||
          Math.abs(position.y - pickupPosition.y) <=
            PICKUP_PARTNER_LEFT_SIDE_VERTICAL_TOLERANCE)
      );
    })
    .map((item) => {
      const position = getItemPosition(item);
      return position
        ? {
            text: normalizeWhitespace(item.str ?? ''),
            position,
          }
        : null;
    })
    .filter(
      (item): item is { text: string; position: { x: number; y: number } } =>
        item !== null,
    )
    .sort((a, b) => {
      const aSameRow =
        Math.abs(a.position.y - pickupPosition.y) <=
        PICKUP_PARTNER_LEFT_SIDE_VERTICAL_TOLERANCE;
      const bSameRow =
        Math.abs(b.position.y - pickupPosition.y) <=
        PICKUP_PARTNER_LEFT_SIDE_VERTICAL_TOLERANCE;

      if (aSameRow !== bSameRow) {
        return aSameRow ? -1 : 1;
      }

      const aVerticalGap = a.position.y - pickupPosition.y;
      const bVerticalGap = b.position.y - pickupPosition.y;

      if (aVerticalGap !== bVerticalGap) {
        return aSameRow
          ? Math.abs(aVerticalGap) - Math.abs(bVerticalGap)
          : aVerticalGap - bVerticalGap;
      }

      return (
        pickupPosition.x - a.position.x - (pickupPosition.x - b.position.x)
      );
    });

  return candidates[0]?.text ?? null;
}

function createFullPagePreparedLabel(args: {
  pageNumber: number;
  width: number;
  height: number;
}): PreparedLabelPage {
  return {
    pageNumber: args.pageNumber,
    boundingBox: {
      left: 0,
      right: args.width,
      bottom: 0,
      top: args.height,
    },
    width: args.width,
    height: args.height,
    sku: null,
    pickupPartner: null,
  };
}

function getLargestLabelSize(labels: PreparedLabelPage[]) {
  return labels.reduce(
    (largest, label) => ({
      width: Math.max(largest.width, label.width),
      height: Math.max(largest.height, label.height),
    }),
    {
      width: 0,
      height: 0,
    },
  );
}

function compareNullableText(
  left: string | null,
  right: string | null,
  direction: ShippingLabelSortDirection,
): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  const comparison = left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });

  return direction === 'asc' ? comparison : -comparison;
}

function sortPreparedLabelPages(
  labels: PreparedLabelPage[],
  sort: ShippingLabelSortOptions,
): PreparedLabelPage[] {
  return [...labels].sort((left, right) => {
    if (sort.pickupPartnerDirection) {
      const pickupComparison = compareNullableText(
        left.pickupPartner,
        right.pickupPartner,
        sort.pickupPartnerDirection,
      );
      if (pickupComparison !== 0) {
        return pickupComparison;
      }
    }

    if (sort.skuDirection) {
      const skuComparison = compareNullableText(
        left.sku,
        right.sku,
        sort.skuDirection,
      );
      if (skuComparison !== 0) {
        return skuComparison;
      }
    }

    return left.pageNumber - right.pageNumber;
  });
}

interface PrepareShippingLabelPdfOptions {
  brand: ShippingLabelBrand;
  outputPageSize: ShippingLabelOutputPageSize;
  labelsPerPage?: number;
  sort?: Partial<ShippingLabelSortOptions>;
}

export async function prepareShippingLabelPdf(
  file: File,
  options: PrepareShippingLabelPdfOptions,
): Promise<ShippingLabelPreparationResult> {
  const startedAt = performance.now();
  await validatePdfFile(file);
  const sortOptions: ShippingLabelSortOptions = {
    pickupPartnerDirection: options.sort?.pickupPartnerDirection ?? null,
    skuDirection: options.sort?.skuDirection ?? null,
  };
  const labelsPerPage = Math.max(1, Math.trunc(options.labelsPerPage ?? 1));

  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const outputDocument = await PDFDocument.create();
  const [sourceDocument, previewSession] = await Promise.all([
    PDFDocument.load(sourceBytes),
    openPdfJsDocument(sourceBytes),
  ]);
  const previewDocument = previewSession.document;

  let pagesProcessed = 0;
  let pagesSkipped = 0;
  const skippedPageNumbers: number[] = [];
  const preparedLabels: PreparedLabelPage[] = [];

  try {
    pagesProcessed = previewDocument.numPages;

    for (
      let pageNumber = 1;
      pageNumber <= previewDocument.numPages;
      pageNumber += 1
    ) {
      const previewPage = await previewDocument.getPage(pageNumber);
      try {
        const textContent = await previewPage.getTextContent();
        const viewport = previewPage.getViewport({ scale: 1 });
        if (options.brand === 'amazon') {
          if (pageNumber === 2) {
            const validation = validateAmazonPage(textContent.items);

            if (!validation.isAmazonPdf) {
              throw new Error(
                'This file does not appear to be a supported Amazon label PDF.',
              );
            }
          }

          if (pageNumber % 2 === 0) {
            pagesSkipped += 1;
            skippedPageNumbers.push(pageNumber);
            continue;
          }

          preparedLabels.push(
            createFullPagePreparedLabel({
              pageNumber,
              width: viewport.width,
              height: viewport.height,
            }),
          );
          continue;
        }

        if (options.brand === 'meesho') {
          const anchor = findMeeshoAnchor(textContent.items);

          if (!anchor) {
            pagesSkipped += 1;
            skippedPageNumbers.push(pageNumber);
            continue;
          }

          const cutLine = Math.min(
            Math.max(anchor.top + TAX_INVOICE_TOP_OFFSET, 0),
            viewport.height,
          );
          const cropHeight = viewport.height - cutLine;

          if (cropHeight <= 0) {
            pagesSkipped += 1;
            skippedPageNumbers.push(pageNumber);
            continue;
          }

          const boundingBox = normalizedRectToPdfBoundingBox(
            {
              x: 0,
              y: 0,
              width: 1,
              height: cropHeight / viewport.height,
            },
            {
              width: viewport.width,
              height: viewport.height,
              viewBox: viewport.viewBox,
              convertToPdfPoint: (x, y) =>
                readPdfPoint(viewport.convertToPdfPoint(x, y)),
            },
          );
          const width = boundingBox.right - boundingBox.left;
          const height = boundingBox.top - boundingBox.bottom;
          preparedLabels.push({
            pageNumber,
            boundingBox,
            width,
            height,
            sku: readSku(textContent.items),
            pickupPartner: readPickupPartner(textContent.items),
          });
          continue;
        }
        if (pageNumber === 1) {
          const validation = validateFlipkartPage(textContent.items);

          if (!validation.isFlipkartPdf) {
            throw new Error(
              'This file does not appear to be a supported Flipkart label PDF.',
            );
          }
        }

        const cropTop = Math.min(
          Math.max(FLIPKART_TOP_TRIM_POINTS, 0),
          viewport.height,
        );
        const cropHeight = Math.min(
          Math.max(viewport.height * FLIPKART_LABEL_HEIGHT_RATIO, 0),
          viewport.height - cropTop,
        );

        if (cropHeight <= 0) {
          pagesSkipped += 1;
          skippedPageNumbers.push(pageNumber);
          continue;
        }

        const boundingBox = normalizedRectToPdfBoundingBox(
          {
            x: 0,
            y: cropTop / viewport.height,
            width: 1,
            height: cropHeight / viewport.height,
          },
          {
            width: viewport.width,
            height: viewport.height,
            viewBox: viewport.viewBox,
            convertToPdfPoint: (x, y) =>
              readPdfPoint(viewport.convertToPdfPoint(x, y)),
          },
        );
        const width = boundingBox.right - boundingBox.left;
        const height = boundingBox.top - boundingBox.bottom;
        preparedLabels.push({
          pageNumber,
          boundingBox,
          width,
          height,
          sku: readFlipkartSku(textContent.items),
          pickupPartner: null,
        });
        continue;
      } finally {
        cleanupPdfJsPage(previewPage);
      }
    }
  } finally {
    await previewSession.destroy();
  }

  if (preparedLabels.length === 0) {
    throw new Error(
      `No ${options.brand.slice(0, 1).toUpperCase()}${options.brand.slice(1)} label pages were found in this PDF.`,
    );
  }

  const sortedLabels = sortPreparedLabelPages(preparedLabels, sortOptions);

  if (options.outputPageSize === 'auto') {
    for (const label of sortedLabels) {
      const sourcePage = sourceDocument.getPage(label.pageNumber - 1);
      const embeddedPage = await outputDocument.embedPage(
        sourcePage,
        label.boundingBox,
      );
      const page = outputDocument.addPage([
        label.width,
        label.height + AUTO_PAGE_BOTTOM_PADDING,
      ]);
      page.drawPage(embeddedPage, {
        x: 0,
        y: AUTO_PAGE_BOTTOM_PADDING,
        width: label.width,
        height: label.height,
      });
    }
  } else {
    const pageSize = getPageSizeDimensionsInPoints(options.outputPageSize);
    const brandProfile = getShippingLabelBrandProfile(options.brand);
    const largestLabelSize = getLargestLabelSize(sortedLabels);
    const layoutLabelSize = {
      width: Math.max(
        largestLabelSize.width,
        brandProfile.sampleLabelSize.width,
      ),
      height: Math.max(
        largestLabelSize.height,
        brandProfile.sampleLabelSize.height,
      ),
    };
    const maxLabelsPerPage = getSafeMaxLabelsPerPage({
      brand: options.brand,
      pageSizeId: options.outputPageSize,
      labelSize: layoutLabelSize,
    });

    if (labelsPerPage > maxLabelsPerPage) {
      throw new Error(
        `Choose ${String(maxLabelsPerPage)} or fewer labels per ${options.outputPageSize.toUpperCase()} page for ${options.brand.slice(0, 1).toUpperCase()}${options.brand.slice(1)} labels.`,
      );
    }

    const layout = getBestGridLayoutForCount({
      count: labelsPerPage,
      labelSize: layoutLabelSize,
      pageSize,
    });

    if (!layout) {
      throw new Error('Unable to fit labels on the selected paper size.');
    }

    for (
      let startIndex = 0;
      startIndex < sortedLabels.length;
      startIndex += labelsPerPage
    ) {
      const outputPage = outputDocument.addPage([
        layout.pageWidth,
        layout.pageHeight,
      ]);
      const labelGroup = sortedLabels.slice(
        startIndex,
        startIndex + labelsPerPage,
      );

      for (const [index, label] of labelGroup.entries()) {
        const sourcePage = sourceDocument.getPage(label.pageNumber - 1);
        const embeddedPage = await outputDocument.embedPage(
          sourcePage,
          label.boundingBox,
        );
        const column = index % layout.columns;
        const row = Math.floor(index / layout.columns);
        const cellX =
          layout.pagePadding + column * (layout.cellWidth + layout.cellGap);
        const cellTop =
          layout.pageHeight -
          layout.pagePadding -
          row * (layout.cellHeight + layout.cellGap);
        const scale = Math.min(
          layout.cellWidth / label.width,
          layout.cellHeight / label.height,
        );
        const scaledWidth = label.width * scale;
        const scaledHeight = label.height * scale;

        outputPage.drawPage(embeddedPage, {
          x: cellX + (layout.cellWidth - scaledWidth) / 2,
          y:
            cellTop -
            layout.cellHeight +
            (layout.cellHeight - scaledHeight) / 2,
          width: scaledWidth,
          height: scaledHeight,
        });
      }
    }
  }

  const outputBytes = await outputDocument.save();
  const normalizedOutputBytes = new Uint8Array(outputBytes.byteLength);
  normalizedOutputBytes.set(outputBytes);
  const outputPagesCreated =
    options.outputPageSize === 'auto'
      ? sortedLabels.length
      : Math.ceil(sortedLabels.length / labelsPerPage);

  return {
    blob: new Blob([normalizedOutputBytes.buffer], { type: 'application/pdf' }),
    fileName: createOutputFileName(file.name, options.brand),
    pagesProcessed,
    labelsPrepared: sortedLabels.length,
    outputPagesCreated,
    pagesSkipped,
    skippedPageNumbers,
    elapsedMs: Math.max(1, Math.round(performance.now() - startedAt)),
  };
}
