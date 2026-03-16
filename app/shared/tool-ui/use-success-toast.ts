import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function useSuccessToast(message: string | null | undefined) {
  const previousMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (message && message !== previousMessageRef.current) {
      toast.success(message);
    }

    previousMessageRef.current = message ?? null;
  }, [message]);
}
