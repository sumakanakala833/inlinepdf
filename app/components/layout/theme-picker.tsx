import { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router';

import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import {
  applyThemePreference,
  readThemeStateFromDocument,
  setThemePreference,
  subscribeToThemeChanges,
  subscribeToSystemThemeChanges,
  themePreferences,
  type ThemePreference,
} from '~/lib/theme';
import type { loader as rootLoader } from '~/root';

const themeOptionLabels: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  auto: 'Auto',
};

export function ThemePicker() {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') {
      return rootData?.preference ?? 'auto';
    }

    if (document.documentElement.hasAttribute('data-theme-preference')) {
      return readThemeStateFromDocument().preference;
    }

    return rootData?.preference ?? 'auto';
  });

  useEffect(() => {
    applyThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    return subscribeToSystemThemeChanges(() => {
      if (theme === 'auto') {
        applyThemePreference('auto');
      }
    });
  }, [theme]);

  useEffect(() => {
    return subscribeToThemeChanges(({ preference }) => {
      setTheme((currentTheme) =>
        currentTheme === preference ? currentTheme : preference,
      );
    });
  }, []);

  function handleThemeSelect(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    setThemePreference(nextTheme);
  }

  return (
    <ToggleGroup
      aria-label="Theme preference"
      value={[theme]}
      onValueChange={(nextValue) => {
        const nextTheme = nextValue[0];
        if (
          nextTheme &&
          themePreferences.includes(nextTheme as ThemePreference)
        ) {
          handleThemeSelect(nextTheme as ThemePreference);
        }
      }}
      variant="outline"
      size="sm"
      spacing={0}
      className="rounded-md border border-input bg-background/50 p-0.5 supports-[backdrop-filter]:bg-background/40"
    >
      {themePreferences.map((value) => (
        <ToggleGroupItem key={value} value={value}>
          {themeOptionLabels[value]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
