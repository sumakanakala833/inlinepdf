import { Add01Icon, File01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { type ChangeEvent, type DragEvent, useRef, useState } from 'react';

import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';

type SelectorVariant = 'dropzone' | 'inline' | 'tile';

interface PdfFileSelectorProps {
  disabled?: boolean;
  multiple?: boolean;
  onSelect: (files: File[]) => void;
  ariaLabel: string;
  accept?: string;
  variant?: SelectorVariant;
  title?: string;
  description?: string;
  buttonLabel?: string;
}

function filesFromList(fileList: FileList | null, multiple: boolean): File[] {
  const files = Array.from(fileList ?? []);

  if (multiple) {
    return files;
  }

  if (files.length === 0) {
    return [];
  }

  return [files[0]];
}

export function PdfFileSelector({
  disabled = false,
  multiple = false,
  onSelect,
  ariaLabel,
  accept = 'application/pdf,.pdf',
  variant = 'dropzone',
  title,
  description,
  buttonLabel,
}: PdfFileSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  function commitSelection(fileList: FileList | null) {
    if (disabled) {
      return;
    }

    const files = filesFromList(fileList, multiple);
    if (files.length > 0) {
      onSelect(files);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    commitSelection(event.currentTarget.files);
    event.currentTarget.value = '';
  }

  function openPicker() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  const defaultTitle = multiple
    ? 'Drag and drop PDF files'
    : 'Drag and drop a PDF file';
  const defaultDescription = multiple
    ? 'Select PDF files by dragging and dropping, or choose from your device.'
    : 'Select a PDF file by dragging and dropping, or choose from your device.';

  return (
    <section>
      <Input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
        aria-label={ariaLabel}
      />

      {variant === 'inline' ? (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-auto w-full items-center justify-center gap-3 rounded-xl border-dashed bg-card px-4 py-5 text-sm transition-colors',
            !disabled && 'hover:border-primary/40 hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-70',
          )}
          onClick={openPicker}
        >
          <HugeiconsIcon icon={Add01Icon} size={18} />
          {buttonLabel ?? 'Select more PDF files'}
        </Button>
      ) : variant === 'tile' ? (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-full min-h-[136px] w-full rounded-2xl border-dashed bg-transparent p-0 text-center transition-colors sm:min-h-[156px] lg:min-h-[188px]',
            !disabled && 'hover:border-primary/40 hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-70',
          )}
          onClick={openPicker}
        >
          <Card className="h-full w-full border-0 bg-transparent py-0 shadow-none ring-0">
            <CardContent className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-3 px-4 py-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background">
                <HugeiconsIcon icon={Add01Icon} size={20} />
              </div>
              <p className="text-sm font-semibold tracking-tight sm:text-base">
                {buttonLabel ?? 'Add more files'}
              </p>
            </CardContent>
          </Card>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-auto w-full rounded-2xl border-dashed bg-transparent p-0 text-center whitespace-normal transition-colors',
            !disabled && 'hover:border-primary/40 hover:bg-muted/50',
            isDragActive && 'border-primary/60 bg-muted/60',
            disabled && 'cursor-not-allowed opacity-70',
          )}
          onClick={openPicker}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!disabled) {
              setIsDragActive(true);
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={(event: DragEvent<HTMLButtonElement>) => {
            event.preventDefault();
            setIsDragActive(false);
            commitSelection(event.dataTransfer.files);
          }}
        >
          <Empty className="rounded-[inherit] border-0 p-6 sm:p-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={File01Icon} size={30} />
              </EmptyMedia>
              <EmptyTitle className="text-2xl font-semibold tracking-tight">
                {title ?? defaultTitle}
              </EmptyTitle>
              <EmptyDescription>
                {description ?? defaultDescription}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="text-xs text-muted-foreground sm:text-sm">
              Drag files here or click to browse.
            </EmptyContent>
          </Empty>
        </Button>
      )}
    </section>
  );
}
