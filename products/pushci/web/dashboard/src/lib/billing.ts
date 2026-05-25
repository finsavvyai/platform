export function sanitizePromo(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
}

export const PROMO_MAX_LENGTH = 32;
