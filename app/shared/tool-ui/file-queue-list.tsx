import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import { type ReactNode } from 'react';
import type { DragDropEventHandlers } from '@dnd-kit/react';
import { isSortableOperation, useSortable } from '@dnd-kit/react/sortable';
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
  listClassName?: string;
  onReorder?: (activeId: string, overId: string) => void;
  onRemove?: (id: string) => void;
  appendItem?: ReactNode;
}

const FILE_ROW_CLASS_NAME =
  'relative rounded-2xl select-none transition-shadow touch-none';

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
  const pageText =
    entry.metadataText ??
    (entry.pageCount === null
      ? 'Pages unavailable'
      : `${String(entry.pageCount)} page${entry.pageCount === 1 ? '' : 's'}`);

  return (
    <Card className="depth-shadow-s h-full gap-0 border border-border/90 bg-muted/45 py-3 shadow-none ring-0 dark:depth-shadow-l dark:bg-card/95 dark:border-border/80">
      <CardContent className="px-3">
        <div className="flex items-center gap-3 lg:flex-col lg:items-stretch">
          <div className="w-[76px] shrink-0 lg:w-full">
            <AspectRatio
              ratio={4 / 5}
              className="overflow-hidden rounded-lg bg-muted/45 dark:bg-muted/30"
            >
              {entry.previewStatus === 'loading' ? (
                <div className="flex h-full w-full items-center justify-center bg-background/80">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : entry.previewDataUrl ? (
                <>
                  <img
                    src={entry.previewDataUrl}
                    alt={`First page preview of ${entry.file.name}`}
                    draggable={false}
                    className="h-full w-full object-cover object-top transition-transform duration-300"
                    loading="lazy"
                  />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-background">
                  <HugeiconsIcon icon={File01Icon} size={30} />
                </div>
              )}
            </AspectRatio>
          </div>

          <div
            className={cn(
              'grid min-w-0 flex-1 gap-x-2 lg:w-full',
              showIndexBadge ? 'grid-cols-[2rem_minmax(0,1fr)]' : 'grid-cols-1',
            )}
          >
            {showIndexBadge ? (
              <span className="row-span-3 self-center inline-flex h-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 px-2 text-xs font-semibold tabular-nums text-primary shadow-sm">
                {index + 1}
              </span>
            ) : null}
            <p className="text-[0.95rem] font-semibold leading-snug tracking-[-0.01em] wrap-break-word text-foreground select-none [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
              {entry.file.name}
            </p>
            <p className="text-xs leading-relaxed font-medium tabular-nums text-foreground/90 select-none">
              {pageText}
            </p>
            <p className="text-xs leading-relaxed font-medium tabular-nums text-foreground/80 select-none">
              {formatBytes(entry.file.size)}
            </p>
          </div>

          {onRemove ? (
            <div className="flex shrink-0 items-center justify-center self-center lg:absolute lg:right-4 lg:top-4 lg:z-20 lg:self-auto">
              <Button
                type="button"
                size="icon"
                aria-label={`Remove ${entry.file.name}`}
                data-dnd-interactive="true"
                onClick={() => {
                  onRemove(entry.id);
                }}
                disabled={disabled}
                className="hover:bg-destructive hover:text-white hover:border-destructive"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={2} />
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
  onRemove?: (id: string) => void;
}

function SortableFileRow({
  entry,
  index,
  disabled,
  showIndexBadge,
  canReorder,
  onRemove,
}: SortableFileRowProps) {
  const { ref, isDragging } = useSortable({
    id: entry.id,
    index,
    disabled: disabled || !canReorder,
    transition: {
      duration: 250,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      idle: false,
    },
  });

  return (
    <li
      ref={ref}
      data-testid="file-queue-item"
      className={cn(
        FILE_ROW_CLASS_NAME,
        canReorder &&
          !disabled &&
          'cursor-grab active:cursor-grabbing',
        isDragging && 'ring-2 ring-ring shadow-sm',
        disabled && 'opacity-70',
      )}
      tabIndex={canReorder && !disabled ? 0 : undefined}
      aria-label={canReorder ? `Reorder ${entry.file.name}` : undefined}
    >
      <FileQueueRowCard
        entry={entry}
        index={index}
        disabled={disabled}
        showIndexBadge={showIndexBadge}
        onRemove={onRemove}
      />
    </li>
  );
}

export function FileQueueList({
  title = 'Selected files',
  files,
  disabled = false,
  showIndexBadge = true,
  listClassName,
  onReorder,
  onRemove,
  appendItem,
}: FileQueueListProps) {
  if (files.length === 0) {
    return null;
  }

  const canReorder = !!onReorder && files.length > 1;
  const reorderFiles = onReorder;

  const handleDragEnd: NonNullable<DragDropEventHandlers['onDragEnd']> = (
    event,
  ) => {
    if (!canReorder || disabled || !reorderFiles || event.canceled) {
      return;
    }

    if (!isSortableOperation(event.operation)) {
      return;
    }

    const { source, target } = event.operation;
    const sourceId = source && typeof source.id === 'string' ? source.id : null;
    const targetId = target && typeof target.id === 'string' ? target.id : null;

    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }

    reorderFiles(sourceId, targetId);
  };

  return (
    <section className="isolate space-y-3" aria-label={title}>
      <CspDragDropProvider onDragEnd={handleDragEnd}>
        <ul
          className={
            listClassName ??
            'grid grid-cols-1 items-start gap-3 [contain:layout] sm:grid-cols-2 lg:grid-cols-3'
          }
        >
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
      </CspDragDropProvider>
    </section>
  );
}
