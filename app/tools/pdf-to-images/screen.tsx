import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSet,
} from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { MAX_QUALITY_LONG_EDGE_TARGET_PX } from '~/tools/pdf-to-images/service/render-pdf-to-images';
import type {
  ImageOutputFormat,
  MaxDimensionCap,
  ResolutionInfo,
} from '~/tools/pdf-to-images/models';
import { SinglePdfToolWorkspace } from '~/shared/tool-ui/single-pdf-tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';
import { type PageRangeMode } from '~/tools/pdf-to-images/workspace-state';
import { usePdfToImagesWorkspace } from '~/tools/pdf-to-images/use-pdf-to-images-workspace';

import { pdfToImagesToolDefinition } from './definition';
import {
  isImageOutputFormat,
  isMaxDimensionCap,
} from './use-cases/convert-pdf-to-images';

const FORMAT_OPTIONS: { value: ImageOutputFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WEBP' },
];

const MAX_DIMENSION_CAP_OPTIONS: { value: MaxDimensionCap; label: string }[] = [
  { value: 3000, label: '3000 px' },
  { value: 4000, label: '4000 px' },
  { value: 5000, label: '5000 px' },
  { value: 6000, label: '6000 px' },
  { value: 8000, label: '8000 px' },
];

const outputFormatInputId = 'pdf-to-images-format';
const maxDimensionCapInputId = 'pdf-to-images-max-dimension-cap';
const pageRangeModeInputId = 'pdf-to-images-page-range-mode';
const customRangeInputId = 'pdf-to-images-custom-range';
const outputFormatLabelId = 'pdf-to-images-format-label';
const maxDimensionCapLabelId = 'pdf-to-images-max-dimension-label';
const pageRangeModeLabelId = 'pdf-to-images-page-range-label';

interface PdfToImagesOptionsPanelProps {
  format: ImageOutputFormat;
  maxDimensionCap: MaxDimensionCap;
  pageRangeMode: PageRangeMode;
  pageRangeInput: string;
  selectedPageCount: number | null;
  disabled: boolean;
  onFormatChange: (format: ImageOutputFormat) => void;
  onMaxDimensionCapChange: (maxDimensionCap: MaxDimensionCap) => void;
  onPageRangeModeChange: (pageRangeMode: PageRangeMode) => void;
  onPageRangeInputChange: (value: string) => void;
}

function PdfToImagesOptionsPanel({
  format,
  maxDimensionCap,
  pageRangeMode,
  pageRangeInput,
  selectedPageCount,
  disabled,
  onFormatChange,
  onMaxDimensionCapChange,
  onPageRangeModeChange,
  onPageRangeInputChange,
}: PdfToImagesOptionsPanelProps) {
  return (
    <FieldSet className="max-w-sm">
      <Field>
        <FieldContent>
          <FieldLabel id={outputFormatLabelId} htmlFor={outputFormatInputId}>
            Output format
          </FieldLabel>
          <Select
            value={format}
            onValueChange={(value) => {
              if (isImageOutputFormat(value)) {
                onFormatChange(value);
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id={outputFormatInputId}
              aria-labelledby={outputFormatLabelId}
              className="w-full"
            >
              <SelectValue placeholder="Select output format">
                {(value: unknown) =>
                  typeof value === 'string'
                    ? FORMAT_OPTIONS.find((option) => option.value === value)
                        ?.label
                    : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              {FORMAT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>

      <Field>
        <FieldContent>
          <FieldLabel
            id={maxDimensionCapLabelId}
            htmlFor={maxDimensionCapInputId}
          >
            Max dimension cap
          </FieldLabel>
          <Select
            value={String(maxDimensionCap)}
            onValueChange={(value) => {
              const nextCap = Number(value);
              if (isMaxDimensionCap(nextCap)) {
                onMaxDimensionCapChange(nextCap);
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id={maxDimensionCapInputId}
              aria-labelledby={maxDimensionCapLabelId}
              className="w-full"
            >
              <SelectValue placeholder="Select max dimension" />
            </SelectTrigger>
            <SelectContent align="start">
              {MAX_DIMENSION_CAP_OPTIONS.map((option) => (
                <SelectItem
                  key={String(option.value)}
                  value={String(option.value)}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>

      <Field>
        <FieldContent>
          <FieldLabel id={pageRangeModeLabelId} htmlFor={pageRangeModeInputId}>
            Pages to convert
          </FieldLabel>
          <Select
            value={pageRangeMode}
            onValueChange={(value) => {
              onPageRangeModeChange(value === 'custom' ? 'custom' : 'all');
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id={pageRangeModeInputId}
              aria-labelledby={pageRangeModeLabelId}
              className="w-full"
            >
              <SelectValue placeholder="Select pages" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All pages</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>

      {pageRangeMode === 'custom' ? (
        <Field>
          <FieldContent>
            <FieldLabel htmlFor={customRangeInputId}>Custom range</FieldLabel>
            <Input
              id={customRangeInputId}
              aria-label="Custom page range"
              value={pageRangeInput}
              disabled={disabled}
              aria-invalid={selectedPageCount === null}
              onChange={(event) => {
                onPageRangeInputChange(event.currentTarget.value);
              }}
              placeholder="e.g. 1-3, 5, 9-12"
            />
            <FieldDescription>
              Use comma-separated pages and ranges.
            </FieldDescription>
            <FieldError>
              {selectedPageCount === null
                ? 'Enter a range like 1, 3-5, 9.'
                : null}
            </FieldError>
          </FieldContent>
        </Field>
      ) : null}
    </FieldSet>
  );
}

function PdfToImagesResolutionPreview({
  isReadingResolution,
  resolutionInfo,
  selectedPageCount,
  maxDimensionCap,
}: {
  isReadingResolution: boolean;
  resolutionInfo: ResolutionInfo | null;
  selectedPageCount: number | null;
  maxDimensionCap: MaxDimensionCap;
}) {
  if (isReadingResolution) {
    return (
      <p className="text-sm text-muted-foreground">Reading PDF resolution...</p>
    );
  }

  if (!resolutionInfo) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-4">
      <p className="text-sm font-medium">Output resolution preview</p>
      <dl className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Pages</dt>
          <dd>
            {selectedPageCount === null
              ? `of ${String(resolutionInfo.pageCount)} total`
              : `${String(selectedPageCount)} of ${String(resolutionInfo.pageCount)}`}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Base PDF (72 DPI points)</dt>
          <dd>{`${String(resolutionInfo.baseWidthPx)} x ${String(resolutionInfo.baseHeightPx)} px`}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Selected (Maximum quality)</dt>
          <dd>{`${String(resolutionInfo.scaledWidthPx)} x ${String(resolutionInfo.scaledHeightPx)} px`}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        {`Maximum quality targets a ~${String(MAX_QUALITY_LONG_EDGE_TARGET_PX)} px long edge, capped at ${String(maxDimensionCap)} px.`}{' '}
        Resolution preview is based on page 1; page sizes can vary in some PDFs.
        {` Effective render scale on page 1: ${resolutionInfo.effectiveScale.toFixed(2)}x.`}
      </p>
    </div>
  );
}

export function PdfToImagesToolScreen() {
  const workspace = usePdfToImagesWorkspace();

  useSuccessToast(workspace.successMessage);

  return (
    <SinglePdfToolWorkspace
      title="PDF to Images"
      description="Export PDF pages as PNG, JPEG, or WEBP files in a ZIP archive."
      titleIcon={pdfToImagesToolDefinition.icon}
      selectorAriaLabel="Select PDF file"
      selectedFileEntry={workspace.selectedFileEntry}
      isBusy={workspace.isConverting}
      onSelectFile={workspace.handleFileSelection}
      onClearSelection={workspace.handleClearSelection}
      optionsPanel={
        workspace.hasSelectedFile ? (
          <PdfToImagesOptionsPanel
            format={workspace.format}
            maxDimensionCap={workspace.maxDimensionCap}
            pageRangeMode={workspace.pageRangeMode}
            pageRangeInput={workspace.pageRangeInput}
            selectedPageCount={workspace.selectedPageCount}
            disabled={workspace.isConverting}
            onFormatChange={(format) => {
              workspace.changeFormat(format);
            }}
            onMaxDimensionCapChange={(maxDimensionCap) => {
              workspace.changeMaxDimensionCap(maxDimensionCap);
            }}
            onPageRangeModeChange={(pageRangeMode) => {
              workspace.changePageRangeMode(pageRangeMode);
            }}
            onPageRangeInputChange={(value) => {
              workspace.changePageRangeInput(value);
            }}
          />
        ) : null
      }
      outputPanel={
        workspace.hasSelectedFile ? (
          <PdfToImagesResolutionPreview
            isReadingResolution={workspace.isReadingResolution}
            resolutionInfo={workspace.resolutionInfo}
            selectedPageCount={workspace.selectedPageCount}
            maxDimensionCap={workspace.maxDimensionCap}
          />
        ) : null
      }
      actionBar={
        workspace.hasSelectedFile ? (
          <div>
            <Button
              disabled={!workspace.canConvert}
              onClick={() => {
                workspace.handleConvert();
              }}
            >
              {workspace.isConverting ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              {workspace.isConverting
                ? 'Converting...'
                : 'Export Image Archive'}
            </Button>
          </div>
        ) : null
      }
      errorMessage={workspace.errorMessage}
    />
  );
}
