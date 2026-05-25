// File validation constants and helpers for uploads

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'text/html',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'audio/mpeg',
  'video/mp4'
];

/**
 * Validate a file for upload against size and type constraints.
 */
export function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error(`File type ${file.type} is not supported`);
  }
}

/**
 * Calculate upload speed (placeholder for time-tracking implementation).
 */
export function calculateUploadSpeed(
  _progressEvent: { loaded: number; total: number }
): number {
  return 0;
}

/**
 * Calculate time remaining (placeholder for time-tracking implementation).
 */
export function calculateTimeRemaining(
  _progressEvent: { loaded: number; total: number }
): number {
  return 0;
}
