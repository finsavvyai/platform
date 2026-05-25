/**
 * Security Validation — utility functions
 */

export function escapeHTML(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function escapeSQL(unsafe: string): string {
  return unsafe.replace(/'/g, "''");
}

export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

export function validatePasswordStrength(password: string): { valid: boolean; score: number; feedback: string[] } {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) { score += 20; } else { feedback.push('Password must be at least 8 characters'); }
  if (password.length >= 12) { score += 10; }
  if (/[a-z]/.test(password)) { score += 15; } else { feedback.push('Password must contain lowercase letters'); }
  if (/[A-Z]/.test(password)) { score += 15; } else { feedback.push('Password must contain uppercase letters'); }
  if (/[0-9]/.test(password)) { score += 15; } else { feedback.push('Password must contain numbers'); }
  if (/[^a-zA-Z0-9]/.test(password)) { score += 15; } else { feedback.push('Password must contain special characters'); }

  const commonPasswords = ['password', '123456', 'qwerty', 'abc123'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    score -= 50;
    feedback.push('Password is too common');
  }

  return { valid: score >= 60, score: Math.max(0, score), feedback };
}

export function generateSecureToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint32Array(length);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(randomValues);
    return Array.from({ length }, (_, i) => chars[randomValues[i] % chars.length]).join('');
  }
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isSafeForRendering(content: string): boolean {
  return !/<script/i.test(content) && !/javascript:/i.test(content) && !/\son\w+\s*=/i.test(content);
}

export function truncateString(str: string, maxLength: number): string {
  return str.length <= maxLength ? str : str.slice(0, maxLength - 3) + '...';
}

export function validateAndSanitize(input: string, options: { maxLength?: number; allowHTML?: boolean; allowSQL?: boolean } = {}): { valid: boolean; sanitized: string; errors: string[] } {
  const errors: string[] = [];
  let sanitized = input.trim();

  if (options.maxLength && sanitized.length > options.maxLength) {
    errors.push(`Input exceeds maximum length of ${options.maxLength}`);
    sanitized = truncateString(sanitized, options.maxLength);
  }
  if (!options.allowHTML) sanitized = escapeHTML(sanitized);
  if (!options.allowSQL) sanitized = escapeSQL(sanitized);
  sanitized = sanitized.replace(/\0/g, '');

  return { valid: errors.length === 0, sanitized, errors };
}
