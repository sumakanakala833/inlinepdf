import { Link } from 'react-router';

import type { Route } from './+types/catchall';
import { buttonVariants } from '~/components/ui/button-variants';

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Page Not Found | InlinePDF' },
    {
      name: 'description',
      content: 'The page you requested does not exist.',
    },
  ];
};

export default function CatchallRoute() {
  return (
    <section className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight text-balance">
        Page not found
      </h1>
      <p className="leading-7 text-muted-foreground">
        The URL does not exist. Go back to home or launch a tool.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link to="/" className={buttonVariants({ size: 'lg' })}>
          Go Home
        </Link>
        <Link
          to="/merge"
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          Open Merge PDF
        </Link>
      </div>
    </section>
  );
}
