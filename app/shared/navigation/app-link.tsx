import { forwardRef } from 'react';
import {
  Form,
  Link,
  NavLink,
} from 'react-router';

type AppLinkProps = React.ComponentPropsWithoutRef<typeof Link>;
type AppNavLinkProps = React.ComponentPropsWithoutRef<typeof NavLink>;

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  function AppLink({ viewTransition = true, ...props }, ref) {
    return <Link ref={ref} viewTransition={viewTransition} {...props} />;
  },
);

AppLink.displayName = 'AppLink';

export const AppNavLink = forwardRef<HTMLAnchorElement, AppNavLinkProps>(
  function AppNavLink({ viewTransition = true, ...props }, ref) {
    return <NavLink ref={ref} viewTransition={viewTransition} {...props} />;
  },
);

AppNavLink.displayName = 'AppNavLink';

type AppFormProps = React.ComponentPropsWithoutRef<typeof Form>;

export const AppForm = forwardRef<HTMLFormElement, AppFormProps>(
  function AppForm({ viewTransition = true, ...props }, ref) {
    return <Form ref={ref} viewTransition={viewTransition} {...props} />;
  },
);

AppForm.displayName = 'AppForm';
