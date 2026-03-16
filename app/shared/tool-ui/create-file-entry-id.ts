export function createFileEntryId(file: File): string {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${file.name}-${String(file.size)}-${String(Date.now())}`;
}
