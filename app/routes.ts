import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  route(
    '.well-known/appspecific/com.chrome.devtools.json',
    'routes/well-known.appspecific.devtools.ts',
  ),
  layout('routes/site-layout.tsx', [
    index('routes/home.tsx'),
    route('merge', 'tools/merge/route.tsx'),
    route('crop', 'tools/crop/route.tsx'),
    route('organize', 'tools/organize/route.tsx'),
    route('image-to-pdf', 'tools/image-to-pdf/route.tsx'),
    route('pdf-to-images', 'tools/pdf-to-images/route.tsx'),
    route('info', 'tools/info/route.tsx'),
    route('privacy', 'routes/privacy.tsx'),
    route('terms', 'routes/terms.tsx'),
    route('*', 'routes/catchall.tsx'),
  ]),
] satisfies RouteConfig;
