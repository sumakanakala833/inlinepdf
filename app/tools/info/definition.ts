import { InformationCircleIcon } from '@hugeicons/core-free-icons';

import type { ToolDefinition } from '~/tools/catalog/definitions';

export const infoToolDefinition = {
  id: 'info',
  slug: 'info',
  path: '/info',
  title: 'PDF Info',
  shortDescription: 'Inspect metadata, producers, and font details locally.',
  navGroup: 'Inspect',
  icon: InformationCircleIcon,
  availability: 'available',
} satisfies ToolDefinition;
