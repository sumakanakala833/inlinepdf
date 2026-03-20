import { useCallback } from 'react';
import {
  useNavigate,
  type NavigateFunction,
  type NavigateOptions,
  type To,
} from 'react-router';

export function useAppNavigate(): NavigateFunction {
  const navigate = useNavigate();

  return useCallback<NavigateFunction>(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        return navigate(to);
      }

      return navigate(to, {
        viewTransition: true,
        ...options,
      });
    },
    [navigate],
  );
}
