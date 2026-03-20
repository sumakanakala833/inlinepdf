import type { SyntheticEvent } from 'react';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import { HugeiconsIcon } from '@hugeicons/react';

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
import { Spinner } from '~/components/ui/spinner';
import { FieldContent, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  STANDARD_PAGE_SIZE_IDS,
  getStandardPageSizeOption,
  isStandardPageSizeId,
} from '~/platform/pdf/page-size-options';
import { PageSizeOptionLabel } from '~/shared/tool-ui/page-size-option-label';
import { PdfCropEditor } from '~/tools/crop/components/pdf-crop-editor';
import type {
  CropDocumentPreview,
  CropPreset,
  NormalizedRect,
  PageCropState,
} from '~/tools/crop/models';
import { cropToolDefinition } from '~/tools/crop/definition';
import { ToolWorkspace } from '~/shared/tool-ui/tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';
import { useCropWorkspace } from '~/tools/crop/use-crop-workspace';

const PAGE_SIZE_PRESET_OPTIONS = STANDARD_PAGE_SIZE_IDS.map((value) => ({
  value,
  label: getStandardPageSizeOption(value).label,
}));

const PRESET_OPTIONS: { value: CropPreset; label: string }[] = [
  { value: 'free', label: 'Freeform' },
  ...PAGE_SIZE_PRESET_OPTIONS,
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
];

function isCropPreset(value: string): value is CropPreset {
  return PRESET_OPTIONS.some((option) => option.value === value);
}

function renderCropPresetLabel(value: CropPreset) {
  if (isStandardPageSizeId(value)) {
    return <PageSizeOptionLabel {...getStandardPageSizeOption(value)} />;
  }

  return (
    PRESET_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

const mobileAspectSelectId = 'crop-mobile-aspect-select';
const desktopAspectSelectId = 'crop-desktop-aspect-select';

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
  const selectedPresetOption = PRESET_OPTIONS.find(
    (option) => option.value === preset,
  );

  return (
    <FieldContent className={className}>
      <FieldLabel
        htmlFor={id}
        className="whitespace-nowrap text-muted-foreground"
      >
        Aspect
      </FieldLabel>
      <Select
        value={preset}
        onValueChange={(value) => {
          if (typeof value === 'string' && isCropPreset(value)) {
            onPresetChange(value);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label="Aspect Ratio" className="min-w-48">
          <SelectValue placeholder="Select aspect ratio">
            {selectedPresetOption
              ? renderCropPresetLabel(selectedPresetOption.value)
              : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {PRESET_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {renderCropPresetLabel(option.value)}
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
          <span className="text-lg leading-none text-primary-foreground/95">
            /
          </span>
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
            Reset Crop
          </Button>
          <Button
            disabled={!canOpenExportDialog}
            onClick={onOpenExportDialog}
            className="whitespace-nowrap"
          >
            {isExporting ? <Spinner data-icon="inline-start" /> : null}
            {isExporting ? 'Cropping...' : 'Crop PDF'}
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
          Reset Crop
        </Button>
        <Button
          disabled={!canOpenExportDialog}
          onClick={onOpenExportDialog}
          className="w-full"
        >
          {isExporting ? <Spinner data-icon="inline-start" /> : null}
          {isExporting ? 'Cropping...' : 'Crop PDF'}
        </Button>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to crop page</AlertTitle>
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
  const workspace = useCropWorkspace();

  useSuccessToast(workspace.successMessage);

  function handlePageJump(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    workspace.submitPageJump();
  }

  if (!workspace.selectedFile) {
    return (
      <ToolWorkspace
        title="Crop PDF"
        description="Choose a PDF and crop pages one at a time."
        titleIcon={cropToolDefinition.icon}
        inputPanel={
          <PdfFileSelector
            ariaLabel="Select PDF file for crop"
            onSelect={(files) => {
              void workspace.handleFileSelected(files[0]);
            }}
            disabled={workspace.isBusy}
          />
        }
        errorMessage={workspace.errorMessage}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-80 bg-background">
      <div className="flex h-full flex-col">
        <main className="min-h-0 flex flex-1 flex-col overflow-hidden px-2 py-2 md:px-4 md:py-3">
          <div className="pb-2 text-center">
            <p className="text-sm font-medium">{workspace.selectedFile.name}</p>
          </div>
          <div className="flex items-center justify-center pb-2 md:hidden">
            <CropAspectField
              id={mobileAspectSelectId}
              preset={workspace.preset}
              disabled={workspace.isBusy}
              className="flex items-center gap-2"
              onPresetChange={(preset) => {
                workspace.changePreset(preset);
              }}
            />
          </div>

          <CropPreviewPanel
            selectedFile={workspace.selectedFile}
            documentPreview={workspace.documentPreview}
            activePageNumber={workspace.activePageNumber}
            isReadingPdf={workspace.isReadingPdf}
            preset={workspace.preset}
            pageCrops={workspace.pageCrops}
            onCropChange={(pageNumber, cropRect) => {
              workspace.changeCrop(pageNumber, cropRect);
            }}
          />
        </main>

        <div className="px-3 pb-2 md:px-4">
          <CropNavigationBar
            canGoPrevious={workspace.canGoPrevious}
            canGoNext={workspace.canGoNext}
            isBusy={workspace.isBusy}
            pageInputValue={workspace.pageInputValue}
            totalPages={workspace.totalPages}
            onPrevious={() => {
              workspace.goToPreviousPage();
            }}
            onNext={() => {
              workspace.goToNextPage();
            }}
            onPageInputChange={(value) => {
              workspace.updatePageInput(value);
            }}
            onPageJump={handlePageJump}
          />
        </div>

        <CropActionBar
          preset={workspace.preset}
          isBusy={workspace.isBusy}
          hasActivePage={workspace.hasActivePage}
          canOpenExportDialog={workspace.canOpenExportDialog}
          isExporting={workspace.isExporting}
          errorMessage={workspace.errorMessage}
          onPresetChange={(preset) => {
            workspace.changePreset(preset);
          }}
          onResetCrop={() => {
            workspace.resetCrop();
          }}
          onOpenExportDialog={() => {
            workspace.openExportDialog();
          }}
        />
      </div>

      <AlertDialog
        open={workspace.isExportDialogOpen}
        onOpenChange={(open) => {
          workspace.closeOrSetExportDialog(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Choose Export Scope</AlertDialogTitle>
            <AlertDialogDescription>
              Export the cropped page only, or export the full document with
              this page cropped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={workspace.isExporting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!workspace.canExport}
              onClick={() => {
                workspace.handleExport('allWithOriginalOthers');
              }}
              className="border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Full document
            </AlertDialogAction>
            <AlertDialogAction
              disabled={!workspace.canExport}
              onClick={() => {
                workspace.handleExport('current');
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
