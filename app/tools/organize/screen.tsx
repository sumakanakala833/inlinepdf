import { type ReactNode, useState } from 'react';
import { DragOverlay } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Rotate02Icon from '@hugeicons/core-free-icons/Rotate02Icon';
import { HugeiconsIcon } from '@hugeicons/react';

import { CspDragDropProvider } from '~/components/dnd/csp-drag-drop-provider';
import { PdfFileSelector } from '~/components/pdf-file-selector';
import { AspectRatio } from '~/components/ui/aspect-ratio';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import { Card, CardContent } from '~/components/ui/card';
import { Checkbox } from '~/components/ui/checkbox';
import {
  FileQueueList,
  type QueuedFile,
} from '~/shared/tool-ui/file-queue-list';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '~/components/ui/pagination';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import type { OrganizePageState } from '~/tools/organize/models';
import { quarterTurnsToDegrees } from '~/tools/organize/models';
import { organizeToolDefinition } from '~/tools/organize/definition';
import { ToolWorkspace } from '~/shared/tool-ui/tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';
import { buildOrganizePaginationItems } from '~/tools/organize/workspace-state';
import { useOrganizeWorkspace } from '~/tools/organize/use-organize-workspace';
import { cn } from '~/lib/utils';
const OVERLAY_ICON_BUTTON_CLASS =
  'rounded-full border-border bg-white text-foreground shadow-sm hover:bg-white active:bg-white';
const PAGE_CARD_CLASS_NAME =
  'rounded-2xl select-none transition-shadow touch-none';

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
  if (
    !isRecord(event) ||
    !isRecord(event.operation) ||
    !isRecord(event.operation.source)
  ) {
    return null;
  }

  return typeof event.operation.source.id === 'string'
    ? event.operation.source.id
    : null;
}

function getEventTargetId(event: unknown): string | null {
  if (
    !isRecord(event) ||
    !isRecord(event.operation) ||
    !isRecord(event.operation.target)
  ) {
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
                Excluded from export
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
  const { ref, isDragging, isDropTarget } = useSortable({
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
        canReorder &&
          !disabled &&
          !isOverlay &&
          'cursor-grab active:cursor-grabbing',
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

  const paginationItems = buildOrganizePaginationItems(
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
  const activePage =
    visiblePages.find((page) => page.id === draggedPageId) ?? null;

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
      title="Selected File"
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
      description="Reorder, rotate, and remove pages, then export a new PDF."
      titleIcon={organizeToolDefinition.icon}
      inputPanel={
        <PdfFileSelector
          ariaLabel="Select PDF file for organizing"
          onSelect={(files) => {
            void onSelectFile(files[0]);
          }}
          disabled={disabled}
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
      titleIcon={organizeToolDefinition.icon}
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
      description="Reorder pages and export the updated PDF."
      titleIcon={organizeToolDefinition.icon}
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
              {isExporting ? <Spinner data-icon="inline-start" /> : null}
              {isExporting ? 'Organizing...' : 'Export PDF'}
            </Button>
          </div>
        </section>
      }
      errorMessage={errorMessage}
    />
  );
}

export function OrganizeToolScreen() {
  const workspace = useOrganizeWorkspace();

  useSuccessToast(workspace.successMessage);

  if (!workspace.selectedFile) {
    return (
      <OrganizeSelectionState
        disabled={workspace.isReadingPdf || workspace.isExporting}
        errorMessage={workspace.errorMessage}
        onSelectFile={workspace.handleFileSelected}
      />
    );
  }

  if (!workspace.fileInfoEntry) {
    return null;
  }

  const fileInfoPanel = (
    <OrganizeFileInfoPanel
      fileInfoEntry={workspace.fileInfoEntry}
      disabled={workspace.isReadingPdf || workspace.isExporting}
      onRemove={() => {
        workspace.handleReplaceFile();
      }}
    />
  );

  if (workspace.isLoadingPreview) {
    return (
      <OrganizeLoadingState
        fileInfoPanel={fileInfoPanel}
        errorMessage={workspace.errorMessage}
      />
    );
  }

  return (
    <OrganizeReadyState
      fileInfoPanel={fileInfoPanel}
      selectedPageCount={workspace.selectedPageCount}
      excludedPageCount={workspace.excludedPageCount}
      visibleRangeLabel={workspace.visibleRangeLabel}
      currentPaginationPage={workspace.currentPaginationPage}
      totalPaginationPages={workspace.totalPaginationPages}
      visiblePages={workspace.visiblePages}
      startIndex={workspace.startIndex}
      isExporting={workspace.isExporting}
      canExport={workspace.canExport}
      errorMessage={workspace.errorMessage}
      onGoToPage={(page) => {
        workspace.goToPage(page);
      }}
      onPreviousPage={() => {
        workspace.goToPreviousPage();
      }}
      onNextPage={() => {
        workspace.goToNextPage();
      }}
      onDragReorder={(sourceId, targetId) => {
        workspace.reorderPages(sourceId, targetId);
      }}
      onToggleSelected={(pageId) => {
        workspace.togglePageSelected(pageId);
      }}
      onRotate={(pageId) => {
        workspace.rotatePage(pageId);
      }}
      onRemove={(pageId) => {
        workspace.removePage(pageId);
      }}
      onExport={() => {
        workspace.handleExport();
      }}
    />
  );
}
