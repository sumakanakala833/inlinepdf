import {
  ArrangeIcon,
  CodeIcon,
  CropIcon,
  File01Icon,
  GitMergeIcon,
  ImageDownloadIcon,
  ImageUploadIcon,
  InformationCircleIcon,
  SecurityLockIcon,
  WorkflowCircle01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Link } from 'react-router';

import type { Route } from './+types/home';
import { ThemedBrandImage } from '~/components/branding/themed-brand-image';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import { Badge } from '~/components/ui/badge';
import { buttonVariants } from '~/components/ui/button-variants';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '~/components/ui/item';
import { Separator } from '~/components/ui/separator';
import {
  implementedToolDefinitions,
  toolNavigationGroups,
  type ToolNavigationGroup,
} from '~/tools/catalog/definitions';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'InlinePDF | Local-First PDF Tools' },
    {
      name: 'description',
      content:
        'InlinePDF delivers a cleaner local-first PDF workflow with private in-browser processing and open-source transparency.',
    },
  ];
};

const toolIconBySlug: Partial<Record<string, typeof File01Icon>> = {
  crop: CropIcon,
  'image-to-pdf': ImageUploadIcon,
  merge: GitMergeIcon,
  organize: ArrangeIcon,
  info: InformationCircleIcon,
  'pdf-to-images': ImageDownloadIcon,
} as const;

const navigationGroupDescriptions: Record<ToolNavigationGroup, string> = {
  Organize: 'Clean up and reshape the structure of a PDF.',
  Convert: 'Move content between formats without upload steps.',
  Inspect: 'Inspect document internals and metadata locally.',
};

const privacyHighlights = [
  'No file uploads by design.',
  'No accounts, trackers, or cloud queue.',
  'Transparent source available for review.',
];

const faqs = [
  {
    value: 'privacy',
    question: 'Does InlinePDF upload my files?',
    answer:
      'No. The current tools process files directly in the browser, so the PDF stays on your device during the workflow.',
  },
  {
    value: 'scope',
    question: 'Which tools are available right now?',
    answer:
      'The current local-first set includes merge, crop, organize, image-to-PDF, PDF-to-images, and PDF info.',
  },
  {
    value: 'roadmap',
    question: 'Why are there only a few tools right now?',
    answer:
      'This alpha only exposes tools that already work end-to-end. New tools get added when they are ready to ship as local-first workflows.',
  },
];

export function HydrateFallback() {
  return <p className="text-sm text-muted-foreground">Loading home...</p>;
}

export default function HomeRoute() {
  const firstToolPath = implementedToolDefinitions[0]?.path ?? '/';

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
      <section className="flex flex-col items-start gap-5">
        <div className="flex flex-col gap-4">
          <ThemedBrandImage
            alt="InlinePDF logo"
            className="size-20 rounded-2xl sm:size-24"
            fetchPriority="low"
            loading="eager"
            variant="hero"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Local-First</Badge>
            <Badge variant="outline">No Uploads</Badge>
            <Badge variant="outline">Open Source</Badge>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            InlinePDF
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Local-first PDF tools for merge, split, crop, organize, convert,
            and inspect workflows. Your files stay on your device while the app
            stays simple and fast.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to={firstToolPath}
            prefetch="intent"
            className={buttonVariants({ variant: 'default' })}
          >
            Open first tool
          </Link>
          <a
            href="#tools"
            className={buttonVariants({ variant: 'outline' })}
          >
            Browse tools
          </a>
        </div>
      </section>

      <Separator />

      <section id="tools" className="flex flex-col gap-6 scroll-mt-24">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Implemented tools
          </h2>
          <p className="text-sm text-muted-foreground">
            Focused, local-first utilities you can launch directly.
          </p>
        </div>
        <div className="space-y-6">
          {toolNavigationGroups.map((group) => (
            <section key={group} className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight">{group}</h3>
                <p className="text-sm text-muted-foreground">
                  {navigationGroupDescriptions[group]}
                </p>
              </div>
              <ItemGroup>
                {implementedToolDefinitions
                  .filter((tool) => tool.navGroup === group)
                  .map((tool) => {
                    const icon = toolIconBySlug[tool.slug] ?? File01Icon;

                    return (
                      <Item key={tool.id} variant="outline">
                        <ItemMedia
                          variant="icon"
                          className="size-10 rounded-xl border border-border bg-background"
                        >
                          <HugeiconsIcon icon={icon} size={18} strokeWidth={1.8} />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{tool.title}</ItemTitle>
                          <ItemDescription>{tool.shortDescription}</ItemDescription>
                        </ItemContent>
                        <ItemActions className="ml-auto">
                          <Link
                            to={tool.path}
                            prefetch="intent"
                            className={buttonVariants({
                              variant: 'outline',
                              size: 'sm',
                            })}
                          >
                            Open
                          </Link>
                        </ItemActions>
                      </Item>
                    );
                  })}
              </ItemGroup>
            </section>
          ))}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Privacy and product direction
          </h2>
          <p className="text-sm text-muted-foreground">
            Compact, inspectable, and intentionally local-first.
          </p>
        </div>
        <Alert>
          <HugeiconsIcon
            icon={SecurityLockIcon}
            size={18}
            strokeWidth={1.8}
          />
          <AlertTitle>Privacy you can verify</AlertTitle>
          <AlertDescription>
            InlinePDF processes files in the browser. There is no upload queue,
            no account requirement, and the code is open for inspection.
          </AlertDescription>
        </Alert>
        <ItemGroup>
          {privacyHighlights.map((highlight) => (
            <Item key={highlight} variant="outline" size="sm">
              <ItemMedia
                variant="icon"
                className="size-8 rounded-lg border border-border bg-background"
              >
                <HugeiconsIcon
                  icon={SecurityLockIcon}
                  size={14}
                  strokeWidth={1.8}
                />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{highlight}</ItemTitle>
              </ItemContent>
            </Item>
          ))}
          <Item variant="outline" size="sm">
            <ItemMedia
              variant="icon"
              className="size-8 rounded-lg border border-border bg-background"
            >
              <HugeiconsIcon icon={CodeIcon} size={14} strokeWidth={1.8} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Built in the open</ItemTitle>
              <ItemDescription>
                The roadmap stays practical: local-only features, cleaner flows,
                and transparent implementation choices.
              </ItemDescription>
            </ItemContent>
            <ItemActions className="ml-auto">
              <Badge variant="outline">
                <HugeiconsIcon icon={WorkflowCircle01Icon} size={12} />
                UX-first roadmap
              </Badge>
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>

      <Separator />

      <section id="faq" className="flex flex-col gap-4 scroll-mt-24">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
          <p className="text-sm text-muted-foreground">
            Quick answers about how the app works today.
          </p>
        </div>
        <Accordion>
          {faqs.map((faq) => (
            <AccordionItem key={faq.value} value={faq.value}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </section>
  );
}
