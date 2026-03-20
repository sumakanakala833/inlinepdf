import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type PercentCrop,
  type PixelCrop,
} from 'react-image-crop';

import { Spinner } from '~/components/ui/spinner';
import {
  cleanupPdfJsPage,
  openPdfJsDocument,
  type PdfJsDocument,
  type PdfJsRenderTask,
} from '~/platform/pdf/pdfjs-session';
import {
  normalizedToPercentRect,
  percentToNormalizedRect,
} from '~/tools/crop/domain/coordinate-math';
import {
  getPageSizeDimensionsInPoints,
  isStandardPageSizeId,
} from '~/platform/pdf/page-size-options';
import type { CropPreset, NormalizedRect } from '~/tools/crop/models';

import 'react-image-crop/dist/ReactCrop.css';

interface PdfCropEditorProps {
  sourceFile: File;
  pageNumber: number;
  preset: CropPreset;
  cropRect: NormalizedRect | null;
  immersive?: boolean;
  showHeader?: boolean;
  onCropChange: (next: NormalizedRect | null) => void;
}

interface RenderedPageDetails {
  width: number;
  height: number;
  rotation: number;
}

function getAspectRatioForPreset(preset: CropPreset): number | undefined {
  if (isStandardPageSizeId(preset)) {
    const dimensions = getPageSizeDimensionsInPoints(preset);
    return dimensions.width / dimensions.height;
  }

  switch (preset) {
    case 'free':
      return undefined;
    case '1:1':
      return 1;
    case '4:3':
      return 4 / 3;
    case '16:9':
      return 16 / 9;
    default:
      return undefined;
  }
}

function formatPageInfo(pageDetails: RenderedPageDetails | null): string {
  if (!pageDetails) {
    return '';
  }

  const width = Math.round(pageDetails.width);
  const height = Math.round(pageDetails.height);

  return `${String(width)} × ${String(height)} pt`;
}

function clampPercentage(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function clampPercentCrop(crop: PercentCrop): PercentCrop {
  const width = clampPercentage(crop.width, 0.1, 100);
  const height = clampPercentage(crop.height, 0.1, 100);
  const maxX = Math.max(0, 100 - width);
  const maxY = Math.max(0, 100 - height);

  return {
    unit: '%',
    width,
    height,
    x: clampPercentage(crop.x, 0, maxX),
    y: clampPercentage(crop.y, 0, maxY),
  };
}

function areSamePercentCrop(
  a: PercentCrop | undefined,
  b: PercentCrop,
): boolean {
  if (!a) {
    return false;
  }

  const epsilon = 0.01;
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  );
}

export function PdfCropEditor({
  sourceFile,
  pageNumber,
  preset,
  cropRect,
  immersive = false,
  showHeader = true,
  onCropChange,
}: PdfCropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  });
  const [pdfDocument, setPdfDocument] = useState<PdfJsDocument | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [currentCrop, setCurrentCrop] = useState<PercentCrop | undefined>(
    undefined,
  );
  const [pageDetails, setPageDetails] = useState<RenderedPageDetails | null>(
    null,
  );
  const aspectRatio = getAspectRatioForPreset(preset);
  const reportCropChange = useEffectEvent((nextCrop: PercentCrop | null) => {
    onCropChange(nextCrop ? percentToNormalizedRect(nextCrop) : null);
  });

  useEffect(() => {
    setCurrentCrop(cropRect ? normalizedToPercentRect(cropRect) : undefined);
  }, [cropRect, pageNumber]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      const nextHeight = entries[0]?.contentRect.height ?? 0;
      startTransition(() => {
        setContainerSize((currentSize) =>
          currentSize.width === nextWidth && currentSize.height === nextHeight
            ? currentSize
            : { width: nextWidth, height: nextHeight },
        );
      });
    });

    resizeObserver.observe(element);
    const rect = element.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const cancellation = { cancelled: false };
    let loadedSession: Awaited<ReturnType<typeof openPdfJsDocument>> | null =
      null;

    setPdfDocument(null);
    setErrorMessage(null);

    void (async () => {
      try {
        loadedSession = await openPdfJsDocument(sourceFile);

        if (cancellation.cancelled) {
          await loadedSession.destroy();
          return;
        }

        setPdfDocument(loadedSession.document);
      } catch {
        if (!cancellation.cancelled) {
          setErrorMessage(
            'Unable to load this page preview. Select the file again.',
          );
        }
      }
    })();

    return () => {
      cancellation.cancelled = true;

      if (loadedSession) {
        void loadedSession.destroy();
      }
    };
  }, [sourceFile]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) {
      return;
    }

    const cancellation = { cancelled: false };
    let renderTask: PdfJsRenderTask | null = null;

    void (async () => {
      setIsRendering(true);
      setErrorMessage(null);

      try {
        const page = await pdfDocument.getPage(pageNumber);
        try {
          const baseViewport = page.getViewport({ scale: 1 });
          const canvasPadding = immersive ? 0 : 24;
          const maxPreviewWidth = Math.max(
            280,
            Math.floor(containerSize.width) - canvasPadding,
          );
          const maxPreviewHeight = Math.max(
            280,
            Math.floor(
              (containerSize.height || window.innerHeight * 0.72) -
                canvasPadding,
            ),
          );
          const scaleByWidth = maxPreviewWidth / baseViewport.width;
          const scaleByHeight = maxPreviewHeight / baseViewport.height;
          const layoutScale = Math.max(
            0.1,
            Math.min(4, scaleByWidth, scaleByHeight),
          );
          const deviceRatio = Math.min(
            Math.max(window.devicePixelRatio || 1, 1),
            3,
          );
          const renderScale = layoutScale * deviceRatio;
          const layoutViewport = page.getViewport({ scale: layoutScale });
          const renderViewport = page.getViewport({ scale: renderScale });

          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }

          canvas.width = Math.max(1, Math.floor(renderViewport.width));
          canvas.height = Math.max(1, Math.floor(renderViewport.height));
          canvas.style.width = `${String(Math.floor(layoutViewport.width))}px`;
          canvas.style.height = `${String(Math.floor(layoutViewport.height))}px`;

          const context = canvas.getContext('2d', { alpha: false });
          if (!context) {
            throw new Error('Unable to create a canvas context.');
          }

          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, canvas.width, canvas.height);

          renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport: renderViewport,
            background: 'rgb(255,255,255)',
          });
          await renderTask.promise;

          if (cancellation.cancelled) {
            return;
          }

          setPageDetails({
            width: baseViewport.width,
            height: baseViewport.height,
            rotation: baseViewport.rotation,
          });
        } finally {
          cleanupPdfJsPage(page);
        }
      } catch {
        if (!cancellation.cancelled) {
          setErrorMessage('Unable to render this page preview.');
        }
      } finally {
        if (!cancellation.cancelled) {
          setIsRendering(false);
        }
      }
    })();

    return () => {
      cancellation.cancelled = true;
      renderTask?.cancel();
    };
  }, [
    containerSize.height,
    containerSize.width,
    immersive,
    pageNumber,
    pdfDocument,
  ]);

  useEffect(() => {
    if (!aspectRatio || isRendering) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const mediaWidth = canvas.clientWidth;
    const mediaHeight = canvas.clientHeight;

    if (mediaWidth <= 0 || mediaHeight <= 0) {
      return;
    }

    const hasCurrentCrop =
      !!currentCrop && currentCrop.width > 0 && currentCrop.height > 0;

    const baseCrop: PercentCrop = hasCurrentCrop
      ? { ...currentCrop, unit: '%' }
      : {
          unit: '%',
          width: 90,
          height: 90,
          x: 5,
          y: 5,
        };

    const nextAspectCrop = makeAspectCrop(
      {
        unit: '%',
        width: clampPercentage(baseCrop.width, 1, 100),
        x: baseCrop.x,
        y: baseCrop.y,
      },
      aspectRatio,
      mediaWidth,
      mediaHeight,
    );

    const nextCrop = hasCurrentCrop
      ? clampPercentCrop(nextAspectCrop)
      : centerCrop(clampPercentCrop(nextAspectCrop), mediaWidth, mediaHeight);

    if (areSamePercentCrop(currentCrop, nextCrop)) {
      return;
    }

    setCurrentCrop(nextCrop);
    reportCropChange(nextCrop);
  }, [aspectRatio, currentCrop, isRendering, pageNumber]);

  function handleCropChange(_pixelCrop: PixelCrop, percentCrop: PercentCrop) {
    setCurrentCrop(percentCrop);

    if (percentCrop.width <= 0 || percentCrop.height <= 0) {
      onCropChange(null);
      return;
    }

    onCropChange(percentToNormalizedRect(percentCrop));
  }

  return (
    <section
      className={immersive ? 'flex h-full min-h-0 flex-col gap-3' : 'space-y-3'}
    >
      {showHeader ? (
        <header className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{`Page ${String(pageNumber)}`}</p>
          <p className="text-xs text-muted-foreground">
            {errorMessage
              ? 'Preview unavailable.'
              : pageDetails
                ? `${formatPageInfo(pageDetails)} · ${String(pageDetails.rotation)}° rotation`
                : 'Preparing page preview...'}
          </p>
        </header>
      ) : null}

      <div
        ref={containerRef}
        className={
          immersive
            ? 'relative min-h-0 flex-1 bg-background'
            : 'relative w-full overflow-hidden rounded-xl border border-border bg-card p-2 sm:p-3'
        }
      >
        {errorMessage ? (
          <p role="alert" className="p-2 text-sm font-medium text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <div
          className={immersive ? 'flex h-full items-center justify-center' : ''}
        >
          <ReactCrop
            crop={currentCrop}
            onChange={handleCropChange}
            onComplete={handleCropChange}
            keepSelection
            minWidth={24}
            minHeight={24}
            ruleOfThirds
            aspect={aspectRatio}
            className={
              immersive ? 'crop-mask-blue max-h-full' : 'crop-mask-blue'
            }
          >
            <canvas
              ref={canvasRef}
              className={
                immersive
                  ? 'block h-auto max-h-full max-w-full bg-white'
                  : 'block h-auto max-w-full rounded-sm bg-white shadow-sm'
              }
            />
          </ReactCrop>
        </div>

        {isRendering ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/65">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Spinner className="h-4 w-4" />
              <p>Rendering page...</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
