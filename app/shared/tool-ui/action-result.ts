export interface ToolActionSuccess<TResult = undefined> {
  ok: true;
  message: string;
  result?: TResult;
}

export interface ToolActionFailure {
  ok: false;
  message: string;
}

export type ToolActionResult<TResult = undefined> =
  | ToolActionSuccess<TResult>
  | ToolActionFailure;

export function getActionErrorMessage(
  error: unknown,
  fallback: string,
): ToolActionFailure {
  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback,
  };
}
