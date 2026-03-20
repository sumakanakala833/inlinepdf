import { useState } from 'react';

import type {
  ShippingLabelBrand,
  ShippingLabelOutputPageSize,
  ShippingLabelSortDirection,
} from './models';
import { getLabelsPerPageOptions, getShippingLabelSortOptions } from './layout';
import { useSinglePdfActionWorkspace } from '~/shared/tool-ui/use-single-pdf-action-workspace';
import { submitClientAction } from '~/shared/tool-ui/submit-client-action';

const BRAND_LABELS: Record<ShippingLabelBrand, string> = {
  meesho: 'Meesho',
  amazon: 'Amazon',
  flipkart: 'Flipkart',
};

export function buildShippingLabelsViewModel(args: {
  brand: ShippingLabelBrand;
  selectedFile: boolean;
  isPreparing: boolean;
  localErrorMessage: string | null;
  actionErrorMessage: string | null;
  result: {
    pagesProcessed: number;
    labelsPrepared: number;
    outputPagesCreated: number;
    pagesSkipped: number;
    skippedPageNumbers: number[];
    elapsedMs: number;
    fileName: string;
  } | null;
}) {
  const {
    brand,
    selectedFile,
    isPreparing,
    localErrorMessage,
    actionErrorMessage,
    result,
  } = args;
  const isBrandAvailable = true;
  const sortOptions = getShippingLabelSortOptions(brand);
  const hasVisibleSortOptions = sortOptions.pickupPartner || sortOptions.sku;

  return {
    errorMessage: localErrorMessage ?? actionErrorMessage,
    helperText: isPreparing
      ? 'Scanning pages and preparing label pages...'
      : undefined,
    isBrandAvailable,
    prepareButtonDisabled: !selectedFile || isPreparing,
    prepareButtonLabel: isPreparing ? 'Preparing...' : 'Prepare Labels',
    showPickupPartnerSort: sortOptions.pickupPartner,
    showSkuSort: sortOptions.sku,
    showSortingSection: hasVisibleSortOptions,
    resultSummary: result
      ? {
          brandLabel: BRAND_LABELS[brand],
          fileName: result.fileName,
          labelsPrepared: result.labelsPrepared,
          outputPagesCreated: result.outputPagesCreated,
          pagesProcessed: result.pagesProcessed,
          pagesSkipped: result.pagesSkipped,
          skippedPageNumbers: result.skippedPageNumbers,
          elapsedMs: result.elapsedMs,
        }
      : null,
  };
}

export function useShippingLabelsWorkspace(brand: ShippingLabelBrand) {
  const workspace = useSinglePdfActionWorkspace<{
    pagesProcessed: number;
    labelsPrepared: number;
    outputPagesCreated: number;
    pagesSkipped: number;
    skippedPageNumbers: number[];
    elapsedMs: number;
    fileName: string;
  }>();
  const [lastPreparedFileEntryId, setLastPreparedFileEntryId] = useState<
    string | null
  >(null);
  const [outputPageSize, setOutputPageSize] =
    useState<ShippingLabelOutputPageSize>('auto');
  const [pickupPartnerDirection, setPickupPartnerDirection] =
    useState<ShippingLabelSortDirection | null>(null);
  const [skuDirection, setSkuDirection] =
    useState<ShippingLabelSortDirection | null>(null);
  const [labelsPerPage, setLabelsPerPage] = useState(1);
  const viewModel = buildShippingLabelsViewModel({
    brand,
    selectedFile: !!workspace.selectedFileEntry,
    isPreparing: workspace.isBusy,
    localErrorMessage: workspace.localErrorMessage,
    actionErrorMessage: workspace.actionErrorMessage,
    result:
      workspace.selectedFileEntry?.id === lastPreparedFileEntryId
        ? workspace.result
        : null,
  });
  const labelsPerPageOptions =
    outputPageSize === 'auto'
      ? [1]
      : getLabelsPerPageOptions(brand, outputPageSize);

  function handleOutputPageSizeChange(
    nextPageSize: ShippingLabelOutputPageSize,
  ) {
    setOutputPageSize(nextPageSize);

    if (nextPageSize === 'auto') {
      setLabelsPerPage(1);
      return;
    }

    const nextMaxLabelsPerPage =
      getLabelsPerPageOptions(brand, nextPageSize).at(-1) ?? 1;
    setLabelsPerPage((current) =>
      Math.min(Math.max(current, 1), nextMaxLabelsPerPage),
    );
  }

  function handleLabelsPerPageChange(nextLabelsPerPage: number) {
    const maxLabelsPerPage = labelsPerPageOptions.at(-1) ?? 1;
    setLabelsPerPage(
      Math.min(Math.max(nextLabelsPerPage, 1), maxLabelsPerPage),
    );
  }

  function handlePrepare() {
    if (!workspace.selectedFileEntry) {
      workspace.setLocalErrorMessage(
        'Select a PDF file before preparing label pages.',
      );
      return;
    }

    const selectedFileEntry = workspace.selectedFileEntry;

    workspace.setLocalErrorMessage(null);
    workspace.beginActionForFileEntry(selectedFileEntry.id);
    setLastPreparedFileEntryId(selectedFileEntry.id);
    submitClientAction({
      fetcher: workspace.fetcher,
      payload: {
        file: selectedFileEntry.file,
        outputPageSize,
        labelsPerPage,
        pickupPartnerDirection,
        skuDirection,
      },
      writeFormData(formData) {
        formData.set('file', selectedFileEntry.file);
        formData.set('outputPageSize', outputPageSize);
        formData.set('labelsPerPage', String(labelsPerPage));
        if (pickupPartnerDirection) {
          formData.set('pickupPartnerDirection', pickupPartnerDirection);
        }
        if (skuDirection) {
          formData.set('skuDirection', skuDirection);
        }
      },
    });
  }

  function handleFileSelection(file: File) {
    setLastPreparedFileEntryId(null);
    workspace.handleFileSelection(file);
  }

  function handleClearSelection() {
    setLastPreparedFileEntryId(null);
    workspace.handleClearSelection();
  }

  return {
    ...viewModel,
    handleClearSelection,
    handlePrepare,
    handleFileSelection,
    isPreparing: workspace.isBusy,
    labelsPerPage,
    labelsPerPageOptions,
    outputPageSize,
    pickupPartnerDirection,
    selectedFileEntry: workspace.selectedFileEntry,
    setLabelsPerPage: handleLabelsPerPageChange,
    setOutputPageSize: handleOutputPageSizeChange,
    setPickupPartnerDirection,
    setSkuDirection,
    skuDirection,
    successMessage: workspace.successMessage,
    showPickupPartnerSort: viewModel.showPickupPartnerSort,
    showSkuSort: viewModel.showSkuSort,
    showSortingSection: viewModel.showSortingSection,
  };
}
