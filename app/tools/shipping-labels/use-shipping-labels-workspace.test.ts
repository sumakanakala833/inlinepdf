import { describe, expect, it } from 'vitest';

import { buildShippingLabelsViewModel } from '~/tools/shipping-labels/use-shipping-labels-workspace';

describe('buildShippingLabelsViewModel', () => {
  it('enables preparation for supported brands with a selected file', () => {
    const viewModel = buildShippingLabelsViewModel({
      brand: 'meesho',
      selectedFile: true,
      isPreparing: false,
      localErrorMessage: null,
      actionErrorMessage: null,
      result: {
        fileName: 'labels.pdf',
        labelsPrepared: 3,
        outputPagesCreated: 1,
        pagesProcessed: 4,
        pagesSkipped: 1,
        skippedPageNumbers: [2],
        elapsedMs: 842,
      },
    });

    expect(viewModel.isBrandAvailable).toBe(true);
    expect(viewModel.showSortingSection).toBe(true);
    expect(viewModel.showPickupPartnerSort).toBe(true);
    expect(viewModel.showSkuSort).toBe(true);
    expect(viewModel.prepareButtonDisabled).toBe(false);
    expect(viewModel.resultSummary?.brandLabel).toBe('Meesho');
    expect(viewModel.resultSummary?.outputPagesCreated).toBe(1);
    expect(viewModel.resultSummary?.skippedPageNumbers).toEqual([2]);
  });

  it('keeps Amazon available, disables sorting, and prefers local errors', () => {
    const viewModel = buildShippingLabelsViewModel({
      brand: 'amazon',
      selectedFile: true,
      isPreparing: false,
      localErrorMessage: 'local',
      actionErrorMessage: 'action',
      result: null,
    });

    expect(viewModel.isBrandAvailable).toBe(true);
    expect(viewModel.showSortingSection).toBe(false);
    expect(viewModel.showPickupPartnerSort).toBe(false);
    expect(viewModel.showSkuSort).toBe(false);
    expect(viewModel.prepareButtonDisabled).toBe(false);
    expect(viewModel.errorMessage).toBe('local');
  });

  it('shows only SKU sorting for Flipkart', () => {
    const viewModel = buildShippingLabelsViewModel({
      brand: 'flipkart',
      selectedFile: true,
      isPreparing: false,
      localErrorMessage: null,
      actionErrorMessage: null,
      result: null,
    });

    expect(viewModel.showSortingSection).toBe(true);
    expect(viewModel.showPickupPartnerSort).toBe(false);
    expect(viewModel.showSkuSort).toBe(true);
  });
});
