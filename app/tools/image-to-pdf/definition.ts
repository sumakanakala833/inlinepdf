import { ImageUploadIcon } from '@hugeicons/core-free-icons';

import type { ToolDefinition } from '~/tools/catalog/definitions';

export const imageToPdfToolDefinition = {
  id: 'image-to-pdf',
  slug: 'image-to-pdf',
  path: '/image-to-pdf',
  title: 'Image to PDF',
  shortDescription: 'Convert JPG and PNG images into a single PDF.',
  navGroup: 'Convert',
  icon: ImageUploadIcon,
  availability: 'available',
} satisfies ToolDefinition;
