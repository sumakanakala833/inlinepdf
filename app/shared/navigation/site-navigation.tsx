import { Menu01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Link } from 'react-router';

import {
  getToolsForNavigationGroup,
  toolNavigationGroups,
} from '~/tools/catalog/definitions';
import { Button } from '~/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '~/components/ui/navigation-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';

function ToolMenuLink({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  return (
    <NavigationMenuLink
      href={path}
      className="block min-w-64 space-y-1 rounded-2xl"
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </NavigationMenuLink>
  );
}

function DesktopToolNavigation() {
  return (
    <NavigationMenu className="hidden md:flex" align="start">
      <NavigationMenuList className="gap-2">
        {toolNavigationGroups.map((group) => {
          const tools = getToolsForNavigationGroup(group);
          return (
            <NavigationMenuItem key={group}>
              <NavigationMenuTrigger>{group}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid gap-2 p-1 md:w-[22rem]">
                  {tools.map((tool) => (
                    <ToolMenuLink
                      key={tool.id}
                      title={tool.title}
                      description={tool.shortDescription}
                      path={tool.path}
                    />
                  ))}
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function MobileToolNavigation() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            aria-label="Open navigation menu"
          />
        }
      >
        <HugeiconsIcon icon={Menu01Icon} size={18} strokeWidth={2} />
      </SheetTrigger>
      <SheetContent side="right" className="w-[22rem] gap-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle>InlinePDF</SheetTitle>
          <SheetDescription>
            Local-first PDF tools with no uploads.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-6">
          {toolNavigationGroups.map((group) => (
            <section key={group} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {group}
              </h2>
              <div className="space-y-2">
                {getToolsForNavigationGroup(group).map((tool) => (
                  <Link
                    key={tool.id}
                    to={tool.path}
                    className="block rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <p className="font-medium text-foreground">{tool.title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {tool.shortDescription}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Info
            </h2>
            <div className="space-y-2">
              <Link
                to="/privacy"
                className="block rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className="block rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
              >
                Terms
              </Link>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SiteNavigation() {
  return (
    <>
      <DesktopToolNavigation />
      <MobileToolNavigation />
    </>
  );
}
