import { ImageDownloadIcon } from '@hugeicons/core-free-icons';

import type { ToolDefinition } from '~/tools/catalog/definitions';

export const pdfToImagesToolDefinition = {
  id: 'pdf-to-images',
  slug: 'pdf-to-images',
  path: '/pdf-to-images',
  title: 'PDF to Images',
  shortDescription: 'Export PDF pages into image files and a ZIP download.',
  navGroup: 'Convert',
  icon: ImageDownloadIcon,
  availability: 'available',
} satisfies ToolDefinition;
