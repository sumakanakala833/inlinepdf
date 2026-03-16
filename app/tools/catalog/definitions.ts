import {
  CropIcon,
  GitMergeIcon,
  ImageDownloadIcon,
  ImageUploadIcon,
  InformationCircleIcon,
  ArrangeIcon,
} from '@hugeicons/core-free-icons';

import { cropToolDefinition } from '~/tools/crop/definition';
import { imageToPdfToolDefinition } from '~/tools/image-to-pdf/definition';
import { infoToolDefinition } from '~/tools/info/definition';
import { mergeToolDefinition } from '~/tools/merge/definition';
import { organizeToolDefinition } from '~/tools/organize/definition';
import { pdfToImagesToolDefinition } from '~/tools/pdf-to-images/definition';

export type ToolNavigationGroup = 'Organize' | 'Convert' | 'Inspect';

export interface ToolDefinition {
  id: string;
  slug: string;
  path: `/${string}`;
  title: string;
  shortDescription: string;
  navGroup: ToolNavigationGroup;
  icon: typeof GitMergeIcon;
  availability: 'available';
}

export const implementedToolDefinitions = [
  mergeToolDefinition,
  organizeToolDefinition,
  cropToolDefinition,
  imageToPdfToolDefinition,
  pdfToImagesToolDefinition,
  infoToolDefinition,
] satisfies readonly ToolDefinition[];

export const toolNavigationGroups: readonly ToolNavigationGroup[] = [
  'Organize',
  'Convert',
  'Inspect',
];

export const toolIconFallbacks = {
  organize: ArrangeIcon,
  crop: CropIcon,
  merge: GitMergeIcon,
  'image-to-pdf': ImageUploadIcon,
  'pdf-to-images': ImageDownloadIcon,
  info: InformationCircleIcon,
} as const;

export function getToolsForNavigationGroup(group: ToolNavigationGroup) {
  return implementedToolDefinitions.filter((tool) => tool.navGroup === group);
}
