/**
 * Generate a new TokenForge API key.
 * Format: tf_ + 32 random hex chars = 35 chars total.
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `tf_${hex}`;
}

/**
 * Extract the prefix from an API key for display (first 8 chars after tf_).
 * Example: "tf_abc12345..." -> "tf_abc1...".
 */
export function extractKeyPrefix(key: string): string {
  return key.slice(0, 8) + '...';
}
