/**
 * Escape SQL LIKE wildcard characters in user input.
 *
 * Prevents wildcard injection where `%` and `_` in untrusted strings
 * are interpreted as LIKE metacharacters, allowing record enumeration.
 *
 * @param value - Raw user input string
 * @returns Escaped string safe for use inside LIKE patterns
 */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}
