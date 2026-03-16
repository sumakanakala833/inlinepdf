import { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router';

import { themedBrandingAssets } from '~/lib/branding';
import {
  readThemeStateFromDocument,
  subscribeToThemeChanges,
  type ResolvedTheme,
} from '~/lib/theme';
import type { loader as rootLoader } from '~/root';

type BrandImageVariant = 'header' | 'hero';

export function ThemedBrandImage({
  alt,
  className,
  fetchPriority,
  loading,
  variant,
}: {
  alt: string;
  className?: string;
  fetchPriority?: 'auto' | 'high' | 'low';
  loading?: 'eager' | 'lazy';
  variant: BrandImageVariant;
}) {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === 'undefined') {
      return rootData?.resolvedTheme ?? 'light';
    }

    if (document.documentElement.hasAttribute('data-resolved-theme')) {
      return readThemeStateFromDocument().resolvedTheme;
    }

    return rootData?.resolvedTheme ?? 'light';
  });

  useEffect(() => {
    return subscribeToThemeChanges(({ resolvedTheme: nextResolvedTheme }) => {
      setResolvedTheme((currentTheme) =>
        currentTheme === nextResolvedTheme ? currentTheme : nextResolvedTheme,
      );
    });
  }, []);

  const assets = themedBrandingAssets[resolvedTheme][variant];

  return (
    <picture>
      <source
        srcSet={assets.webpSrcSet}
        sizes={assets.sizes}
        type="image/webp"
      />
      <img
        src={assets.fallbackSrc}
        srcSet={assets.fallbackSrcSet}
        sizes={assets.sizes}
        width={assets.width}
        height={assets.height}
        alt={alt}
        className={className}
        decoding="async"
        fetchPriority={fetchPriority}
        loading={loading}
      />
    </picture>
  );
}
