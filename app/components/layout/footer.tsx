import { href } from 'react-router';

import { AppLink } from '~/shared/navigation/app-link';
import { containerClassName } from './container';

export function Footer() {
  return (
    <footer className="border-t bg-muted/50 backdrop-blur-md">
      <div className={`${containerClassName} py-6`}>
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-muted-foreground text-center text-sm font-normal">
            Copyright © 2026 InlinePDF. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm font-normal">
            <AppLink
              to={href('/privacy')}
              prefetch="intent"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </AppLink>
            <span className="text-muted-foreground/30" aria-hidden="true">
              |
            </span>
            <AppLink
              to={href('/terms')}
              prefetch="intent"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Use
            </AppLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
