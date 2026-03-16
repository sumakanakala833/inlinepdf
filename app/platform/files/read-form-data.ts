function isFileLike(value: unknown): value is File {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<File>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.arrayBuffer === 'function'
  );
}

export function getFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return isFileLike(value) ? value : null;
}

export function getFiles(formData: FormData, key: string): File[] {
  return formData.getAll(key).filter((value): value is File => isFileLike(value));
}

export function getString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' ? value : null;
}

export function getJson(formData: FormData, key: string): unknown {
  const value = getString(formData, key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
