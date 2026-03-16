import { GitMergeIcon } from '@hugeicons/core-free-icons';

import type { ToolDefinition } from '~/tools/catalog/definitions';

export const mergeToolDefinition = {
  id: 'merge',
  slug: 'merge',
  path: '/merge',
  title: 'Merge PDF',
  shortDescription: 'Combine multiple PDFs in the order you choose.',
  navGroup: 'Organize',
  icon: GitMergeIcon,
  availability: 'available',
} satisfies ToolDefinition;
