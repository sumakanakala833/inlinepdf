import { getFile, getString } from '~/platform/files/read-form-data';
import { saveBlobFile } from '~/platform/files/save-blob-file';
import { createToolRouteModule } from '~/shared/tool-ui/create-tool-route-module';
import type { ToolDefinition } from '~/tools/catalog/definitions';

import type {
  ShippingLabelBrand,
  ShippingLabelPreparationResult,
  ShippingLabelPreparationSummary,
  ShippingLabelOutputPageSize,
  ShippingLabelSortDirection,
} from './models';
import { prepareShippingLabels } from './use-cases/prepare-shipping-labels';

interface ShippingLabelsActionPayload {
  file: File;
  outputPageSize: ShippingLabelOutputPageSize;
  labelsPerPage: number;
  pickupPartnerDirection: ShippingLabelSortDirection | null;
  skuDirection: ShippingLabelSortDirection | null;
}

interface ShippingLabelActionInput {
  file: File | null;
  outputPageSize: string | null;
  labelsPerPage: string | null;
  pickupPartnerDirection: string | null;
  skuDirection: string | null;
}

export function createShippingLabelRouteModule(
  toolDefinition: ToolDefinition,
  brand: ShippingLabelBrand,
) {
  return createToolRouteModule<
    ShippingLabelsActionPayload,
    ShippingLabelActionInput,
    ShippingLabelPreparationResult,
    ShippingLabelPreparationSummary
  >({
    definition: toolDefinition,
    errorMessage: 'Unable to prepare label pages.',
    parseInput({ formData, fallbackPayload }) {
      const file = getFile(formData, 'file') ?? fallbackPayload?.file;
      return {
        file: file ?? null,
        outputPageSize:
          getString(formData, 'outputPageSize') ??
          fallbackPayload?.outputPageSize ??
          null,
        labelsPerPage:
          getString(formData, 'labelsPerPage') ??
          (typeof fallbackPayload?.labelsPerPage === 'number'
            ? String(fallbackPayload.labelsPerPage)
            : null) ??
          null,
        pickupPartnerDirection:
          getString(formData, 'pickupPartnerDirection') ??
          fallbackPayload?.pickupPartnerDirection ??
          null,
        skuDirection:
          getString(formData, 'skuDirection') ??
          fallbackPayload?.skuDirection ??
          null,
      };
    },
    execute(input) {
      return prepareShippingLabels({
        file: input.file,
        brand,
        outputPageSize: input.outputPageSize,
        labelsPerPage: input.labelsPerPage,
        pickupPartnerDirection: input.pickupPartnerDirection,
        skuDirection: input.skuDirection,
      });
    },
    onSuccess(result) {
      saveBlobFile(result.blob, result.fileName);
    },
    getSuccessMessage(result) {
      return `Prepared ${String(result.labelsPrepared)} label${result.labelsPrepared === 1 ? '' : 's'} on ${String(result.outputPagesCreated)} page${result.outputPagesCreated === 1 ? '' : 's'}.`;
    },
    mapSuccessResult(result) {
      return {
        pagesProcessed: result.pagesProcessed,
        labelsPrepared: result.labelsPrepared,
        outputPagesCreated: result.outputPagesCreated,
        pagesSkipped: result.pagesSkipped,
        skippedPageNumbers: result.skippedPageNumbers,
        elapsedMs: result.elapsedMs,
        fileName: result.fileName,
      };
    },
  });
}
