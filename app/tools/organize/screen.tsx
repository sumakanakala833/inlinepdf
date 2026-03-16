import { type ReactNode, useEffect, useReducer, useRef, useState } from 'react';
import { DragOverlay } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { useFetcher } from 'react-router';
import {
  Cancel01Icon,
  Rotate02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { CspDragDropProvider } from '~/components/dnd/csp-drag-drop-provider';
import { PdfFileSelector } from '~/components/pdf-file-selector';
import { AspectRatio } from '~/components/ui/aspect-ratio';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Checkbox } from '~/components/ui/checkbox';
import {
  FileQueueList,
  type QueuedFile,
} from '~/shared/tool-ui/file-queue-list';
import { readPdfDetails } from '~/platform/pdf/read-pdf-details';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '~/components/ui/pagination';
import { Spinner } from '~/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { saveClientActionFallback } from '~/platform/files/client-action-fallback';
import { readOrganizePreview } from '~/tools/organize/service/read-organize-preview';
import type {
  OrganizePageState,
  OrganizePreviewSession,
} from '~/tools/organize/models';
import {
  normalizeQuarterTurns,
  quarterTurnsToDegrees,
} from '~/tools/organize/models';
import type { ToolActionResult } from '~/shared/tool-ui/action-result';
import { reorderListByIndex } from '~/shared/tool-ui/reorder-list-by-index';
import { ToolWorkspace } from '~/shared/tool-ui/tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';
import { cn } from '~/lib/utils';

const PAGES_PER_VIEW = 12;
const OVERLAY_ICON_BUTTON_CLASS =
  'rounded-full border-border bg-white text-foreground shadow-sm hover:bg-white active:bg-white';
const PAGE_CARD_CLASS_NAME =
  'rounded-2xl select-none transition-shadow touch-none';

type PaginationToken = number | 'ellipsis';

interface OrganizeWorkspaceState {
  selectedFile: File | null;
  selectedFileEntry: QueuedFile | null;
  previewSession: OrganizePreviewSession | null;
  pageStates: OrganizePageState[];
  currentPaginationPage: number;
  isReadingPdf: boolean;
  localErrorMessage: string | null;
}

type OrganizeWorkspaceAction =
  | { type: 'fileSelectionStarted'; file: File; entryId: string }
  | {
      type: 'fileDetailsLoaded';
      entryId: string;
      pageCount: number;
      previewDataUrl: string | null;
    }
  | { type: 'fileDetailsFailed'; entryId: string }
  | {
      type: 'previewSessionLoaded';
      entryId: string;
      previewSession: OrganizePreviewSession;
    }
  | { type: 'previewSessionFailed'; message: string }
  | { type: 'replaceFile' }
  | { type: 'localErrorCleared' }
  | { type: 'paginationClamped'; totalPaginationPages: number }
  | { type: 'paginationPageSet'; page: number }
  | { type: 'paginationOffset'; offset: number; totalPaginationPages: number }
  | { type: 'pageSelectionToggled'; pageId: string }
  | { type: 'pageRotated'; pageId: string }
  | { type: 'pageRemoved'; pageId: string }
  | { type: 'pagesReordered'; sourceId: string; targetId: string }
  | { type: 'pagesMarkedLoading'; pageIds: string[] }
  | { type: 'pageThumbnailLoaded'; pageId: string; thumbnailDataUrl: string | null }
  | { type: 'pageThumbnailUnavailable'; pageId: string };

interface SortableOrganizePageCardProps {
  page: OrganizePageState;
  index: number;
  displayPageNumber: number;
  disabled: boolean;
  canReorder: boolean;
  isOverlay?: boolean;
  onToggleSelected: (pageId: string) => void;
  onRotate: (pageId: string) => void;
  onRemove: (pageId: string) => void;
}

const initialState: OrganizeWorkspaceState = {
  selectedFile: null,
  selectedFileEntry: null,
  previewSession: null,
  pageStates: [],
  currentPaginationPage: 1,
  isReadingPdf: false,
  localErrorMessage: null,
};

function reorderPagesById(
  pages: OrganizePageState[],
  sourceId: string,
  targetId: string,
): OrganizePageState[] {
  const sourceIndex = pages.findIndex((page) => page.id === sourceId);
  const targetIndex = pages.findIndex((page) => page.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return pages;
  }

  return reorderListByIndex(pages, sourceIndex, targetIndex);
}

function buildPaginationItems(totalPages: number, currentPage: number): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
  }

  const sortedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items: PaginationToken[] = [];

  for (const [index, page] of sortedPages.entries()) {
    const previous = sortedPages[index - 1];
    if (previous && page - previous > 1) {
      items.push('ellipsis');
    }

    items.push(page);
  }

  return items;
}

function getVisiblePageRangeLabel(
  currentPage: number,
  pageSize: number,
  totalPages: number,
): string {
  if (totalPages < 1) {
    return 'No pages available';
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, totalPages);
  return `Showing pages ${String(start)}-${String(end)} of ${String(totalPages)}`;
}

function createOrganizePageStates(pageCount: number): OrganizePageState[] {
  return Array.from({ length: pageCount }, (_, index) => ({
    id: `page-${String(index + 1)}`,
    sourcePageNumber: index + 1,
    rotationQuarterTurns: 0,
    isDeleted: false,
    thumbnailDataUrl: null,
    thumbnailStatus: 'idle' as const,
  }));
}

function organizeWorkspaceReducer(
  state: OrganizeWorkspaceState,
  action: OrganizeWorkspaceAction,
): OrganizeWorkspaceState {
  switch (action.type) {
    case 'fileSelectionStarted':
      return {
        ...state,
        selectedFile: action.file,
        selectedFileEntry: {
          id: action.entryId,
          file: action.file,
          pageCount: null,
          previewDataUrl: null,
          previewStatus: 'loading',
        },
        previewSession: null,
        pageStates: [],
        currentPaginationPage: 1,
        isReadingPdf: true,
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
    case 'previewSessionLoaded':
      return {
        ...state,
        previewSession: action.previewSession,
        selectedFileEntry:
          state.selectedFileEntry?.id === action.entryId
            ? {
                ...state.selectedFileEntry,
                pageCount: action.previewSession.pageCount,
              }
            : state.selectedFileEntry,
        pageStates: createOrganizePageStates(action.previewSession.pageCount),
        currentPaginationPage: 1,
        isReadingPdf: false,
      };
    case 'previewSessionFailed':
      return {
        ...initialState,
        localErrorMessage: action.message,
      };
    case 'replaceFile':
      return {
        ...initialState,
      };
    case 'localErrorCleared':
      return {
        ...state,
        localErrorMessage: null,
      };
    case 'paginationClamped':
      return {
        ...state,
        currentPaginationPage: Math.min(
          state.currentPaginationPage,
          Math.max(1, action.totalPaginationPages),
        ),
      };
    case 'paginationPageSet':
      return {
        ...state,
        currentPaginationPage: action.page,
      };
    case 'paginationOffset': {
      const nextPage = Math.min(
        Math.max(state.currentPaginationPage + action.offset, 1),
        action.totalPaginationPages,
      );

      return {
        ...state,
        currentPaginationPage: nextPage,
      };
    }
    case 'pageSelectionToggled':
      return {
        ...state,
        localErrorMessage: null,
        pageStates: state.pageStates.map((page) =>
          page.id === action.pageId
            ? {
                ...page,
                isDeleted: !page.isDeleted,
              }
            : page,
        ),
      };
    case 'pageRotated':
      return {
        ...state,
        localErrorMessage: null,
        pageStates: state.pageStates.map((page) =>
          page.id === action.pageId
            ? {
                ...page,
                rotationQuarterTurns: normalizeQuarterTurns(
                  page.rotationQuarterTurns + 1,
                ),
              }
            : page,
        ),
      };
    case 'pageRemoved':
      return {
        ...state,
        localErrorMessage: null,
        pageStates: state.pageStates.map((page) =>
          page.id === action.pageId
            ? {
                ...page,
                isDeleted: true,
              }
            : page,
        ),
      };
    case 'pagesReordered':
      return {
        ...state,
        localErrorMessage: null,
        pageStates: reorderPagesById(
          state.pageStates,
          action.sourceId,
          action.targetId,
        ),
      };
    case 'pagesMarkedLoading': {
      const targetIds = new Set(action.pageIds);
      if (targetIds.size < 1) {
        return state;
      }

      return {
        ...state,
        pageStates: state.pageStates.map((page) =>
          targetIds.has(page.id)
            ? {
                ...page,
                thumbnailStatus: 'loading',
              }
            : page,
        ),
      };
    }
    case 'pageThumbnailLoaded':
      return {
        ...state,
        pageStates: state.pageStates.map((page) =>
          page.id === action.pageId
            ? {
                ...page,
                thumbnailStatus: action.thumbnailDataUrl ? 'ready' : 'unavailable',
                thumbnailDataUrl: action.thumbnailDataUrl,
              }
            : page,
        ),
      };
    case 'pageThumbnailUnavailable':
      return {
        ...state,
        pageStates: state.pageStates.map((page) =>
          page.id === action.pageId
            ? {
                ...page,
                thumbnailStatus: 'unavailable',
                thumbnailDataUrl: null,
              }
            : page,
        ),
      };
    default:
      return state;
  }
}

function getProjectedTargetId(
  items: { id: string }[],
  sourceId: string,
  targetIndex: number,
): string | null {
  if (targetIndex < 0 || targetIndex >= items.length) {
    return null;
  }

  const targetId = items[targetIndex]?.id;

  if (!targetId || targetId === sourceId) {
    return null;
  }

  return targetId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getEventSourceId(event: unknown): string | null {
  if (!isRecord(event) || !isRecord(event.operation) || !isRecord(event.operation.source)) {
    return null;
  }

  return typeof event.operation.source.id === 'string'
    ? event.operation.source.id
    : null;
}

function getEventTargetId(event: unknown): string | null {
  if (!isRecord(event) || !isRecord(event.operation) || !isRecord(event.operation.target)) {
    return null;
  }

  return typeof event.operation.target.id === 'string'
    ? event.operation.target.id
    : null;
}

function getEventSortableIndex(event: unknown): number | null {
  if (
    !isRecord(event) ||
    !isRecord(event.operation) ||
    !isRecord(event.operation.source) ||
    !isRecord(event.operation.source.sortable)
  ) {
    return null;
  }

  return typeof event.operation.source.sortable.index === 'number'
    ? event.operation.source.sortable.index
    : null;
}

function OrganizePageCardContent({
  page,
  displayPageNumber,
  disabled,
  onToggleSelected,
  onRotate,
  onRemove,
}: {
  page: OrganizePageState;
  displayPageNumber: number;
  disabled: boolean;
  onToggleSelected?: (pageId: string) => void;
  onRotate?: (pageId: string) => void;
  onRemove?: (pageId: string) => void;
}) {
  const rotationDegrees = quarterTurnsToDegrees(page.rotationQuarterTurns);
  const isSelected = !page.isDeleted;

  return (
    <Card className="gap-3 border border-border py-3 shadow-none ring-0">
      <CardContent className="space-y-3 px-3">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-white p-2">
          <div className="absolute left-3 right-3 top-3 z-20 flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Checkbox
                    checked={isSelected}
                    disabled={disabled || !onToggleSelected}
                    aria-label={`${isSelected ? 'Deselect' : 'Select'} page ${String(displayPageNumber)}`}
                    data-dnd-interactive="true"
                    className="size-5 rounded-full border-border bg-white shadow-sm"
                    onCheckedChange={() => {
                      onToggleSelected?.(page.id);
                    }}
                  />
                }
              />
              <TooltipContent>
                {isSelected ? 'Include page' : 'Re-include page'}
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={disabled || !isSelected || !onRotate}
                      className={OVERLAY_ICON_BUTTON_CLASS}
                      aria-label={`Rotate page ${String(displayPageNumber)}`}
                      data-dnd-interactive="true"
                      onClick={() => {
                        onRotate?.(page.id);
                      }}
                    >
                      <HugeiconsIcon icon={Rotate02Icon} strokeWidth={2} />
                    </Button>
                  }
                />
                <TooltipContent>Rotate page</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={disabled || !isSelected || !onRemove}
                      className={OVERLAY_ICON_BUTTON_CLASS}
                      aria-label={`Remove page ${String(displayPageNumber)}`}
                      data-dnd-interactive="true"
                      onClick={() => {
                        onRemove?.(page.id);
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                    </Button>
                  }
                />
                <TooltipContent>Exclude page</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <AspectRatio ratio={3 / 4} className="rounded-xl">
            {page.thumbnailStatus === 'loading' ? (
              <div className="flex h-full items-center justify-center">
                <Spinner className="h-5 w-5" />
              </div>
            ) : page.thumbnailDataUrl ? (
              <img
                src={page.thumbnailDataUrl}
                alt={`Preview for page ${String(page.sourcePageNumber)}`}
                draggable={false}
                className={cn(
                  'h-full w-full rounded-xl object-contain object-top origin-center transition-transform duration-300 ease-out',
                  page.isDeleted && 'opacity-40',
                )}
                style={{ transform: `rotate(${String(rotationDegrees)}deg)` }}
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Preview unavailable
              </div>
            )}
          </AspectRatio>

          {page.isDeleted ? (
            <div className="absolute inset-0 z-10 flex items-end justify-center bg-background/40 pb-3">
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
                Excluded from download
              </span>
            </div>
          ) : null}
        </div>

        <div className="px-1">
          <p className="text-base font-semibold select-none">{`Page ${String(displayPageNumber)}`}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableOrganizePageCard({
  page,
  index,
  displayPageNumber,
  disabled,
  canReorder,
  isOverlay = false,
  onToggleSelected,
  onRotate,
  onRemove,
}: SortableOrganizePageCardProps) {
  const {
    ref,
    isDragging,
    isDropTarget,
  } = useSortable({
    id: page.id,
    index,
    disabled: isOverlay || disabled || !canReorder,
  });

  return (
    <li
      ref={isOverlay ? undefined : ref}
      data-testid="organize-page-card"
      className={cn(
        PAGE_CARD_CLASS_NAME,
        canReorder && !disabled && !isOverlay && 'cursor-grab active:cursor-grabbing',
        isDragging && 'ring-2 ring-ring shadow-sm',
        isDropTarget && 'border-primary/60 ring-2 ring-primary/30',
      )}
      tabIndex={canReorder && !disabled && !isOverlay ? 0 : undefined}
      aria-label={
        canReorder && !isOverlay
          ? `Reorder page ${String(displayPageNumber)}`
          : undefined
      }
    >
      <OrganizePageCardContent
        page={page}
        displayPageNumber={displayPageNumber}
        disabled={disabled}
        onToggleSelected={isOverlay ? undefined : onToggleSelected}
        onRotate={isOverlay ? undefined : onRotate}
        onRemove={isOverlay ? undefined : onRemove}
      />
    </li>
  );
}

function OrganizePageOverlay({
  page,
  displayPageNumber,
}: {
  page: OrganizePageState;
  displayPageNumber: number;
}) {
  return (
    <li className={PAGE_CARD_CLASS_NAME}>
      <OrganizePageCardContent
        page={page}
        displayPageNumber={displayPageNumber}
        disabled
      />
    </li>
  );
}

function OrganizeSummaryBar({
  selectedPageCount,
  excludedPageCount,
  visibleRangeLabel,
}: {
  selectedPageCount: number;
  excludedPageCount: number;
  visibleRangeLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        {`${String(selectedPageCount)} selected · ${String(excludedPageCount)} removed`}
      </p>
      <p className="text-sm text-muted-foreground">{visibleRangeLabel}</p>
    </div>
  );
}

interface OrganizePaginationControlsProps {
  currentPaginationPage: number;
  totalPaginationPages: number;
  onGoToPage: (page: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

function OrganizePaginationControls({
  currentPaginationPage,
  totalPaginationPages,
  onGoToPage,
  onPreviousPage,
  onNextPage,
}: OrganizePaginationControlsProps) {
  if (totalPaginationPages <= 1) {
    return null;
  }

  const paginationItems = buildPaginationItems(
    totalPaginationPages,
    currentPaginationPage,
  );

  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            text="Prev"
            aria-disabled={currentPaginationPage <= 1}
            className={cn(
              currentPaginationPage <= 1 && 'pointer-events-none opacity-50',
            )}
            onClick={(event) => {
              event.preventDefault();
              onPreviousPage();
            }}
          />
        </PaginationItem>
        {paginationItems.map((item, index) => (
          <PaginationItem key={`page-token-${String(item)}-${String(index)}`}>
            {item === 'ellipsis' ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                isActive={item === currentPaginationPage}
                aria-label={`Go to pagination page ${String(item)}`}
                onClick={(event) => {
                  event.preventDefault();
                  onGoToPage(item);
                }}
              >
                {String(item)}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href="#"
            text="Next"
            aria-disabled={currentPaginationPage >= totalPaginationPages}
            className={cn(
              currentPaginationPage >= totalPaginationPages &&
                'pointer-events-none opacity-50',
            )}
            onClick={(event) => {
              event.preventDefault();
              onNextPage();
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

interface OrganizePageGridProps {
  visiblePages: OrganizePageState[];
  startIndex: number;
  isExporting: boolean;
  onDragReorder: (sourceId: string, targetId: string) => void;
  onToggleSelected: (pageId: string) => void;
  onRotate: (pageId: string) => void;
  onRemove: (pageId: string) => void;
}

function OrganizePageGrid({
  visiblePages,
  startIndex,
  isExporting,
  onDragReorder,
  onToggleSelected,
  onRotate,
  onRemove,
}: OrganizePageGridProps) {
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const canReorder = visiblePages.length > 1;
  const activePage = visiblePages.find((page) => page.id === draggedPageId) ?? null;

  function handleDragStart(event: unknown) {
    setDraggedPageId(getEventSourceId(event));
  }

  function handleDragEnd(event: unknown) {
    const sourceId = getEventSourceId(event);
    setDraggedPageId(null);

    if (isExporting || typeof sourceId !== 'string') {
      return;
    }

    const nextIndex = getEventSortableIndex(event);
    const targetId =
      getEventTargetId(event) ??
      (nextIndex === null
        ? null
        : getProjectedTargetId(visiblePages, sourceId, nextIndex));

    if (!targetId) {
      return;
    }

    onDragReorder(sourceId, targetId);
  }

  return (
    <CspDragDropProvider
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePages.map((page, index) => (
          <SortableOrganizePageCard
            key={page.id}
            page={page}
            index={index}
            displayPageNumber={startIndex + index + 1}
            disabled={isExporting}
            canReorder={canReorder}
            onToggleSelected={onToggleSelected}
            onRotate={onRotate}
            onRemove={onRemove}
          />
        ))}
      </ul>

      <DragOverlay disabled={activePage == null}>
        {activePage ? (
          <ul className="grid w-full max-w-sm">
            <OrganizePageOverlay
              page={activePage}
              displayPageNumber={
                startIndex +
                visiblePages.findIndex((page) => page.id === activePage.id) +
                1
              }
            />
          </ul>
        ) : null}
      </DragOverlay>
    </CspDragDropProvider>
  );
}

function buildFileInfoEntry(
  selectedFile: File,
  selectedFileEntry: QueuedFile | null,
  pageStates: OrganizePageState[],
  isReadingPdf: boolean,
): QueuedFile {
  return selectedFileEntry ?? {
    id: 'organize-file-fallback',
    file: selectedFile,
    pageCount: pageStates.length > 0 ? pageStates.length : null,
    previewDataUrl: null,
    previewStatus: isReadingPdf ? 'loading' : 'unavailable',
  };
}

function OrganizeFileInfoPanel({
  fileInfoEntry,
  disabled,
  onRemove,
}: {
  fileInfoEntry: QueuedFile;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <FileQueueList
      title="Selected file"
      files={[fileInfoEntry]}
      disabled={disabled}
      showIndexBadge={false}
      onRemove={onRemove}
    />
  );
}

function OrganizeSelectionState({
  disabled,
  errorMessage,
  onSelectFile,
}: {
  disabled: boolean;
  errorMessage: string | null;
  onSelectFile: (file: File) => Promise<void>;
}) {
  return (
    <ToolWorkspace
      title="Organize PDF"
      description="Reorder, rotate, and remove pages before downloading a new PDF."
      inputPanel={
        <PdfFileSelector
          ariaLabel="Select PDF file for organizing"
          onSelect={(files) => {
            void onSelectFile(files[0]);
          }}
          disabled={disabled}
          title="Drag and drop a PDF to organize"
        />
      }
      errorMessage={errorMessage}
    />
  );
}

function OrganizeLoadingState({
  fileInfoPanel,
  errorMessage,
}: {
  fileInfoPanel: ReactNode;
  errorMessage: string | null;
}) {
  return (
    <ToolWorkspace
      title="Organize PDF"
      description="Reorder pages and export a new PDF."
      inputPanel={fileInfoPanel}
      outputPanel={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          <span>Reading PDF and preparing pages...</span>
        </div>
      }
      errorMessage={errorMessage}
    />
  );
}

interface OrganizeReadyStateProps {
  fileInfoPanel: ReactNode;
  selectedPageCount: number;
  excludedPageCount: number;
  visibleRangeLabel: string;
  currentPaginationPage: number;
  totalPaginationPages: number;
  visiblePages: OrganizePageState[];
  startIndex: number;
  isExporting: boolean;
  canExport: boolean;
  errorMessage: string | null;
  onGoToPage: (page: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onDragReorder: (sourceId: string, targetId: string) => void;
  onToggleSelected: (pageId: string) => void;
  onRotate: (pageId: string) => void;
  onRemove: (pageId: string) => void;
  onExport: () => void;
}

function OrganizeReadyState({
  fileInfoPanel,
  selectedPageCount,
  excludedPageCount,
  visibleRangeLabel,
  currentPaginationPage,
  totalPaginationPages,
  visiblePages,
  startIndex,
  isExporting,
  canExport,
  errorMessage,
  onGoToPage,
  onPreviousPage,
  onNextPage,
  onDragReorder,
  onToggleSelected,
  onRotate,
  onRemove,
  onExport,
}: OrganizeReadyStateProps) {
  return (
    <ToolWorkspace
      title="Organize PDF"
      description="Reorder pages with drag and drop, then download the updated PDF."
      inputPanel={fileInfoPanel}
      outputPanel={
        <section className="space-y-4">
          <OrganizeSummaryBar
            selectedPageCount={selectedPageCount}
            excludedPageCount={excludedPageCount}
            visibleRangeLabel={visibleRangeLabel}
          />

          <OrganizePaginationControls
            currentPaginationPage={currentPaginationPage}
            totalPaginationPages={totalPaginationPages}
            onGoToPage={onGoToPage}
            onPreviousPage={onPreviousPage}
            onNextPage={onNextPage}
          />

          <TooltipProvider>
            <OrganizePageGrid
              visiblePages={visiblePages}
              startIndex={startIndex}
              isExporting={isExporting}
              onDragReorder={onDragReorder}
              onToggleSelected={onToggleSelected}
              onRotate={onRotate}
              onRemove={onRemove}
            />
          </TooltipProvider>

          <div className="flex justify-end pt-1">
            <Button disabled={!canExport} onClick={onExport}>
              {isExporting ? 'Organizing...' : 'Organize and Download'}
            </Button>
          </div>
        </section>
      }
      errorMessage={errorMessage}
    />
  );
}

export function OrganizeToolScreen() {
  const fetcher = useFetcher<ToolActionResult>();
  const selectionTokenRef = useRef(0);
  const [state, dispatch] = useReducer(organizeWorkspaceReducer, initialState);
  const isExporting = fetcher.state !== 'idle';

  const selectedPageCount = state.pageStates.filter((page) => !page.isDeleted).length;
  const excludedPageCount = state.pageStates.length - selectedPageCount;
  const totalPaginationPages = Math.max(
    1,
    Math.ceil(state.pageStates.length / PAGES_PER_VIEW),
  );
  const startIndex = (state.currentPaginationPage - 1) * PAGES_PER_VIEW;
  const visiblePages = state.pageStates.slice(
    startIndex,
    startIndex + PAGES_PER_VIEW,
  );
  const canExport =
    !!state.selectedFile &&
    selectedPageCount > 0 &&
    state.pageStates.length > 0 &&
    !isExporting &&
    !state.isReadingPdf;
  const actionErrorMessage =
    fetcher.data && !fetcher.data.ok ? fetcher.data.message : null;
  const errorMessage = state.localErrorMessage ?? actionErrorMessage;
  const successMessage = fetcher.data?.ok ? fetcher.data.message : null;

  useSuccessToast(successMessage);

  useEffect(() => {
    return () => {
      if (state.previewSession) {
        void state.previewSession.destroy();
      }
    };
  }, [state.previewSession]);

  useEffect(() => {
    dispatch({ type: 'paginationClamped', totalPaginationPages });
  }, [totalPaginationPages]);

  useEffect(() => {
    if (!state.previewSession || state.pageStates.length < 1) {
      return;
    }

    const targetPageNumbers = new Set<number>();

    for (const pageOffset of [-1, 0, 1]) {
      const paginationPage = state.currentPaginationPage + pageOffset;
      if (paginationPage < 1 || paginationPage > totalPaginationPages) {
        continue;
      }

      const rangeStart = (paginationPage - 1) * PAGES_PER_VIEW;
      const rangeEnd = rangeStart + PAGES_PER_VIEW;
      const pagesInRange = state.pageStates.slice(rangeStart, rangeEnd);

      for (const page of pagesInRange) {
        targetPageNumbers.add(page.sourcePageNumber);
      }
    }

    const pagesToLoad = state.pageStates.filter(
      (page) =>
        targetPageNumbers.has(page.sourcePageNumber) &&
        page.thumbnailStatus === 'idle',
    );

    if (pagesToLoad.length < 1) {
      return;
    }

    const activeSelectionToken = selectionTokenRef.current;
    dispatch({
      type: 'pagesMarkedLoading',
      pageIds: pagesToLoad.map((page) => page.id),
    });

    for (const page of pagesToLoad) {
      void state.previewSession
        .getPageThumbnail(page.sourcePageNumber)
        .then((thumbnailDataUrl) => {
          if (selectionTokenRef.current !== activeSelectionToken) {
            return;
          }

          dispatch({
            type: 'pageThumbnailLoaded',
            pageId: page.id,
            thumbnailDataUrl,
          });
        })
        .catch(() => {
          if (selectionTokenRef.current !== activeSelectionToken) {
            return;
          }

          dispatch({ type: 'pageThumbnailUnavailable', pageId: page.id });
        });
    }
  }, [
    state.currentPaginationPage,
    state.pageStates,
    state.previewSession,
    totalPaginationPages,
  ]);

  async function handleFileSelected(file: File) {
    const selectionToken = selectionTokenRef.current + 1;
    const entryId = `organize-file-${String(selectionToken)}`;
    selectionTokenRef.current = selectionToken;

    dispatch({ type: 'fileSelectionStarted', file, entryId });

    void readPdfDetails(file)
      .then((details) => {
        if (selectionTokenRef.current !== selectionToken) {
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
        if (selectionTokenRef.current !== selectionToken) {
          return;
        }

        dispatch({ type: 'fileDetailsFailed', entryId });
      });

    try {
      const nextPreviewSession = await readOrganizePreview(file);

      if (selectionTokenRef.current !== selectionToken) {
        await nextPreviewSession.destroy();
        return;
      }

      if (nextPreviewSession.pageCount < 1) {
        await nextPreviewSession.destroy();
        throw new Error('This PDF has no pages to organize.');
      }

      dispatch({
        type: 'previewSessionLoaded',
        entryId,
        previewSession: nextPreviewSession,
      });
    } catch (error: unknown) {
      if (selectionTokenRef.current !== selectionToken) {
        return;
      }

      const fallback = 'Failed to read PDF pages.';
      dispatch({
        type: 'previewSessionFailed',
        message: error instanceof Error ? error.message : fallback,
      });
    }
  }

  function handleReplaceFile() {
    if (state.isReadingPdf || isExporting) {
      return;
    }

    selectionTokenRef.current += 1;
    dispatch({ type: 'replaceFile' });
  }

  function handleExport() {
    if (!state.selectedFile) {
      return;
    }

    dispatch({ type: 'localErrorCleared' });

    const submissionId = saveClientActionFallback({
      file: state.selectedFile,
      pages: state.pageStates,
    });
    const formData = new FormData();
    formData.set('file', state.selectedFile);
    formData.set('pages', JSON.stringify(state.pageStates));
    formData.set('submissionId', submissionId);
    void fetcher.submit(formData, { method: 'post' });
  }

  if (!state.selectedFile) {
    return (
      <OrganizeSelectionState
        disabled={state.isReadingPdf || isExporting}
        errorMessage={errorMessage}
        onSelectFile={handleFileSelected}
      />
    );
  }

  const fileInfoEntry = buildFileInfoEntry(
    state.selectedFile,
    state.selectedFileEntry,
    state.pageStates,
    state.isReadingPdf,
  );
  const fileInfoPanel = (
    <OrganizeFileInfoPanel
      fileInfoEntry={fileInfoEntry}
      disabled={state.isReadingPdf || isExporting}
      onRemove={handleReplaceFile}
    />
  );

  if (state.isReadingPdf || !state.previewSession || state.pageStates.length < 1) {
    return (
      <OrganizeLoadingState
        fileInfoPanel={fileInfoPanel}
        errorMessage={errorMessage}
      />
    );
  }

  const visibleRangeLabel = getVisiblePageRangeLabel(
    state.currentPaginationPage,
    PAGES_PER_VIEW,
    state.pageStates.length,
  );

  return (
    <OrganizeReadyState
      fileInfoPanel={fileInfoPanel}
      selectedPageCount={selectedPageCount}
      excludedPageCount={excludedPageCount}
      visibleRangeLabel={visibleRangeLabel}
      currentPaginationPage={state.currentPaginationPage}
      totalPaginationPages={totalPaginationPages}
      visiblePages={visiblePages}
      startIndex={startIndex}
      isExporting={isExporting}
      canExport={canExport}
      errorMessage={errorMessage}
      onGoToPage={(page) => {
        dispatch({ type: 'paginationPageSet', page });
      }}
      onPreviousPage={() => {
        dispatch({
          type: 'paginationOffset',
          offset: -1,
          totalPaginationPages,
        });
      }}
      onNextPage={() => {
        dispatch({
          type: 'paginationOffset',
          offset: 1,
          totalPaginationPages,
        });
      }}
      onDragReorder={(sourceId, targetId) => {
        dispatch({ type: 'pagesReordered', sourceId, targetId });
      }}
      onToggleSelected={(pageId) => {
        dispatch({ type: 'pageSelectionToggled', pageId });
      }}
      onRotate={(pageId) => {
        dispatch({ type: 'pageRotated', pageId });
      }}
      onRemove={(pageId) => {
        dispatch({ type: 'pageRemoved', pageId });
      }}
      onExport={handleExport}
    />
  );
}
