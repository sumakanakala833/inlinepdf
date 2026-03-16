import { type SyntheticEvent, useReducer, useRef } from 'react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useFetcher } from 'react-router';

import { PdfFileSelector } from '~/components/pdf-file-selector';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { FieldContent, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { saveClientActionFallback } from '~/platform/files/client-action-fallback';
import { PdfCropEditor } from '~/tools/crop/components/pdf-crop-editor';
import { hasValidRect } from '~/tools/crop/domain/coordinate-math';
import type {
  CropDocumentPreview,
  CropPreset,
  NormalizedRect,
  PageCropState,
} from '~/tools/crop/models';
import type { ToolActionResult } from '~/shared/tool-ui/action-result';
import { ToolWorkspace } from '~/shared/tool-ui/tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';

import { readPdfPages } from './use-cases/read-pdf-pages';

const PRESET_OPTIONS: { value: CropPreset; label: string }[] = [
  { value: 'free', label: 'Freeform' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
];

function isCropPreset(value: string): value is CropPreset {
  return PRESET_OPTIONS.some((option) => option.value === value);
}

const DEFAULT_CROP_RECT: NormalizedRect = {
  x: 0.002,
  y: 0.002,
  width: 0.996,
  height: 0.996,
};

const mobileAspectSelectId = 'crop-mobile-aspect-select';
const desktopAspectSelectId = 'crop-desktop-aspect-select';

interface CropWorkspaceState {
  selectedFile: File | null;
  documentPreview: CropDocumentPreview | null;
  activePageNumber: number | null;
  pageInputValue: string;
  pageCrops: PageCropState;
  preset: CropPreset;
  isReadingPdf: boolean;
  isExportDialogOpen: boolean;
  localErrorMessage: string | null;
}

type CropWorkspaceAction =
  | { type: 'fileSelectionStarted'; file: File }
  | { type: 'fileSelectionSucceeded'; preview: CropDocumentPreview }
  | { type: 'fileSelectionFailed'; message: string }
  | { type: 'pageSelected'; pageNumber: number }
  | { type: 'pageOffsetRequested'; offset: number }
  | { type: 'pageInputChanged'; value: string }
  | { type: 'cropChanged'; pageNumber: number; cropRect: NormalizedRect | null }
  | { type: 'cropReset' }
  | { type: 'presetChanged'; preset: CropPreset }
  | { type: 'exportDialogChanged'; open: boolean }
  | { type: 'localErrorSet'; message: string }
  | { type: 'localErrorCleared' };

const initialState: CropWorkspaceState = {
  selectedFile: null,
  documentPreview: null,
  activePageNumber: null,
  pageInputValue: '1',
  pageCrops: {},
  preset: 'free',
  isReadingPdf: false,
  isExportDialogOpen: false,
  localErrorMessage: null,
};

function ensurePageCrop(
  pageCrops: PageCropState,
  pageNumber: number,
): PageCropState {
  return pageNumber in pageCrops
    ? pageCrops
    : { ...pageCrops, [pageNumber]: { ...DEFAULT_CROP_RECT } };
}

function applySelectedPage(
  state: CropWorkspaceState,
  pageNumber: number,
): CropWorkspaceState {
  if (!state.documentPreview) {
    return state;
  }

  const clamped = Math.min(
    Math.max(pageNumber, 1),
    state.documentPreview.pageCount,
  );

  return {
    ...state,
    activePageNumber: clamped,
    pageInputValue: String(clamped),
    pageCrops: ensurePageCrop(state.pageCrops, clamped),
    localErrorMessage: null,
  };
}

function cropWorkspaceReducer(
  state: CropWorkspaceState,
  action: CropWorkspaceAction,
): CropWorkspaceState {
  switch (action.type) {
    case 'fileSelectionStarted':
      return {
        selectedFile: action.file,
        documentPreview: null,
        activePageNumber: null,
        pageInputValue: '1',
        pageCrops: {},
        preset: 'free',
        isReadingPdf: true,
        isExportDialogOpen: false,
        localErrorMessage: null,
      };
    case 'fileSelectionSucceeded':
      return {
        ...state,
        documentPreview: action.preview,
        activePageNumber: 1,
        pageInputValue: '1',
        pageCrops: { 1: { ...DEFAULT_CROP_RECT } },
        isReadingPdf: false,
        localErrorMessage: null,
      };
    case 'fileSelectionFailed':
      return {
        ...initialState,
        localErrorMessage: action.message,
      };
    case 'pageSelected':
      return applySelectedPage(state, action.pageNumber);
    case 'pageOffsetRequested':
      return state.activePageNumber === null
        ? state
        : applySelectedPage(state, state.activePageNumber + action.offset);
    case 'pageInputChanged':
      return {
        ...state,
        pageInputValue: action.value,
      };
    case 'cropChanged':
      return {
        ...state,
        pageCrops: {
          ...state.pageCrops,
          [action.pageNumber]: action.cropRect,
        },
        localErrorMessage: null,
      };
    case 'cropReset':
      return state.activePageNumber === null
        ? state
        : {
            ...state,
            pageCrops: {
              ...state.pageCrops,
              [state.activePageNumber]: { ...DEFAULT_CROP_RECT },
            },
            localErrorMessage: null,
          };
    case 'presetChanged':
      return {
        ...state,
        preset: action.preset,
      };
    case 'exportDialogChanged':
      return {
        ...state,
        isExportDialogOpen: action.open,
      };
    case 'localErrorSet':
      return {
        ...state,
        localErrorMessage: action.message,
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

function CropAspectField({
  id,
  preset,
  disabled,
  className,
  onPresetChange,
}: {
  id: string;
  preset: CropPreset;
  disabled: boolean;
  className?: string;
  onPresetChange: (preset: CropPreset) => void;
}) {
  return (
    <FieldContent className={className}>
      <FieldLabel htmlFor={id} className="whitespace-nowrap text-muted-foreground">
        Aspect
      </FieldLabel>
      <Select
        value={preset}
        onValueChange={(value) => {
          if (isCropPreset(value)) {
            onPresetChange(value);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label="Aspect" className="min-w-32">
          <SelectValue placeholder="Select aspect" />
        </SelectTrigger>
        <SelectContent align="end">
          {PRESET_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldContent>
  );
}

interface CropNavigationBarProps {
  canGoPrevious: boolean;
  canGoNext: boolean;
  isBusy: boolean;
  pageInputValue: string;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  onPageInputChange: (value: string) => void;
  onPageJump: (event: SyntheticEvent<HTMLFormElement>) => void;
}

function CropNavigationBar({
  canGoPrevious,
  canGoNext,
  isBusy,
  pageInputValue,
  totalPages,
  onPrevious,
  onNext,
  onPageInputChange,
  onPageJump,
}: CropNavigationBarProps) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-primary px-1.5 py-1.5 text-primary-foreground md:gap-1.5 md:px-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!canGoPrevious || isBusy}
          onClick={onPrevious}
          className="h-8 w-8 rounded-full p-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
          aria-label="Previous page"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
        </Button>

        <form className="flex items-center gap-2" onSubmit={onPageJump}>
          <Input
            value={pageInputValue}
            onChange={(event) => {
              onPageInputChange(event.currentTarget.value);
            }}
            inputMode="numeric"
            aria-label="Jump to page"
            className="h-8 w-12 border-primary-foreground/30 bg-primary-foreground/15 px-2 text-center text-base font-medium text-primary-foreground placeholder:text-primary-foreground/70 focus-visible:ring-primary-foreground/70"
            disabled={isBusy || totalPages < 1}
          />
          <span className="text-lg leading-none text-primary-foreground/95">/</span>
          <span className="min-w-6 text-center text-xl leading-none text-primary-foreground/95">
            {String(totalPages)}
          </span>
        </form>

        <Button
          variant="ghost"
          size="sm"
          disabled={!canGoNext || isBusy}
          onClick={onNext}
          className="h-8 w-8 rounded-full p-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
          aria-label="Next page"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
        </Button>
      </div>
    </div>
  );
}

interface CropActionBarProps {
  preset: CropPreset;
  isBusy: boolean;
  hasActivePage: boolean;
  canOpenExportDialog: boolean;
  isExporting: boolean;
  errorMessage: string | null;
  onPresetChange: (preset: CropPreset) => void;
  onResetCrop: () => void;
  onOpenExportDialog: () => void;
}

function CropActionBar({
  preset,
  isBusy,
  hasActivePage,
  canOpenExportDialog,
  isExporting,
  errorMessage,
  onPresetChange,
  onResetCrop,
  onOpenExportDialog,
}: CropActionBarProps) {
  return (
    <div className="space-y-2 px-3 pb-3 md:px-4 md:pb-4">
      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="hidden md:block" />

        <div />

        <div className="hidden items-center justify-end gap-2 md:flex">
          <CropAspectField
            id={desktopAspectSelectId}
            preset={preset}
            disabled={isBusy}
            className="flex items-center gap-2"
            onPresetChange={onPresetChange}
          />

          <Button
            variant="outline"
            disabled={!hasActivePage || isBusy}
            onClick={onResetCrop}
            className="whitespace-nowrap"
          >
            Reset crop
          </Button>
          <Button
            disabled={!canOpenExportDialog}
            onClick={onOpenExportDialog}
            className="whitespace-nowrap"
          >
            {isExporting ? 'Cropping...' : 'Crop and Download'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:hidden">
        <Button
          variant="outline"
          disabled={!hasActivePage || isBusy}
          onClick={onResetCrop}
          className="w-full"
        >
          Reset crop
        </Button>
        <Button
          disabled={!canOpenExportDialog}
          onClick={onOpenExportDialog}
          className="w-full"
        >
          {isExporting ? 'Cropping...' : 'Crop and Download'}
        </Button>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Crop failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function CropPreviewPanel({
  selectedFile,
  documentPreview,
  activePageNumber,
  isReadingPdf,
  preset,
  pageCrops,
  onCropChange,
}: {
  selectedFile: File;
  documentPreview: CropDocumentPreview | null;
  activePageNumber: number | null;
  isReadingPdf: boolean;
  preset: CropPreset;
  pageCrops: PageCropState;
  onCropChange: (pageNumber: number, cropRect: NormalizedRect | null) => void;
}) {
  if (isReadingPdf || !documentPreview || !activePageNumber) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          <p>Reading PDF and preparing crop preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1">
      <PdfCropEditor
        key={String(activePageNumber)}
        immersive
        showHeader={false}
        sourceFile={selectedFile}
        pageNumber={activePageNumber}
        preset={preset}
        cropRect={pageCrops[activePageNumber] ?? null}
        onCropChange={(nextRect) => {
          onCropChange(activePageNumber, nextRect);
        }}
      />
    </div>
  );
}

export function CropToolScreen() {
  const fetcher = useFetcher<ToolActionResult>();
  const selectionTokenRef = useRef(0);
  const [state, dispatch] = useReducer(cropWorkspaceReducer, initialState);
  const isExporting = fetcher.state !== 'idle';

  const totalPages = state.documentPreview?.pageCount ?? 0;
  const activePageNumber = state.activePageNumber;
  const hasActivePage = activePageNumber !== null && activePageNumber >= 1;
  const activeCropRect =
    activePageNumber === null
      ? null
      : (state.pageCrops[activePageNumber] ?? null);
  const canGoPrevious = activePageNumber !== null && activePageNumber > 1;
  const canGoNext = activePageNumber !== null && activePageNumber < totalPages;
  const canExport =
    !!state.selectedFile &&
    hasActivePage &&
    hasValidRect(activeCropRect) &&
    !state.isReadingPdf &&
    !isExporting;
  const canOpenExportDialog =
    !!state.selectedFile && hasActivePage && !state.isReadingPdf && !isExporting;
  const actionErrorMessage =
    fetcher.data && !fetcher.data.ok ? fetcher.data.message : null;
  const errorMessage = state.localErrorMessage ?? actionErrorMessage;
  const successMessage = fetcher.data?.ok ? fetcher.data.message : null;
  const isBusy = state.isReadingPdf || isExporting;

  useSuccessToast(successMessage);

  async function handleFileSelected(file: File) {
    const selectionToken = selectionTokenRef.current + 1;
    selectionTokenRef.current = selectionToken;
    dispatch({ type: 'fileSelectionStarted', file });

    try {
      const preview = await readPdfPages(file);
      if (selectionTokenRef.current !== selectionToken) {
        return;
      }

      if (preview.pageCount < 1) {
        throw new Error('This PDF has no pages to crop.');
      }

      dispatch({ type: 'fileSelectionSucceeded', preview });
    } catch (error: unknown) {
      if (selectionTokenRef.current !== selectionToken) {
        return;
      }

      const fallback = 'Failed to read PDF pages.';
      dispatch({
        type: 'fileSelectionFailed',
        message: error instanceof Error ? error.message : fallback,
      });
    }
  }

  function handlePageJump(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = Number.parseInt(state.pageInputValue, 10);
    if (!Number.isFinite(next)) {
      dispatch({
        type: 'pageInputChanged',
        value: state.activePageNumber ? String(state.activePageNumber) : '1',
      });
      return;
    }

    dispatch({ type: 'pageSelected', pageNumber: next });
  }

  function handleExport(mode: 'current' | 'allWithOriginalOthers') {
    if (!state.selectedFile || !state.activePageNumber || !state.documentPreview) {
      return;
    }

    const cropRect = state.pageCrops[state.activePageNumber];
    if (!cropRect || !hasValidRect(cropRect)) {
      dispatch({
        type: 'localErrorSet',
        message: 'Set a valid crop area before downloading.',
      });
      return;
    }

    dispatch({ type: 'exportDialogChanged', open: false });
    dispatch({ type: 'localErrorCleared' });

    const activeCrop: NormalizedRect = cropRect;
    const payload = {
      file: state.selectedFile,
      pageNumber: state.activePageNumber,
      totalPages: state.documentPreview.pageCount,
      mode,
      cropRect: activeCrop,
    };
    const submissionId = saveClientActionFallback(payload);
    const formData = new FormData();
    formData.set('file', state.selectedFile);
    formData.set('pageNumber', String(state.activePageNumber));
    formData.set('totalPages', String(state.documentPreview.pageCount));
    formData.set('mode', mode);
    formData.set('cropRect', JSON.stringify(activeCrop));
    formData.set('submissionId', submissionId);

    void fetcher.submit(formData, { method: 'post' });
  }

  if (!state.selectedFile) {
    return (
      <ToolWorkspace
        title="Crop PDF"
        description="Pick a PDF and jump straight into page-by-page cropping."
        inputPanel={
          <PdfFileSelector
            ariaLabel="Select PDF file for crop"
            onSelect={(files) => {
              void handleFileSelected(files[0]);
            }}
            disabled={isBusy}
            title="Drag and drop a PDF to crop"
          />
        }
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-background">
      <div className="flex h-full flex-col">
        <main className="min-h-0 flex flex-1 flex-col overflow-hidden px-2 py-2 md:px-4 md:py-3">
          <div className="pb-2 text-center">
            <p className="text-sm font-medium">{state.selectedFile.name}</p>
          </div>
          <div className="flex items-center justify-center pb-2 md:hidden">
            <CropAspectField
              id={mobileAspectSelectId}
              preset={state.preset}
              disabled={isBusy}
              className="flex items-center gap-2"
              onPresetChange={(preset) => {
                dispatch({ type: 'presetChanged', preset });
              }}
            />
          </div>

          <CropPreviewPanel
            selectedFile={state.selectedFile}
            documentPreview={state.documentPreview}
            activePageNumber={state.activePageNumber}
            isReadingPdf={state.isReadingPdf}
            preset={state.preset}
            pageCrops={state.pageCrops}
            onCropChange={(pageNumber, cropRect) => {
              dispatch({ type: 'cropChanged', pageNumber, cropRect });
            }}
          />
        </main>

        <div className="px-3 pb-2 md:px-4">
          <CropNavigationBar
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
            isBusy={isBusy}
            pageInputValue={state.pageInputValue}
            totalPages={totalPages}
            onPrevious={() => {
              if (!state.activePageNumber) {
                return;
              }

              dispatch({ type: 'pageOffsetRequested', offset: -1 });
            }}
            onNext={() => {
              if (!state.activePageNumber) {
                return;
              }

              dispatch({ type: 'pageOffsetRequested', offset: 1 });
            }}
            onPageInputChange={(value) => {
              dispatch({
                type: 'pageInputChanged',
                value: value.replace(/\D/g, ''),
              });
            }}
            onPageJump={handlePageJump}
          />
        </div>

        <CropActionBar
          preset={state.preset}
          isBusy={isBusy}
          hasActivePage={hasActivePage}
          canOpenExportDialog={canOpenExportDialog}
          isExporting={isExporting}
          errorMessage={errorMessage}
          onPresetChange={(preset) => {
            dispatch({ type: 'presetChanged', preset });
          }}
          onResetCrop={() => {
            dispatch({ type: 'cropReset' });
          }}
          onOpenExportDialog={() => {
            dispatch({ type: 'exportDialogChanged', open: true });
          }}
        />
      </div>

      <AlertDialog
        open={state.isExportDialogOpen}
        onOpenChange={(open) => {
          if (isExporting) {
            return;
          }

          dispatch({ type: 'exportDialogChanged', open });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Choose Download Scope</AlertDialogTitle>
            <AlertDialogDescription>
              Download only the cropped current page, or the full document with
              only this page cropped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isExporting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isExporting || !canExport}
              onClick={() => {
                handleExport('allWithOriginalOthers');
              }}
              className="border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Full document
            </AlertDialogAction>
            <AlertDialogAction
              disabled={isExporting || !canExport}
              onClick={() => {
                handleExport('current');
              }}
            >
              Current page only
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
