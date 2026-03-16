import { Outlet, useFetchers, useNavigation } from 'react-router';

import { Shell } from '~/components/layout/shell';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Spinner } from '~/components/ui/spinner';

function isAnyFetcherPending(
  fetchers: ReturnType<typeof useFetchers>,
): boolean {
  return fetchers.some((fetcher) => fetcher.state !== 'idle');
}

export function HydrateFallback() {
  return (
    <Shell>
      <p className="text-sm text-muted-foreground">Loading page...</p>
    </Shell>
  );
}

export default function SiteLayout() {
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const isPending =
    navigation.state !== 'idle' || isAnyFetcherPending(fetchers);

  return (
    <Shell>
      <div aria-live="polite" className="min-h-14">
        {isPending ? (
          <Alert className="mb-6">
            <Spinner className="h-4 w-4" />
            <AlertTitle>Working</AlertTitle>
            <AlertDescription>
              Processing your latest action.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
      <Outlet />
    </Shell>
  );
}
