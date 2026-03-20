import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import { HugeiconsIcon } from '@hugeicons/react';
import { type ChangeEvent, type DragEvent, useRef, useState } from 'react';

import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import {
  Empty,
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
  dropzoneTitle?: React.ReactNode;
  dropzoneDescription?: React.ReactNode;
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
  dropzoneTitle,
  dropzoneDescription,
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

  const defaultDropzoneTitle = 'Add Files';
  const defaultDropzoneDescription = (
    <>
      Drop {accept.includes('image') ? 'images' : 'PDF files'} here, or{' '}
      <span className="font-semibold underline underline-offset-4">
        browse files
      </span>
      .
    </>
  );

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
          {buttonLabel ?? 'Add More PDF Files'}
        </Button>
      ) : variant === 'tile' ? (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-full min-h-[7.5rem] w-full rounded-2xl border-dashed bg-transparent p-0 text-center transition-colors',
            !disabled && 'hover:border-primary/40 hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-70',
          )}
          onClick={openPicker}
        >
          <Card className="h-full w-full border-0 bg-transparent py-0 shadow-none ring-0">
            <CardContent className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-3 px-4 py-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background">
                <HugeiconsIcon icon={Add01Icon} size={20} />
              </div>
              <p className="text-sm font-semibold tracking-tight sm:text-base">
                {buttonLabel ?? 'Add More Files'}
              </p>
            </CardContent>
          </Card>
        </Button>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={!disabled ? openPicker : undefined}
          onKeyDown={(event) => {
            if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              openPicker();
            }
          }}
          className={cn(
            'relative w-full cursor-pointer rounded-2xl border-2 border-dashed bg-transparent p-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            !disabled && 'hover:border-primary/40 hover:bg-muted/50',
            isDragActive && 'border-primary/60 bg-muted/60',
            disabled && 'cursor-not-allowed opacity-70',
          )}
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
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setIsDragActive(false);
            commitSelection(event.dataTransfer.files);
          }}
        >
          <Empty className="pointer-events-none rounded-[inherit] border-0 p-8 sm:p-12">
            <EmptyHeader>
              <EmptyMedia className="mb-4 flex size-16 items-center justify-center rounded-full border border-border bg-background sm:size-20">
                <HugeiconsIcon
                  icon={Add01Icon}
                  className="size-8 text-muted-foreground sm:size-10"
                />
              </EmptyMedia>
              <EmptyTitle className="text-xl font-bold tracking-tight">
                {dropzoneTitle ?? defaultDropzoneTitle}
              </EmptyTitle>
              <EmptyDescription className="text-base text-muted-foreground">
                {dropzoneDescription ?? defaultDropzoneDescription}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </section>
  );
}
