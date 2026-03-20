import { lazy, Suspense } from 'react';
import {
  href,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from 'react-router';

import type { Route } from './+types/root';
import rootStylesHref from './app.css?url';
import { Shell } from './components/layout/shell';
import { AppLink } from './shared/navigation/app-link';
import { cn } from './lib/utils';
import {
  themeInitScript,
  themedIconPaths,
  readThemeStateFromCookieHeader,
} from './lib/theme';

const Toaster = lazy(() =>
  import('./components/ui/sonner').then((module) => ({
    default: module.Toaster,
  })),
);

export function loader({ request }: Route.LoaderArgs) {
  return readThemeStateFromCookieHeader(request.headers.get('cookie'));
}

export const links: Route.LinksFunction = () => [
  { rel: 'stylesheet', href: rootStylesHref },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const rootData = useRouteLoaderData<typeof loader>('root');
  const preference = rootData?.preference ?? 'auto';
  const resolvedTheme = rootData?.resolvedTheme ?? 'light';
  const themedIcons = themedIconPaths[resolvedTheme];

  return (
    <html
      lang="en"
      className={resolvedTheme === 'dark' ? 'dark' : undefined}
      data-theme-preference={preference}
      data-resolved-theme={resolvedTheme}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          id="app-favicon-32"
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={themedIcons.favicon32}
        />
        <link
          id="app-shortcut-icon"
          rel="shortcut icon"
          type="image/png"
          href={themedIcons.favicon32}
        />
        <link
          id="app-favicon-16"
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={themedIcons.favicon16}
        />
        <link
          id="app-apple-touch-icon"
          rel="apple-touch-icon"
          sizes="180x180"
          href={themedIcons.appleTouchIcon}
        />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Suspense fallback={null}>
          <Toaster position="top-right" richColors />
        </Suspense>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';
  const isLegalRoute = /^\/(privacy|terms)(\/|$)/.test(location.pathname);

  return (
    <Shell
      contentClassName={
        isHomeRoute || isLegalRoute ? 'w-full max-w-none px-0' : undefined
      }
      mainClassName={cn(
        isHomeRoute || isLegalRoute ? 'py-0' : undefined,
        isHomeRoute &&
          'from-muted/35 via-background to-background bg-linear-to-b',
      )}
    >
      <Outlet />
    </Shell>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Unexpected error';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;
  let status: number | undefined;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    message = error.status === 404 ? 'Page not found' : 'Unexpected error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <Shell>
      <section className="w-full space-y-4 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm text-muted-foreground">
          {status ? String(status) : 'Unexpected Error'}
        </p>
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight text-balance">
          {message}
        </h1>
        <p className="leading-7 text-muted-foreground">{details}</p>
        <div className="flex flex-wrap gap-3">
          <AppLink
            to={href('/')}
            prefetch="intent"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:brightness-95"
          >
            Go Home
          </AppLink>
          <AppLink
            to={href('/merge')}
            prefetch="intent"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Open Merge PDF
          </AppLink>
        </div>
        {stack ? (
          <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-4 text-xs">
            <code>{stack}</code>
          </pre>
        ) : null}
      </section>
    </Shell>
  );
}
