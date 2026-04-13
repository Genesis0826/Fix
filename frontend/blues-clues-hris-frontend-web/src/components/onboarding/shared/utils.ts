export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export function validateFile(
  file: File,
  allowedTypes: Set<string>,
  allowedTypesError: string,
  maxSize = 10 * 1024 * 1024
): string | null {
  if (file.size > maxSize) {
    return `File size exceeds 10MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`;
  }
  if (!allowedTypes.has(file.type)) {
    return allowedTypesError;
  }
  return null;
}
