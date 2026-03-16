const clientActionFallbackStore = new Map<string, unknown>();

function createSubmissionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function saveClientActionFallback(payload: unknown): string {
  const submissionId = createSubmissionId();
  clientActionFallbackStore.set(submissionId, payload);
  return submissionId;
}

export function takeClientActionFallback(submissionId: string): unknown {
  const payload = clientActionFallbackStore.get(submissionId);
  clientActionFallbackStore.delete(submissionId);
  return payload ?? null;
}
