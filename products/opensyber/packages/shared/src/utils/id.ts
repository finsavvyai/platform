/**
 * Generate a nanoid-style unique ID
 * Uses crypto.randomUUID for simplicity, can switch to nanoid if needed
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a short, URL-friendly ID for instances
 */
export function generateShortId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}
