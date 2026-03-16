import { type ReactNode, useState } from 'react';
import { DragOverlay } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { Cancel01Icon, File01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { CspDragDropProvider } from '~/components/dnd/csp-drag-drop-provider';
import { AspectRatio } from '~/components/ui/aspect-ratio';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Spinner } from '~/components/ui/spinner';

import { cn } from '~/lib/utils';

export interface QueuedFile {
  id: string;
  file: File;
  pageCount: number | null;
  previewDataUrl: string | null;
  previewStatus: 'loading' | 'ready' | 'unavailable';
  metadataText?: string;
}

interface FileQueueListProps {
  title?: string;
  files: QueuedFile[];
  disabled?: boolean;
  showIndexBadge?: boolean;
  onReorder?: (activeId: string, overId: string) => void;
  onRemove?: (id: string) => void;
  appendItem?: ReactNode;
}

const FILE_ROW_CLASS_NAME = 'relative rounded-2xl select-none transition-shadow touch-none';
const FILE_ROW_ACTION_BUTTON_CLASS =
  'h-9 w-9 shrink-0 rounded-full border-border/90 bg-card/90 text-foreground shadow-md backdrop-blur-xl hover:bg-card';

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(2)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
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

interface FileQueueRowCardProps {
  entry: QueuedFile;
  index: number;
  disabled: boolean;
  showIndexBadge: boolean;
  onRemove?: (id: string) => void;
}

function FileQueueRowCard({
  entry,
  index,
  disabled,
  showIndexBadge,
  onRemove,
}: FileQueueRowCardProps) {
  return (
    <Card className="h-full gap-0 border border-border/90 py-3 shadow-none ring-0">
      <CardContent className="px-3">
        <div className="flex items-center gap-3 lg:flex-col lg:items-stretch">
          <div className="w-[76px] shrink-0 lg:w-full">
            <AspectRatio
              ratio={4 / 5}
              className="overflow-hidden rounded-lg border border-border/70 bg-white dark:border-white/15"
            >
              {entry.previewStatus === 'loading' ? (
                <div className="flex h-full w-full items-center justify-center bg-background/80">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : entry.previewDataUrl ? (
                <img
                  src={entry.previewDataUrl}
                  alt={`First page preview of ${entry.file.name}`}
                  draggable={false}
                  className="h-full w-full object-cover object-top transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-background">
                  <HugeiconsIcon icon={File01Icon} size={30} />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08),inset_0_0_24px_-14px_rgba(15,23,42,0.28)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_0_40px_-8px_rgba(0,0,0,0.78)]" />
            </AspectRatio>
          </div>

          <div
            className={cn(
              'grid min-w-0 flex-1 gap-x-2 lg:w-full',
              showIndexBadge ? 'grid-cols-[2rem_minmax(0,1fr)]' : 'grid-cols-1',
            )}
          >
            {showIndexBadge ? (
              <span className="row-span-3 inline-flex h-10 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
            ) : null}
            <p className="text-sm font-semibold leading-tight break-all select-none [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
              {entry.file.name}
            </p>
            <p className="text-xs text-muted-foreground select-none">
              {entry.metadataText ?? (
                entry.pageCount === null
                  ? 'Pages unavailable'
                  : `${String(entry.pageCount)} page${entry.pageCount === 1 ? '' : 's'}`
              )}
            </p>
            <p className="text-xs text-muted-foreground select-none">
              {formatBytes(entry.file.size)}
            </p>
          </div>

          {onRemove ? (
            <div className="flex shrink-0 items-center gap-2 self-start lg:absolute lg:right-4 lg:top-4 lg:z-20">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Remove ${entry.file.name}`}
                data-dnd-interactive="true"
                onClick={() => {
                  onRemove(entry.id);
                }}
                disabled={disabled}
                className={FILE_ROW_ACTION_BUTTON_CLASS}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={20} />
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

interface SortableFileRowProps {
  entry: QueuedFile;
  index: number;
  disabled: boolean;
  showIndexBadge: boolean;
  canReorder: boolean;
  isOverlay?: boolean;
  onRemove?: (id: string) => void;
}

function SortableFileRow({
  entry,
  index,
  disabled,
  showIndexBadge,
  canReorder,
  isOverlay = false,
  onRemove,
}: SortableFileRowProps) {
  const {
    ref,
    isDragging,
    isDropTarget,
  } = useSortable({
    id: entry.id,
    index,
    disabled: isOverlay || disabled || !canReorder,
  });

  return (
    <li
      ref={isOverlay ? undefined : ref}
      data-testid="file-queue-item"
      className={cn(
        FILE_ROW_CLASS_NAME,
        canReorder && !disabled && !isOverlay && 'cursor-grab active:cursor-grabbing',
        isDragging && 'ring-2 ring-ring shadow-sm',
        isDropTarget && 'border-primary/60 ring-2 ring-primary/30',
        disabled && 'opacity-70',
      )}
      tabIndex={canReorder && !disabled && !isOverlay ? 0 : undefined}
      aria-label={canReorder && !isOverlay ? `Reorder ${entry.file.name}` : undefined}
    >
      <FileQueueRowCard
        entry={entry}
        index={index}
        disabled={disabled}
        showIndexBadge={showIndexBadge}
        onRemove={isOverlay ? undefined : onRemove}
      />
    </li>
  );
}

function FileQueueRowOverlay({
  entry,
  index,
  disabled,
  showIndexBadge,
}: Omit<SortableFileRowProps, 'isOverlay' | 'onRemove'>) {
  return (
    <li className={cn(FILE_ROW_CLASS_NAME, disabled && 'opacity-70')}>
      <FileQueueRowCard
        entry={entry}
        index={index}
        disabled={disabled}
        showIndexBadge={showIndexBadge}
      />
    </li>
  );
}

export function FileQueueList({
  title = 'Selected files',
  files,
  disabled = false,
  showIndexBadge = true,
  onReorder,
  onRemove,
  appendItem,
}: FileQueueListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  if (files.length === 0) {
    return null;
  }

  const canReorder = !!onReorder && files.length > 1;
  const activeEntry = files.find((entry) => entry.id === draggedId) ?? null;
  const reorderFiles = onReorder;

  function handleDragStart(event: unknown) {
    setDraggedId(getEventSourceId(event));
  }

  function handleDragEnd(event: unknown) {
    const sourceId = getEventSourceId(event);
    setDraggedId(null);

    if (!canReorder || disabled || !reorderFiles || typeof sourceId !== 'string') {
      return;
    }

    const nextIndex = getEventSortableIndex(event);
    const targetId =
      getEventTargetId(event) ??
      (nextIndex === null ? null : getProjectedTargetId(files, sourceId, nextIndex));

    if (!targetId) {
      return;
    }

    reorderFiles(sourceId, targetId);
  }

  return (
    <section className="space-y-3" aria-label={title}>
      <CspDragDropProvider
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((entry, index) => (
            <SortableFileRow
              key={entry.id}
              entry={entry}
              index={index}
              disabled={disabled}
              showIndexBadge={showIndexBadge}
              canReorder={canReorder}
              onRemove={onRemove}
            />
          ))}
          {appendItem}
        </ul>

        <DragOverlay disabled={activeEntry == null}>
          {activeEntry !== null ? (
            <ul className="grid w-full max-w-sm">
              <FileQueueRowOverlay
                entry={activeEntry}
                index={files.findIndex((entry) => entry.id === activeEntry.id)}
                disabled
                showIndexBadge={showIndexBadge}
                canReorder={canReorder}
              />
            </ul>
          ) : null}
        </DragOverlay>
      </CspDragDropProvider>
    </section>
  );
}
