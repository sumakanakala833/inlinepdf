import { CropIcon } from '@hugeicons/core-free-icons';

import type { ToolDefinition } from '~/tools/catalog/definitions';

export const cropToolDefinition = {
  id: 'crop',
  slug: 'crop',
  path: '/crop',
  title: 'Crop PDF',
  shortDescription: 'Crop pages with precise page-level controls.',
  navGroup: 'Organize',
  icon: CropIcon,
  availability: 'available',
} satisfies ToolDefinition;
