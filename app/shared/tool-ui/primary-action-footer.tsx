import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';

interface PrimaryActionFooterProps {
  actionLabel: string;
  busyLabel: string;
  disabled?: boolean;
  isBusy?: boolean;
  progressText?: string;
  onAction: () => Promise<void>;
}

export function PrimaryActionFooter({
  actionLabel,
  busyLabel,
  disabled = false,
  isBusy = false,
  progressText,
  onAction,
}: PrimaryActionFooterProps) {
  return (
    <div className="space-y-3">
      <Button
        disabled={disabled || isBusy}
        onClick={() => {
          void onAction();
        }}
      >
        {isBusy ? <Spinner data-icon="inline-start" /> : null}
        {isBusy ? busyLabel : actionLabel}
      </Button>
      {progressText ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {progressText}
        </p>
      ) : null}
    </div>
  );
}
