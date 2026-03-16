import { useState } from 'react';
import { useFetcher } from 'react-router';

import { PdfFileSelector } from '~/components/pdf-file-selector';
import { Button } from '~/components/ui/button';
import { saveClientActionFallback } from '~/platform/files/client-action-fallback';
import { readPdfDetails } from '~/platform/pdf/read-pdf-details';
import type { ToolActionResult } from '~/shared/tool-ui/action-result';
import { createFileEntryId } from '~/shared/tool-ui/create-file-entry-id';
import { FileQueueList } from '~/shared/tool-ui/file-queue-list';
import { reorderListByIndex } from '~/shared/tool-ui/reorder-list-by-index';
import { ToolWorkspace } from '~/shared/tool-ui/tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';
import type { MergeInputFile } from '~/tools/merge/models';

export function MergeToolScreen() {
  const fetcher = useFetcher<ToolActionResult>();
  const [files, setFiles] = useState<MergeInputFile[]>([]);

  const isMerging = fetcher.state !== 'idle';
  const canMerge = files.length >= 2 && !isMerging;
  const errorMessage = fetcher.data && !fetcher.data.ok ? fetcher.data.message : null;
  const successMessage = fetcher.data?.ok ? fetcher.data.message : null;

  useSuccessToast(successMessage);

  function handleFilesAdded(newFiles: File[]) {
    const mapped = newFiles.map((file) => ({
      id: createFileEntryId(file),
      file,
      pageCount: null,
      previewDataUrl: null,
      previewStatus: 'loading' as const,
    }));
    setFiles((current) => [...current, ...mapped]);

    mapped.forEach((entry) => {
      void readPdfDetails(entry.file).then((details) => {
        setFiles((current) =>
          current.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  pageCount: details.pageCount,
                  previewDataUrl: details.previewDataUrl,
                  previewStatus: details.previewDataUrl ? 'ready' : 'unavailable',
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
  }

  function handleRemove(id: string) {
    setFiles((current) => current.filter((entry) => entry.id !== id));
  }

  function handleClearAll() {
    if (isMerging) {
      return;
    }

    setFiles([]);
  }

  function handleMerge() {
    const payload = { files: files.map((entry) => entry.file) };
    const submissionId = saveClientActionFallback(payload);
    const formData = new FormData();
    files.forEach((entry) => {
      formData.append('files[]', entry.file);
    });
    formData.set('submissionId', submissionId);
    void fetcher.submit(formData, { method: 'post' });
  }

  return (
    <ToolWorkspace
      title="Merge PDF"
      description="Combine PDFs in the exact order you choose."
      inputPanel={
        <div className="space-y-4">
          {files.length === 0 ? (
            <PdfFileSelector
              multiple
              ariaLabel="Select PDF files"
              onSelect={handleFilesAdded}
              disabled={isMerging}
              title="Drag and drop PDF files"
            />
          ) : (
            <>
              <FileQueueList
                files={files}
                disabled={isMerging}
                onReorder={handleReorder}
                onRemove={handleRemove}
                appendItem={
                  <li>
                    <PdfFileSelector
                      variant="tile"
                      multiple
                      ariaLabel="Select PDF files"
                      onSelect={handleFilesAdded}
                      disabled={isMerging}
                      buttonLabel="Add more files"
                    />
                  </li>
                }
              />
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" disabled={isMerging} onClick={handleClearAll}>
                  Clear all
                </Button>
                <Button disabled={!canMerge} onClick={handleMerge}>
                  {isMerging ? 'Merging...' : 'Merge and Download'}
                </Button>
              </div>
            </>
          )}
        </div>
      }
      errorMessage={errorMessage}
    />
  );
}
