import type { Route } from './+types/terms';

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Terms | InlinePDF' }];
};

export default function TermsRoute() {
  return <section />;
}
