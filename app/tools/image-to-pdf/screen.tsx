import { ImageFileSelector } from '~/components/image-file-selector';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSet,
} from '~/components/ui/field';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { MultiFileToolWorkspace } from '~/shared/tool-ui/multi-file-tool-workspace';
import { useSuccessToast } from '~/shared/tool-ui/use-success-toast';

import { imageToPdfToolDefinition } from './definition';
import { isImageToPdfQuality } from './use-cases/convert-images-to-pdf';
import {
  IMAGE_TO_PDF_QUALITY_OPTIONS,
  useImageToPdfWorkspace,
} from './use-image-to-pdf-workspace';

export function ImageToPdfToolScreen() {
  const workspace = useImageToPdfWorkspace();

  useSuccessToast(workspace.successMessage);

  return (
    <MultiFileToolWorkspace
      title="Image to PDF"
      description="Combine JPG and PNG images into one PDF on device."
      titleIcon={imageToPdfToolDefinition.icon}
      files={workspace.files}
      isBusy={workspace.isConverting}
      emptyState={
        <ImageFileSelector
          multiple
          ariaLabel="Select image files"
          onSelect={workspace.handleFilesAdded}
          disabled={workspace.isConverting}
        />
      }
      appendItem={
        <li>
          <ImageFileSelector
            variant="tile"
            multiple
            ariaLabel="Select image files"
            onSelect={workspace.handleFilesAdded}
            disabled={workspace.isConverting}
            buttonLabel="Add More Images"
          />
        </li>
      }
      onReorder={workspace.handleReorder}
      onRemove={workspace.handleRemove}
      onClearAll={workspace.handleClearAll}
      optionsPanel={
        workspace.files.length > 0 ? (
          <FieldSet className="max-w-sm">
            <RadioGroup
              aria-label="PDF quality"
              value={workspace.quality}
              onValueChange={(value) => {
                if (isImageToPdfQuality(value)) {
                  workspace.setQuality(value);
                }
              }}
            >
              {IMAGE_TO_PDF_QUALITY_OPTIONS.map((option) => {
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
                      disabled={workspace.isConverting}
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
              PNG files stay PNG in the PDF (lossless format). Medium and Low
              reduce image dimensions for smaller output. JPEG files also use
              stronger lossy compression at Medium and Low.
            </FieldDescription>
          </FieldSet>
        ) : null
      }
      actionBar={
        workspace.files.length > 0 ? (
          <div>
            <Button
              disabled={!workspace.canConvert}
              onClick={workspace.handleConvert}
            >
              {workspace.isConverting ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              {workspace.convertButtonLabel}
            </Button>
          </div>
        ) : null
      }
      errorMessage={workspace.errorMessage}
    />
  );
}
