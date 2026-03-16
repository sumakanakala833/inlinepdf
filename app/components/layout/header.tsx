import { Link } from 'react-router';

import { ThemedBrandImage } from '~/components/branding/themed-brand-image';
import { SiteNavigation } from '~/shared/navigation/site-navigation';

import { ThemePicker } from './theme-picker';
import { containerClassName } from './container';

export function Header() {
  return (
    <header className="sticky inset-x-0 top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div
        className={`${containerClassName} flex min-w-0 items-center justify-between gap-3 py-4`}
      >
        <div className="flex min-w-0 items-center gap-5">
          <Link to="/" className="inline-flex items-center gap-2 tracking-tight">
            <ThemedBrandImage
              alt=""
              className="size-10 rounded-md"
              loading="eager"
              variant="header"
            />
            <span className="text-xl font-medium">InlinePDF</span>
          </Link>
          <SiteNavigation />
        </div>
        <ThemePicker />
      </div>
    </header>
  );
}
