import { Button } from '~/components/ui/button';

interface PrimaryActionFooterProps {
  actionLabel: string;
  busyLabel: string;
  disabled?: boolean;
  isBusy?: boolean;
  helperText?: string;
  progressText?: string;
  onAction: () => Promise<void>;
}

export function PrimaryActionFooter({
  actionLabel,
  busyLabel,
  disabled = false,
  isBusy = false,
  helperText,
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
        {isBusy ? busyLabel : actionLabel}
      </Button>
      {progressText ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {progressText}
        </p>
      ) : null}
      {helperText ? <p className="text-sm text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
