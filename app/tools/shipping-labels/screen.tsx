import AlertCircleIcon from '@hugeicons/core-free-icons/AlertCircleIcon';
import { HugeiconsIcon } from '@hugeicons/react';
import type { ComponentProps } from 'react';

import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '~/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { SHIPPING_LABEL_PAGE_SIZE_IDS } from '~/platform/pdf/page-size-options';
import { PageSizeSelectLabel } from '~/shared/tool-ui/page-size-option-label';
import { SinglePdfToolWorkspace } from '~/shared/tool-ui/single-pdf-tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';
import { useShippingLabelsWorkspace } from '~/tools/shipping-labels/use-shipping-labels-workspace';

import type { ShippingLabelBrand, ShippingLabelOutputPageSize } from './models';

const BRAND_LABELS: Record<ShippingLabelBrand, string> = {
  meesho: 'Meesho',
  amazon: 'Amazon',
  flipkart: 'Flipkart',
};

const OUTPUT_PAGE_SIZE_DESCRIPTIONS: Record<
  ShippingLabelOutputPageSize,
  string
> = {
  auto: 'Use the detected label size with no resizing.',
  a3: 'Scale each label page to fit on an A3 sheet.',
  a4: 'Scale each label page to fit on an A4 sheet.',
  a5: 'Scale each label page to fit on an A5 sheet.',
  b5: 'Scale each label page to fit on a B5 sheet.',
  envelope10: 'Scale each label page to fit on an Envelope #10 sheet.',
  envelopeChoukei3:
    'Scale each label page to fit on an Envelope Choukei 3 sheet.',
  envelopeDl: 'Scale each label page to fit on an Envelope DL sheet.',
  jisB5: 'Scale each label page to fit on a JIS B5 sheet.',
  roc16k: 'Scale each label page to fit on a ROC 16K sheet.',
  superBA3: 'Scale each label page to fit on a Super B/A3 sheet.',
  tabloid: 'Scale each label page to fit on a Tabloid sheet.',
  tabloidOversize: 'Scale each label page to fit on a Tabloid Oversize sheet.',
  legal: 'Scale each label page to fit on a US Legal sheet.',
  letter: 'Scale each label page to fit on a US Letter sheet.',
};

const OUTPUT_PAGE_SIZE_OPTIONS: {
  value: ShippingLabelOutputPageSize;
  description: string;
}[] = SHIPPING_LABEL_PAGE_SIZE_IDS.map((value) => ({
  value,
  description: OUTPUT_PAGE_SIZE_DESCRIPTIONS[value],
}));

const outputPageSizeInputId = 'shipping-label-output-page-size';
const pickupPartnerSortInputId = 'shipping-label-sort-pickup-partner';
const skuSortInputId = 'shipping-label-sort-sku';
const labelsPerPageInputId = 'shipping-label-labels-per-page';

function renderOutputPageSizeLabel(value: ShippingLabelOutputPageSize) {
  return <PageSizeSelectLabel value={value} />;
}

function formatDuration(elapsedMs: number) {
  if (elapsedMs < 1000) {
    return `${String(elapsedMs)} ms`;
  }

  const seconds = elapsedMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${String(minutes)}m ${String(remainingSeconds)}s`;
}

function formatPageList(pageNumbers: number[]) {
  if (pageNumbers.length === 0) {
    return 'None';
  }

  return pageNumbers.join(', ');
}

interface ShippingLabelsToolScreenProps {
  brand: ShippingLabelBrand;
  title: string;
  description: string;
  titleIcon?: ComponentProps<typeof SinglePdfToolWorkspace>['titleIcon'];
}

export function ShippingLabelsToolScreen({
  brand,
  title,
  description,
  titleIcon,
}: ShippingLabelsToolScreenProps) {
  const workspace = useShippingLabelsWorkspace(brand);
  const selectedOutputPageSizeOption = OUTPUT_PAGE_SIZE_OPTIONS.find(
    (option) => option.value === workspace.outputPageSize,
  );
  const selectedLabelsPerPage = workspace.labelsPerPageOptions.find(
    (option) => option === workspace.labelsPerPage,
  );

  useSuccessToast(workspace.successMessage);

  return (
    <SinglePdfToolWorkspace
      title={title}
      description={description}
      titleIcon={titleIcon}
      selectorAriaLabel="Select a PDF file to prepare label pages"
      selectedFileEntry={workspace.selectedFileEntry}
      isBusy={workspace.isPreparing}
      onSelectFile={workspace.handleFileSelection}
      onClearSelection={workspace.handleClearSelection}
      inputPanelClassName={
        workspace.selectedFileEntry ? 'space-y-3 xl:w-[19rem]' : undefined
      }
      inputOptionsLayoutClassName={
        workspace.selectedFileEntry
          ? 'grid gap-8 xl:max-w-[58rem] xl:grid-cols-[19rem_minmax(0,32rem)] xl:items-start xl:gap-12'
          : undefined
      }
      optionsPanel={
        workspace.selectedFileEntry ? (
          <div className="space-y-8 xl:pl-2">
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight">Output</h2>
                <p className="text-sm text-muted-foreground">
                  Choose the paper size, then set how many {BRAND_LABELS[brand]}{' '}
                  labels should fit on each sheet.
                </p>
              </div>

              <FieldSet className="max-w-sm">
                <FieldGroup className="gap-5">
                  <div className="space-y-2">
                    <FieldLabel htmlFor={outputPageSizeInputId}>
                      Paper size
                    </FieldLabel>
                    <Select
                      value={workspace.outputPageSize}
                      onValueChange={(value) => {
                        const nextPageSize = OUTPUT_PAGE_SIZE_OPTIONS.find(
                          (option) => option.value === value,
                        )?.value;

                        if (nextPageSize) {
                          workspace.setOutputPageSize(nextPageSize);
                        }
                      }}
                      disabled={workspace.isPreparing}
                    >
                      <SelectTrigger
                        id={outputPageSizeInputId}
                        className="w-full"
                      >
                        <SelectValue>
                          {selectedOutputPageSizeOption
                            ? renderOutputPageSizeLabel(
                                selectedOutputPageSizeOption.value,
                              )
                            : 'Select page size'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start">
                        {OUTPUT_PAGE_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {renderOutputPageSizeLabel(option.value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {
                        OUTPUT_PAGE_SIZE_OPTIONS.find(
                          (option) => option.value === workspace.outputPageSize,
                        )?.description
                      }
                    </FieldDescription>
                  </div>

                  {workspace.outputPageSize !== 'auto' ? (
                    <div className="space-y-2">
                      <FieldLabel htmlFor={labelsPerPageInputId}>
                        Labels per page
                      </FieldLabel>
                      <Select
                        value={String(workspace.labelsPerPage)}
                        onValueChange={(value) => {
                          if (!value) {
                            return;
                          }

                          const nextLabelsPerPage = Number.parseInt(value, 10);

                          if (Number.isFinite(nextLabelsPerPage)) {
                            workspace.setLabelsPerPage(nextLabelsPerPage);
                          }
                        }}
                        disabled={workspace.isPreparing}
                      >
                        <SelectTrigger
                          id={labelsPerPageInputId}
                          className="w-full"
                        >
                          <SelectValue>
                            {selectedLabelsPerPage
                              ? `${String(selectedLabelsPerPage)} per sheet`
                              : 'Select count'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent align="start">
                          {workspace.labelsPerPageOptions.map((option) => (
                            <SelectItem key={option} value={String(option)}>
                              {String(option)} per sheet
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Up to{' '}
                        {String(workspace.labelsPerPageOptions.at(-1) ?? 1)}{' '}
                        {BRAND_LABELS[brand]} label
                        {workspace.labelsPerPageOptions.at(-1) === 1
                          ? ''
                          : 's'}{' '}
                        fit on this page size before the text becomes too small.
                      </FieldDescription>
                    </div>
                  ) : null}
                </FieldGroup>
              </FieldSet>

              {workspace.showSortingSection ? (
                <FieldSet className="max-w-xl">
                  <FieldLegend variant="label">Sorting</FieldLegend>
                  <FieldDescription>
                    Optional sorting rules for the prepared label order.
                  </FieldDescription>
                  <FieldGroup className="max-w-md gap-4">
                    {workspace.showPickupPartnerSort ? (
                      <Field orientation="horizontal">
                        <Checkbox
                          id={pickupPartnerSortInputId}
                          checked={workspace.pickupPartnerDirection !== null}
                          onCheckedChange={(checked) => {
                            workspace.setPickupPartnerDirection(
                              checked ? 'desc' : null,
                            );
                          }}
                          disabled={workspace.isPreparing}
                          aria-label="Sort labels by pickup partner"
                        />
                        <FieldContent>
                          <FieldLabel htmlFor={pickupPartnerSortInputId}>
                            Sort by pickup partner
                          </FieldLabel>
                          <FieldDescription>
                            Group labels by detected pickup partner in one fixed
                            order.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    ) : null}

                    {workspace.showSkuSort ? (
                      <Field orientation="horizontal">
                        <Checkbox
                          id={skuSortInputId}
                          checked={workspace.skuDirection !== null}
                          onCheckedChange={(checked) => {
                            workspace.setSkuDirection(checked ? 'desc' : null);
                          }}
                          disabled={workspace.isPreparing}
                          aria-label="Sort labels by SKU"
                        />
                        <FieldContent>
                          <FieldLabel htmlFor={skuSortInputId}>
                            Sort by SKU
                          </FieldLabel>
                          <FieldDescription>
                            Order labels by detected SKU in one fixed order.
                          </FieldDescription>
                        </FieldContent>
                      </Field>
                    ) : null}
                  </FieldGroup>
                </FieldSet>
              ) : null}

              {workspace.errorMessage ? (
                <Alert variant="destructive" className="max-w-xl">
                  <HugeiconsIcon
                    icon={AlertCircleIcon}
                    size={18}
                    strokeWidth={2}
                  />
                  <AlertTitle>Unable to complete action</AlertTitle>
                  <AlertDescription>{workspace.errorMessage}</AlertDescription>
                </Alert>
              ) : null}
            </section>

            <div className="pt-2">
              <Button
                disabled={workspace.prepareButtonDisabled}
                onClick={workspace.handlePrepare}
                className="w-full sm:w-auto"
              >
                {workspace.isPreparing ? (
                  <Spinner data-icon="inline-start" />
                ) : null}
                {workspace.prepareButtonLabel}
              </Button>
            </div>
          </div>
        ) : null
      }
      outputPanel={
        workspace.resultSummary ? (
          <section className="space-y-8 border-t border-border/70 pt-8">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Task Summary
              </h3>
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">
                    Processing time
                  </dt>
                  <dd className="text-2xl font-semibold">
                    {formatDuration(workspace.resultSummary.elapsedMs)}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">
                    Labels prepared
                  </dt>
                  <dd className="text-2xl font-semibold">
                    {String(workspace.resultSummary.labelsPrepared)}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">
                    Pages created
                  </dt>
                  <dd className="text-2xl font-semibold">
                    {String(workspace.resultSummary.outputPagesCreated)}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-sm text-muted-foreground">
                    Pages skipped
                  </dt>
                  <dd className="text-2xl font-semibold">
                    {String(workspace.resultSummary.pagesSkipped)}
                  </dd>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {workspace.resultSummary.skippedPageNumbers.length > 0
                      ? formatPageList(
                          workspace.resultSummary.skippedPageNumbers,
                        )
                      : 'None'}
                  </p>
                </div>
              </dl>
            </section>
          </section>
        ) : null
      }
      errorMessage={null}
    />
  );
}
