import { PdfFileSelector } from '~/components/pdf-file-selector';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import { MultiFileToolWorkspace } from '~/shared/tool-ui/multi-file-tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';

import { mergeToolDefinition } from './definition';
import { useMergeWorkspace } from './use-merge-workspace';

export function MergeToolScreen() {
  const workspace = useMergeWorkspace();

  useSuccessToast(workspace.successMessage);

  return (
    <MultiFileToolWorkspace
      title="Merge PDF"
      description="Combine PDFs in the order you choose."
      titleIcon={mergeToolDefinition.icon}
      files={workspace.files}
      isBusy={workspace.isMerging}
      emptyState={
        <PdfFileSelector
          multiple
          ariaLabel="Select PDF files"
          onSelect={workspace.handleFilesAdded}
          disabled={workspace.isMerging}
        />
      }
      appendItem={
        <li>
          <PdfFileSelector
            variant="tile"
            multiple
            ariaLabel="Select PDF files"
            onSelect={workspace.handleFilesAdded}
            disabled={workspace.isMerging}
            buttonLabel="Add More Files"
          />
        </li>
      }
      onReorder={workspace.handleReorder}
      onRemove={workspace.handleRemove}
      inputFooter={
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={workspace.isMerging}
            onClick={workspace.handleClearAll}
          >
            Clear All
          </Button>
          <Button
            disabled={!workspace.canMerge}
            onClick={workspace.handleMerge}
          >
            {workspace.isMerging ? <Spinner data-icon="inline-start" /> : null}
            {workspace.mergeButtonLabel}
          </Button>
        </div>
      }
      errorMessage={workspace.errorMessage}
    />
  );
}
