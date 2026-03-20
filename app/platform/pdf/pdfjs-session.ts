import { loadPdfJsModule } from './load-pdfjs';
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist/types/src/display/api';
import type { PageViewport } from 'pdfjs-dist/types/src/display/display_utils';

export interface PdfJsRuntimeModule {
  OPS: {
    setFont: number;
  };
}

export type PdfJsViewport = PageViewport;
export type PdfJsRenderTask = RenderTask;
export type PdfJsPage = PDFPageProxy;
export type PdfJsDocument = PDFDocumentProxy;
export type PdfJsLoadingTask = PDFDocumentLoadingTask;

export interface PdfJsDocumentSession {
  module: PdfJsRuntimeModule;
  document: PdfJsDocument;
  loadingTask: PdfJsLoadingTask;
  destroy: () => Promise<void>;
}

async function readPdfJsSourceBytes(
  source: File | ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (source instanceof Uint8Array) {
    const bytes = new Uint8Array(source.byteLength);
    bytes.set(source);
    return bytes;
  }

  const buffer = source instanceof File ? await source.arrayBuffer() : source;
  const originalBytes = new Uint8Array(buffer);
  const bytes = new Uint8Array(originalBytes.byteLength);
  bytes.set(originalBytes);
  return bytes;
}

export async function openPdfJsDocument(
  source: File | ArrayBuffer | Uint8Array,
): Promise<PdfJsDocumentSession> {
  const [bytes, pdfjs] = await Promise.all([
    readPdfJsSourceBytes(source),
    loadPdfJsModule(),
  ]);
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const module: PdfJsRuntimeModule = pdfjs;

  try {
    const document = await loadingTask.promise;

    return {
      module,
      document,
      loadingTask,
      async destroy() {
        await document.destroy();
        void loadingTask.destroy();
      },
    };
  } catch (error) {
    void loadingTask.destroy();
    throw error;
  }
}

export async function withPdfJsDocument<T>(
  source: File | ArrayBuffer | Uint8Array,
  callback: (document: PdfJsDocument) => Promise<T>,
): Promise<T> {
  const session = await openPdfJsDocument(source);

  try {
    return await callback(session.document);
  } finally {
    await session.destroy();
  }
}

export function cleanupPdfJsPage(page: { cleanup?: () => void }): void {
  page.cleanup?.();
}
