import type { Route } from './+types/privacy';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Privacy | InlinePDF' }];
};

export default function PrivacyRoute() {
  return <section />;
}
