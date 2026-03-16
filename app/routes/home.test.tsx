import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Header } from '~/components/layout/header';
import HomeRoute from '~/routes/home';

function renderWithRoot(
  element: ReactNode,
  resolvedTheme: 'light' | 'dark' = 'light',
) {
  document.documentElement.setAttribute('data-theme-preference', resolvedTheme);
  document.documentElement.setAttribute('data-resolved-theme', resolvedTheme);

  const router = createMemoryRouter(
    [
      {
        id: 'root',
        path: '/',
        loader: () => ({
          preference: resolvedTheme,
          resolvedTheme,
        }),
        element,
      },
    ],
    { initialEntries: ['/'] },
  );

  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme-preference');
  document.documentElement.removeAttribute('data-resolved-theme');
});

describe('home route branding', () => {
  it('renders one hero image', async () => {
    const { container } = renderWithRoot(<HomeRoute />, 'light');

    const heroImage = await screen.findByRole('img', {
      name: 'InlinePDF logo',
    });
    const renderedImages = container.querySelectorAll('picture img');

    expect(renderedImages).toHaveLength(1);
    expect(heroImage).toHaveAttribute('src');
    expect(heroImage.getAttribute('src')).toContain('hero-logo-');
  });
});

describe('header branding', () => {
  it('renders one header logo image for the resolved theme', async () => {
    const { container } = renderWithRoot(<Header />, 'dark');
    await screen.findByText('InlinePDF');

    const headerImage = container.querySelector('picture img');

    expect(headerImage).not.toBeNull();
    expect(container.querySelectorAll('picture img')).toHaveLength(1);
    expect(headerImage?.getAttribute('src')).toContain('header-logo-');
    expect(headerImage).toHaveAttribute('width', '40');
    expect(headerImage).toHaveAttribute('height', '40');
  });
});
