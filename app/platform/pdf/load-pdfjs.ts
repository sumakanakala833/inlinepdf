import workerSource from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type PdfJsModule = typeof import('pdfjs-dist');

let isWorkerConfigured = false;

export async function loadPdfJsModule(): Promise<PdfJsModule> {
  const module = await import('pdfjs-dist');

  if (!isWorkerConfigured) {
    module.GlobalWorkerOptions.workerSrc = workerSource;
    isWorkerConfigured = true;
  }

  return module;
}
