import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';

interface ToolWorkspaceProps {
  title: string;
  description: string;
  titleIcon?: unknown;
  inputPanel?: React.ReactNode;
  inputPanelClassName?: string;
  optionsPanel?: React.ReactNode;
  inputOptionsLayoutClassName?: string;
  actionBar?: React.ReactNode;
  outputPanel?: React.ReactNode;
  errorMessage?: string | null;
}

export function ToolWorkspace({
  title,
  description,
  inputPanel,
  inputPanelClassName,
  optionsPanel,
  inputOptionsLayoutClassName,
  actionBar,
  outputPanel,
  errorMessage,
}: ToolWorkspaceProps) {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <div>
          <h1 className="scroll-m-20 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
        </div>
        <p className="text-lg text-muted-foreground">{description}</p>
      </header>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to complete action</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {inputPanel && optionsPanel ? (
        <section className={inputOptionsLayoutClassName ?? 'space-y-6'}>
          <div className={inputPanelClassName ?? 'space-y-3'}>{inputPanel}</div>
          <div className="space-y-3">{optionsPanel}</div>
        </section>
      ) : null}
      {inputPanel && !optionsPanel ? (
        <section className={inputPanelClassName ?? 'space-y-3'}>
          {inputPanel}
        </section>
      ) : null}
      {optionsPanel && !inputPanel ? (
        <section className="space-y-3">{optionsPanel}</section>
      ) : null}
      {actionBar ? <section className="space-y-3">{actionBar}</section> : null}
      {outputPanel ? (
        <section className="space-y-3">{outputPanel}</section>
      ) : null}
    </section>
  );
}
