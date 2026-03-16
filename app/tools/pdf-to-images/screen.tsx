import { useReducer, useRef } from 'react';
import { useFetcher } from 'react-router';

import { PdfFileSelector } from '~/components/pdf-file-selector';
import { Button } from '~/components/ui/button';
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
import { saveClientActionFallback } from '~/platform/files/client-action-fallback';
import { readPdfDetails } from '~/platform/pdf/read-pdf-details';
import {
  MAX_QUALITY_LONG_EDGE_TARGET_PX,
  readPdfImageBaseResolution,
} from '~/tools/pdf-to-images/service/render-pdf-to-images';
import type {
  ImageOutputFormat,
  MaxDimensionCap,
  PdfImageBaseResolution,
} from '~/tools/pdf-to-images/models';
import {
  FileQueueList,
  type QueuedFile,
} from '~/shared/tool-ui/file-queue-list';
import { ToolWorkspace } from '~/shared/tool-ui/tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';
import { createFileEntryId } from '~/shared/tool-ui/create-file-entry-id';
import type { ToolActionResult } from '~/shared/tool-ui/action-result';

import {
  calculateResolutionInfo,
  isImageOutputFormat,
  isMaxDimensionCap,
  parsePageRangeInput,
} from './use-cases/convert-pdf-to-images';

type PageRangeMode = 'all' | 'custom';

interface PdfToImagesState {
  selectedFileEntry: QueuedFile | null;
  format: ImageOutputFormat;
  maxDimensionCap: MaxDimensionCap;
  pageRangeMode: PageRangeMode;
  pageRangeInput: string;
  baseResolution: PdfImageBaseResolution | null;
  isReadingResolution: boolean;
  localErrorMessage: string | null;
}

type PdfToImagesAction =
  | { type: 'fileSelected'; entry: QueuedFile }
  | {
      type: 'fileDetailsLoaded';
      entryId: string;
      pageCount: number;
      previewDataUrl: string | null;
    }
  | { type: 'fileDetailsFailed'; entryId: string }
  | {
      type: 'baseResolutionLoaded';
      entryId: string;
      baseResolution: PdfImageBaseResolution;
    }
  | { type: 'baseResolutionFailed'; message: string }
  | { type: 'readingFinished' }
  | { type: 'selectionCleared' }
  | { type: 'formatChanged'; format: ImageOutputFormat }
  | { type: 'maxDimensionCapChanged'; maxDimensionCap: MaxDimensionCap }
  | { type: 'pageRangeModeChanged'; pageRangeMode: PageRangeMode }
  | { type: 'pageRangeInputChanged'; value: string }
  | { type: 'localErrorCleared' };

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

const initialState: PdfToImagesState = {
  selectedFileEntry: null,
  format: 'png',
  maxDimensionCap: 5000,
  pageRangeMode: 'all',
  pageRangeInput: '1',
  baseResolution: null,
  isReadingResolution: false,
  localErrorMessage: null,
};

function pdfToImagesReducer(
  state: PdfToImagesState,
  action: PdfToImagesAction,
): PdfToImagesState {
  switch (action.type) {
    case 'fileSelected':
      return {
        ...state,
        selectedFileEntry: action.entry,
        baseResolution: null,
        pageRangeMode: 'all',
        pageRangeInput: '1',
        isReadingResolution: true,
        localErrorMessage: null,
      };
    case 'fileDetailsLoaded':
      return {
        ...state,
        selectedFileEntry:
          state.selectedFileEntry?.id === action.entryId
            ? {
                ...state.selectedFileEntry,
                pageCount: action.pageCount,
                previewDataUrl: action.previewDataUrl,
                previewStatus: action.previewDataUrl ? 'ready' : 'unavailable',
              }
            : state.selectedFileEntry,
      };
    case 'fileDetailsFailed':
      return {
        ...state,
        selectedFileEntry:
          state.selectedFileEntry?.id === action.entryId
            ? {
                ...state.selectedFileEntry,
                previewStatus: 'unavailable',
              }
            : state.selectedFileEntry,
      };
    case 'baseResolutionLoaded':
      return {
        ...state,
        baseResolution: action.baseResolution,
        selectedFileEntry:
          state.selectedFileEntry?.id === action.entryId
            ? {
                ...state.selectedFileEntry,
                pageCount:
                  state.selectedFileEntry.pageCount ?? action.baseResolution.pageCount,
              }
            : state.selectedFileEntry,
      };
    case 'baseResolutionFailed':
      return {
        ...state,
        localErrorMessage: action.message,
      };
    case 'readingFinished':
      return {
        ...state,
        isReadingResolution: false,
      };
    case 'selectionCleared':
      return {
        ...state,
        selectedFileEntry: null,
        baseResolution: null,
        isReadingResolution: false,
        localErrorMessage: null,
      };
    case 'formatChanged':
      return {
        ...state,
        format: action.format,
      };
    case 'maxDimensionCapChanged':
      return {
        ...state,
        maxDimensionCap: action.maxDimensionCap,
      };
    case 'pageRangeModeChanged':
      return {
        ...state,
        pageRangeMode: action.pageRangeMode,
      };
    case 'pageRangeInputChanged':
      return {
        ...state,
        pageRangeInput: action.value,
      };
    case 'localErrorCleared':
      return {
        ...state,
        localErrorMessage: null,
      };
    default:
      return state;
  }
}

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
                    ? FORMAT_OPTIONS.find((option) => option.value === value)?.label
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
          <FieldLabel id={maxDimensionCapLabelId} htmlFor={maxDimensionCapInputId}>
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
              <SelectValue placeholder="Select cap" />
            </SelectTrigger>
            <SelectContent align="start">
              {MAX_DIMENSION_CAP_OPTIONS.map((option) => (
                <SelectItem key={String(option.value)} value={String(option.value)}>
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
              <SelectValue placeholder="Select page scope" />
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
                ? 'Invalid range. Use values like 1, 3-5, 9.'
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
  resolutionInfo: ReturnType<typeof calculateResolutionInfo> | null;
  selectedPageCount: number | null;
  maxDimensionCap: MaxDimensionCap;
}) {
  if (isReadingResolution) {
    return <p className="text-sm text-muted-foreground">Reading PDF resolution...</p>;
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
  const fetcher = useFetcher<ToolActionResult>();
  const activeEntryIdRef = useRef<string | null>(null);
  const [state, dispatch] = useReducer(pdfToImagesReducer, initialState);

  const isConverting = fetcher.state !== 'idle';
  const hasSelectedFile = !!state.selectedFileEntry;
  const resolutionInfo = state.baseResolution
    ? calculateResolutionInfo(state.baseResolution, state.maxDimensionCap)
    : null;
  const selectedPageCount = (() => {
    if (!state.baseResolution) {
      return null;
    }

    if (state.pageRangeMode === 'all') {
      return state.baseResolution.pageCount;
    }

    try {
      return parsePageRangeInput(
        state.pageRangeInput,
        state.baseResolution.pageCount,
      ).length;
    } catch {
      return null;
    }
  })();
  const hasValidPageRange =
    state.pageRangeMode === 'all' || selectedPageCount !== null;
  const canConvert =
    hasSelectedFile &&
    !!state.baseResolution &&
    hasValidPageRange &&
    !isConverting;
  const actionErrorMessage =
    fetcher.data && !fetcher.data.ok ? fetcher.data.message : null;
  const errorMessage = state.localErrorMessage ?? actionErrorMessage;
  const successMessage = fetcher.data?.ok ? fetcher.data.message : null;

  useSuccessToast(successMessage);

  function handleFileSelection(file: File) {
    const entryId = createFileEntryId(file);
    activeEntryIdRef.current = entryId;

    dispatch({
      type: 'fileSelected',
      entry: {
        id: entryId,
        file,
        pageCount: null,
        previewDataUrl: null,
        previewStatus: 'loading',
      },
    });

    void readPdfDetails(file)
      .then((details) => {
        if (activeEntryIdRef.current !== entryId) {
          return;
        }

        if (details.pageCount === null) {
          dispatch({ type: 'fileDetailsFailed', entryId });
          return;
        }

        dispatch({
          type: 'fileDetailsLoaded',
          entryId,
          pageCount: details.pageCount,
          previewDataUrl: details.previewDataUrl,
        });
      })
      .catch(() => {
        if (activeEntryIdRef.current !== entryId) {
          return;
        }

        dispatch({ type: 'fileDetailsFailed', entryId });
      });

    void readPdfImageBaseResolution(file)
      .then((baseResolution) => {
        if (activeEntryIdRef.current !== entryId) {
          return;
        }

        dispatch({ type: 'baseResolutionLoaded', entryId, baseResolution });
      })
      .catch((error: unknown) => {
        if (activeEntryIdRef.current !== entryId) {
          return;
        }

        const fallback = 'Failed to read PDF resolution.';
        dispatch({
          type: 'baseResolutionFailed',
          message: error instanceof Error ? error.message : fallback,
        });
      })
      .finally(() => {
        if (activeEntryIdRef.current === entryId) {
          dispatch({ type: 'readingFinished' });
        }
      });
  }

  function handleClearSelection() {
    if (isConverting) {
      return;
    }

    activeEntryIdRef.current = null;
    dispatch({ type: 'selectionCleared' });
  }

  function handleConvert() {
    if (!state.selectedFileEntry || !state.baseResolution) {
      return;
    }

    dispatch({ type: 'localErrorCleared' });

    const selectedPageNumbers =
      state.pageRangeMode === 'all'
        ? undefined
        : parsePageRangeInput(
            state.pageRangeInput,
            state.baseResolution.pageCount,
          );

    const payload = {
      file: state.selectedFileEntry.file,
      format: state.format,
      maxDimensionCap: state.maxDimensionCap,
      pageNumbers: selectedPageNumbers,
    };
    const submissionId = saveClientActionFallback(payload);
    const formData = new FormData();
    formData.set('file', state.selectedFileEntry.file);
    formData.set('format', state.format);
    formData.set('maxDimensionCap', String(state.maxDimensionCap));
    if (selectedPageNumbers) {
      formData.set('pageNumbers', JSON.stringify(selectedPageNumbers));
    }
    formData.set('submissionId', submissionId);

    void fetcher.submit(formData, { method: 'post' });
  }

  return (
    <ToolWorkspace
      title="PDF to Images"
      description="Convert every PDF page into PNG, JPEG, or WEBP and download one ZIP."
      inputPanel={
        state.selectedFileEntry ? (
          <FileQueueList
            files={[state.selectedFileEntry]}
            disabled={isConverting}
            onRemove={handleClearSelection}
          />
        ) : (
          <PdfFileSelector
            ariaLabel="Select PDF file"
            onSelect={(files) => {
              handleFileSelection(files[0]);
            }}
            disabled={isConverting}
            title="Drag and drop a PDF file"
          />
        )
      }
      optionsPanel={
        hasSelectedFile ? (
          <PdfToImagesOptionsPanel
            format={state.format}
            maxDimensionCap={state.maxDimensionCap}
            pageRangeMode={state.pageRangeMode}
            pageRangeInput={state.pageRangeInput}
            selectedPageCount={selectedPageCount}
            disabled={isConverting}
            onFormatChange={(format) => {
              dispatch({ type: 'formatChanged', format });
            }}
            onMaxDimensionCapChange={(maxDimensionCap) => {
              dispatch({ type: 'maxDimensionCapChanged', maxDimensionCap });
            }}
            onPageRangeModeChange={(pageRangeMode) => {
              dispatch({ type: 'pageRangeModeChanged', pageRangeMode });
            }}
            onPageRangeInputChange={(value) => {
              dispatch({ type: 'pageRangeInputChanged', value });
            }}
          />
        ) : null
      }
      outputPanel={
        hasSelectedFile ? (
          <PdfToImagesResolutionPreview
            isReadingResolution={state.isReadingResolution}
            resolutionInfo={resolutionInfo}
            selectedPageCount={selectedPageCount}
            maxDimensionCap={state.maxDimensionCap}
          />
        ) : null
      }
      actionBar={
        hasSelectedFile ? (
          <div className="space-y-2">
            <Button disabled={!canConvert} onClick={handleConvert}>
              {isConverting ? 'Converting...' : 'Convert and Download ZIP'}
            </Button>
            {isConverting ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Converting pages...
              </p>
            ) : null}
          </div>
        ) : null
      }
      errorMessage={errorMessage}
    />
  );
}
