# InlinePDF

InlinePDF is a local-first PDF toolkit and iLovePDF alternative.

## Core Product Rules

- All PDF processing runs client-side in the browser.
- No file uploads.
- No server-side PDF processing.
- No authentication, database, or user accounts.
- Features are shipped only when they can run fully local-first.

## Current Pages

- `/` Home (Header + Hero + Footer)
- `/merge` Merge PDF
- `/crop` Crop PDF
- `/organize` Organize PDF
- `/image-to-pdf` Image to PDF
- `/pdf-to-images` PDF to Images
- `/info` PDF Info

## Tech Stack

- React Router + Vite + TypeScript
- Tailwind CSS + shadcn component primitives
- PDF-Lib for merge processing
- PDF.js adapter scaffold for future local-first tooling
- Cloudflare Workers deployment target

## Folder Architecture

- `app/components/layout/*` shared shell (`SiteHeader`, `SiteFooter`, `SiteShell`)
- `app/components/ui/*` shadcn/base-ui primitives
- `app/shared/navigation/*` header and mobile navigation built from tool definitions
- `app/shared/tool-ui/*` reusable workspace UI and action helpers
- `app/platform/files/*` file validation, form parsing, client fallbacks, downloads
- `app/platform/pdf/*` low-level PDF infrastructure (`pdf-lib`, `pdfjs`)
- `app/tools/catalog/*` implemented tool definitions used by home and nav
- `app/tools/<tool>/*` vertical slices owning route, screen, models, and use-cases
- `app/routes.ts` top-level route composition
- `assets/branding/source/*` design-source icon files (not served at runtime)
- `public/icons/*` runtime-served app icons, favicons, and hero logos

## Local Development

```bash
pnpm install
pnpm run dev
```

## Quality Gates

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run test
```

## Local Release Readiness

```bash
pnpm run verify
```

This runs the full local release gate sequence (lint, typecheck, tests, and build)
without deploying.

## Security Hygiene

```bash
pnpm run security:deps
```

- Keep the `pnpm-lock.yaml` file committed and review dependency changes before merging.
- Prefer self-hosted runtime assets over CDN script tags.
- Do not add third-party tag-manager or analytics scripts that execute with app-origin privileges.

## Adding New Tools

1. Create a slice under `app/tools/<tool-name>/` with `definition.ts`, `route.tsx`, `screen.tsx`, and explicit `use-cases/*`.
2. Add the tool definition to `app/tools/catalog/definitions.ts`.
3. Map the route in `app/routes.ts` using a top-level path like `/merge` or `/crop`.
4. Reuse `app/shared/tool-ui/*` and `app/components/ui/*` only when the behavior is truly shared.
5. Keep processing local-only. If a tool is not ready, do not add it to the implemented tool catalog.
