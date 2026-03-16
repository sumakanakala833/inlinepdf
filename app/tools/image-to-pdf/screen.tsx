import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';

import { ImageFileSelector } from '~/components/image-file-selector';
import { Button } from '~/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSet,
} from '~/components/ui/field';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { saveClientActionFallback } from '~/platform/files/client-action-fallback';
import {
  isSupportedImageFile,
  readImageDimensions,
} from '~/tools/image-to-pdf/service/convert-images-to-pdf';
import type { ImageToPdfQuality } from '~/tools/image-to-pdf/models';
import {
  FileQueueList,
  type QueuedFile,
} from '~/shared/tool-ui/file-queue-list';
import { ToolWorkspace } from '~/shared/tool-ui/tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';
import { createFileEntryId } from '~/shared/tool-ui/create-file-entry-id';
import { reorderListByIndex } from '~/shared/tool-ui/reorder-list-by-index';
import type { ToolActionResult } from '~/shared/tool-ui/action-result';

import { isImageToPdfQuality } from './use-cases/convert-images-to-pdf';

const QUALITY_OPTIONS: { value: ImageToPdfQuality; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function revokeEntryPreviewUrl(entry: QueuedFile) {
  if (entry.previewDataUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(entry.previewDataUrl);
  }
}

export function ImageToPdfToolScreen() {
  const fetcher = useFetcher<ToolActionResult>();
  const filesRef = useRef<QueuedFile[]>([]);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [quality, setQuality] = useState<ImageToPdfQuality>('medium');
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null);

  const isConverting = fetcher.state !== 'idle';
  const canConvert = files.length > 0 && !isConverting;
  const actionErrorMessage =
    fetcher.data && !fetcher.data.ok ? fetcher.data.message : null;
  const errorMessage = localErrorMessage ?? actionErrorMessage;
  const successMessage = fetcher.data?.ok ? fetcher.data.message : null;

  useSuccessToast(successMessage);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(
    () => () => {
      filesRef.current.forEach((entry) => {
        revokeEntryPreviewUrl(entry);
      });
    },
    [],
  );

  function handleFilesAdded(newFiles: File[]) {
    const supportedFiles = newFiles.filter((file) => isSupportedImageFile(file));
    const unsupportedFiles = newFiles.filter((file) => !isSupportedImageFile(file));

    if (supportedFiles.length < 1) {
      if (unsupportedFiles.length > 0) {
        setLocalErrorMessage(
          `Only JPG and PNG images are supported. Unsupported: ${unsupportedFiles[0]?.name}.`,
        );
      }

      return;
    }

    const addedEntries = supportedFiles.map((file) => {
      const objectUrl = URL.createObjectURL(file);
      return {
        id: createFileEntryId(file),
        file,
        pageCount: null,
        previewDataUrl: objectUrl,
        previewStatus: 'ready' as const,
        metadataText: 'Reading dimensions...',
      };
    });

    setFiles((current) => [...current, ...addedEntries]);
    setLocalErrorMessage(
      unsupportedFiles.length > 0
        ? `Only JPG and PNG images are supported. Unsupported: ${unsupportedFiles[0]?.name}.`
        : null,
    );

    addedEntries.forEach((entry) => {
      void readImageDimensions(entry.file)
        .then((dimensions) => {
          setFiles((current) =>
            current.map((item) =>
              item.id === entry.id
                ? {
                    ...item,
                    metadataText: `${String(dimensions.width)} x ${String(dimensions.height)} px`,
                  }
                : item,
            ),
          );
        })
        .catch(() => {
          setFiles((current) =>
            current.map((item) =>
              item.id === entry.id
                ? {
                    ...item,
                    metadataText: 'Dimensions unavailable',
                  }
                : item,
            ),
          );
        });
    });
  }

  function handleReorder(activeId: string, overId: string) {
    setFiles((current) => {
      const sourceIndex = current.findIndex((entry) => entry.id === activeId);
      const targetIndex = current.findIndex((entry) => entry.id === overId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return current;
      }

      return reorderListByIndex(current, sourceIndex, targetIndex);
    });
    setLocalErrorMessage(null);
  }

  function handleRemove(id: string) {
    setFiles((current) => {
      const entryToRemove = current.find((entry) => entry.id === id);
      if (entryToRemove) {
        revokeEntryPreviewUrl(entryToRemove);
      }

      return current.filter((entry) => entry.id !== id);
    });
    setLocalErrorMessage(null);
  }

  function handleClearAll() {
    if (isConverting) {
      return;
    }

    files.forEach((entry) => {
      revokeEntryPreviewUrl(entry);
    });

    setFiles([]);
    setLocalErrorMessage(null);
  }

  function handleConvert() {
    if (!canConvert) {
      return;
    }

    setLocalErrorMessage(null);

    const payload = { files: files.map((entry) => entry.file), quality };
    const submissionId = saveClientActionFallback(payload);
    const formData = new FormData();
    files.forEach((entry) => {
      formData.append('files[]', entry.file);
    });
    formData.set('quality', quality);
    formData.set('submissionId', submissionId);
    void fetcher.submit(formData, { method: 'post' });
  }

  return (
    <ToolWorkspace
      title="Image to PDF"
      description="Convert JPG and PNG images into a single PDF directly in your browser."
      inputPanel={
        files.length === 0 ? (
          <ImageFileSelector
            multiple
            ariaLabel="Select image files"
            onSelect={handleFilesAdded}
            disabled={isConverting}
            title="Drag and drop image files"
            description="Select JPG or PNG images by dragging and dropping, or choose from your device."
          />
        ) : (
          <div className="space-y-4">
            <FileQueueList
              files={files}
              disabled={isConverting}
              onReorder={handleReorder}
              onRemove={handleRemove}
              appendItem={
                <li>
                  <ImageFileSelector
                    variant="tile"
                    multiple
                    ariaLabel="Select image files"
                    onSelect={handleFilesAdded}
                    disabled={isConverting}
                    buttonLabel="Add more images"
                  />
                </li>
              }
            />
            <Button variant="outline" disabled={isConverting} onClick={handleClearAll}>
              Clear all
            </Button>
          </div>
        )
      }
      optionsPanel={
        files.length > 0 ? (
          <FieldSet className="max-w-sm">
            <RadioGroup
              aria-label="PDF quality"
              value={quality}
              onValueChange={(value) => {
                if (isImageToPdfQuality(value)) {
                  setQuality(value);
                }
              }}
            >
              {QUALITY_OPTIONS.map((option) => {
                const id = `image-to-pdf-quality-${option.value}`;

                return (
                  <Field
                    key={option.value}
                    orientation="horizontal"
                    className="items-start rounded-xl border border-border px-4 py-3 has-[[role=radio][aria-checked=true]]:border-primary/40 has-[[role=radio][aria-checked=true]]:bg-primary/5"
                  >
                    <RadioGroupItem
                      id={id}
                      value={option.value}
                      disabled={isConverting}
                      aria-label={option.label}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
                    </FieldContent>
                  </Field>
                );
              })}
            </RadioGroup>
            <FieldDescription>
              PNG files stay PNG in the PDF (lossless format). Medium and Low reduce
              image dimensions for smaller output. JPEG files also use stronger lossy
              compression at Medium and Low.
            </FieldDescription>
          </FieldSet>
        ) : null
      }
      actionBar={
        files.length > 0 ? (
          <div className="space-y-2">
            <Button disabled={!canConvert} onClick={handleConvert}>
              {isConverting ? 'Converting...' : 'Convert and Download'}
            </Button>
            {isConverting ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Converting images...
              </p>
            ) : null}
          </div>
        ) : null
      }
      errorMessage={errorMessage}
    />
  );
}
